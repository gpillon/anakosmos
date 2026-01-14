package k8s

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"sync"

	appsv1 "k8s.io/api/apps/v1"
	autoscalingv2 "k8s.io/api/autoscaling/v2"
	batchv1 "k8s.io/api/batch/v1"
	corev1 "k8s.io/api/core/v1"
	networkingv1 "k8s.io/api/networking/v1"
	storagev1 "k8s.io/api/storage/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
)

// LightResource is the lightweight resource format sent to frontend
type LightResource struct {
	ID                string            `json:"id"`
	Name              string            `json:"name"`
	Namespace         string            `json:"namespace"`
	Kind              string            `json:"kind"`
	Status            string            `json:"status"`
	Health            string            `json:"health,omitempty"`
	Labels            map[string]string `json:"labels"`
	OwnerRefs         []string          `json:"ownerRefs"`
	CreationTimestamp string            `json:"creationTimestamp"`
	// Extra fields needed for link calculation
	NodeName         string            `json:"nodeName,omitempty"`         // For Pods
	Selector         map[string]string `json:"selector,omitempty"`         // For Services, Deployments, etc.
	ScaleTargetRef   *ScaleTargetRef   `json:"scaleTargetRef,omitempty"`   // For HPAs
	StorageClassName string            `json:"storageClassName,omitempty"` // For PVCs
	IngressBackends  []IngressBackend  `json:"ingressBackends,omitempty"`  // For Ingresses
	Volumes          []VolumeRef       `json:"volumes,omitempty"`          // For Pods
	EnvRefs          []EnvRef          `json:"envRefs,omitempty"`          // For Pods (ConfigMap/Secret refs from env)
	HelmRelease      *HelmReleaseInfo  `json:"helmRelease,omitempty"`      // Helm management info
}

type ScaleTargetRef struct {
	Kind string `json:"kind"`
	Name string `json:"name"`
}

type IngressBackend struct {
	ServiceName string `json:"serviceName"`
}

type VolumeRef struct {
	Type string `json:"type"` // "configMap", "secret", "pvc"
	Name string `json:"name"`
}

type EnvRef struct {
	Type string `json:"type"` // "configMap", "secret"
	Name string `json:"name"`
}

type HelmReleaseInfo struct {
	ReleaseName      string `json:"releaseName"`
	ReleaseNamespace string `json:"releaseNamespace"`
	ChartName        string `json:"chartName,omitempty"`
	ChartVersion     string `json:"chartVersion,omitempty"`
	Revision         int    `json:"revision,omitempty"`
}

// ClusterLink represents a link between resources
type ClusterLink struct {
	Source string `json:"source"`
	Target string `json:"target"`
	Type   string `json:"type"` // "owner", "network", "config", "storage"
}

// InitResponse is the response for the /api/cluster/init endpoint
type InitResponse struct {
	Resources []LightResource `json:"resources"`
	Links     []ClusterLink   `json:"links"`
}

// HandleInit handles the /api/cluster/init endpoint
func HandleInit(config *rest.Config, w http.ResponseWriter, r *http.Request) {
	if config == nil {
		http.Error(w, "Kubernetes config not loaded", http.StatusServiceUnavailable)
		return
	}

	clientset, err := kubernetes.NewForConfig(config)
	if err != nil {
		http.Error(w, "Failed to create client", http.StatusInternalServerError)
		return
	}

	// Create dynamic client for CRD fetching
	dynamicClient, err := dynamic.NewForConfig(config)
	if err != nil {
		log.Printf("Failed to create dynamic client: %v (CRD fetching disabled)", err)
	}

	ctx := context.Background()

	// Fetch all resources in parallel
	var (
		nodes          *corev1.NodeList
		pods           *corev1.PodList
		services       *corev1.ServiceList
		deployments    *appsv1.DeploymentList
		statefulsets   *appsv1.StatefulSetList
		daemonsets     *appsv1.DaemonSetList
		replicasets    *appsv1.ReplicaSetList
		ingresses      *networkingv1.IngressList
		pvcs           *corev1.PersistentVolumeClaimList
		configmaps     *corev1.ConfigMapList
		secrets        *corev1.SecretList
		storageclasses *storagev1.StorageClassList
		jobs           *batchv1.JobList
		cronjobs       *batchv1.CronJobList
		hpas           *autoscalingv2.HorizontalPodAutoscalerList
		argoApps       *unstructured.UnstructuredList
		wg             sync.WaitGroup
		mu             sync.Mutex
		errors         []error
	)

	addError := func(err error) {
		if err != nil {
			mu.Lock()
			errors = append(errors, err)
			mu.Unlock()
		}
	}

	listOpts := metav1.ListOptions{}

	// Fetch all resources in parallel
	wg.Add(16)

	go func() {
		defer wg.Done()
		var err error
		nodes, err = clientset.CoreV1().Nodes().List(ctx, listOpts)
		addError(err)
	}()

	go func() {
		defer wg.Done()
		var err error
		pods, err = clientset.CoreV1().Pods("").List(ctx, listOpts)
		addError(err)
	}()

	go func() {
		defer wg.Done()
		var err error
		services, err = clientset.CoreV1().Services("").List(ctx, listOpts)
		addError(err)
	}()

	go func() {
		defer wg.Done()
		var err error
		deployments, err = clientset.AppsV1().Deployments("").List(ctx, listOpts)
		addError(err)
	}()

	go func() {
		defer wg.Done()
		var err error
		statefulsets, err = clientset.AppsV1().StatefulSets("").List(ctx, listOpts)
		addError(err)
	}()

	go func() {
		defer wg.Done()
		var err error
		daemonsets, err = clientset.AppsV1().DaemonSets("").List(ctx, listOpts)
		addError(err)
	}()

	go func() {
		defer wg.Done()
		var err error
		replicasets, err = clientset.AppsV1().ReplicaSets("").List(ctx, listOpts)
		addError(err)
	}()

	go func() {
		defer wg.Done()
		var err error
		ingresses, err = clientset.NetworkingV1().Ingresses("").List(ctx, listOpts)
		addError(err)
	}()

	go func() {
		defer wg.Done()
		var err error
		pvcs, err = clientset.CoreV1().PersistentVolumeClaims("").List(ctx, listOpts)
		addError(err)
	}()

	go func() {
		defer wg.Done()
		var err error
		configmaps, err = clientset.CoreV1().ConfigMaps("").List(ctx, listOpts)
		addError(err)
	}()

	go func() {
		defer wg.Done()
		var err error
		secrets, err = clientset.CoreV1().Secrets("").List(ctx, listOpts)
		addError(err)
	}()

	go func() {
		defer wg.Done()
		var err error
		storageclasses, err = clientset.StorageV1().StorageClasses().List(ctx, listOpts)
		addError(err)
	}()

	go func() {
		defer wg.Done()
		var err error
		jobs, err = clientset.BatchV1().Jobs("").List(ctx, listOpts)
		addError(err)
	}()

	go func() {
		defer wg.Done()
		var err error
		cronjobs, err = clientset.BatchV1().CronJobs("").List(ctx, listOpts)
		addError(err)
	}()

	go func() {
		defer wg.Done()
		var err error
		hpas, err = clientset.AutoscalingV2().HorizontalPodAutoscalers("").List(ctx, listOpts)
		addError(err)
	}()

	go func() {
		defer wg.Done()
		if dynamicClient == nil {
			return
		}
		gvr := schema.GroupVersionResource{
			Group:    "argoproj.io",
			Version:  "v1alpha1",
			Resource: "applications",
		}
		var err error
		argoApps, err = dynamicClient.Resource(gvr).Namespace("").List(ctx, listOpts)
		if err != nil {
			// ArgoCD might not be installed, just log
			log.Printf("ArgoCD applications not available: %v", err)
		}
	}()

	wg.Wait()

	// Check for critical errors
	if len(errors) > 0 {
		log.Printf("Some resources failed to fetch: %v", errors)
	}

	// Build resource maps for link calculation
	nodeMap := make(map[string]string)     // name -> uid
	podMap := make(map[string]string)      // uid -> namespace/name
	svcMap := make(map[string]string)      // namespace/name -> uid
	cmMap := make(map[string]string)       // namespace/name -> uid
	secretMap := make(map[string]string)   // namespace/name -> uid
	pvcMap := make(map[string]string)      // namespace/name -> uid
	scMap := make(map[string]string)       // name -> uid
	workloadMap := make(map[string]string) // namespace/kind/name -> uid

	// Initialize maps for safe iteration
	if nodes != nil {
		for _, n := range nodes.Items {
			nodeMap[n.Name] = string(n.UID)
		}
	}
	if services != nil {
		for _, s := range services.Items {
			svcMap[s.Namespace+"/"+s.Name] = string(s.UID)
		}
	}
	if configmaps != nil {
		for _, cm := range configmaps.Items {
			cmMap[cm.Namespace+"/"+cm.Name] = string(cm.UID)
		}
	}
	if secrets != nil {
		for _, sec := range secrets.Items {
			secretMap[sec.Namespace+"/"+sec.Name] = string(sec.UID)
		}
	}
	if pvcs != nil {
		for _, pvc := range pvcs.Items {
			pvcMap[pvc.Namespace+"/"+pvc.Name] = string(pvc.UID)
		}
	}
	if storageclasses != nil {
		for _, sc := range storageclasses.Items {
			scMap[sc.Name] = string(sc.UID)
		}
	}
	if deployments != nil {
		for _, d := range deployments.Items {
			workloadMap[d.Namespace+"/Deployment/"+d.Name] = string(d.UID)
		}
	}
	if statefulsets != nil {
		for _, s := range statefulsets.Items {
			workloadMap[s.Namespace+"/StatefulSet/"+s.Name] = string(s.UID)
		}
	}
	if replicasets != nil {
		for _, r := range replicasets.Items {
			workloadMap[r.Namespace+"/ReplicaSet/"+r.Name] = string(r.UID)
		}
	}

	// Process all resources and build links
	resources := []LightResource{}
	links := []ClusterLink{}

	// Helper function to extract Helm info from labels
	extractHelmInfo := func(labels, annotations map[string]string, ns string) *HelmReleaseInfo {
		releaseName := labels["app.kubernetes.io/instance"]
		if releaseName == "" {
			releaseName = labels["helm.sh/release-name"]
		}
		if releaseName == "" {
			releaseName = annotations["meta.helm.sh/release-name"]
		}
		if releaseName == "" {
			return nil
		}

		// Check if actually Helm-managed
		hasManagedByHelm := labels["app.kubernetes.io/managed-by"] == "Helm"
		hasHelmChart := labels["helm.sh/chart"] != ""
		hasHelmMetadata := labels["meta.helm.sh/release-name"] != "" || annotations["meta.helm.sh/release-name"] != ""

		if !hasManagedByHelm && !hasHelmChart && !hasHelmMetadata {
			return nil
		}

		releaseNs := labels["meta.helm.sh/release-namespace"]
		if releaseNs == "" {
			releaseNs = annotations["meta.helm.sh/release-namespace"]
		}
		if releaseNs == "" {
			releaseNs = ns
		}

		return &HelmReleaseInfo{
			ReleaseName:      releaseName,
			ReleaseNamespace: releaseNs,
			ChartName:        labels["helm.sh/chart"],
		}
	}

	// Process Nodes
	if nodes != nil {
		for _, n := range nodes.Items {
			status := "NotReady"
			health := "warning"
			for _, cond := range n.Status.Conditions {
				if cond.Type == corev1.NodeReady && cond.Status == corev1.ConditionTrue {
					status = "Ready"
					health = "ok"
					break
				}
			}
			resources = append(resources, LightResource{
				ID:                string(n.UID),
				Name:              n.Name,
				Namespace:         "",
				Kind:              "Node",
				Status:            status,
				Health:            health,
				Labels:            n.Labels,
				OwnerRefs:         extractOwnerRefs(n.OwnerReferences),
				CreationTimestamp: n.CreationTimestamp.Format("2006-01-02T15:04:05Z"),
			})
		}
	}

	// Process Pods
	if pods != nil {
		for _, p := range pods.Items {
			status := string(p.Status.Phase)
			health := "ok"

			if p.Status.Phase == corev1.PodFailed {
				health = "error"
			} else if p.Status.Phase == corev1.PodPending {
				health = "warning"
			} else if p.Status.Phase == corev1.PodRunning {
				isReady := false
				for _, c := range p.Status.Conditions {
					if c.Type == corev1.PodReady && c.Status == corev1.ConditionTrue {
						isReady = true
						break
					}
				}
				if !isReady {
					health = "warning"
				}
				for _, cs := range p.Status.ContainerStatuses {
					if cs.State.Waiting != nil && cs.State.Waiting.Reason != "" {
						health = "error"
					}
					if cs.State.Terminated != nil && cs.State.Terminated.ExitCode != 0 {
						health = "error"
					}
				}
			}

			// Extract volume refs
			var volumes []VolumeRef
			for _, vol := range p.Spec.Volumes {
				if vol.ConfigMap != nil {
					volumes = append(volumes, VolumeRef{Type: "configMap", Name: vol.ConfigMap.Name})
				}
				if vol.Secret != nil {
					volumes = append(volumes, VolumeRef{Type: "secret", Name: vol.Secret.SecretName})
				}
				if vol.PersistentVolumeClaim != nil {
					volumes = append(volumes, VolumeRef{Type: "pvc", Name: vol.PersistentVolumeClaim.ClaimName})
				}
				if vol.Projected != nil {
					for _, src := range vol.Projected.Sources {
						if src.ConfigMap != nil {
							volumes = append(volumes, VolumeRef{Type: "configMap", Name: src.ConfigMap.Name})
						}
						if src.Secret != nil {
							volumes = append(volumes, VolumeRef{Type: "secret", Name: src.Secret.Name})
						}
					}
				}
			}

			// Extract env refs
			var envRefs []EnvRef
			seenRefs := make(map[string]bool)
			for _, container := range p.Spec.Containers {
				for _, envFrom := range container.EnvFrom {
					if envFrom.ConfigMapRef != nil {
						key := "configMap:" + envFrom.ConfigMapRef.Name
						if !seenRefs[key] {
							envRefs = append(envRefs, EnvRef{Type: "configMap", Name: envFrom.ConfigMapRef.Name})
							seenRefs[key] = true
						}
					}
					if envFrom.SecretRef != nil {
						key := "secret:" + envFrom.SecretRef.Name
						if !seenRefs[key] {
							envRefs = append(envRefs, EnvRef{Type: "secret", Name: envFrom.SecretRef.Name})
							seenRefs[key] = true
						}
					}
				}
				for _, env := range container.Env {
					if env.ValueFrom != nil {
						if env.ValueFrom.ConfigMapKeyRef != nil {
							key := "configMap:" + env.ValueFrom.ConfigMapKeyRef.Name
							if !seenRefs[key] {
								envRefs = append(envRefs, EnvRef{Type: "configMap", Name: env.ValueFrom.ConfigMapKeyRef.Name})
								seenRefs[key] = true
							}
						}
						if env.ValueFrom.SecretKeyRef != nil {
							key := "secret:" + env.ValueFrom.SecretKeyRef.Name
							if !seenRefs[key] {
								envRefs = append(envRefs, EnvRef{Type: "secret", Name: env.ValueFrom.SecretKeyRef.Name})
								seenRefs[key] = true
							}
						}
					}
				}
			}

			annotations := p.Annotations
			if annotations == nil {
				annotations = make(map[string]string)
			}

			res := LightResource{
				ID:                string(p.UID),
				Name:              p.Name,
				Namespace:         p.Namespace,
				Kind:              "Pod",
				Status:            status,
				Health:            health,
				Labels:            p.Labels,
				OwnerRefs:         extractOwnerRefs(p.OwnerReferences),
				CreationTimestamp: p.CreationTimestamp.Format("2006-01-02T15:04:05Z"),
				NodeName:          p.Spec.NodeName,
				Volumes:           volumes,
				EnvRefs:           envRefs,
				HelmRelease:       extractHelmInfo(p.Labels, annotations, p.Namespace),
			}
			resources = append(resources, res)
			podMap[string(p.UID)] = p.Namespace + "/" + p.Name

			// Add owner links
			for _, ref := range p.OwnerReferences {
				links = append(links, ClusterLink{Source: string(p.UID), Target: string(ref.UID), Type: "owner"})
			}

			// Add Pod -> Node link
			if p.Spec.NodeName != "" {
				if nodeUID, ok := nodeMap[p.Spec.NodeName]; ok {
					links = append(links, ClusterLink{Source: string(p.UID), Target: nodeUID, Type: "owner"})
				}
			}

			// Add Pod -> ConfigMap/Secret/PVC links
			for _, vol := range volumes {
				var targetUID string
				var linkType string
				switch vol.Type {
				case "configMap":
					targetUID = cmMap[p.Namespace+"/"+vol.Name]
					linkType = "config"
				case "secret":
					targetUID = secretMap[p.Namespace+"/"+vol.Name]
					linkType = "config"
				case "pvc":
					targetUID = pvcMap[p.Namespace+"/"+vol.Name]
					linkType = "storage"
				}
				if targetUID != "" {
					links = append(links, ClusterLink{Source: string(p.UID), Target: targetUID, Type: linkType})
				}
			}

			// Add Pod -> ConfigMap/Secret links from env
			for _, envRef := range envRefs {
				var targetUID string
				if envRef.Type == "configMap" {
					targetUID = cmMap[p.Namespace+"/"+envRef.Name]
				} else if envRef.Type == "secret" {
					targetUID = secretMap[p.Namespace+"/"+envRef.Name]
				}
				if targetUID != "" {
					links = append(links, ClusterLink{Source: string(p.UID), Target: targetUID, Type: "config"})
				}
			}
		}
	}

	// Process Services
	if services != nil {
		for _, s := range services.Items {
			var selector map[string]string
			if s.Spec.Selector != nil && len(s.Spec.Selector) > 0 {
				selector = s.Spec.Selector
			}

			annotations := s.Annotations
			if annotations == nil {
				annotations = make(map[string]string)
			}

			res := LightResource{
				ID:                string(s.UID),
				Name:              s.Name,
				Namespace:         s.Namespace,
				Kind:              "Service",
				Status:            "Active",
				Health:            "ok",
				Labels:            s.Labels,
				OwnerRefs:         extractOwnerRefs(s.OwnerReferences),
				CreationTimestamp: s.CreationTimestamp.Format("2006-01-02T15:04:05Z"),
				Selector:          selector,
				HelmRelease:       extractHelmInfo(s.Labels, annotations, s.Namespace),
			}
			resources = append(resources, res)

			// Add owner links
			for _, ref := range s.OwnerReferences {
				links = append(links, ClusterLink{Source: string(s.UID), Target: string(ref.UID), Type: "owner"})
			}

			// Add Service -> Pod network links
			if selector != nil && pods != nil {
				for _, p := range pods.Items {
					if p.Namespace != s.Namespace {
						continue
					}
					if matchLabels(p.Labels, selector) {
						links = append(links, ClusterLink{Source: string(s.UID), Target: string(p.UID), Type: "network"})
					}
				}
			}
		}
	}

	// Process Deployments
	if deployments != nil {
		for _, d := range deployments.Items {
			status := "Progressing"
			health := "warning"
			if d.Spec.Replicas != nil && *d.Spec.Replicas == 0 {
				status = "ScaledDown"
				health = "ok"
			} else if d.Status.AvailableReplicas == d.Status.Replicas && d.Status.Replicas > 0 {
				status = "Available"
				health = "ok"
			}

			annotations := d.Annotations
			if annotations == nil {
				annotations = make(map[string]string)
			}

			res := LightResource{
				ID:                string(d.UID),
				Name:              d.Name,
				Namespace:         d.Namespace,
				Kind:              "Deployment",
				Status:            status,
				Health:            health,
				Labels:            d.Labels,
				OwnerRefs:         extractOwnerRefs(d.OwnerReferences),
				CreationTimestamp: d.CreationTimestamp.Format("2006-01-02T15:04:05Z"),
				HelmRelease:       extractHelmInfo(d.Labels, annotations, d.Namespace),
			}
			resources = append(resources, res)

			for _, ref := range d.OwnerReferences {
				links = append(links, ClusterLink{Source: string(d.UID), Target: string(ref.UID), Type: "owner"})
			}
		}
	}

	// Process StatefulSets
	if statefulsets != nil {
		for _, s := range statefulsets.Items {
			status := "Progressing"
			health := "warning"
			if s.Status.ReadyReplicas == s.Status.Replicas && s.Status.Replicas > 0 {
				status = "Ready"
				health = "ok"
			}

			var selector map[string]string
			if s.Spec.Selector != nil && s.Spec.Selector.MatchLabels != nil {
				selector = s.Spec.Selector.MatchLabels
			}

			annotations := s.Annotations
			if annotations == nil {
				annotations = make(map[string]string)
			}

			res := LightResource{
				ID:                string(s.UID),
				Name:              s.Name,
				Namespace:         s.Namespace,
				Kind:              "StatefulSet",
				Status:            status,
				Health:            health,
				Labels:            s.Labels,
				OwnerRefs:         extractOwnerRefs(s.OwnerReferences),
				CreationTimestamp: s.CreationTimestamp.Format("2006-01-02T15:04:05Z"),
				Selector:          selector,
				HelmRelease:       extractHelmInfo(s.Labels, annotations, s.Namespace),
			}
			resources = append(resources, res)

			for _, ref := range s.OwnerReferences {
				links = append(links, ClusterLink{Source: string(s.UID), Target: string(ref.UID), Type: "owner"})
			}

			// StatefulSets often don't have direct OwnerReferences from pods, use selector
			if selector != nil && pods != nil {
				for _, p := range pods.Items {
					if p.Namespace != s.Namespace {
						continue
					}
					if matchLabels(p.Labels, selector) {
						// Check if link doesn't already exist (from OwnerRef)
						exists := false
						for _, l := range links {
							if l.Source == string(p.UID) && l.Target == string(s.UID) {
								exists = true
								break
							}
						}
						if !exists {
							links = append(links, ClusterLink{Source: string(p.UID), Target: string(s.UID), Type: "owner"})
						}
					}
				}
			}
		}
	}

	// Process DaemonSets
	if daemonsets != nil {
		for _, d := range daemonsets.Items {
			status := "Progressing"
			health := "warning"
			if d.Status.NumberReady == d.Status.DesiredNumberScheduled && d.Status.DesiredNumberScheduled > 0 {
				status = "Ready"
				health = "ok"
			}

			var selector map[string]string
			if d.Spec.Selector != nil && d.Spec.Selector.MatchLabels != nil {
				selector = d.Spec.Selector.MatchLabels
			}

			annotations := d.Annotations
			if annotations == nil {
				annotations = make(map[string]string)
			}

			res := LightResource{
				ID:                string(d.UID),
				Name:              d.Name,
				Namespace:         d.Namespace,
				Kind:              "DaemonSet",
				Status:            status,
				Health:            health,
				Labels:            d.Labels,
				OwnerRefs:         extractOwnerRefs(d.OwnerReferences),
				CreationTimestamp: d.CreationTimestamp.Format("2006-01-02T15:04:05Z"),
				Selector:          selector,
				HelmRelease:       extractHelmInfo(d.Labels, annotations, d.Namespace),
			}
			resources = append(resources, res)

			for _, ref := range d.OwnerReferences {
				links = append(links, ClusterLink{Source: string(d.UID), Target: string(ref.UID), Type: "owner"})
			}

			// Link pods via selector
			if selector != nil && pods != nil {
				for _, p := range pods.Items {
					if p.Namespace != d.Namespace {
						continue
					}
					if matchLabels(p.Labels, selector) {
						exists := false
						for _, l := range links {
							if l.Source == string(p.UID) && l.Target == string(d.UID) {
								exists = true
								break
							}
						}
						if !exists {
							links = append(links, ClusterLink{Source: string(p.UID), Target: string(d.UID), Type: "owner"})
						}
					}
				}
			}
		}
	}

	// Process ReplicaSets
	if replicasets != nil {
		for _, r := range replicasets.Items {
			annotations := r.Annotations
			if annotations == nil {
				annotations = make(map[string]string)
			}

			res := LightResource{
				ID:                string(r.UID),
				Name:              r.Name,
				Namespace:         r.Namespace,
				Kind:              "ReplicaSet",
				Status:            "Active",
				Health:            "ok",
				Labels:            r.Labels,
				OwnerRefs:         extractOwnerRefs(r.OwnerReferences),
				CreationTimestamp: r.CreationTimestamp.Format("2006-01-02T15:04:05Z"),
				HelmRelease:       extractHelmInfo(r.Labels, annotations, r.Namespace),
			}
			resources = append(resources, res)

			for _, ref := range r.OwnerReferences {
				links = append(links, ClusterLink{Source: string(r.UID), Target: string(ref.UID), Type: "owner"})
			}
		}
	}

	// Process Ingresses
	if ingresses != nil {
		for _, i := range ingresses.Items {
			var backends []IngressBackend
			for _, rule := range i.Spec.Rules {
				if rule.HTTP != nil {
					for _, path := range rule.HTTP.Paths {
						if path.Backend.Service != nil && path.Backend.Service.Name != "" {
							backends = append(backends, IngressBackend{ServiceName: path.Backend.Service.Name})
						}
					}
				}
			}

			annotations := i.Annotations
			if annotations == nil {
				annotations = make(map[string]string)
			}

			res := LightResource{
				ID:                string(i.UID),
				Name:              i.Name,
				Namespace:         i.Namespace,
				Kind:              "Ingress",
				Status:            "Active",
				Health:            "ok",
				Labels:            i.Labels,
				OwnerRefs:         extractOwnerRefs(i.OwnerReferences),
				CreationTimestamp: i.CreationTimestamp.Format("2006-01-02T15:04:05Z"),
				IngressBackends:   backends,
				HelmRelease:       extractHelmInfo(i.Labels, annotations, i.Namespace),
			}
			resources = append(resources, res)

			for _, ref := range i.OwnerReferences {
				links = append(links, ClusterLink{Source: string(i.UID), Target: string(ref.UID), Type: "owner"})
			}

			// Add Ingress -> Service network links
			for _, backend := range backends {
				if svcUID, ok := svcMap[i.Namespace+"/"+backend.ServiceName]; ok {
					links = append(links, ClusterLink{Source: string(i.UID), Target: svcUID, Type: "network"})
				}
			}
		}
	}

	// Process PVCs
	if pvcs != nil {
		for _, pvc := range pvcs.Items {
			annotations := pvc.Annotations
			if annotations == nil {
				annotations = make(map[string]string)
			}

			status := string(pvc.Status.Phase)
			health := "ok"
			if status == "Lost" {
				health = "error"
			} else if status == "Pending" {
				health = "warning"
			}

			res := LightResource{
				ID:                string(pvc.UID),
				Name:              pvc.Name,
				Namespace:         pvc.Namespace,
				Kind:              "PersistentVolumeClaim",
				Status:            status,
				Health:            health,
				Labels:            pvc.Labels,
				OwnerRefs:         extractOwnerRefs(pvc.OwnerReferences),
				CreationTimestamp: pvc.CreationTimestamp.Format("2006-01-02T15:04:05Z"),
				StorageClassName:  getStorageClassName(pvc.Spec.StorageClassName),
				HelmRelease:       extractHelmInfo(pvc.Labels, annotations, pvc.Namespace),
			}
			resources = append(resources, res)

			for _, ref := range pvc.OwnerReferences {
				links = append(links, ClusterLink{Source: string(pvc.UID), Target: string(ref.UID), Type: "owner"})
			}

			// Add PVC -> StorageClass link
			if pvc.Spec.StorageClassName != nil && *pvc.Spec.StorageClassName != "" {
				if scUID, ok := scMap[*pvc.Spec.StorageClassName]; ok {
					links = append(links, ClusterLink{Source: string(pvc.UID), Target: scUID, Type: "storage"})
				}
			}
		}
	}

	// Process ConfigMaps
	if configmaps != nil {
		for _, cm := range configmaps.Items {
			annotations := cm.Annotations
			if annotations == nil {
				annotations = make(map[string]string)
			}

			res := LightResource{
				ID:                string(cm.UID),
				Name:              cm.Name,
				Namespace:         cm.Namespace,
				Kind:              "ConfigMap",
				Status:            "Active",
				Health:            "ok",
				Labels:            cm.Labels,
				OwnerRefs:         extractOwnerRefs(cm.OwnerReferences),
				CreationTimestamp: cm.CreationTimestamp.Format("2006-01-02T15:04:05Z"),
				HelmRelease:       extractHelmInfo(cm.Labels, annotations, cm.Namespace),
			}
			resources = append(resources, res)

			for _, ref := range cm.OwnerReferences {
				links = append(links, ClusterLink{Source: string(cm.UID), Target: string(ref.UID), Type: "owner"})
			}
		}
	}

	// Process Secrets (excluding Helm release secrets, create HelmRelease resources)
	helmReleaseMap := make(map[string]struct {
		secret  *corev1.Secret
		version int
	})

	if secrets != nil {
		for i := range secrets.Items {
			sec := &secrets.Items[i]
			labels := sec.Labels
			if labels == nil {
				labels = make(map[string]string)
			}

			// Check if this is a Helm release secret
			isHelmSecret := labels["owner"] == "helm" && sec.Type == "helm.sh/release.v1"

			if isHelmSecret {
				releaseName := labels["name"]
				namespace := sec.Namespace
				version := 0
				if v, ok := labels["version"]; ok {
					var err error
					_, err = json.Number(v).Int64()
					if err == nil {
						version = int(mustParseInt(v))
					}
				}

				key := namespace + "/" + releaseName
				existing, exists := helmReleaseMap[key]
				if !exists || version > existing.version {
					helmReleaseMap[key] = struct {
						secret  *corev1.Secret
						version int
					}{secret: sec, version: version}
				}
			} else {
				annotations := sec.Annotations
				if annotations == nil {
					annotations = make(map[string]string)
				}

				res := LightResource{
					ID:                string(sec.UID),
					Name:              sec.Name,
					Namespace:         sec.Namespace,
					Kind:              "Secret",
					Status:            "Active",
					Health:            "ok",
					Labels:            labels,
					OwnerRefs:         extractOwnerRefs(sec.OwnerReferences),
					CreationTimestamp: sec.CreationTimestamp.Format("2006-01-02T15:04:05Z"),
					HelmRelease:       extractHelmInfo(labels, annotations, sec.Namespace),
				}
				resources = append(resources, res)

				for _, ref := range sec.OwnerReferences {
					links = append(links, ClusterLink{Source: string(sec.UID), Target: string(ref.UID), Type: "owner"})
				}
			}
		}
	}

	// Create HelmRelease resources from grouped secrets
	for _, entry := range helmReleaseMap {
		sec := entry.secret
		labels := sec.Labels
		releaseName := labels["name"]
		namespace := sec.Namespace
		status := labels["status"]
		chartInfo := labels["chart"]

		helmReleaseID := "helm-" + namespace + "-" + releaseName

		health := "ok"
		if status == "failed" {
			health = "error"
		} else if status == "pending-install" || status == "pending-upgrade" || status == "pending-rollback" {
			health = "warning"
		}

		// Extract chart name and version
		chartName := chartInfo
		chartVersion := ""
		if idx := findLastDash(chartInfo); idx > 0 {
			chartName = chartInfo[:idx]
			chartVersion = chartInfo[idx+1:]
		}

		statusDisplay := status
		if len(status) > 0 {
			statusDisplay = string(status[0]-32) + status[1:] // Capitalize first letter
		}

		res := LightResource{
			ID:        helmReleaseID,
			Name:      releaseName,
			Namespace: namespace,
			Kind:      "HelmRelease",
			Status:    statusDisplay,
			Health:    health,
			Labels: map[string]string{
				"helm.sh/chart":             chartInfo,
				"helm.sh/release-name":      releaseName,
				"helm.sh/release-namespace": namespace,
			},
			OwnerRefs:         []string{},
			CreationTimestamp: sec.CreationTimestamp.Format("2006-01-02T15:04:05Z"),
			HelmRelease: &HelmReleaseInfo{
				ReleaseName:      releaseName,
				ReleaseNamespace: namespace,
				ChartName:        chartName,
				ChartVersion:     chartVersion,
				Revision:         entry.version,
			},
		}
		resources = append(resources, res)

		// Link HelmRelease to its secret
		links = append(links, ClusterLink{Source: helmReleaseID, Target: string(sec.UID), Type: "owner"})
	}

	// Process StorageClasses
	if storageclasses != nil {
		for _, sc := range storageclasses.Items {
			res := LightResource{
				ID:                string(sc.UID),
				Name:              sc.Name,
				Namespace:         "",
				Kind:              "StorageClass",
				Status:            "Active",
				Health:            "ok",
				Labels:            sc.Labels,
				OwnerRefs:         extractOwnerRefs(sc.OwnerReferences),
				CreationTimestamp: sc.CreationTimestamp.Format("2006-01-02T15:04:05Z"),
			}
			resources = append(resources, res)
		}
	}

	// Process Jobs
	if jobs != nil {
		for _, j := range jobs.Items {
			status := "Pending"
			health := "warning"

			conditions := j.Status.Conditions
			completeCond := false
			failedCond := false
			for _, c := range conditions {
				if c.Type == batchv1.JobComplete && c.Status == corev1.ConditionTrue {
					completeCond = true
				}
				if c.Type == batchv1.JobFailed && c.Status == corev1.ConditionTrue {
					failedCond = true
				}
			}

			if completeCond {
				status = "Complete"
				health = "ok"
			} else if failedCond {
				status = "Failed"
				health = "error"
			} else if j.Status.Active > 0 {
				status = "Running"
				health = "ok"
			} else if j.Status.Succeeded > 0 {
				status = "Complete"
				health = "ok"
			}

			annotations := j.Annotations
			if annotations == nil {
				annotations = make(map[string]string)
			}

			res := LightResource{
				ID:                string(j.UID),
				Name:              j.Name,
				Namespace:         j.Namespace,
				Kind:              "Job",
				Status:            status,
				Health:            health,
				Labels:            j.Labels,
				OwnerRefs:         extractOwnerRefs(j.OwnerReferences),
				CreationTimestamp: j.CreationTimestamp.Format("2006-01-02T15:04:05Z"),
				HelmRelease:       extractHelmInfo(j.Labels, annotations, j.Namespace),
			}
			resources = append(resources, res)

			for _, ref := range j.OwnerReferences {
				links = append(links, ClusterLink{Source: string(j.UID), Target: string(ref.UID), Type: "owner"})
			}
		}
	}

	// Process CronJobs
	if cronjobs != nil {
		for _, cj := range cronjobs.Items {
			status := "Active"
			if cj.Spec.Suspend != nil && *cj.Spec.Suspend {
				status = "Suspended"
			}

			annotations := cj.Annotations
			if annotations == nil {
				annotations = make(map[string]string)
			}

			res := LightResource{
				ID:                string(cj.UID),
				Name:              cj.Name,
				Namespace:         cj.Namespace,
				Kind:              "CronJob",
				Status:            status,
				Labels:            cj.Labels,
				OwnerRefs:         extractOwnerRefs(cj.OwnerReferences),
				CreationTimestamp: cj.CreationTimestamp.Format("2006-01-02T15:04:05Z"),
				HelmRelease:       extractHelmInfo(cj.Labels, annotations, cj.Namespace),
			}
			resources = append(resources, res)

			for _, ref := range cj.OwnerReferences {
				links = append(links, ClusterLink{Source: string(cj.UID), Target: string(ref.UID), Type: "owner"})
			}
		}
	}

	// Process HPAs
	if hpas != nil {
		for _, hpa := range hpas.Items {
			status := "Unknown"
			health := "warning"

			conditions := hpa.Status.Conditions
			ableCond := false
			scalingActiveCond := false
			for _, c := range conditions {
				if c.Type == autoscalingv2.AbleToScale && c.Status == corev1.ConditionTrue {
					ableCond = true
				}
				if c.Type == autoscalingv2.ScalingActive && c.Status == corev1.ConditionTrue {
					scalingActiveCond = true
				}
			}

			if ableCond && scalingActiveCond {
				status = "Active"
				health = "ok"
			} else if ableCond {
				status = "Ready"
				health = "ok"
			} else {
				status = "Inactive"
			}

			var scaleTargetRef *ScaleTargetRef
			if hpa.Spec.ScaleTargetRef.Kind != "" {
				scaleTargetRef = &ScaleTargetRef{
					Kind: hpa.Spec.ScaleTargetRef.Kind,
					Name: hpa.Spec.ScaleTargetRef.Name,
				}
			}

			annotations := hpa.Annotations
			if annotations == nil {
				annotations = make(map[string]string)
			}

			res := LightResource{
				ID:                string(hpa.UID),
				Name:              hpa.Name,
				Namespace:         hpa.Namespace,
				Kind:              "HorizontalPodAutoscaler",
				Status:            status,
				Health:            health,
				Labels:            hpa.Labels,
				OwnerRefs:         extractOwnerRefs(hpa.OwnerReferences),
				CreationTimestamp: hpa.CreationTimestamp.Format("2006-01-02T15:04:05Z"),
				ScaleTargetRef:    scaleTargetRef,
				HelmRelease:       extractHelmInfo(hpa.Labels, annotations, hpa.Namespace),
			}
			resources = append(resources, res)

			for _, ref := range hpa.OwnerReferences {
				links = append(links, ClusterLink{Source: string(hpa.UID), Target: string(ref.UID), Type: "owner"})
			}

			// Add HPA -> target workload link
			if scaleTargetRef != nil {
				targetKey := hpa.Namespace + "/" + scaleTargetRef.Kind + "/" + scaleTargetRef.Name
				if targetUID, ok := workloadMap[targetKey]; ok {
					links = append(links, ClusterLink{Source: string(hpa.UID), Target: targetUID, Type: "owner"})
				}
			}
		}
	}

	// Process ArgoCD Applications
	if argoApps != nil {
		for _, item := range argoApps.Items {
			metadata := item.Object["metadata"].(map[string]interface{})
			uid := getNestedString(metadata, "uid")
			name := getNestedString(metadata, "name")
			namespace := getNestedString(metadata, "namespace")
			creationTimestamp := getNestedString(metadata, "creationTimestamp")
			labels, _ := metadata["labels"].(map[string]interface{})

			labelsMap := make(map[string]string)
			for k, v := range labels {
				if vs, ok := v.(string); ok {
					labelsMap[k] = vs
				}
			}

			ownerRefs := []string{}
			if refs, ok := metadata["ownerReferences"].([]interface{}); ok {
				for _, ref := range refs {
					if refMap, ok := ref.(map[string]interface{}); ok {
						if refUID, ok := refMap["uid"].(string); ok {
							ownerRefs = append(ownerRefs, refUID)
						}
					}
				}
			}

			status := "Unknown"
			health := "ok"

			statusObj, _ := item.Object["status"].(map[string]interface{})
			if statusObj != nil {
				if sync, ok := statusObj["sync"].(map[string]interface{}); ok {
					if syncStatus, ok := sync["status"].(string); ok {
						status = syncStatus
					}
				}
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

			res := LightResource{
				ID:                uid,
				Name:              name,
				Namespace:         namespace,
				Kind:              "Application",
				Status:            status,
				Health:            health,
				Labels:            labelsMap,
				OwnerRefs:         ownerRefs,
				CreationTimestamp: creationTimestamp,
			}
			resources = append(resources, res)

			for _, refUID := range ownerRefs {
				links = append(links, ClusterLink{Source: uid, Target: refUID, Type: "owner"})
			}
		}
	}

	// Link Helm-managed resources to their HelmRelease
	helmReleaseUIDs := make(map[string]string) // namespace/releaseName -> helmReleaseID
	for _, res := range resources {
		if res.Kind == "HelmRelease" && res.HelmRelease != nil {
			key := res.HelmRelease.ReleaseNamespace + "/" + res.HelmRelease.ReleaseName
			helmReleaseUIDs[key] = res.ID
		}
	}

	for _, res := range resources {
		if res.HelmRelease != nil && res.Kind != "HelmRelease" {
			key := res.HelmRelease.ReleaseNamespace + "/" + res.HelmRelease.ReleaseName
			if helmReleaseID, ok := helmReleaseUIDs[key]; ok {
				links = append(links, ClusterLink{Source: res.ID, Target: helmReleaseID, Type: "owner"})
			}
		}
	}

	// Send response
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(InitResponse{
		Resources: resources,
		Links:     links,
	})
}

func extractOwnerRefs(refs []metav1.OwnerReference) []string {
	result := make([]string, 0, len(refs))
	for _, ref := range refs {
		result = append(result, string(ref.UID))
	}
	return result
}

func matchLabels(labels, selector map[string]string) bool {
	if labels == nil || selector == nil {
		return false
	}
	for k, v := range selector {
		if labels[k] != v {
			return false
		}
	}
	return true
}

func getStorageClassName(name *string) string {
	if name == nil {
		return ""
	}
	return *name
}

func findLastDash(s string) int {
	for i := len(s) - 1; i >= 0; i-- {
		if s[i] == '-' {
			return i
		}
	}
	return -1
}

func mustParseInt(s string) int64 {
	var result int64
	for _, c := range s {
		if c >= '0' && c <= '9' {
			result = result*10 + int64(c-'0')
		}
	}
	return result
}
