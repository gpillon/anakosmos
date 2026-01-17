package main

import (
	"flag"
	"log"
	"net/http"
	"path/filepath"

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

	// API Routes
	// Status
	http.HandleFunc("/api/status", api.StatusHandler(config))

	// Exec Handler
	http.HandleFunc("/api/sock/exec", func(w http.ResponseWriter, r *http.Request) {
		targetUrl := r.URL.Query().Get("target")
		token := r.URL.Query().Get("token")

		var execConfig *rest.Config
		if targetUrl != "" {
			execConfig = &rest.Config{
				Host:            targetUrl,
				BearerToken:     token,
				TLSClientConfig: rest.TLSClientConfig{Insecure: true},
			}
		} else {
			execConfig = config
		}

		if execConfig == nil {
			http.Error(w, "Kubernetes config not loaded", http.StatusServiceUnavailable)
			return
		}
		k8s.HandleExec(execConfig, w, r)
	})

	// Watch Handler (all resources - simplified)
	http.HandleFunc("/api/sock/watch", func(w http.ResponseWriter, r *http.Request) {
		targetUrl := r.URL.Query().Get("target")
		token := r.URL.Query().Get("token")

		var watchConfig *rest.Config
		if targetUrl != "" {
			watchConfig = &rest.Config{
				Host:            targetUrl,
				BearerToken:     token,
				TLSClientConfig: rest.TLSClientConfig{Insecure: true},
			}
		} else {
			watchConfig = config
		}

		if watchConfig == nil {
			http.Error(w, "Kubernetes config not loaded", http.StatusServiceUnavailable)
			return
		}
		k8s.HandleWatch(watchConfig, w, r)
	})

	// Single Resource Watch Handler (full object data)
	http.HandleFunc("/api/sock/watch/resource", func(w http.ResponseWriter, r *http.Request) {
		targetUrl := r.URL.Query().Get("target")
		token := r.URL.Query().Get("token")

		var watchConfig *rest.Config
		if targetUrl != "" {
			watchConfig = &rest.Config{
				Host:            targetUrl,
				BearerToken:     token,
				TLSClientConfig: rest.TLSClientConfig{Insecure: true},
			}
		} else {
			watchConfig = config
		}

		if watchConfig == nil {
			http.Error(w, "Kubernetes config not loaded", http.StatusServiceUnavailable)
			return
		}
		k8s.HandleSingleWatch(watchConfig, w, r)
	})

	// Cluster Init Handler - returns all resources in lightweight format with pre-calculated links
	http.HandleFunc("/api/cluster/init", func(w http.ResponseWriter, r *http.Request) {
		targetUrl := r.URL.Query().Get("target")
		token := r.URL.Query().Get("token")

		var initConfig *rest.Config
		if targetUrl != "" {
			initConfig = &rest.Config{
				Host:            targetUrl,
				BearerToken:     token,
				TLSClientConfig: rest.TLSClientConfig{Insecure: true},
			}
		} else {
			initConfig = config
		}

		if initConfig == nil {
			http.Error(w, "Kubernetes config not loaded", http.StatusServiceUnavailable)
			return
		}
		k8s.HandleInit(initConfig, w, r)
	})

	// Apply YAML Handler
	http.HandleFunc("/api/resources/apply-yaml", func(w http.ResponseWriter, r *http.Request) {
		targetUrl := r.URL.Query().Get("target")
		token := r.URL.Query().Get("token")

		var applyConfig *rest.Config
		if targetUrl != "" {
			applyConfig = &rest.Config{
				Host:            targetUrl,
				BearerToken:     token,
				TLSClientConfig: rest.TLSClientConfig{Insecure: true},
			}
		} else {
			applyConfig = config
		}

		if applyConfig == nil {
			http.Error(w, "Kubernetes config not loaded", http.StatusServiceUnavailable)
			return
		}
		k8s.HandleApplyYaml(applyConfig, w, r)
	})

	// Helm Handler - MUST be registered BEFORE /api/ catch-all
	http.HandleFunc("/api/helm/", func(w http.ResponseWriter, r *http.Request) {
		targetUrl := r.URL.Query().Get("target")
		token := r.URL.Query().Get("token")

		var helmConfig *rest.Config
		if targetUrl != "" {
			helmConfig = &rest.Config{
				Host:            targetUrl,
				BearerToken:     token,
				TLSClientConfig: rest.TLSClientConfig{Insecure: true},
			}
		} else {
			helmConfig = config
		}

		if helmConfig == nil {
			http.Error(w, "Kubernetes config not loaded", http.StatusServiceUnavailable)
			return
		}
		helm.HandleHelmRequest(helmConfig, w, r)
	})

	// Custom Proxy Handler (Dynamic Target)
	http.HandleFunc("/proxy/", api.ProxyHandler())

	// Internal Proxy (Using local kubeconfig) - This is a catch-all, must be last
	http.HandleFunc("/api/", api.InternalProxyHandler(config))

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
