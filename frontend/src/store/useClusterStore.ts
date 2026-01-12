import { create } from 'zustand';
import type { ClusterResource, ClusterLink } from '../api/types';
import { KubeClient } from '../api/kubeClient';

export type DemoResourceLevel = 'none' | 'node' | 'single-pod' | 'multi-pods' | 'workloads' | 'networking' | 'full';

interface ClusterStore {
  // Real cluster resources
  resources: Record<string, ClusterResource>;
  links: ClusterLink[];
  
  // Demo resources for onboarding (separate from real)
  demoResources: Record<string, ClusterResource>;
  demoLinks: ClusterLink[];
  
  isConnected: boolean;
  connectionError: string | null;
  loadingProgress: number;
  loadingMessage: string;
  isSceneReady: boolean;
  client: KubeClient | null;
  
  connect: (mode: 'proxy' | 'custom', url?: string, token?: string) => Promise<void>;
  setDemoResourceLevel: (level: DemoResourceLevel) => void;
  checkConnection: (url: string) => Promise<boolean>;
  disconnect: () => void;
  setSceneReady: (ready: boolean) => void;
  refresh: () => Promise<void>;
  updateResource: (action: 'ADDED' | 'MODIFIED' | 'DELETED', resource: ClusterResource) => void;
  updateResourceRaw: (resourceId: string, raw: any) => void;
}

export const useClusterStore = create<ClusterStore>((set, get) => ({
  resources: {},
  links: [],
  demoResources: {},
  demoLinks: [],
  isConnected: false,
  connectionError: null,
  loadingProgress: 0,
  loadingMessage: '',
  isSceneReady: false,
  client: null,

  setSceneReady: (ready) => set({ isSceneReady: ready }),

  // Update only the raw field of a resource (from single resource watch)
  updateResourceRaw: (resourceId, raw) => {
    set(state => {
      const resource = state.resources[resourceId];
      if (!resource) return state;
      
      return {
        resources: {
          ...state.resources,
          [resourceId]: {
            ...resource,
            raw,
            // Also update any fields that might have changed
            status: raw?.status?.phase || raw?.status?.availableReplicas !== undefined 
              ? (raw.status.availableReplicas === raw.status.replicas ? 'Available' : 'Progressing')
              : resource.status,
            labels: raw?.metadata?.labels || resource.labels,
          }
        }
      };
    });
  },

  updateResource: (action, res) => {
    set(state => {
        const newResources = { ...state.resources };
        const newLinks = [...state.links];

        if (action === 'DELETED') {
            delete newResources[res.id];
            // Remove links connected to this resource
            const filteredLinks = newLinks.filter(l => l.source !== res.id && l.target !== res.id);
            return { resources: newResources, links: filteredLinks };
        }

        // ADDED or MODIFIED
        
        // Preserve raw data if missing in update (because backend sends simplified object)
        const oldRes = newResources[res.id];
        if (oldRes && oldRes.raw && !res.raw) {
            res.raw = oldRes.raw;
        }

        newResources[res.id] = res;

        // Filter out old outgoing owner/network links for this resource (preserve config/storage)
        const keptLinks = newLinks.filter(l => {
            if (l.source !== res.id) return true;
            // Keep config and storage links - they're set at initial load and rarely change
            if (l.type === 'config' || l.type === 'storage') return true;
            return false;
        });
        
        // Add new owner links
        res.ownerRefs.forEach(ownerId => {
            keptLinks.push({ source: res.id, target: ownerId, type: 'owner' });
        });

        // SPECIAL HANDLING FOR POD -> NODE LINKS
        if (res.kind === 'Pod' && (res as any).nodeName) {
            const nodeName = (res as any).nodeName;
            // Find Node UID by name
            const node = Object.values(newResources).find(r => r.kind === 'Node' && r.name === nodeName);
            if (node) {
                 keptLinks.push({ source: res.id, target: node.id, type: 'owner' });
            }
        }

        // SPECIAL HANDLING FOR SERVICE -> POD LINKS (Network)
        // 1. If this is a Service, find matching Pods
        if (res.kind === 'Service' && res.raw?.spec?.selector) {
            Object.values(newResources).forEach(r => {
                if (r.kind === 'Pod' && r.namespace === res.namespace) {
                    const match = Object.entries(res.raw.spec.selector).every(([k, v]) => r.labels[k as string] === v);
                    if (match) {
                        keptLinks.push({ source: res.id, target: r.id, type: 'network' });
                    }
                }
            });
        }

        // 2. If this is a Pod, update incoming Service links
        if (res.kind === 'Pod') {
             // Remove incoming network links for this Pod (to avoid stale links if labels changed)
             for (let i = keptLinks.length - 1; i >= 0; i--) {
                if (keptLinks[i].target === res.id && keptLinks[i].type === 'network') {
                    keptLinks.splice(i, 1);
                }
             }

             // Find Services that should link to this Pod
             Object.values(newResources).forEach(r => {
                 if (r.kind === 'Service' && r.namespace === res.namespace && r.raw?.spec?.selector) {
                      const match = Object.entries(r.raw.spec.selector).every(([k, v]) => res.labels[k as string] === v);
                      if (match) {
                          keptLinks.push({ source: r.id, target: res.id, type: 'network' });
                      }
                 }
             });
        }
        
        return { resources: newResources, links: keptLinks };
    });
  },

  checkConnection: async (url: string) => {
    // Check if server is reachable (even if unauthorized)
    try {
      const client = new KubeClient('custom', url);
      const isReachable = await client.checkConnection();
      if (!isReachable) throw new Error('Server unreachable');
      return true;
    } catch {
      return false;
    }
  },

  // Set demo resources based on onboarding progress level (separate from real resources)
  setDemoResourceLevel: (level: DemoResourceLevel) => {
    const demoResources: Record<string, ClusterResource> = {};
    const demoLinks: ClusterLink[] = [];
    const now = new Date().toISOString();

    // Level: node - Just show nodes
    if (level !== 'none') {
      demoResources['node-1'] = {
        id: 'node-1',
        name: 'worker-node-1',
        kind: 'Node',
        namespace: '',
        status: 'Ready',
        labels: { 'kubernetes.io/hostname': 'worker-node-1', 'node.kubernetes.io/instance-type': 'm5.large' },
        ownerRefs: [],
        creationTimestamp: now,
        raw: { status: { capacity: { cpu: '4', memory: '16Gi' } } }
      };
    }

    // Level: single-pod - Show 1 pod
    if (level === 'single-pod' || level === 'multi-pods' || level === 'workloads' || level === 'networking' || level === 'full') {
      demoResources['pod-frontend-1'] = {
        id: 'pod-frontend-1',
        name: 'frontend-7d8f9c6b5-x2k4m',
        kind: 'Pod',
        namespace: 'default',
        status: 'Running',
        labels: { app: 'frontend', tier: 'web' },
        ownerRefs: [],
        nodeName: 'worker-node-1',
        creationTimestamp: now,
        raw: { status: { phase: 'Running', containerStatuses: [{ ready: true }] } }
      };
      demoLinks.push({ source: 'pod-frontend-1', target: 'node-1', type: 'owner' });
    }

    // Level: multi-pods - Show 3 pods (replica set concept)
    if (level === 'multi-pods' || level === 'workloads' || level === 'networking' || level === 'full') {
      demoResources['pod-frontend-2'] = {
        id: 'pod-frontend-2',
        name: 'frontend-7d8f9c6b5-m9n3p',
        kind: 'Pod',
        namespace: 'default',
        status: 'Running',
        labels: { app: 'frontend', tier: 'web' },
        ownerRefs: [],
        nodeName: 'worker-node-1',
        creationTimestamp: now,
        raw: { status: { phase: 'Running', containerStatuses: [{ ready: true }] } }
      };
      demoResources['pod-frontend-3'] = {
        id: 'pod-frontend-3',
        name: 'frontend-7d8f9c6b5-q7w8e',
        kind: 'Pod',
        namespace: 'default',
        status: 'Running',
        labels: { app: 'frontend', tier: 'web' },
        ownerRefs: [],
        nodeName: 'worker-node-1',
        creationTimestamp: now,
        raw: { status: { phase: 'Running', containerStatuses: [{ ready: true }] } }
      };
      demoLinks.push({ source: 'pod-frontend-2', target: 'node-1', type: 'owner' });
      demoLinks.push({ source: 'pod-frontend-3', target: 'node-1', type: 'owner' });
    }

    // Level: workloads - Add Deployment + ReplicaSet
    if (level === 'workloads' || level === 'networking' || level === 'full') {
      demoResources['deploy-frontend'] = {
        id: 'deploy-frontend',
        name: 'frontend',
        kind: 'Deployment',
        namespace: 'default',
        status: 'Available',
        labels: { app: 'frontend' },
        ownerRefs: [],
        creationTimestamp: now,
        raw: { spec: { replicas: 3 }, status: { availableReplicas: 3, readyReplicas: 3 } }
      };
      demoResources['rs-frontend'] = {
        id: 'rs-frontend',
        name: 'frontend-7d8f9c6b5',
        kind: 'ReplicaSet',
        namespace: 'default',
        status: 'Available',
        labels: { app: 'frontend' },
        ownerRefs: ['deploy-frontend'],
        creationTimestamp: now,
        raw: { spec: { replicas: 3 }, status: { availableReplicas: 3 } }
      };
      // Link ReplicaSet to Deployment
      demoLinks.push({ source: 'rs-frontend', target: 'deploy-frontend', type: 'owner' });
      // Link Pods to ReplicaSet
      demoLinks.push({ source: 'pod-frontend-1', target: 'rs-frontend', type: 'owner' });
      demoLinks.push({ source: 'pod-frontend-2', target: 'rs-frontend', type: 'owner' });
      demoLinks.push({ source: 'pod-frontend-3', target: 'rs-frontend', type: 'owner' });
    }

    // Level: networking - Add Service + Ingress
    if (level === 'networking' || level === 'full') {
      demoResources['svc-frontend'] = {
        id: 'svc-frontend',
        name: 'frontend-service',
        kind: 'Service',
        namespace: 'default',
        status: 'Active',
        labels: { app: 'frontend' },
        ownerRefs: [],
        creationTimestamp: now,
        raw: { spec: { selector: { app: 'frontend' }, ports: [{ port: 80, targetPort: 8080 }], type: 'ClusterIP' } }
      };
      demoResources['ingress-frontend'] = {
        id: 'ingress-frontend',
        name: 'frontend-ingress',
        kind: 'Ingress',
        namespace: 'default',
        status: 'Active',
        labels: { app: 'frontend' },
        ownerRefs: [],
        creationTimestamp: now,
        raw: { spec: { rules: [{ host: 'app.example.com', http: { paths: [{ path: '/', backend: { service: { name: 'frontend-service' } } }] } }] } }
      };
      // Network links: Service -> Pods
      demoLinks.push({ source: 'svc-frontend', target: 'pod-frontend-1', type: 'network' });
      demoLinks.push({ source: 'svc-frontend', target: 'pod-frontend-2', type: 'network' });
      demoLinks.push({ source: 'svc-frontend', target: 'pod-frontend-3', type: 'network' });
      // Ingress -> Service
      demoLinks.push({ source: 'ingress-frontend', target: 'svc-frontend', type: 'network' });
    }

    // Level: full - Add second node, backend deployment, configmap, secret
    if (level === 'full') {
      // Second node
      demoResources['node-2'] = {
        id: 'node-2',
        name: 'worker-node-2',
        kind: 'Node',
        namespace: '',
        status: 'Ready',
        labels: { 'kubernetes.io/hostname': 'worker-node-2', 'node.kubernetes.io/instance-type': 'm5.large' },
        ownerRefs: [],
        creationTimestamp: now,
        raw: { status: { capacity: { cpu: '4', memory: '16Gi' } } }
      };

      // Backend deployment with pods
      demoResources['deploy-backend'] = {
        id: 'deploy-backend',
        name: 'backend-api',
        kind: 'Deployment',
        namespace: 'default',
        status: 'Available',
        labels: { app: 'backend', tier: 'api' },
        ownerRefs: [],
        creationTimestamp: now,
        raw: { spec: { replicas: 2 }, status: { availableReplicas: 2 } }
      };
      demoResources['rs-backend'] = {
        id: 'rs-backend',
        name: 'backend-api-5f6d7c8e9',
        kind: 'ReplicaSet',
        namespace: 'default',
        status: 'Available',
        labels: { app: 'backend' },
        ownerRefs: ['deploy-backend'],
        creationTimestamp: now,
        raw: { spec: { replicas: 2 } }
      };
      demoResources['pod-backend-1'] = {
        id: 'pod-backend-1',
        name: 'backend-api-5f6d7c8e9-a1b2c',
        kind: 'Pod',
        namespace: 'default',
        status: 'Running',
        labels: { app: 'backend', tier: 'api' },
        ownerRefs: ['rs-backend'],
        nodeName: 'worker-node-2',
        creationTimestamp: now,
        raw: { status: { phase: 'Running' } }
      };
      demoResources['pod-backend-2'] = {
        id: 'pod-backend-2',
        name: 'backend-api-5f6d7c8e9-d3e4f',
        kind: 'Pod',
        namespace: 'default',
        status: 'Running',
        labels: { app: 'backend', tier: 'api' },
        ownerRefs: ['rs-backend'],
        nodeName: 'worker-node-2',
        creationTimestamp: now,
        raw: { status: { phase: 'Running' } }
      };
      demoResources['svc-backend'] = {
        id: 'svc-backend',
        name: 'backend-api-service',
        kind: 'Service',
        namespace: 'default',
        status: 'Active',
        labels: { app: 'backend' },
        ownerRefs: [],
        creationTimestamp: now,
        raw: { spec: { selector: { app: 'backend' }, ports: [{ port: 3000 }] } }
      };

      // ConfigMap and Secret
      demoResources['cm-app-config'] = {
        id: 'cm-app-config',
        name: 'app-config',
        kind: 'ConfigMap',
        namespace: 'default',
        status: '',
        labels: { app: 'shared' },
        ownerRefs: [],
        creationTimestamp: now,
        raw: { data: { 'API_URL': 'http://backend-api:3000', 'LOG_LEVEL': 'info' } }
      };
      demoResources['secret-db'] = {
        id: 'secret-db',
        name: 'db-credentials',
        kind: 'Secret',
        namespace: 'default',
        status: '',
        labels: { app: 'backend' },
        ownerRefs: [],
        creationTimestamp: now,
        raw: { type: 'Opaque' }
      };

      // Links for backend
      demoLinks.push({ source: 'rs-backend', target: 'deploy-backend', type: 'owner' });
      demoLinks.push({ source: 'pod-backend-1', target: 'rs-backend', type: 'owner' });
      demoLinks.push({ source: 'pod-backend-2', target: 'rs-backend', type: 'owner' });
      demoLinks.push({ source: 'pod-backend-1', target: 'node-2', type: 'owner' });
      demoLinks.push({ source: 'pod-backend-2', target: 'node-2', type: 'owner' });
      demoLinks.push({ source: 'svc-backend', target: 'pod-backend-1', type: 'network' });
      demoLinks.push({ source: 'svc-backend', target: 'pod-backend-2', type: 'network' });
      // Config links
      demoLinks.push({ source: 'pod-frontend-1', target: 'cm-app-config', type: 'config' });
      demoLinks.push({ source: 'pod-backend-1', target: 'secret-db', type: 'config' });
    }

    set({ demoResources, demoLinks });
  },

  connect: async (mode, url, token) => {
    try {
      set({ connectionError: null, loadingProgress: 0, loadingMessage: 'Connecting...', isSceneReady: false });
      const client = new KubeClient(mode, url, token);
      
      const isReachable = await client.checkConnection();
      if (!isReachable) throw new Error('Failed to reach server');

      set({ loadingMessage: 'Fetching resources...' });
      const data = await client.getClusterResources((progress, message) => {
          set({ loadingProgress: progress, loadingMessage: message });
      });
      
      set({ 
        client,
        resources: data.resources,
        links: data.links,
        isConnected: true,
        loadingProgress: 100,
        loadingMessage: 'Connected'
      });

      // Start Watch
      client.startWatch((event) => {
          // Handle Watch Event
          const { type, resource } = event;
          if (type && resource) {
              get().updateResource(type, resource);
          }
      });

    } catch (e: any) {
      console.error('Connection failed:', e);
      set({ 
        isConnected: false, 
        connectionError: e.message || 'Failed to connect' 
      });
      throw e; // Re-throw for UI handling
    }
  },

  disconnect: () => {
    set({ 
      isConnected: false, 
      client: null, 
      resources: {}, 
      links: [],
      demoResources: {},
      demoLinks: [],
      isSceneReady: false
    });
  },

  refresh: async () => {
    const { client } = get();
    if (!client) return;

    try {
      const data = await client.getClusterResources();
      set({ 
        resources: data.resources,
        links: data.links 
      });
    } catch (e) {
      console.error('Refresh failed:', e);
    }
  }
}));

// Hook to get display resources - returns demo or real based on onboarding state
// This needs to be used with onboarding state from outside
export const useDisplayResources = (showDemo: boolean) => {
  const resources = useClusterStore(state => state.resources);
  const links = useClusterStore(state => state.links);
  const demoResources = useClusterStore(state => state.demoResources);
  const demoLinks = useClusterStore(state => state.demoLinks);
  
  if (showDemo) {
    return { resources: demoResources, links: demoLinks };
  }
  return { resources, links };
};
