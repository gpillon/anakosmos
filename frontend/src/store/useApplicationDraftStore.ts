import { create } from 'zustand';

// Simple unique ID generator
const generateId = () => `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

/**
 * A draft resource is a Kubernetes resource being composed before creation.
 * It stores the full K8s resource spec and some UI metadata.
 */
export interface DraftResource {
  /** Unique ID for this draft resource (for UI keying) */
  id: string;
  /** Kubernetes kind (Deployment, Service, etc.) */
  kind: string;
  /** The full Kubernetes resource object */
  spec: Record<string, unknown>;
  /** Optional: which blueprint this came from */
  fromBlueprint?: string;
}

/**
 * Blueprint definition - a named collection of resources
 */
export interface Blueprint {
  id: string;
  name: string;
  description: string;
  icon: string; // Lucide icon name
  /** Generate the draft resources for this blueprint */
  createResources: (appName: string, namespace: string) => DraftResource[];
}

/**
 * Application Draft State
 */
interface ApplicationDraftState {
  /** Application name (used for labeling) */
  appName: string;
  /** Target namespace */
  namespace: string;
  /** Common labels applied to all resources */
  labels: Record<string, string>;
  /** All draft resources */
  resources: DraftResource[];
  /** Currently selected blueprint ID */
  selectedBlueprintId: string | null;
  /** Resource being edited (by ID) */
  editingResourceId: string | null;
}

interface ApplicationDraftActions {
  /** Set app name and update labels */
  setAppName: (name: string) => void;
  /** Set namespace */
  setNamespace: (ns: string) => void;
  /** Set labels */
  setLabels: (labels: Record<string, string>) => void;
  /** Apply a blueprint */
  applyBlueprint: (blueprint: Blueprint) => void;
  /** Add a new resource */
  addResource: (kind: string, spec: Record<string, unknown>) => string;
  /** Update a resource */
  updateResource: (id: string, spec: Record<string, unknown>) => void;
  /** Remove a resource */
  removeResource: (id: string) => void;
  /** Start editing a resource */
  setEditingResource: (id: string | null) => void;
  /** Get a resource by ID */
  getResource: (id: string) => DraftResource | undefined;
  /** Clear all resources and reset */
  reset: () => void;
  /** Get all resources as K8s objects (with namespace injected) */
  getResourceSpecs: () => Record<string, unknown>[];
}

type ApplicationDraftStore = ApplicationDraftState & ApplicationDraftActions;

const initialState: ApplicationDraftState = {
  appName: 'my-app',
  namespace: 'default',
  labels: { app: 'my-app' },
  resources: [],
  selectedBlueprintId: null,
  editingResourceId: null,
};

export const useApplicationDraftStore = create<ApplicationDraftStore>((set, get) => ({
  ...initialState,
  
  setAppName: (name: string) => {
    set((state) => ({
      appName: name,
      labels: { ...state.labels, app: name },
      // Update app label in all resources
      resources: state.resources.map(r => ({
        ...r,
        spec: updateAppLabel(r.spec, name),
      })),
    }));
  },
  
  setNamespace: (ns: string) => {
    set({ namespace: ns });
  },
  
  setLabels: (labels: Record<string, string>) => {
    set({ labels });
  },
  
  applyBlueprint: (blueprint: Blueprint) => {
    const state = get();
    const resources = blueprint.createResources(state.appName, state.namespace);
    set({
      resources,
      selectedBlueprintId: blueprint.id,
    });
  },
  
  addResource: (kind: string, spec: Record<string, unknown>) => {
    const id = generateId();
    const state = get();
    
    // Inject namespace and app label
    const enrichedSpec = {
      ...spec,
      metadata: {
        ...(spec.metadata as Record<string, unknown> || {}),
        namespace: state.namespace,
        labels: {
          ...((spec.metadata as Record<string, unknown>)?.labels as Record<string, unknown> || {}),
          app: state.appName,
        },
      },
    };
    
    set((state) => ({
      resources: [...state.resources, { id, kind, spec: enrichedSpec }],
    }));
    return id;
  },
  
  updateResource: (id: string, spec: Record<string, unknown>) => {
    set((state) => ({
      resources: state.resources.map(r => 
        r.id === id ? { ...r, spec } : r
      ),
    }));
  },
  
  removeResource: (id: string) => {
    set((state) => ({
      resources: state.resources.filter(r => r.id !== id),
      editingResourceId: state.editingResourceId === id ? null : state.editingResourceId,
    }));
  },
  
  setEditingResource: (id: string | null) => {
    set({ editingResourceId: id });
  },
  
  getResource: (id: string) => {
    return get().resources.find(r => r.id === id);
  },
  
  reset: () => {
    set(initialState);
  },
  
  getResourceSpecs: () => {
    const state = get();
    return state.resources.map(r => ({
      ...r.spec,
      metadata: {
        ...(r.spec.metadata as Record<string, unknown> || {}),
        namespace: (r.spec.metadata as Record<string, unknown>)?.namespace || state.namespace,
      },
    }));
  },
}));

/**
 * Helper to update app label in a resource spec
 */
function updateAppLabel(spec: Record<string, unknown>, appName: string): Record<string, unknown> {
  const metadata = spec.metadata as Record<string, unknown> || {};
  const labels = metadata.labels as Record<string, string> || {};
  
  return {
    ...spec,
    metadata: {
      ...metadata,
      labels: {
        ...labels,
        app: appName,
      },
    },
  };
}

/**
 * Selector: Get resource count by kind
 */
export const selectResourceCountByKind = (state: ApplicationDraftStore): Record<string, number> => {
  return state.resources.reduce((acc, r) => {
    acc[r.kind] = (acc[r.kind] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
};
