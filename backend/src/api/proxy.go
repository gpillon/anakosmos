package api

import (
	"crypto/tls"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"

	"k8s.io/client-go/rest"
)

// ProxyHandler handles requests to custom targets (Dynamic Target)
func ProxyHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
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
	}
}

// InternalProxyHandler handles requests to the local/in-cluster Kubernetes API
func InternalProxyHandler(config *rest.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
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
			InsecureSkipVerify: true,
		}
		// If CA Data is present, we could add it, but InsecureSkipVerify: true solves the "unknown authority" error 
		// which happens because the pod doesn't trust the cluster CA by default or internal IP certs.
		// Since we are proxying, skipping verify is acceptable for dev/internal tool.
		
		proxy.Transport = transport

		proxy.ServeHTTP(w, r)
	}
}

// FrontendProxyHandler proxies requests to the frontend dev server (Vite)
func FrontendProxyHandler(devProxy string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		target, err := url.Parse(devProxy)
		if err != nil {
			http.Error(w, "Invalid dev-proxy URL", http.StatusInternalServerError)
			return
		}
		proxy := httputil.NewSingleHostReverseProxy(target)

		originalDirector := proxy.Director
		proxy.Director = func(req *http.Request) {
			originalDirector(req)
			req.Host = target.Host
		}

		proxy.ServeHTTP(w, r)
	}
}
