package helm

import (
	"encoding/json"
	"net/http"
	"strings"

	"k8s.io/client-go/rest"
)

func HandleHelmRequest(config *rest.Config, w http.ResponseWriter, r *http.Request) {
	// Enable CORS
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	manager := NewHelmManager(config)
	
	// Extract action from path
	// Path is expected to be /api/helm/<action>
	path := r.URL.Path
	prefix := "/api/helm/"
	if !strings.HasPrefix(path, prefix) {
		http.Error(w, "Invalid path", http.StatusBadRequest)
		return
	}
	action := path[len(prefix):]

    // Parse query params
    ns := r.URL.Query().Get("namespace")
    name := r.URL.Query().Get("name")

    if ns == "" && action != "list" { // list might support all namespaces later, but for now strict
        http.Error(w, "namespace required", http.StatusBadRequest)
        return
    }

	switch action {
	case "release":
		if name == "" {
			http.Error(w, "name required", http.StatusBadRequest)
			return
		}
		rel, err := manager.GetRelease(ns, name)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		// Convert release to a format similar to what frontend expects
		response := map[string]interface{}{
			"name":         rel.Name,
			"namespace":    rel.Namespace,
			"revision":     rel.Version,
			"status":       string(rel.Info.Status),
			"chart":        rel.Chart.Metadata.Name + "-" + rel.Chart.Metadata.Version,
			"chartVersion": rel.Chart.Metadata.Version,
			"appVersion":   rel.Chart.Metadata.AppVersion,
			"updated":      rel.Info.LastDeployed.Format("2006-01-02T15:04:05Z"),
		}
		json.NewEncoder(w).Encode(response)

	case "values":
        if name == "" {
            http.Error(w, "name required", http.StatusBadRequest)
            return
        }
		vals, err := manager.GetValues(ns, name, true)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		json.NewEncoder(w).Encode(vals)

	case "history":
        if name == "" {
            http.Error(w, "name required", http.StatusBadRequest)
            return
        }
		hist, err := manager.GetHistory(ns, name)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		json.NewEncoder(w).Encode(hist)

	case "rollback":
        if r.Method != "POST" {
            http.Error(w, "POST required", http.StatusMethodNotAllowed)
            return
        }
        if name == "" {
            http.Error(w, "name required", http.StatusBadRequest)
            return
        }
        var req struct {
            Revision int `json:"revision"`
        }
        if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
             http.Error(w, err.Error(), http.StatusBadRequest)
             return
        }
        if err := manager.Rollback(ns, name, req.Revision); err != nil {
             http.Error(w, err.Error(), http.StatusInternalServerError)
             return
        }
        w.WriteHeader(http.StatusOK)
        json.NewEncoder(w).Encode(map[string]string{"status": "ok"})

    case "upgrade":
        if r.Method != "POST" {
            http.Error(w, "POST required", http.StatusMethodNotAllowed)
            return
        }
        if name == "" {
            http.Error(w, "name required", http.StatusBadRequest)
            return
        }
        var values map[string]interface{}
        if err := json.NewDecoder(r.Body).Decode(&values); err != nil {
             http.Error(w, err.Error(), http.StatusBadRequest)
             return
        }
        rel, err := manager.Upgrade(ns, name, values)
        if err != nil {
             http.Error(w, err.Error(), http.StatusInternalServerError)
             return
        }
        json.NewEncoder(w).Encode(rel)

	default:
		http.Error(w, "Unknown action: " + action, http.StatusNotFound)
	}
}
