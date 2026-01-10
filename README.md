# Kube3D - 3D Kubernetes Visualization

A web application that provides a clear, interactive 3D visualization of a Kubernetes cluster.

## Features

*   **3D Graph View**: Visualizes Nodes, Pods, Services, and their relationships.
*   **Live Data**: Connects to your Kubernetes cluster via a proxy.
*   **Force-Directed Layout**: Automatically organizes resources based on connections.
*   **Mock Mode**: Includes a built-in demo mode for testing without a cluster.

## Quick Start (Local)

### Prerequisites

*   Node.js 18+
*   Go 1.20+
*   A running Kubernetes cluster (optional, for real data)

### Running

1.  **Frontend**:
    ```bash
    cd frontend
    npm install
    npm run dev
    ```
    Access at `http://localhost:5173`.

2.  **Backend** (for Proxy Mode):
    ```bash
    cd backend
    go run main.go --kubeconfig ~/.kube/config
    ```
    The frontend will proxy `/api` requests to `localhost:8080`.

## Docker / In-Cluster

Build the image:

```bash
docker build -t kube3d:latest .
```

Run locally:

```bash
docker run -p 8080:8080 -v ~/.kube/config:/root/.kube/config kube3d:latest
```

## Architecture

*   **Frontend**: React, Three.js (React Three Fiber), Zustand.
*   **Backend**: Go (Simple Reverse Proxy).
