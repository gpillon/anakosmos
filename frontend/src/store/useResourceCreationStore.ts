import { create } from 'zustand';

export type CreationTab = 'yaml' | 'helm' | 'app';

export type AppSection<T> = {
  enabled: boolean;
  data: T;
};

export interface ResourceMeta {
  labels: Record<string, string>;
  annotations: Record<string, string>;
  namespace?: string;
}

export interface DeploymentItem extends ResourceMeta {
  name: string;
  image: string;
  replicas: number;
  containerPort: number;
  env: Array<{ key: string; value: string }>;
}

export interface ServiceItem extends ResourceMeta {
  name: string;
  type: 'ClusterIP' | 'NodePort' | 'LoadBalancer';
  port: number;
  targetPort: number;
  selectorLabels: Record<string, string>;
}

export interface IngressItem extends ResourceMeta {
  name: string;
  host: string;
  path: string;
  serviceName: string;
}

export interface StorageItem extends ResourceMeta {
  name: string;
  size: string;
  mountPath: string;
  storageClassName?: string;
}

export interface ConfigMapItem extends ResourceMeta {
  name: string;
  entries: Array<{ key: string; value: string }>;
}

export interface SecretItem extends ResourceMeta {
  name: string;
  entries: Array<{ key: string; value: string }>;
}

// Generic resource item for dynamic resource types
export interface GenericResourceItem extends ResourceMeta {
  name: string;
  [key: string]: unknown;
}

export interface AppDraft {
  name: string;
  namespace: string;
  labels: Record<string, string>;
  deployment: AppSection<DeploymentItem[]>;
  service: AppSection<ServiceItem[]>;
  ingress: AppSection<IngressItem[]>;
  storage: AppSection<StorageItem[]>;
  configMap: AppSection<ConfigMapItem[]>;
  secret: AppSection<SecretItem[]>;
  // Additional resource types (dynamic)
  additionalResources: Record<string, AppSection<GenericResourceItem[]>>;
}

const defaultAppDraft: AppDraft = {
  name: 'my-app',
  namespace: 'default',
  labels: { app: 'my-app' },
  deployment: {
    enabled: true,
    data: [
      {
        name: 'my-app',
        image: 'nginx:latest',
        replicas: 2,
        containerPort: 80,
        env: [],
        labels: {},
        annotations: {},
      },
    ],
  },
  service: {
    enabled: true,
    data: [
      {
        name: 'my-app-svc',
        type: 'ClusterIP',
        port: 80,
        targetPort: 80,
        selectorLabels: { app: 'my-app' },
        labels: {},
        annotations: {},
      },
    ],
  },
  ingress: {
    enabled: false,
    data: [
      {
        name: 'my-app-ingress',
        host: 'app.local',
        path: '/',
        serviceName: 'my-app-svc',
        labels: {},
        annotations: {},
      },
    ],
  },
  storage: {
    enabled: false,
    data: [
      {
        name: 'my-app-storage',
        size: '1Gi',
        mountPath: '/data',
        labels: {},
        annotations: {},
      },
    ],
  },
  configMap: {
    enabled: false,
    data: [
      {
        name: 'my-app-config',
        entries: [{ key: 'APP_MODE', value: 'production' }],
        labels: {},
        annotations: {},
      },
    ],
  },
  secret: {
    enabled: false,
    data: [
      {
        name: 'my-app-secret',
        entries: [{ key: 'PASSWORD', value: 'change-me' }],
        labels: {},
        annotations: {},
      },
    ],
  },
  additionalResources: {},
};

interface ResourceCreationStore {
  isOpen: boolean;
  isMinimized: boolean;
  activeTab: CreationTab;
  isCreationMode: boolean;
  appDraft: AppDraft;
  openHub: (tab?: CreationTab) => void;
  closeHub: () => void;
  setMinimized: (minimized: boolean) => void;
  setActiveTab: (tab: CreationTab) => void;
  setCreationMode: (enabled: boolean) => void;
  resetAppDraft: () => void;
  updateAppDraft: (partial: Partial<AppDraft>) => void;
  addAdditionalResource: (resourceTypeId: string, defaultItem: GenericResourceItem) => void;
  removeAdditionalResourceType: (resourceTypeId: string) => void;
  updateAdditionalResource: (resourceTypeId: string, index: number, updates: Partial<GenericResourceItem>) => void;
  addAdditionalResourceItem: (resourceTypeId: string, defaultItem: GenericResourceItem) => void;
  removeAdditionalResourceItem: (resourceTypeId: string, index: number) => void;
}

export const useResourceCreationStore = create<ResourceCreationStore>((set) => ({
  isOpen: false,
  isMinimized: false,
  activeTab: 'yaml',
  isCreationMode: false,
  appDraft: defaultAppDraft,
  openHub: (tab) => set({ isOpen: true, isMinimized: false, activeTab: tab || 'yaml' }),
  closeHub: () => set({ isOpen: false, isMinimized: false, isCreationMode: false }),
  setMinimized: (minimized) => set({ isMinimized: minimized }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setCreationMode: (enabled) => set({ isCreationMode: enabled }),
  resetAppDraft: () => set({ appDraft: defaultAppDraft }),
  updateAppDraft: (partial) =>
    set((state) => {
      const partialDraft = partial as Partial<AppDraft>;
      const mergeSection = <T>(existing: AppSection<T[]>, incoming?: Partial<AppSection<T[]>>): AppSection<T[]> => ({
        ...existing,
        ...incoming,
        data: Array.isArray(incoming?.data) ? incoming!.data : existing.data,
      });

      return {
        appDraft: {
          ...state.appDraft,
          ...partialDraft,
          deployment: mergeSection(state.appDraft.deployment, partialDraft.deployment),
          service: mergeSection(state.appDraft.service, partialDraft.service),
          ingress: mergeSection(state.appDraft.ingress, partialDraft.ingress),
          storage: mergeSection(state.appDraft.storage, partialDraft.storage),
          configMap: mergeSection(state.appDraft.configMap, partialDraft.configMap),
          secret: mergeSection(state.appDraft.secret, partialDraft.secret),
          additionalResources: partialDraft.additionalResources || state.appDraft.additionalResources,
        },
      };
    }),
  addAdditionalResource: (resourceTypeId, defaultItem) =>
    set((state) => ({
      appDraft: {
        ...state.appDraft,
        additionalResources: {
          ...state.appDraft.additionalResources,
          [resourceTypeId]: {
            enabled: true,
            data: [defaultItem],
          },
        },
      },
    })),
  removeAdditionalResourceType: (resourceTypeId) =>
    set((state) => {
      const { [resourceTypeId]: _removed, ...rest } = state.appDraft.additionalResources;
      void _removed; // Intentionally unused
      return {
        appDraft: {
          ...state.appDraft,
          additionalResources: rest,
        },
      };
    }),
  updateAdditionalResource: (resourceTypeId, index, updates) =>
    set((state) => {
      const section = state.appDraft.additionalResources[resourceTypeId];
      if (!section) return state;
      const newData = section.data.map((item, i) => (i === index ? { ...item, ...updates } : item));
      return {
        appDraft: {
          ...state.appDraft,
          additionalResources: {
            ...state.appDraft.additionalResources,
            [resourceTypeId]: { ...section, data: newData },
          },
        },
      };
    }),
  addAdditionalResourceItem: (resourceTypeId, defaultItem) =>
    set((state) => {
      const section = state.appDraft.additionalResources[resourceTypeId];
      if (!section) return state;
      return {
        appDraft: {
          ...state.appDraft,
          additionalResources: {
            ...state.appDraft.additionalResources,
            [resourceTypeId]: { ...section, data: [...section.data, defaultItem] },
          },
        },
      };
    }),
  removeAdditionalResourceItem: (resourceTypeId, index) =>
    set((state) => {
      const section = state.appDraft.additionalResources[resourceTypeId];
      if (!section) return state;
      const newData = section.data.filter((_, i) => i !== index);
      // If no items left, remove the entire resource type
      if (newData.length === 0) {
        const { [resourceTypeId]: _removed, ...rest } = state.appDraft.additionalResources;
        void _removed; // Intentionally unused
        return {
          appDraft: {
            ...state.appDraft,
            additionalResources: rest,
          },
        };
      }
      return {
        appDraft: {
          ...state.appDraft,
          additionalResources: {
            ...state.appDraft.additionalResources,
            [resourceTypeId]: { ...section, data: newData },
          },
        },
      };
    }),
}));
