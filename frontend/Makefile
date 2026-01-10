.PHONY: backend-run backend-build backend-setup

backend-setup:
	cd backend && go mod tidy

backend-build:
	cd backend && go build -o kube3d-server main.go

backend-run:
	cd backend && go run main.go --port=8080
