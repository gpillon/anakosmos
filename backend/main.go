package main

import (
	"flag"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/anakosmos/backend/src/api"
	"github.com/anakosmos/backend/src/helm"
	"github.com/anakosmos/backend/src/k8s"

	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
	"k8s.io/client-go/util/homedir"
)

func main() {
	var kubeconfig *string
	if home := homedir.HomeDir(); home != "" {
		kubeconfig = flag.String("kubeconfig", filepath.Join(home, ".kube", "config"), "(optional) absolute path to the kubeconfig file")
	} else {
		kubeconfig = flag.String("kubeconfig", "", "absolute path to the kubeconfig file")
	}
	port := flag.String("port", "8080", "Port to listen on")
	devProxy := flag.String("dev-proxy", "", "Dev URL to reverse proxy to (e.g. http://localhost:5173)")
	flag.Parse()

	inClusterMode := strings.EqualFold(os.Getenv("IN_CLUSTER_MODE"), "true")
	if inClusterMode {
		log.Println("IN_CLUSTER_MODE is enabled — proxy mode will use the local ServiceAccount")
	} else {
		log.Println("IN_CLUSTER_MODE is disabled — proxy mode via internal config is blocked")
	}

	// Try to build config from flags
	config, err := clientcmd.BuildConfigFromFlags("", *kubeconfig)
	if err != nil {
		// Fallback to in-cluster config
		log.Println("Could not load kubeconfig, trying in-cluster config...")
		config, err = rest.InClusterConfig()
		if err != nil {
			log.Printf("Warning: Could not connect to Kubernetes cluster: %v. Proxy will fail.\n", err)
		}
	}

	// resolveConfig returns the appropriate rest.Config for a request.
	// When a custom target is provided, it builds a config from the target/token params.
	// When no target is provided, it uses the local config only if IN_CLUSTER_MODE is enabled.
	resolveConfig := func(w http.ResponseWriter, r *http.Request) *rest.Config {
		targetUrl := r.URL.Query().Get("target")
		token := r.URL.Query().Get("token")

		if targetUrl != "" {
			return &rest.Config{
				Host:            targetUrl,
				BearerToken:     token,
				TLSClientConfig: rest.TLSClientConfig{Insecure: true},
			}
		}

		if !inClusterMode {
			http.Error(w, "In-cluster mode is disabled. Set IN_CLUSTER_MODE=true to allow proxy access, or connect to a remote cluster.", http.StatusForbidden)
			return nil
		}

		if config == nil {
			http.Error(w, "Kubernetes config not loaded", http.StatusServiceUnavailable)
			return nil
		}

		return config
	}

	// API Routes
	// Status
	http.HandleFunc("/api/status", api.StatusHandler(config))

	// Exec Handler
	http.HandleFunc("/api/sock/exec", func(w http.ResponseWriter, r *http.Request) {
		c := resolveConfig(w, r)
		if c == nil {
			return
		}
		k8s.HandleExec(c, w, r)
	})

	// Watch Handler (all resources - simplified)
	http.HandleFunc("/api/sock/watch", func(w http.ResponseWriter, r *http.Request) {
		c := resolveConfig(w, r)
		if c == nil {
			return
		}
		k8s.HandleWatch(c, w, r)
	})

	// Single Resource Watch Handler (full object data)
	http.HandleFunc("/api/sock/watch/resource", func(w http.ResponseWriter, r *http.Request) {
		c := resolveConfig(w, r)
		if c == nil {
			return
		}
		k8s.HandleSingleWatch(c, w, r)
	})

	// Cluster Init Handler - returns all resources in lightweight format with pre-calculated links
	http.HandleFunc("/api/cluster/init", func(w http.ResponseWriter, r *http.Request) {
		c := resolveConfig(w, r)
		if c == nil {
			return
		}
		k8s.HandleInit(c, w, r)
	})

	// Apply YAML Handler
	http.HandleFunc("/api/resources/apply-yaml", func(w http.ResponseWriter, r *http.Request) {
		c := resolveConfig(w, r)
		if c == nil {
			return
		}
		k8s.HandleApplyYaml(c, w, r)
	})

	// Helm Handler - MUST be registered BEFORE /api/ catch-all
	http.HandleFunc("/api/helm/", func(w http.ResponseWriter, r *http.Request) {
		c := resolveConfig(w, r)
		if c == nil {
			return
		}
		helm.HandleHelmRequest(c, w, r)
	})

	// Custom Proxy Handler (Dynamic Target)
	http.HandleFunc("/proxy/", api.ProxyHandler())

	// Internal Proxy (Using local kubeconfig) - This is a catch-all, must be last
	http.HandleFunc("/api/", api.InternalProxyHandler(config, inClusterMode))

	// Serve Frontend or Proxy to Dev Server
	if *devProxy != "" {
		log.Printf("Proxying frontend requests to %s\n", *devProxy)
		http.Handle("/", api.FrontendProxyHandler(*devProxy))
	} else {
		// Serve Static Files
		// Ensure we serve from the correct relative path in the container
		// In Dockerfile we copy to /app/frontend/dist and binary is in /app
		fs := http.FileServer(http.Dir("frontend/dist"))
		http.Handle("/", fs)
	}

	log.Printf("Server starting on :%s\n", *port)
	if err := http.ListenAndServe(":"+*port, nil); err != nil {
		log.Fatal(err)
	}
}
