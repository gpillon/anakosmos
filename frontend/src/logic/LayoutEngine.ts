import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3-force';
import type { ClusterResource, ClusterLink } from '../api/types';
import { useSettingsStore } from '../store/useSettingsStore';
import { getNamespacePosition } from './namespaceMath';

// Extend d3 Node types
interface SimulationNode extends d3.SimulationNodeDatum {
  id: string;
  kind: string;
  namespace?: string;
  x?: number;
  y?: number;
  z?: number;
}

interface SimulationLink extends d3.SimulationLinkDatum<SimulationNode> {
  source: string | SimulationNode;
  target: string | SimulationNode;
  type: string;
}

// Reuse logic via import
const getNamespaceForce = (ns: string, allNs: string[]) => {
  if (!ns) return { x: 0, y: 0 };
  const index = allNs.indexOf(ns);
  if (index === -1) return { x: 0, y: 0 };
  
  const pos = getNamespacePosition(index, allNs.length);
  return { x: pos.x, y: pos.z }; // Map Z to Y for D3
};

export const useForceLayout = (
  resources: Record<string, ClusterResource>,
  links: ClusterLink[]
) => {
  const [positions, setPositions] = useState<Record<string, [number, number, number]>>({});
  const simulationRef = useRef<d3.Simulation<SimulationNode, SimulationLink> | null>(null);
  const searchQuery = useSettingsStore(state => state.searchQuery);
  const filterNamespaces = useSettingsStore(state => state.filterNamespaces);
  const hideSystemNamespaces = useSettingsStore(state => state.hideSystemNamespaces);
  const hiddenResourceKinds = useSettingsStore(state => state.hiddenResourceKinds);
  const activePreset = useSettingsStore(state => state.activePreset);
  const enableNamespaceProjection = useSettingsStore(state => state.enableNamespaceProjection);
  
  // Track previous mode to detect toggles
  const prevModeRef = useRef(enableNamespaceProjection);

  useEffect(() => {
    // 1. Identify all unique namespaces
    const namespaces = Array.from(new Set(
      Object.values(resources)
        .map(r => r.namespace)
        .filter(n => !!n)
    )).sort();

    // 2. Prepare nodes merging with existing simulation state
    const currentSim = simulationRef.current;
    
    // Create a map of existing nodes for fast lookup of position/velocity
    const existingNodeMap = new Map<string, SimulationNode>();
    if (currentSim) {
        currentSim.nodes().forEach(n => existingNodeMap.set(n.id, n));
    }

    const nodes: SimulationNode[] = Object.values(resources)
      .filter(r => shouldShowResource(r, searchQuery, filterNamespaces, hideSystemNamespaces, hiddenResourceKinds, activePreset, links))
      .map(r => {
        const existing = existingNodeMap.get(r.id);
        
        // If namespace projection mode changed, we want to scramble or re-center to let forces work
        // But for simple updates (add/remove pod), we want to keep positions.
        const shouldPreserve = existing && prevModeRef.current === enableNamespaceProjection;

        return {
            id: r.id,
            kind: r.kind,
            namespace: r.namespace,
            // Preserve position and velocity if possible to minimize jitter
            x: shouldPreserve ? existing!.x : (Math.random() - 0.5) * 5,
            y: shouldPreserve ? existing!.y : (Math.random() - 0.5) * 5,
            vx: shouldPreserve ? existing!.vx : 0,
            vy: shouldPreserve ? existing!.vy : 0
        };
      });

    prevModeRef.current = enableNamespaceProjection;

    // 3. Prepare links
    const nodeIds = new Set(nodes.map(n => n.id));
    const simLinks: SimulationLink[] = links
      .filter(l => nodeIds.has(l.source) && nodeIds.has(l.target))
      .map(l => ({
        source: l.source, // D3 will map string IDs to node objects automatically
        target: l.target,
        type: l.type
      }));

    // 4. Update or Initialize Simulation
    if (!currentSim) {
        // --- INITIALIZATION ---
        const simulation = d3.forceSimulation(nodes)
            .force('link', d3.forceLink(simLinks).id((d: any) => d.id).distance(link => {
                return (link as any).type === 'owner' ? 0.5 : 0.8;
            }).strength(enableNamespaceProjection ? 0.01 : 1.5))
            .force('charge', d3.forceManyBody().strength((d: any) => d.kind === 'Node' ? -100 : -5))
            .force('x', d3.forceX((d: any) => {
                if (!enableNamespaceProjection || !d.namespace) return 0;
                const target = getNamespaceForce(d.namespace, namespaces);
                return target.x;
            }).strength(enableNamespaceProjection ? 1.0 : 0.15))
            .force('y', d3.forceY((d: any) => {
                if (!enableNamespaceProjection || !d.namespace) return 0;
                const target = getNamespaceForce(d.namespace, namespaces);
                return target.y;
            }).strength(enableNamespaceProjection ? 1.0 : 0.15))
            .force('collide', d3.forceCollide((d: any) => d.kind === 'Node' ? 3.5 : 1.2).strength(0.7));

        simulation.on('tick', () => {
            const newPositions: Record<string, [number, number, number]> = {};
            simulation.nodes().forEach(node => {
                let height = 0;
                if (node.kind === 'Node') height = 0;
                else if (node.kind === 'NodeNetworkConfigurationPolicy') height = 0.3;
                else if (node.kind === 'PersistentVolume') height = 0.5;
                else if (node.kind === 'StorageClass') height = 0.2;
                else if (node.kind === 'NetworkAttachmentDefinition') height = 1;
                else if (node.kind === 'PersistentVolumeClaim') height = 1.2;
                else if (node.kind === 'Pod') height = 1.5;
                else if (node.kind === 'Secret' || node.kind === 'ConfigMap') height = 2;
                else if (node.kind === 'Service') height = 2.5;
                else if (node.kind === 'Ingress' || node.kind === 'Route') height = 3.5;
                else if (node.kind === 'Deployment') height += 3.5;

                newPositions[node.id] = [node.x || 0, height, node.y || 0];
            });
            setPositions(newPositions);
        });

        simulationRef.current = simulation;
    } else {
        // --- UPDATE EXISTING ---
        // Update nodes and links
        currentSim.nodes(nodes);
        (currentSim.force('link') as d3.ForceLink<SimulationNode, SimulationLink>).links(simLinks);

        // Update forces parameters if needed (e.g. namespaces changed)
        // We re-apply the X/Y forces to ensure they use the new 'namespaces' array
        currentSim.force('x', d3.forceX((d: any) => {
            if (!enableNamespaceProjection || !d.namespace) return 0;
            const target = getNamespaceForce(d.namespace, namespaces);
            return target.x;
        }).strength(enableNamespaceProjection ? 1.0 : 0.15));
        
        currentSim.force('y', d3.forceY((d: any) => {
            if (!enableNamespaceProjection || !d.namespace) return 0;
            const target = getNamespaceForce(d.namespace, namespaces);
            return target.y;
        }).strength(enableNamespaceProjection ? 1.0 : 0.15));
        
        currentSim.force('link', d3.forceLink(simLinks).id((d: any) => d.id).distance(link => {
            return (link as any).type === 'owner' ? 1 : 1.5;
        }).strength(enableNamespaceProjection ? 0.01 : 1.5));

        // Warmup: Low alpha for small updates to prevent jumping
        // High alpha only if significant changes occurred (like mode switch) could be handled,
        // but here we generally prefer gentle settling.
        currentSim.alpha(0.3).restart();
    }

    return () => {
        // Cleanup only on unmount usually, but here we keep ref alive
        // simulation.stop(); 
    };
  }, [resources, links, searchQuery, filterNamespaces, hideSystemNamespaces, hiddenResourceKinds, activePreset, enableNamespaceProjection]);

  // Separate cleanup effect
  useEffect(() => {
      return () => {
          if (simulationRef.current) simulationRef.current.stop();
      };
  }, []);

  return { positions };
};

function isSystemNamespace(ns: string) {
    return ns.startsWith('kube-') || ns.endsWith('-system') || ns.startsWith('openshift-');
}

function shouldShowResource(
  resource: ClusterResource, 
  searchQuery: string,
  filterNamespaces: string[],
  hideSystemNamespaces: boolean,
  hiddenResourceKinds: string[],
  activePreset: string,
  links: ClusterLink[]
): boolean {
  if (hiddenResourceKinds.includes(resource.kind)) return false;
  
  if (searchQuery && !resource.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
  
  if (resource.namespace) {
      if (hideSystemNamespaces && isSystemNamespace(resource.namespace)) return false;
      if (filterNamespaces.length > 0 && !filterNamespaces.includes(resource.namespace)) return false;
  }

  // Generalized Isolation Filtering based on Active Preset
  if (resource.kind === 'Pod') {
      if (activePreset === 'storage') {
          // Show only if Pod has a 'config' link (to PVC, ConfigMap, Secret)
          const hasStorage = links.some(l => l.source === resource.id && l.type === 'config');
          if (!hasStorage) return false;
      }
      
      if (activePreset === 'networking') {
          // Show only if Pod has a 'network' link (target of Service or Ingress)
          const hasNetwork = links.some(l => l.target === resource.id && l.type === 'network');
          if (!hasNetwork) return false;
      }
  }
  
  return true;
}
