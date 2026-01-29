package helm

import (
	"encoding/json"
	"io"
	"net/http"
	"strings"

	"sigs.k8s.io/yaml"

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

    if ns == "" && action != "list" && action != "repo-index" && action != "chart-values" { // list might support all namespaces later, but for now strict
        http.Error(w, "namespace required", http.StatusBadRequest)
        return
    }

	switch action {
	case "repo-index":
        repoURL := r.URL.Query().Get("repoUrl")
        if repoURL == "" {
            http.Error(w, "repoUrl required", http.StatusBadRequest)
            return
        }
        index, err := fetchRepoIndex(repoURL)
        if err != nil {
            http.Error(w, err.Error(), http.StatusBadRequest)
            return
        }
        json.NewEncoder(w).Encode(buildRepoIndexResponse(index))
        return

	case "chart-values":
        repoURL := r.URL.Query().Get("repoUrl")
        chart := r.URL.Query().Get("chart")
        version := r.URL.Query().Get("version")
        if repoURL == "" || chart == "" {
            http.Error(w, "repoUrl and chart required", http.StatusBadRequest)
            return
        }
        values, err := fetchChartValues(repoURL, chart, version)
        if err != nil {
            http.Error(w, err.Error(), http.StatusBadRequest)
            return
        }
        json.NewEncoder(w).Encode(values)
        return

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
        // all=true returns computed values (defaults + user), all=false returns user-only
        allValues := r.URL.Query().Get("all") != "false"
		vals, err := manager.GetValues(ns, name, allValues)
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
        body, err := io.ReadAll(r.Body)
        if err != nil {
            http.Error(w, err.Error(), http.StatusBadRequest)
            return
        }

        type upgradeRequest struct {
            RepoURL string                 `json:"repoUrl"`
            Chart   string                 `json:"chart"`
            Version string                 `json:"version"`
            Values  map[string]interface{} `json:"values"`
        }
        var req upgradeRequest
        _ = json.Unmarshal(body, &req)

        var values map[string]interface{}
        if req.Values != nil {
            values = req.Values
        } else {
            if err := json.Unmarshal(body, &values); err != nil {
                http.Error(w, err.Error(), http.StatusBadRequest)
                return
            }
            if values != nil {
                delete(values, "repoUrl")
                delete(values, "chart")
                delete(values, "version")
                delete(values, "values")
            }
        }

        if values == nil {
            values = map[string]interface{}{}
        }

        var rel interface{}
        if req.RepoURL != "" || req.Chart != "" {
            if req.RepoURL == "" || req.Chart == "" {
                http.Error(w, "repoUrl and chart required", http.StatusBadRequest)
                return
            }
            rel, err = manager.UpgradeFromRepo(ns, name, req.RepoURL, req.Chart, req.Version, values)
        } else {
            rel, err = manager.Upgrade(ns, name, values)
        }
        if err != nil {
             http.Error(w, err.Error(), http.StatusInternalServerError)
             return
        }
        json.NewEncoder(w).Encode(rel)

	case "install":
        if r.Method != "POST" {
            http.Error(w, "POST required", http.StatusMethodNotAllowed)
            return
        }
        if name == "" {
            http.Error(w, "name required", http.StatusBadRequest)
            return
        }
        var values map[string]interface{}
        if strings.Contains(r.Header.Get("Content-Type"), "multipart/form-data") {
            if err := r.ParseMultipartForm(10 << 20); err != nil {
                http.Error(w, "invalid multipart form", http.StatusBadRequest)
                return
            }
            file, _, err := r.FormFile("chart")
            if err != nil {
                http.Error(w, "chart file required", http.StatusBadRequest)
                return
            }
            defer file.Close()
            chartData, err := io.ReadAll(file)
            if err != nil {
                http.Error(w, "failed to read chart file", http.StatusBadRequest)
                return
            }
            valuesYaml := r.FormValue("valuesYaml")
            if valuesYaml != "" {
                if err := yaml.Unmarshal([]byte(valuesYaml), &values); err != nil {
                    http.Error(w, "invalid values yaml", http.StatusBadRequest)
                    return
                }
            }
            rel, err := manager.InstallFromArchive(ns, name, chartData, values)
            if err != nil {
                http.Error(w, err.Error(), http.StatusInternalServerError)
                return
            }
            json.NewEncoder(w).Encode(rel)
            return
        }

        var req struct {
            RepoURL    string `json:"repoUrl"`
            Chart      string `json:"chart"`
            Version    string `json:"version"`
            ValuesYaml string `json:"valuesYaml"`
        }
        if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
            http.Error(w, err.Error(), http.StatusBadRequest)
            return
        }
        if req.RepoURL == "" || req.Chart == "" {
            http.Error(w, "repoUrl and chart required", http.StatusBadRequest)
            return
        }
        if req.ValuesYaml != "" {
            if err := yaml.Unmarshal([]byte(req.ValuesYaml), &values); err != nil {
                http.Error(w, "invalid values yaml", http.StatusBadRequest)
                return
            }
        }
        rel, err := manager.InstallFromRepo(ns, name, req.RepoURL, req.Chart, req.Version, values)
        if err != nil {
            http.Error(w, err.Error(), http.StatusInternalServerError)
            return
        }
        json.NewEncoder(w).Encode(rel)

	default:
		http.Error(w, "Unknown action: " + action, http.StatusNotFound)
	}
}
