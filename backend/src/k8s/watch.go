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
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/watch"
	"k8s.io/client-go/dynamic"
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
	client        *kubernetes.Clientset
	dynamicClient dynamic.Interface
	ws            *websocket.Conn
	done          chan struct{}
	eventChan     chan WatchEvent
	wg            sync.WaitGroup
	// Deduplication: track last sent state per resource to skip no-op MODIFIED events
	lastSent   map[string]string // resourceUID -> "status|health"
	lastSentMu sync.RWMutex
}

func NewWatchManager(client *kubernetes.Clientset, dynamicClient dynamic.Interface, ws *websocket.Conn) *WatchManager {
	return &WatchManager{
		client:        client,
		dynamicClient: dynamicClient,
		ws:            ws,
		done:          make(chan struct{}),
		eventChan:     make(chan WatchEvent, 100),
		lastSent:      make(map[string]string),
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
	// ArgoCD Applications (CRD) - watch if available
	if wm.dynamicClient != nil {
		wm.watchCRD("applications", "argoproj.io", "v1alpha1", "Application")
	}
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

// watchCRD watches a Custom Resource Definition using the dynamic client
func (wm *WatchManager) watchCRD(resource, group, version, kind string) {
	if wm.dynamicClient == nil {
		return
	}

	wm.wg.Add(1)
	go func() {
		defer wm.wg.Done()

		gvr := schema.GroupVersionResource{
			Group:    group,
			Version:  version,
			Resource: resource,
		}

		for {
			select {
			case <-wm.done:
				return
			default:
			}

			ctx := context.Background()
			listOpts := metav1.ListOptions{}

			watcher, err := wm.dynamicClient.Resource(gvr).Namespace("").Watch(ctx, listOpts)
			if err != nil {
				// CRD might not exist, just retry less frequently
				log.Printf("Failed to watch CRD %s.%s: %v. Retrying in 30s...", resource, group, err)
				select {
				case <-wm.done:
					return
				case <-time.After(30 * time.Second):
					continue
				}
			}

			wm.handleDynamicWatchStream(watcher, kind)

			select {
			case <-wm.done:
				return
			case <-time.After(1 * time.Second):
				// Reconnect
			}
		}
	}()
}

// handleDynamicWatchStream processes events from a dynamic (CRD) watcher
func (wm *WatchManager) handleDynamicWatchStream(watcher watch.Interface, kind string) {
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
				return
			}
			if event.Type == watch.Error {
				log.Printf("Watch error for CRD %s: %v", kind, event.Object)
				return
			}

			unstructuredObj, ok := event.Object.(*unstructured.Unstructured)
			if !ok {
				continue
			}

			simpleObj := wm.simplifyCRDObject(unstructuredObj, kind)
			if simpleObj == nil {
				continue
			}

			// Deduplication for CRD events
			if event.Type == watch.Modified {
				objMap, ok := simpleObj.(map[string]interface{})
				if ok {
					uid, _ := objMap["id"].(string)
					status, _ := objMap["status"].(string)
					health, _ := objMap["health"].(string)
					stateKey := status + "|" + health

					wm.lastSentMu.RLock()
					lastState := wm.lastSent[uid]
					wm.lastSentMu.RUnlock()

					if lastState == stateKey {
						continue
					}

					wm.lastSentMu.Lock()
					wm.lastSent[uid] = stateKey
					wm.lastSentMu.Unlock()
				}
			} else if event.Type == watch.Deleted {
				objMap, ok := simpleObj.(map[string]interface{})
				if ok {
					uid, _ := objMap["id"].(string)
					wm.lastSentMu.Lock()
					delete(wm.lastSent, uid)
					wm.lastSentMu.Unlock()
				}
			}

			select {
			case wm.eventChan <- WatchEvent{Type: string(event.Type), Kind: kind, Resource: simpleObj}:
			case <-wm.done:
				return
			}
		}
	}
}

// simplifyCRDObject converts an unstructured CRD object to a simple map for the frontend
func (wm *WatchManager) simplifyCRDObject(obj *unstructured.Unstructured, kind string) interface{} {
	metadata := obj.Object["metadata"].(map[string]interface{})

	uid := getNestedString(metadata, "uid")
	name := getNestedString(metadata, "name")
	namespace := getNestedString(metadata, "namespace")
	creationTimestamp := getNestedString(metadata, "creationTimestamp")
	labels, _ := metadata["labels"].(map[string]interface{})

	// Convert labels to string map
	labelsMap := make(map[string]string)
	for k, v := range labels {
		if vs, ok := v.(string); ok {
			labelsMap[k] = vs
		}
	}

	// Get owner references
	ownerRefs := make([]string, 0)
	if refs, ok := metadata["ownerReferences"].([]interface{}); ok {
		for _, ref := range refs {
			if refMap, ok := ref.(map[string]interface{}); ok {
				if refUID, ok := refMap["uid"].(string); ok {
					ownerRefs = append(ownerRefs, refUID)
				}
			}
		}
	}

	// Determine status based on kind
	status := "Unknown"
	health := "ok"

	if kind == "Application" {
		// ArgoCD Application specific status
		statusObj, _ := obj.Object["status"].(map[string]interface{})
		if statusObj != nil {
			// Sync status
			if sync, ok := statusObj["sync"].(map[string]interface{}); ok {
				if syncStatus, ok := sync["status"].(string); ok {
					status = syncStatus
				}
			}
			// Health status
			if healthObj, ok := statusObj["health"].(map[string]interface{}); ok {
				if healthStatus, ok := healthObj["status"].(string); ok {
					switch healthStatus {
					case "Degraded", "Missing":
						health = "error"
					case "Progressing", "Suspended":
						health = "warning"
					case "Healthy":
						health = "ok"
					default:
						health = "warning"
					}
				}
			}
		}
	}

	result := map[string]interface{}{
		"id":                uid,
		"name":              name,
		"namespace":         namespace,
		"kind":              kind,
		"status":            status,
		"health":            health,
		"labels":            labelsMap,
		"ownerRefs":         ownerRefs,
		"creationTimestamp": creationTimestamp,
	}

	return result
}

// getNestedString safely gets a string from a nested map
func getNestedString(obj map[string]interface{}, keys ...string) string {
	current := obj
	for i, key := range keys {
		if i == len(keys)-1 {
			if val, ok := current[key].(string); ok {
				return val
			}
			return ""
		}
		if next, ok := current[key].(map[string]interface{}); ok {
			current = next
		} else {
			return ""
		}
	}
	return ""
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
				return
			}
			if event.Type == watch.Error {
				log.Printf("Watch error for %s: %v", kind, event.Object)
				return
			}
			simpleObj := wm.simplifyObject(event.Object)
			if simpleObj == nil {
				continue
			}

			// Deduplication: for MODIFIED events, skip if nothing meaningful changed
			if event.Type == watch.Modified {
				objMap, ok := simpleObj.(map[string]interface{})
				if ok {
					uid, _ := objMap["id"].(string)
					status, _ := objMap["status"].(string)
					health, _ := objMap["health"].(string)
					stateKey := status + "|" + health

					wm.lastSentMu.RLock()
					lastState := wm.lastSent[uid]
					wm.lastSentMu.RUnlock()

					if lastState == stateKey {
						// State hasn't changed, skip this MODIFIED event
						continue
					}

					// Update last sent state
					wm.lastSentMu.Lock()
					wm.lastSent[uid] = stateKey
					wm.lastSentMu.Unlock()
				}
			} else if event.Type == watch.Deleted {
				// Clean up tracking on delete
				objMap, ok := simpleObj.(map[string]interface{})
				if ok {
					uid, _ := objMap["id"].(string)
					wm.lastSentMu.Lock()
					delete(wm.lastSent, uid)
					wm.lastSentMu.Unlock()
				}
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

	// Create dynamic client for CRD watching
	dynamicClient, err := dynamic.NewForConfig(config)
	if err != nil {
		log.Printf("Failed to create dynamic client: %v (CRD watching disabled)", err)
		// Don't fail, just continue without dynamic client
	}

	ws, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("Watch upgrade error:", err)
		return
	}
	defer ws.Close()

	manager := NewWatchManager(clientset, dynamicClient, ws)
	manager.Start()
	defer manager.Stop()

	for {
		if _, _, err := ws.NextReader(); err != nil {
			break
		}
	}
}
