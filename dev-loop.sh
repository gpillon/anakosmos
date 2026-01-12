#!/bin/bash
set -e

CLUSTER_NAME="anakosmos-dev"
IMAGE_NAME="localhost/anakosmos:latest"

# Function to handle cleanup on exit
cleanup() {
    echo "Stopping log streaming..."
    # Kill background jobs if any
    kill $(jobs -p) 2>/dev/null || true
}
trap cleanup EXIT

# Build and Deploy Function
deploy() {
    echo "🔄 Rebuilding and Deploying..."
    
    # Build Image (using podman as requested)
    podman build -t $IMAGE_NAME .
    
    # Load Image into Kind
    # Since we are using podman, we might need to export/import or use specific kind loading
    # Assuming kind load works with local docker/podman daemon
    kind load docker-image $IMAGE_NAME --name $CLUSTER_NAME
    
    # Restart Deployment
    kubectl rollout restart deployment/anakosmos
    
    # Wait for rollout
    kubectl rollout status deployment/anakosmos --timeout=60s
}

# Initial Deploy
deploy

echo "-------------------------------------------------------"
echo "Environment ready!"
echo "To access the application, open http://localhost:33445"
echo "-------------------------------------------------------"

# Stream Logs in background
kubectl logs -f -l app=anakosmos --all-containers=true &
LOG_PID=$!

# Watch for changes
# We need a file watcher. 'inotifywait' is common on Linux.
# If not available, we can use a simple loop or ask user to install it.
# Assuming user is on Linux/WSL as per system info.

if ! command -v inotifywait &> /dev/null; then
    echo "⚠️  inotifywait not found. Installing inotify-tools..."
    if [ -f /etc/debian_version ]; then
        sudo apt-get update && sudo apt-get install -y inotify-tools
    elif [ -f /etc/alpine-release ]; then
        apk add inotify-tools
    else
        echo "❌ Please install inotify-tools manually."
        exit 1
    fi
fi

echo "👀 Watching for changes in backend/ and frontend/src/..."

while true; do
    # Watch for changes in go files and ts/tsx files
    # We exclude node_modules and other temp files
    inotifywait -r -e modify,create,delete,move \
        --exclude 'node_modules|dist|tmp|\.git' \
        backend/ frontend/src/ 2>/dev/null
    
    echo "📝 Change detected!"
    
    # Kill current log stream
    kill $LOG_PID 2>/dev/null || true
    
    # Redeploy
    deploy
    
    # Resume Logs
    kubectl logs -f -l app=anakosmos --all-containers=true &
    LOG_PID=$!
done
