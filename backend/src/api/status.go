package api

import (
	"encoding/json"
	"net/http"
	"os"

	"k8s.io/client-go/rest"
)

// StatusHandler returns the running environment status (in-cluster vs local)
func StatusHandler(config *rest.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		// Check if we are running in-cluster
		inCluster := config != nil && os.Getenv("KUBERNETES_SERVICE_HOST") != ""
		json.NewEncoder(w).Encode(map[string]interface{}{
			"inCluster":  inCluster,
			"configured": config != nil,
		})
	}
}
