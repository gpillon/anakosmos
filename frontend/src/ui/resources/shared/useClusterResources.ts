import { useMemo } from 'react';
import { useClusterStore } from '../../../store/useClusterStore';

type ResourceKind = 
  | 'ConfigMap' 
  | 'Secret' 
  | 'PersistentVolumeClaim' 
  | 'ServiceAccount'
  | 'Node'
  | 'PriorityClass'
  | 'Service';

/**
 * Hook to get available resources of a specific kind from the cluster store.
 * Optionally filtered by namespace.
 */
export function useClusterResourceNames(kind: ResourceKind, namespace?: string): string[] {
  const resources = useClusterStore(state => state.resources);
  
  return useMemo(() => {
    return Object.values(resources)
      .filter(r => {
        if (r.kind !== kind) return false;
        // Nodes and PriorityClasses are cluster-scoped, no namespace filtering
        if (kind === 'Node' || kind === 'PriorityClass') return true;
        // For namespaced resources, filter by namespace if provided
        if (namespace && r.namespace !== namespace) return false;
        return true;
      })
      .map(r => r.name)
      .sort();
  }, [resources, kind, namespace]);
}

/**
 * Hook to get ConfigMap names in a namespace
 */
export function useConfigMapNames(namespace?: string): string[] {
  return useClusterResourceNames('ConfigMap', namespace);
}

/**
 * Hook to get Secret names in a namespace
 */
export function useSecretNames(namespace?: string): string[] {
  return useClusterResourceNames('Secret', namespace);
}

/**
 * Hook to get PVC names in a namespace
 */
export function usePVCNames(namespace?: string): string[] {
  return useClusterResourceNames('PersistentVolumeClaim', namespace);
}

/**
 * Hook to get ServiceAccount names in a namespace
 */
export function useServiceAccountNames(namespace?: string): string[] {
  return useClusterResourceNames('ServiceAccount', namespace);
}

/**
 * Hook to get Service names in a namespace
 */
export function useServiceNames(namespace?: string): string[] {
  return useClusterResourceNames('Service', namespace);
}

/**
 * Hook to get Node names (cluster-scoped)
 */
export function useNodeNames(): string[] {
  return useClusterResourceNames('Node');
}

/**
 * Hook to get PriorityClass names (cluster-scoped)
 */
export function usePriorityClassNames(): string[] {
  return useClusterResourceNames('PriorityClass');
}
