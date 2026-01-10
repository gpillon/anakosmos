
# Kind Dev Environment
KIND_CLUSTER_NAME ?= kube3d-dev

.PHONY: backend-run backend-build backend-setup frontend-install frontend-build frontend-run dev backend-dev
.PHONY: kind-up kind-down docker-build kind-load deploy dev-kind

# Backend
backend-setup:
	cd backend && go mod tidy

backend-build:
	cd backend && go build -o kube3d-server main.go

# Runs the server (no hot reload)
backend-run:
	cd backend && go run main.go --port=8080

# Runs the server with hot reload (installs air if missing)
backend-dev:
	@if [ ! -f "$$(go env GOPATH)/bin/air" ]; then \
		echo "Installing air for hot reload..."; \
		go install github.com/air-verse/air@v1.61.1; \
	fi
	cd backend && $$(go env GOPATH)/bin/air

# Frontend
frontend-install:
	cd frontend && npm install

frontend-build:
	cd frontend && npm run build

frontend-run:
	cd frontend && npm run dev

# Dev (Run backend and frontend in parallel)
dev:
	$(MAKE) -j2 backend-dev frontend-run

kind-up:
	kind create cluster --config kind-config.yaml --name $(KIND_CLUSTER_NAME) || true

kind-down:
	kind delete cluster --name $(KIND_CLUSTER_NAME)

docker-build:
	podman build -t localhost/kube3d:latest . || podman build --no-cache -t localhost/kube3d:latest .

kind-load:
	kind load docker-image localhost/kube3d:latest --name $(KIND_CLUSTER_NAME)

deploy:
	kubectl apply -f backend/deploy/
	kubectl rollout restart deployment/kube3d || true

dev-kind: kind-up
	./dev-loop.sh
