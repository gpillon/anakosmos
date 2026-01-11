package k8s

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/gorilla/websocket"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/watch"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
)

// SingleResourceWatchEvent is what we send for a single resource watch (full object)
type SingleResourceWatchEvent struct {
	Type     string      `json:"type"` // ADDED, MODIFIED, DELETED
	Resource interface{} `json:"resource"` // Full K8s object
}

// SingleResourceWatcher watches a single resource and sends full updates
type SingleResourceWatcher struct {
	client    *kubernetes.Clientset
	ws        *websocket.Conn
	done      chan struct{}
	kind      string
	namespace string
	name      string
}

func NewSingleResourceWatcher(client *kubernetes.Clientset, ws *websocket.Conn, kind, namespace, name string) *SingleResourceWatcher {
	return &SingleResourceWatcher{
		client:    client,
		ws:        ws,
		done:      make(chan struct{}),
		kind:      kind,
		namespace: namespace,
		name:      name,
	}
}

func (sw *SingleResourceWatcher) Start() {
	go sw.watchLoop()
}

func (sw *SingleResourceWatcher) Stop() {
	close(sw.done)
}

func (sw *SingleResourceWatcher) watchLoop() {
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-sw.done:
			return
		default:
		}

		var watcher watch.Interface
		var err error
		ctx := context.Background()

		// Field selector to watch only this specific resource
		fieldSelector := "metadata.name=" + sw.name
		listOpts := metav1.ListOptions{
			FieldSelector: fieldSelector,
		}

		kindLower := strings.ToLower(sw.kind)

		switch kindLower {
		case "pod":
			watcher, err = sw.client.CoreV1().Pods(sw.namespace).Watch(ctx, listOpts)
		case "node":
			watcher, err = sw.client.CoreV1().Nodes().Watch(ctx, listOpts)
		case "service":
			watcher, err = sw.client.CoreV1().Services(sw.namespace).Watch(ctx, listOpts)
		case "deployment":
			watcher, err = sw.client.AppsV1().Deployments(sw.namespace).Watch(ctx, listOpts)
		case "statefulset":
			watcher, err = sw.client.AppsV1().StatefulSets(sw.namespace).Watch(ctx, listOpts)
		case "daemonset":
			watcher, err = sw.client.AppsV1().DaemonSets(sw.namespace).Watch(ctx, listOpts)
		case "replicaset":
			watcher, err = sw.client.AppsV1().ReplicaSets(sw.namespace).Watch(ctx, listOpts)
		case "configmap":
			watcher, err = sw.client.CoreV1().ConfigMaps(sw.namespace).Watch(ctx, listOpts)
		case "secret":
			watcher, err = sw.client.CoreV1().Secrets(sw.namespace).Watch(ctx, listOpts)
		case "persistentvolumeclaim", "pvc":
			watcher, err = sw.client.CoreV1().PersistentVolumeClaims(sw.namespace).Watch(ctx, listOpts)
		case "ingress":
			watcher, err = sw.client.NetworkingV1().Ingresses(sw.namespace).Watch(ctx, listOpts)
		default:
			log.Printf("Unknown kind for single watch: %s", sw.kind)
			return
		}

		if err != nil {
			log.Printf("Failed to watch single resource %s/%s/%s: %v", sw.kind, sw.namespace, sw.name, err)
			select {
			case <-sw.done:
				return
			case <-time.After(5 * time.Second):
				continue
			}
		}

		sw.handleWatchStream(watcher)

		select {
		case <-sw.done:
			return
		case <-time.After(1 * time.Second):
			// Reconnect
		}
	}
}

func (sw *SingleResourceWatcher) handleWatchStream(watcher watch.Interface) {
	if watcher == nil {
		return
	}
	defer watcher.Stop()

	ch := watcher.ResultChan()
	pingTicker := time.NewTicker(5 * time.Second)
	defer pingTicker.Stop()

	for {
		select {
		case <-sw.done:
			return
		case <-pingTicker.C:
			if err := sw.ws.WriteMessage(websocket.PingMessage, []byte{}); err != nil {
				return
			}
		case event, ok := <-ch:
			if !ok {
				return
			}
			if event.Type == watch.Error {
				log.Printf("Single resource watch error: %v", event.Object)
				return
			}
			
			// Convert to JSON-friendly format (full object)
			// We need to convert the runtime.Object to a clean JSON representation
			objBytes, err := json.Marshal(event.Object)
			if err != nil {
				log.Printf("Failed to marshal watch object: %v", err)
				continue
			}

			var fullObj interface{}
			if err := json.Unmarshal(objBytes, &fullObj); err != nil {
				log.Printf("Failed to unmarshal watch object: %v", err)
				continue
			}

			evt := SingleResourceWatchEvent{
				Type:     string(event.Type),
				Resource: fullObj,
			}

			if err := sw.ws.WriteJSON(evt); err != nil {
				log.Println("Single watch WS write error:", err)
				return
			}
		}
	}
}

// HandleSingleWatch handles WebSocket connections for watching a single resource
func HandleSingleWatch(config *rest.Config, w http.ResponseWriter, r *http.Request) {
	kind := r.URL.Query().Get("kind")
	namespace := r.URL.Query().Get("namespace")
	name := r.URL.Query().Get("name")

	if kind == "" || name == "" {
		http.Error(w, "kind and name are required", http.StatusBadRequest)
		return
	}

	clientset, err := kubernetes.NewForConfig(config)
	if err != nil {
		http.Error(w, "Failed to create client", http.StatusInternalServerError)
		return
	}

	ws, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("Single watch upgrade error:", err)
		return
	}
	defer ws.Close()

	log.Printf("Starting single resource watch: %s/%s/%s", kind, namespace, name)

	watcher := NewSingleResourceWatcher(clientset, ws, kind, namespace, name)
	watcher.Start()
	defer watcher.Stop()

	// Keep connection open until client disconnects
	for {
		if _, _, err := ws.NextReader(); err != nil {
			break
		}
	}

	log.Printf("Single resource watch ended: %s/%s/%s", kind, namespace, name)
}
