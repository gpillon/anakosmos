import { useEffect, useRef, useState, useMemo } from 'react';
import type { ClusterResource, ClusterLink } from '../api/types';
import { useSettingsStore } from '../store/useSettingsStore';

// Web Worker Import
// Vite handles this import with ?worker suffix
import LayoutWorker from '../workers/layout.worker?worker';

// Simple hash for comparing data changes
const simpleHash = (str: string): string => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(36);
};

export const useForceLayout = (
  resources: Record<string, ClusterResource>,
  links: ClusterLink[]
) => {
  const positionsRef = useRef<Record<string, [number, number, number]>>({});
  // We need to trigger at least one render when positions first arrive so nodes appear
  const [hasPositions, setHasPositions] = useState(false);
  // Track when worker is ready to trigger data send
  const [isWorkerReady, setIsWorkerReady] = useState(false);
  
  const workerRef = useRef<Worker | null>(null);
  const lastSentHashRef = useRef<string>('');
  
  const searchQuery = useSettingsStore(state => state.searchQuery);
  const filterNamespaces = useSettingsStore(state => state.filterNamespaces);
  const hideSystemNamespaces = useSettingsStore(state => state.hideSystemNamespaces);
  const hiddenResourceKinds = useSettingsStore(state => state.hiddenResourceKinds);
  const activePreset = useSettingsStore(state => state.activePreset);
  const enableNamespaceProjection = useSettingsStore(state => state.enableNamespaceProjection);
  const statusFilters = useSettingsStore(state => state.statusFilters);

  useEffect(() => {
    // Initialize Worker
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
    
    // Signal that worker is ready
    setIsWorkerReady(true);

    return () => {
        workerRef.current?.terminate();
        workerRef.current = null;
        setIsWorkerReady(false);
        setHasPositions(false);
        lastSentHashRef.current = '';
        positionsRef.current = {};
    };
  }, []);

  // Memoize the computed layout data to detect actual changes
  const layoutData = useMemo(() => {
    // 1. Filter Resources
    const allResources = Object.values(resources);
    const filteredResources = allResources.filter(r => 
        shouldShowResource(r, searchQuery, filterNamespaces, hideSystemNamespaces, hiddenResourceKinds, activePreset, links, statusFilters)
    );

    // 2. Identify Namespaces (Stable based on ALL resources)
    const namespaces = Array.from(new Set(
        allResources.map(r => r.namespace).filter(n => !!n)
    )).sort();

    const namespaceSizes: Record<string, number> = {};
    let clusterScopedCount = 0;
    allResources.forEach(r => {
        if (r.namespace) {
            namespaceSizes[r.namespace] = (namespaceSizes[r.namespace] || 0) + 1;
        } else {
            clusterScopedCount++;
        }
    });

    // 3. Prepare Nodes (without positions - those come from ref)
    const nodeIds = filteredResources.map(r => r.id).sort();
    const nodes = filteredResources.map(r => ({
        id: r.id,
        kind: r.kind,
        namespace: r.namespace,
    }));

    // 4. Prepare Links
    const nodeIdSet = new Set(nodeIds);
    const simLinks = links
      .filter(l => nodeIdSet.has(l.source) && nodeIdSet.has(l.target))
      .map(l => ({
        source: l.source,
        target: l.target,
        type: l.type
      }));
    
    // Generate hash for change detection
    const linkIds = simLinks.map(l => `${l.source}-${l.target}`).sort();
    const dataHash = simpleHash(`${nodeIds.join(',')}|${linkIds.join(',')}|${enableNamespaceProjection}`);

    return { nodes, simLinks, namespaces, namespaceSizes, clusterScopedCount, dataHash };
  }, [resources, links, searchQuery, filterNamespaces, hideSystemNamespaces, hiddenResourceKinds, activePreset, enableNamespaceProjection, statusFilters]);

  useEffect(() => {
    // Wait for worker to be ready before sending data
    if (!isWorkerReady || !workerRef.current) return;
    
    const { nodes, simLinks, namespaces, namespaceSizes, clusterScopedCount, dataHash } = layoutData;

    // If there are no nodes to layout, set hasPositions immediately
    // This handles empty clusters or when all resources are filtered out
    if (nodes.length === 0) {
      setHasPositions(true);
      return;
    }

    // Skip if data hasn't actually changed
    if (dataHash === lastSentHashRef.current) {
      return;
    }
    lastSentHashRef.current = dataHash;

    // Add current positions from ref to nodes before sending
    const nodesWithPositions = nodes.map(n => ({
        ...n,
        x: positionsRef.current[n.id]?.[0],
        y: positionsRef.current[n.id]?.[2]
    }));

    // Send to Worker
    workerRef.current.postMessage({
        type: 'update',
        nodes: nodesWithPositions,
        links: simLinks,
        config: {
            enableNamespaceProjection,
            namespaces,
            namespaceSizes,
            clusterScopedCount
        }
    });

  }, [layoutData, enableNamespaceProjection, isWorkerReady]);

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

  // Filter out empty ReplicaSets (historic/inactive)
  if (resource.kind === 'ReplicaSet') {
    const specReplicas = resource.raw?.spec?.replicas;
    if (specReplicas === 0) return false;
  }
  
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
