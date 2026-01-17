package k8s

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strings"

	"k8s.io/apimachinery/pkg/api/meta"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/apimachinery/pkg/util/yaml"
	"k8s.io/client-go/discovery"
	"k8s.io/client-go/discovery/cached/memory"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/restmapper"
)

type applyRequest struct {
	YAML             string `json:"yaml"`
	DefaultNamespace string `json:"defaultNamespace"`
}

type applyResult struct {
	Kind      string `json:"kind"`
	Name      string `json:"name"`
	Namespace string `json:"namespace,omitempty"`
	Status    string `json:"status"`
	Error     string `json:"error,omitempty"`
}

// HandleApplyYaml accepts multi-document YAML and applies resources to the cluster.
func HandleApplyYaml(config *rest.Config, w http.ResponseWriter, r *http.Request) {
	if config == nil {
		http.Error(w, "Kubernetes config not loaded", http.StatusServiceUnavailable)
		return
	}
	if r.Method != "POST" {
		http.Error(w, "POST required", http.StatusMethodNotAllowed)
		return
	}

	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "Failed to read request body", http.StatusBadRequest)
		return
	}

	defaultNamespace := r.URL.Query().Get("defaultNamespace")
	yamlContent := string(body)

	if strings.Contains(r.Header.Get("Content-Type"), "application/json") {
		var payload applyRequest
		if err := json.Unmarshal(body, &payload); err != nil {
			http.Error(w, "Invalid JSON payload", http.StatusBadRequest)
			return
		}
		yamlContent = payload.YAML
		if defaultNamespace == "" {
			defaultNamespace = payload.DefaultNamespace
		}
	}

	if strings.TrimSpace(yamlContent) == "" {
		http.Error(w, "YAML content is empty", http.StatusBadRequest)
		return
	}

	dynamicClient, err := dynamic.NewForConfig(config)
	if err != nil {
		http.Error(w, "Failed to create dynamic client", http.StatusInternalServerError)
		return
	}

	discoveryClient, err := discovery.NewDiscoveryClientForConfig(config)
	if err != nil {
		http.Error(w, "Failed to create discovery client", http.StatusInternalServerError)
		return
	}

	mapper := restmapper.NewDeferredDiscoveryRESTMapper(memory.NewMemCacheClient(discoveryClient))
	decoder := yaml.NewYAMLOrJSONDecoder(bytes.NewReader([]byte(yamlContent)), 4096)

	results := []applyResult{}
	applied := 0
	for {
		var rawObj map[string]interface{}
		if err := decoder.Decode(&rawObj); err != nil {
			if err == io.EOF {
				break
			}
			results = append(results, applyResult{Status: "error", Error: err.Error()})
			continue
		}
		if len(rawObj) == 0 {
			continue
		}

		u := &unstructured.Unstructured{Object: rawObj}
		if u.GetName() == "" {
			results = append(results, applyResult{Status: "error", Error: "resource name missing"})
			continue
		}

		gvk := u.GroupVersionKind()
		mapping, err := mapper.RESTMapping(gvk.GroupKind(), gvk.Version)
		if err != nil {
			results = append(results, applyResult{
				Kind:   gvk.Kind,
				Name:   u.GetName(),
				Status: "error",
				Error:  err.Error(),
			})
			continue
		}

		baseResource := dynamicClient.Resource(mapping.Resource)
		var resourceInterface dynamic.ResourceInterface = baseResource
		namespace := u.GetNamespace()
		if mapping.Scope.Name() == meta.RESTScopeNameNamespace {
			if namespace == "" {
				namespace = defaultNamespace
				u.SetNamespace(namespace)
			}
			if namespace == "" {
				results = append(results, applyResult{
					Kind:   gvk.Kind,
					Name:   u.GetName(),
					Status: "error",
					Error:  "namespace missing",
				})
				continue
			}
			resourceInterface = baseResource.Namespace(namespace)
		}

		data, err := json.Marshal(u)
		if err != nil {
			results = append(results, applyResult{
				Kind:      gvk.Kind,
				Name:      u.GetName(),
				Namespace: namespace,
				Status:    "error",
				Error:     err.Error(),
			})
			continue
		}

		force := true
		_, err = resourceInterface.Patch(
			context.Background(),
			u.GetName(),
			types.ApplyPatchType,
			data,
			metav1PatchOptions(force),
		)
		if err != nil {
			results = append(results, applyResult{
				Kind:      gvk.Kind,
				Name:      u.GetName(),
				Namespace: namespace,
				Status:    "error",
				Error:     err.Error(),
			})
			continue
		}

		applied++
		results = append(results, applyResult{
			Kind:      gvk.Kind,
			Name:      u.GetName(),
			Namespace: namespace,
			Status:    "applied",
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"applied": applied,
		"results": results,
	})
}

func metav1PatchOptions(force bool) metav1.PatchOptions {
	return metav1.PatchOptions{
		FieldManager: "anakosmos-ui",
		Force:        &force,
	}
}
