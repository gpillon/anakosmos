package main

import (
	"crypto/tls"
	"flag"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"path/filepath"
	"strings"

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

	// Serve Frontend (Static Files)
	fs := http.FileServer(http.Dir("../frontend/dist"))
	http.Handle("/", fs)

	// Custom Proxy Handler (Dynamic Target)
	http.HandleFunc("/proxy/", func(w http.ResponseWriter, r *http.Request) {
		// CORS headers
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Kube-Target")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		targetUrlStr := r.Header.Get("X-Kube-Target")
		if targetUrlStr == "" {
			http.Error(w, "X-Kube-Target header missing", http.StatusBadRequest)
			return
		}

		target, err := url.Parse(targetUrlStr)
		if err != nil {
			http.Error(w, "Invalid target URL", http.StatusBadRequest)
			return
		}

		proxy := httputil.NewSingleHostReverseProxy(target)

		originalDirector := proxy.Director
		proxy.Director = func(req *http.Request) {
			originalDirector(req)
			// Fix host header for the target
			req.Host = target.Host

			// Strip /proxy prefix
			// Client sends /proxy/api/v1/pods -> /api/v1/pods
			path := strings.TrimPrefix(req.URL.Path, "/proxy")
			req.URL.Path = path
		}

		// Transport with InsecureSkipVerify (Typical for internal IPs)
		transport := http.DefaultTransport.(*http.Transport).Clone()
		transport.TLSClientConfig = &tls.Config{
			InsecureSkipVerify: true,
		}
		proxy.Transport = transport

		proxy.ServeHTTP(w, r)
	})

	// Internal Proxy (Using local kubeconfig)
	http.HandleFunc("/api/", func(w http.ResponseWriter, r *http.Request) {
		if config == nil {
			http.Error(w, "Kubernetes config not loaded", http.StatusServiceUnavailable)
			return
		}

		target, _ := url.Parse(config.Host)
		proxy := httputil.NewSingleHostReverseProxy(target)

		// Update headers for auth
		originalDirector := proxy.Director
		proxy.Director = func(req *http.Request) {
			originalDirector(req)
			// Strip /api prefix
			// K8s API is at /, so /api/api/v1/... -> /api/v1/...
			// But our client sends /api/api/v1.
			// Let's assume client sends /api/<path> and we map to /<path>
			path := strings.TrimPrefix(req.URL.Path, "/api")
			req.URL.Path = path

			// Set Auth
			if config.BearerToken != "" {
				req.Header.Set("Authorization", "Bearer "+config.BearerToken)
			}
			if config.Username != "" && config.Password != "" {
				req.SetBasicAuth(config.Username, config.Password)
			}
		}

		// Handle TLS
		transport := http.DefaultTransport.(*http.Transport).Clone()
		transport.TLSClientConfig = &tls.Config{
			InsecureSkipVerify: config.TLSClientConfig.Insecure,
		}
		if config.TLSClientConfig.CAData != nil {
			// Add CA logic if strictly needed, but InsecureSkipVerify is common for local dashboards
		}
		proxy.Transport = transport

		proxy.ServeHTTP(w, r)
	})

	log.Printf("Server starting on :%s\n", *port)
	if err := http.ListenAndServe(":"+*port, nil); err != nil {
		log.Fatal(err)
	}
}
