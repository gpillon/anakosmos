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
}

export const useClusterStore = create<ClusterStore>((set, get) => ({
  resources: {},
  links: [],
  isConnected: false,
  connectionError: null,
  client: null,

  checkConnection: async (url: string) => {
    // Check if server is reachable (even if unauthorized)
    try {
      const client = new KubeClient('custom', url);
      const isReachable = await client.checkConnection();
      if (!isReachable) throw new Error('Server unreachable');
      return true;
    } catch (e) {
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
