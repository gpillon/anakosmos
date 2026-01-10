import { create } from 'zustand';
import type { ClusterResource, ClusterLink } from '../api/types';
import { KubeClient } from '../api/kubeClient';

interface ClusterStore {
  resources: Record<string, ClusterResource>;
  links: ClusterLink[];
  isConnected: boolean;
  connectionError: string | null;
  client: KubeClient | null;
  
  connect: (mode: 'mock' | 'proxy' | 'custom', url?: string, token?: string) => Promise<void>;
  checkConnection: (url: string) => Promise<boolean>;
  disconnect: () => void;
  refresh: () => Promise<void>;
  updateResource: (action: 'ADDED' | 'MODIFIED' | 'DELETED', resource: ClusterResource) => void;
}

export const useClusterStore = create<ClusterStore>((set, get) => ({
  resources: {},
  links: [],
  isConnected: false,
  connectionError: null,
  client: null,

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
        newResources[res.id] = res;

        // If it's a new resource or links changed, we might need to update links.
        // The simple way is: remove old links for this resource, add new ones from ownerRefs.
        // But links are bidirectional in our model (source/target).
        // Wait, our backend 'simplifyObject' sends ownerRefs as IDs.
        
        // 1. Remove old outgoing links (where source is this resource)
        // We keep incoming links (where target is this resource) unless the other resource updates?
        // Actually, 'owner' links: Pod -> Node. If Pod updates, we update that link.
        // Service -> Pod links are 'network'. Backend doesn't send those in the simplified object yet?
        // Wait, backend 'simplifyObject' sends ownerRefs. It does NOT send service selectors or volume links yet.
        // So for now, we only get owner links update.
        
        // Filter out old outgoing links for this resource
        const keptLinks = newLinks.filter(l => l.source !== res.id);
        
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
      set({ connectionError: null });
      const client = new KubeClient(mode, url, token);
      
      // If not mock, maybe do a quick check first?
      if (mode !== 'mock') {
         const isReachable = await client.checkConnection();
         if (!isReachable) throw new Error('Failed to reach server');
      }

      const data = await client.getClusterResources();
      
      set({ 
        client,
        resources: data.resources,
        links: data.links,
        isConnected: true 
      });

      // Start Watch
      if (mode !== 'mock') {
         client.startWatch((event) => {
             // Handle Watch Event
             const { type, resource } = event;
             if (type && resource) {
                 get().updateResource(type, resource);
             }
         });
      }

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
      links: [] 
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
