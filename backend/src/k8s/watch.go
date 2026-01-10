package k8s

import (
	"context"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/watch"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
)

// WatchEvent is what we send to the frontend
type WatchEvent struct {
	Type     string      `json:"type"` // ADDED, MODIFIED, DELETED
	Kind     string      `json:"kind"`
	Resource interface{} `json:"resource"`
}

// WatchManager handles the lifecycle of watchers for a single connection
type WatchManager struct {
	client    *kubernetes.Clientset
	ws        *websocket.Conn
	done      chan struct{}
	eventChan chan WatchEvent
	wg        sync.WaitGroup
}

func NewWatchManager(client *kubernetes.Clientset, ws *websocket.Conn) *WatchManager {
	return &WatchManager{
		client:    client,
		ws:        ws,
		done:      make(chan struct{}),
		eventChan: make(chan WatchEvent, 100),
	}
}

func (wm *WatchManager) Start() {
	wm.watchResource("pods")
	wm.watchResource("nodes")
	wm.watchResource("services")
	wm.watchResource("deployments")
	wm.watchResource("statefulsets")
	wm.watchResource("daemonsets")
	wm.watchResource("replicasets")
	wm.watchResource("ingresses")
	go wm.sendLoop()
}

func (wm *WatchManager) Stop() {
	close(wm.done)
	wm.wg.Wait()
}

func (wm *WatchManager) sendLoop() {
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-wm.done:
			return
		case evt := <-wm.eventChan:
			if err := wm.ws.WriteJSON(evt); err != nil {
				log.Println("Watch WS write error:", err)
				return
			}
		case <-ticker.C:
			if err := wm.ws.WriteMessage(websocket.PingMessage, []byte{}); err != nil {
				return
			}
		}
	}
}

func (wm *WatchManager) watchResource(resource string) {
	wm.wg.Add(1)
	go func() {
		defer wm.wg.Done()
		for {
			select {
			case <-wm.done:
				return
			default:
			}

			var watcher watch.Interface
			var err error
			var kind string
			ctx := context.Background()

			// Add timeout to list options to avoid hanging indefinitely if watch fails silently
			// but more importantly, let's use a retry backoff in the loop
			listOpts := metav1.ListOptions{
				// TimeoutSeconds: int64ptr(30), // Optional: timeout for the list request
			}

			switch resource {
			case "pods":
				kind = "Pod"
				watcher, err = wm.client.CoreV1().Pods("").Watch(ctx, listOpts)
			case "nodes":
				kind = "Node"
				watcher, err = wm.client.CoreV1().Nodes().Watch(ctx, listOpts)
			case "services":
				kind = "Service"
				watcher, err = wm.client.CoreV1().Services("").Watch(ctx, listOpts)
			case "deployments":
				kind = "Deployment"
				watcher, err = wm.client.AppsV1().Deployments("").Watch(ctx, listOpts)
			case "statefulsets":
				kind = "StatefulSet"
				watcher, err = wm.client.AppsV1().StatefulSets("").Watch(ctx, listOpts)
			case "daemonsets":
				kind = "DaemonSet"
				watcher, err = wm.client.AppsV1().DaemonSets("").Watch(ctx, listOpts)
			case "replicasets":
				kind = "ReplicaSet"
				watcher, err = wm.client.AppsV1().ReplicaSets("").Watch(ctx, listOpts)
			}

			if err != nil {
				log.Printf("Failed to watch %s: %v. Retrying in 5s...", resource, err)
				
				// Check for done before sleeping
				select {
				case <-wm.done:
					return
				case <-time.After(5 * time.Second):
					continue
				}
			}
			wm.handleWatchStream(watcher, kind)
			
			// If handleWatchStream returns, it means the watcher closed. 
			// We should wait a bit before reconnecting to avoid tight loops on error.
			select {
			case <-wm.done:
				return
			case <-time.After(1 * time.Second):
				// Reconnect
			}
		}
	}()
}

func (wm *WatchManager) handleWatchStream(watcher watch.Interface, kind string) {
	if watcher == nil {
		return
	}
	defer watcher.Stop()

	ch := watcher.ResultChan()
	for {
		select {
		case <-wm.done:
			return
		case event, ok := <-ch:
			if !ok {
				// Channel closed
				return
			}
			if event.Type == watch.Error {
				log.Printf("Watch error for %s: %v", kind, event.Object)
				// Don't return immediately on error event, but maybe log it?
				// Usually Error event means we need to restart watch (e.g. resource version too old)
				return 
			}
			simpleObj := wm.simplifyObject(event.Object)
			if simpleObj == nil {
				continue
			}
			select {
			case wm.eventChan <- WatchEvent{Type: string(event.Type), Kind: kind, Resource: simpleObj}:
			case <-wm.done:
				return
			}
		}
	}
}

func (wm *WatchManager) simplifyObject(obj interface{}) interface{} {
	var meta metav1.Object
	var status string
	var kind string
	var health string = "ok"

	switch o := obj.(type) {
	case *corev1.Pod:
		meta = o
		kind = "Pod"
		status = string(o.Status.Phase)
		
		// Calculate Health
		if o.Status.Phase == corev1.PodFailed {
			health = "error"
		} else if o.Status.Phase == corev1.PodPending {
			health = "warning"
		} else if o.Status.Phase == corev1.PodRunning {
			// Check readiness
			isReady := false
			for _, c := range o.Status.Conditions {
				if c.Type == corev1.PodReady && c.Status == corev1.ConditionTrue {
					isReady = true
					break
				}
			}
			if !isReady {
				health = "warning"
			}

			// Check detailed container statuses for errors
			for _, cs := range o.Status.ContainerStatuses {
				if cs.State.Waiting != nil && cs.State.Waiting.Reason != "" {
					// e.g. ImagePullBackOff, CrashLoopBackOff, ImageInspectError
					health = "error"
				}
				if cs.State.Terminated != nil && cs.State.Terminated.ExitCode != 0 {
					health = "error"
				}
			}
		}

	case *corev1.Node:
		meta = o
		kind = "Node"
		status = "NotReady"
		health = "warning"
		for _, cond := range o.Status.Conditions {
			if cond.Type == corev1.NodeReady && cond.Status == corev1.ConditionTrue {
				status = "Ready"
				health = "ok"
				break
			}
		}
	case *corev1.Service:
		meta = o
		kind = "Service"
		status = "Active"
	case *appsv1.Deployment:
		meta = o
		kind = "Deployment"
		if o.Status.AvailableReplicas == o.Status.Replicas {
			status = "Available"
		} else {
			status = "Progressing"
			health = "warning"
		}
	case *appsv1.StatefulSet:
		meta = o
		kind = "StatefulSet"
		if o.Status.ReadyReplicas == o.Status.Replicas {
			status = "Ready"
		} else {
			status = "Progressing"
			health = "warning"
		}
	case *appsv1.DaemonSet:
		meta = o
		kind = "DaemonSet"
		if o.Status.NumberReady == o.Status.DesiredNumberScheduled {
			status = "Ready"
		} else {
			status = "Progressing"
			health = "warning"
		}
	case *appsv1.ReplicaSet:
		meta = o
		kind = "ReplicaSet"
		status = "Active"
	default:
		return nil
	}

	ownerRefs := make([]string, 0)
	for _, ref := range meta.GetOwnerReferences() {
		ownerRefs = append(ownerRefs, string(ref.UID))
	}

	extra := make(map[string]interface{})
	if pod, ok := obj.(*corev1.Pod); ok {
		if pod.Spec.NodeName != "" {
			extra["nodeName"] = pod.Spec.NodeName
		}
	}

	result := map[string]interface{}{
		"id":                string(meta.GetUID()),
		"name":              meta.GetName(),
		"namespace":         meta.GetNamespace(),
		"kind":              kind,
		"status":            status,
		"health":            health,
		"labels":            meta.GetLabels(),
		"ownerRefs":         ownerRefs,
		"creationTimestamp": meta.GetCreationTimestamp().Time,
	}

	for k, v := range extra {
		result[k] = v
	}

	return result
}

func HandleWatch(config *rest.Config, w http.ResponseWriter, r *http.Request) {
	clientset, err := kubernetes.NewForConfig(config)
	if err != nil {
		http.Error(w, "Failed to create client", http.StatusInternalServerError)
		return
	}

	ws, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("Watch upgrade error:", err)
		return
	}
	defer ws.Close()

	manager := NewWatchManager(clientset, ws)
	manager.Start()
	defer manager.Stop()

	for {
		if _, _, err := ws.NextReader(); err != nil {
			break
		}
	}
}
