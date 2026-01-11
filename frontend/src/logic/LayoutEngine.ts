import { useEffect, useRef, useState } from 'react';
import type { ClusterResource, ClusterLink } from '../api/types';
import { useSettingsStore } from '../store/useSettingsStore';

// Web Worker Import
// Vite handles this import with ?worker suffix
import LayoutWorker from '../workers/layout.worker?worker';

export const useForceLayout = (
  resources: Record<string, ClusterResource>,
  links: ClusterLink[]
) => {
  const positionsRef = useRef<Record<string, [number, number, number]>>({});
  // We need to trigger at least one render when positions first arrive so nodes appear
  const [hasPositions, setHasPositions] = useState(false);
  
  const workerRef = useRef<Worker | null>(null);
  
  const searchQuery = useSettingsStore(state => state.searchQuery);
  const filterNamespaces = useSettingsStore(state => state.filterNamespaces);
  const hideSystemNamespaces = useSettingsStore(state => state.hideSystemNamespaces);
  const hiddenResourceKinds = useSettingsStore(state => state.hiddenResourceKinds);
  const activePreset = useSettingsStore(state => state.activePreset);
  const enableNamespaceProjection = useSettingsStore(state => state.enableNamespaceProjection);
  const statusFilters = useSettingsStore(state => state.statusFilters);

  useEffect(() => {
    // Initialize Worker
    if (!workerRef.current) {
        workerRef.current = new LayoutWorker();
        
        workerRef.current.onmessage = (e) => {
            const { type, positions } = e.data;
            if (type === 'tick') {
                positionsRef.current = positions;
                // Only trigger render on first valid positions to avoid loop loop re-renders
                setHasPositions(prev => {
                    if (!prev && Object.keys(positions).length > 0) return true;
                    return prev;
                });
            }
        };
    }

    return () => {
        workerRef.current?.terminate();
        workerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!workerRef.current) return;

    // 1. Filter Resources
    const filteredResources = Object.values(resources).filter(r => 
        shouldShowResource(r, searchQuery, filterNamespaces, hideSystemNamespaces, hiddenResourceKinds, activePreset, links, statusFilters)
    );

    // 2. Identify Namespaces
    const namespaces = Array.from(new Set(
        filteredResources.map(r => r.namespace).filter(n => !!n)
    )).sort();

    // 3. Prepare Nodes
    const nodes = filteredResources.map(r => ({
        id: r.id,
        kind: r.kind,
        namespace: r.namespace,
        // Pass current position from ref to maintain state across updates
        x: positionsRef.current[r.id]?.[0],
        y: positionsRef.current[r.id]?.[2] // Map Z to Y
    }));


    // 4. Prepare Links
    const nodeIds = new Set(nodes.map(n => n.id));
    const simLinks = links
      .filter(l => nodeIds.has(l.source) && nodeIds.has(l.target))
      .map(l => ({
        source: l.source,
        target: l.target,
        type: l.type
      }));

    // 5. Send to Worker
    workerRef.current.postMessage({
        type: 'update',
        nodes,
        links: simLinks,
        config: {
            enableNamespaceProjection,
            namespaces
        }
    });

  }, [resources, links, searchQuery, filterNamespaces, hideSystemNamespaces, hiddenResourceKinds, activePreset, enableNamespaceProjection, statusFilters]);

  return { positionsRef, hasPositions };
};

function isSystemNamespace(ns: string) {
    return ns.startsWith('kube-') || ns.endsWith('-system') || ns.startsWith('openshift-');
}

export function shouldShowResource(
  resource: ClusterResource, 
  searchQuery: string,
  filterNamespaces: string[],
  hideSystemNamespaces: boolean,
  hiddenResourceKinds: string[],
  activePreset: string,
  links: ClusterLink[],
  statusFilters?: Record<string, Record<string, string>>
): boolean {
  if (hiddenResourceKinds.includes(resource.kind)) return false;
  
  // Status Filters
  if (statusFilters) {
      const statusFilter = statusFilters[resource.kind]?.[resource.status] || 'default';
      if (statusFilter === 'hidden') return false;
  }

  if (searchQuery && !resource.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
  
  if (resource.namespace) {
      if (hideSystemNamespaces && isSystemNamespace(resource.namespace)) return false;
      if (filterNamespaces.length > 0 && !filterNamespaces.includes(resource.namespace)) return false;
  }

  // Generalized Isolation Filtering based on Active Preset
  if (resource.kind === 'Pod') {
      if (activePreset === 'storage') {
          const hasStorage = links.some(l => l.source === resource.id && l.type === 'config');
          if (!hasStorage) return false;
      }
      
      if (activePreset === 'networking') {
          const hasNetwork = links.some(l => l.target === resource.id && l.type === 'network');
          if (!hasNetwork) return false;
      }
  }
  
  return true;
}
