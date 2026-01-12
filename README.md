# Anakosmos - 3D Kubernetes Administration

[![Build and Push](https://github.com/gpillon/anakosmos/actions/workflows/build.yaml/badge.svg)](https://github.com/gpillon/anakosmos/actions/workflows/build.yaml)
[![Release Helm Chart](https://github.com/gpillon/anakosmos/actions/workflows/helm-release.yaml/badge.svg)](https://github.com/gpillon/anakosmos/actions/workflows/helm-release.yaml)

A web application that provides a clear, interactive 3D visualization of a Kubernetes cluster.

![Anakosmos Screenshot](https://raw.githubusercontent.com/gpillon/anakosmos/main/docs/screenshot.png)

## Features

*   **3D Graph View**: Visualizes Nodes, Pods, Services, Deployments, and their relationships.
*   **Live Data**: Connects to your Kubernetes cluster via a proxy.
*   **Force-Directed Layout**: Automatically organizes resources based on connections.
*   **Mock Mode**: Includes a built-in demo mode for testing without a cluster.
*   **Multi-Architecture**: Supports both `amd64` and `arm64` platforms.

## Quick Start

### Using Helm (Recommended)

```bash
# Add the Helm repository
helm repo add anakosmos https://gpillon.github.io/anakosmos
helm repo update

# Install in your cluster
helm install anakosmos anakosmos/anakosmos

# Access via port-forward
kubectl port-forward svc/anakosmos 8080:80
```

Then visit `http://localhost:8080`.

### Using Docker

```bash
docker run -p 8080:8080 -v ~/.kube/config:/root/.kube/config ghcr.io/gpillon/anakosmos:latest
```

### Using kubectl

```bash
kubectl apply -f https://raw.githubusercontent.com/gpillon/anakosmos/main/backend/deploy/rbac.yaml
kubectl apply -f https://raw.githubusercontent.com/gpillon/anakosmos/main/backend/deploy/deployment.yaml
kubectl port-forward svc/anakosmos 8080:80
```

## Configuration

### Helm Values

| Parameter | Description | Default |
|-----------|-------------|---------|
| `replicaCount` | Number of replicas | `1` |
| `image.repository` | Image repository | `ghcr.io/gpillon/anakosmos` |
| `image.tag` | Image tag | Chart's `appVersion` |
| `service.type` | Service type | `ClusterIP` |
| `ingress.enabled` | Enable ingress | `false` |
| `rbac.create` | Create RBAC resources | `true` |

See [values.yaml](charts/anakosmos/values.yaml) for full configuration options.

## Development

### Prerequisites

*   Node.js 18+
*   Go 1.20+
*   A running Kubernetes cluster (optional, for real data)

### Running Locally

```bash
# Start both frontend and backend with hot reload
make dev
```

Or separately:

```bash
# Frontend (http://localhost:5173)
cd frontend && npm install && npm run dev

# Backend (http://localhost:8080)
cd backend && go run main.go --kubeconfig ~/.kube/config
```

### Building Docker Image

```bash
# Build multi-arch image
docker buildx build --platform linux/amd64,linux/arm64 -t anakosmos:latest .
```

## Architecture

*   **Frontend**: React, Three.js (React Three Fiber), Zustand, TailwindCSS
*   **Backend**: Go (WebSocket proxy to Kubernetes API)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see [LICENSE](LICENSE) for details.
