import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type VisualizationMode = 'overview' | 'workload' | 'networking' | 'storage' | 'infrastructure';

export interface SavedConnection {
  id: string;
  name: string;
  url: string;
  mode: 'custom' | 'proxy';
  token?: string; // Optional: user might choose not to save token
  lastUsed: number;
}

export type StatusFilterState = 'default' | 'hidden' | 'grayed' | 'focused';

interface SettingsStore {
  groupBy: 'namespace' | 'node' | 'none';
  filterNamespaces: string[];
  hideSystemNamespaces: boolean;
  hiddenResourceKinds: string[];
  hiddenLinkTypes: string[];
  focusedResourceKind: string | null;
  statusFilters: Record<string, Record<string, StatusFilterState>>; // { Kind: { Status: State } }
  searchQuery: string;
  selectedResourceId: string | null;
  savedConnections: SavedConnection[];
  activePreset: string;
  
  setGroupBy: (groupBy: 'namespace' | 'node' | 'none') => void;
  setFilterNamespaces: (ns: string[]) => void;
  setHideSystemNamespaces: (hide: boolean) => void;
  toggleHiddenResourceKind: (kind: string) => void;
  setHiddenResourceKinds: (kinds: string[]) => void;
  toggleHiddenLinkType: (type: string) => void;
  setFocusedResourceKind: (kind: string | null) => void;
  cycleStatusFilter: (kind: string, status: string) => void;
  setSearchQuery: (query: string) => void;
  setSelectedResourceId: (id: string | null) => void;
  setActivePreset: (preset: string) => void;
  
  addSavedConnection: (conn: Omit<SavedConnection, 'id' | 'lastUsed'>) => void;
  removeSavedConnection: (id: string) => void;
  updateSavedConnection: (id: string, updates: Partial<SavedConnection>) => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      groupBy: 'namespace',
      filterNamespaces: [],
      hideSystemNamespaces: false,
      hiddenResourceKinds: [],
      hiddenLinkTypes: [],
      focusedResourceKind: null,
      statusFilters: {},
      searchQuery: '',
      selectedResourceId: null,
      savedConnections: [],
      activePreset: 'overview',

      setGroupBy: (groupBy) => set({ groupBy }),
      setFilterNamespaces: (ns) => set({ filterNamespaces: ns }),
      setHideSystemNamespaces: (hide) => set({ hideSystemNamespaces: hide }),
      toggleHiddenResourceKind: (kind) => set((state) => {
        const isHidden = state.hiddenResourceKinds.includes(kind);
        return {
          hiddenResourceKinds: isHidden 
            ? state.hiddenResourceKinds.filter(k => k !== kind)
            : [...state.hiddenResourceKinds, kind]
        };
      }),
      setHiddenResourceKinds: (kinds) => set({ hiddenResourceKinds: kinds }),
      toggleHiddenLinkType: (type) => set((state) => {
        const isHidden = state.hiddenLinkTypes.includes(type);
        return {
          hiddenLinkTypes: isHidden 
            ? state.hiddenLinkTypes.filter(t => t !== type)
            : [...state.hiddenLinkTypes, type]
        };
      }),
      setFocusedResourceKind: (kind) => set((state) => ({ 
        focusedResourceKind: state.focusedResourceKind === kind ? null : kind 
      })),
      cycleStatusFilter: (kind, status) => set((state) => {
        const currentKindFilters = state.statusFilters[kind] || {};
        const currentState = currentKindFilters[status] || 'default';
        
        let nextState: StatusFilterState = 'default';
        if (currentState === 'default') nextState = 'hidden';
        else if (currentState === 'hidden') nextState = 'grayed';
        else if (currentState === 'grayed') nextState = 'focused';
        else if (currentState === 'focused') nextState = 'default';

        return {
          statusFilters: {
            ...state.statusFilters,
            [kind]: {
              ...currentKindFilters,
              [status]: nextState
            }
          }
        };
      }),
      setSearchQuery: (query) => set({ searchQuery: query }),
      setSelectedResourceId: (id) => set({ selectedResourceId: id }),
      setActivePreset: (preset) => set({ activePreset: preset }),
      
      addSavedConnection: (conn) => set((state) => {
        // Check if exists to update instead of duplicate
        const existing = state.savedConnections.find(c => c.url === conn.url && c.mode === conn.mode);
        if (existing) {
          return {
            savedConnections: state.savedConnections.map(c => 
              c.id === existing.id 
                ? { ...c, ...conn, lastUsed: Date.now(), token: conn.token || c.token } 
                : c
            )
          };
        }
        return {
          savedConnections: [
            ...state.savedConnections,
            { ...conn, id: crypto.randomUUID(), lastUsed: Date.now() }
          ]
        };
      }),
      
      removeSavedConnection: (id) => set((state) => ({
        savedConnections: state.savedConnections.filter(c => c.id !== id)
      })),
      
      updateSavedConnection: (id, updates) => set((state) => ({
        savedConnections: state.savedConnections.map(c => 
          c.id === id ? { ...c, ...updates, lastUsed: Date.now() } : c
        )
      })),
    }),
    {
      name: 'kube3d-settings',
      partialize: (state) => ({ 
        savedConnections: state.savedConnections,
        groupBy: state.groupBy,
        filterNamespaces: state.filterNamespaces,
        hideSystemNamespaces: state.hideSystemNamespaces,
        hiddenResourceKinds: state.hiddenResourceKinds,
        hiddenLinkTypes: state.hiddenLinkTypes,
        statusFilters: state.statusFilters,
        activePreset: state.activePreset,
        // focusedResourceKind is NOT persisted intentionally (session only)
      }), // Only persist these fields
    }
  )
);
