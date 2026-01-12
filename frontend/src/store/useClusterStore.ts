import { create } from 'zustand';
import type { ClusterResource, ClusterLink } from '../api/types';
import { KubeClient } from '../api/kubeClient';

interface ClusterStore {
  resources: Record<string, ClusterResource>;
  links: ClusterLink[];
  isConnected: boolean;
  connectionError: string | null;
  loadingProgress: number;
  loadingMessage: string;
  isSceneReady: boolean;
  client: KubeClient | null;
  
  connect: (mode: 'proxy' | 'custom', url?: string, token?: string) => Promise<void>;
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
