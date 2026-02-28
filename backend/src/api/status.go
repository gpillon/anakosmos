package api

import (
	"encoding/json"
	"net/http"
	"os"
	"strings"

	"k8s.io/client-go/rest"
)

// StatusHandler returns the running environment status (in-cluster vs local)
func StatusHandler(config *rest.Config) http.HandlerFunc {
	inClusterMode := strings.EqualFold(os.Getenv("IN_CLUSTER_MODE"), "true")

	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		inCluster := config != nil && os.Getenv("KUBERNETES_SERVICE_HOST") != ""
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"inCluster":     inCluster,
			"inClusterMode": inClusterMode,
			"configured":    config != nil,
		})
	}
}
