import * as d3 from 'd3-force';

// Messages types
type SimulationMessage = 
  | { type: 'init'; nodes: any[]; links: any[]; config: any }
  | { type: 'update'; nodes: any[]; links: any[]; config: any }
  | { type: 'stop' };

const ctx: Worker = self as any;

let simulation: d3.Simulation<any, any> | null = null;
const nodeStateMap = new Map<string, {x: number, y: number, vx: number, vy: number}>();

// Cache for namespace positions and sizes
let namespacePositionCache: Map<string, { x: number; y: number; radius: number }> = new Map();

// Cache for data fingerprint to avoid unnecessary simulation restarts
let lastDataFingerprint = '';

/**
 * Generate a simple fingerprint of the current data to detect real changes
 */
const generateFingerprint = (nodeIds: string[], linkPairs: string[], config: any): string => {
  // Sort for consistent comparison
  const sortedNodes = [...nodeIds].sort().join(',');
  const sortedLinks = [...linkPairs].sort().join(',');
  return `${sortedNodes}|${sortedLinks}|${config.enableNamespaceProjection}`;
};

// Golden angle in radians (~137.5°) - creates optimal packing like sunflower seeds
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

// Special namespace name for cluster-scoped resources (no namespace)
const CLUSTER_SCOPED_NS = '__cluster__';

/**
 * Smart namespace layout using Phyllotaxis (sunflower) pattern
 * - Adapts to number of namespaces
 * - Considers namespace size (resource count)
 * - Packs efficiently without huge gaps
 * - Places cluster-scoped resources at the CENTER
 */
const calculateNamespaceLayout = (
  namespaces: string[], 
  namespaceSizes: Map<string, number>,
  clusterScopedCount: number
) => {
  namespacePositionCache.clear();
  
  // Always add cluster-scoped zone at center if there are cluster resources
  if (clusterScopedCount > 0) {
    const clusterRadius = 2 + Math.sqrt(clusterScopedCount) * 0.8;
    namespacePositionCache.set(CLUSTER_SCOPED_NS, { x: 0, y: 0, radius: clusterRadius });
  }
  
  if (namespaces.length === 0) return;
  
  // Calculate estimated radius for each namespace based on resource count
  const namespaceRadii = namespaces.map(ns => {
    const count = namespaceSizes.get(ns) || 1;
    return 2 + Math.sqrt(count) * 0.8;
  });
  
  // Total area needed (sum of circle areas)
  const totalArea = namespaceRadii.reduce((sum, r) => sum + Math.PI * r * r, 0);
  
  // Calculate packing factor
  const packingFactor = Math.max(0.4, 0.8 - namespaces.length * 0.015);
  
  // Base spacing scale
  const baseScale = Math.sqrt(totalArea / Math.PI) * 0.25;
  
  // Sort namespaces by size (largest first)
  const sortedIndices = namespaces
    .map((ns, i) => ({ ns, i, radius: namespaceRadii[i] }))
    .sort((a, b) => b.radius - a.radius);
  
  // Starting index: if we have cluster-scoped resources, they're at center (index 0)
  // So namespaces start from index 1
  const startIdx = clusterScopedCount > 0 ? 1 : 0;
  
  // Position using Phyllotaxis pattern - namespaces AROUND the center
  sortedIndices.forEach((item, i) => {
    const { ns, radius } = item;
    const sortedIdx = i + startIdx;
    
    if (sortedIdx === 0) {
      // Center position (only if no cluster-scoped resources)
      namespacePositionCache.set(ns, { x: 0, y: 0, radius });
      return;
    }
    
    // Phyllotaxis: angle = n * golden_angle, distance = scale * sqrt(n)
    const angle = sortedIdx * GOLDEN_ANGLE;
    
    // Distance grows with sqrt(index)
    const prevRadii = sortedIndices.slice(0, i).reduce((sum, p) => sum + p.radius, 0);
    const avgRadius = i > 0 ? prevRadii / i : radius;
    
    // Add extra offset for cluster-scoped zone at center
    const clusterOffset = clusterScopedCount > 0 ? (namespacePositionCache.get(CLUSTER_SCOPED_NS)?.radius || 3) : 0;
    const dist = clusterOffset + baseScale * Math.sqrt(sortedIdx) * (1 + avgRadius * 0.3) * packingFactor;
    
    namespacePositionCache.set(ns, {
      x: Math.cos(angle) * dist,
      y: Math.sin(angle) * dist,
      radius
    });
  });
};

const getNamespaceForce = (ns: string | null | undefined) => {
  // Cluster-scoped resources (no namespace) go to center
  if (!ns) {
    const cached = namespacePositionCache.get(CLUSTER_SCOPED_NS);
    if (cached) return cached;
    return { x: 0, y: 0, radius: 5 };
  }
  
  const cached = namespacePositionCache.get(ns);
  if (cached) return cached;
  
  // Fallback for unknown namespace
  return { x: 0, y: 0, radius: 5 };
};

ctx.onmessage = (e: MessageEvent<SimulationMessage>) => {
  const { type } = e.data;

  if (type === 'init' || type === 'update') {
    const { nodes, links, config } = e.data as any;
    const { enableNamespaceProjection, namespaces, namespaceSizes: rawSizes, clusterScopedCount: rawClusterCount } = config;

    // Generate fingerprint to check if data actually changed
    const nodeIds = nodes.map((n: any) => n.id);
    const linkPairs = links.map((l: any) => `${l.source}-${l.target}`);
    const fingerprint = generateFingerprint(nodeIds, linkPairs, config);
    
    // If data hasn't changed, skip simulation restart entirely
    const dataChanged = fingerprint !== lastDataFingerprint;
    lastDataFingerprint = fingerprint;
    
    // If simulation exists and data hasn't changed, just send current positions
    if (!dataChanged && simulation && type === 'update') {
      const positions: Record<string, [number, number, number]> = {};
      nodeStateMap.forEach((state, id) => {
        const node = nodes.find((n: any) => n.id === id);
        if (node) {
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
          positions[id] = [state.x, height, state.y];
        }
      });
      ctx.postMessage({ type: 'tick', positions });
      return; // Skip simulation restart
    }

    // Use provided stable sizes if available (fallback to calculating from nodes for backward compat/init)
    const namespaceSizes = new Map<string, number>(Object.entries(rawSizes || {}));
    
    // If rawSizes wasn't provided (e.g. init?), calculate from visible nodes (fallback)
    // But ideally we rely on what's passed in config for stability
    let clusterScopedCount = rawClusterCount;

    if (!rawSizes) {
         clusterScopedCount = 0;
         nodes.forEach((node: any) => {
          if (node.namespace) {
            namespaceSizes.set(node.namespace, (namespaceSizes.get(node.namespace) || 0) + 1);
          } else {
            clusterScopedCount++;
          }
        });
    }
    
    // Pre-calculate namespace positions using smart packing algorithm
    if (enableNamespaceProjection) {
      calculateNamespaceLayout(namespaces || [], namespaceSizes, clusterScopedCount);
    }

    // D. Persist previous positions to avoid "jump"
    const mergedNodes = nodes.map((node: any) => {
        const prev = nodeStateMap.get(node.id);
        if (prev) {
            return { ...node, x: prev.x, y: prev.y, vx: prev.vx, vy: prev.vy };
        }
        
        // Initialize new nodes near their namespace center if projection is enabled
        let initX = (Math.random() - 0.5) * 10;
        let initY = (Math.random() - 0.5) * 10;
        
        if (enableNamespaceProjection && node.namespace) {
          const nsPos = getNamespaceForce(node.namespace);
          initX = nsPos.x + (Math.random() - 0.5) * nsPos.radius;
          initY = nsPos.y + (Math.random() - 0.5) * nsPos.radius;
        }
        
        return { 
            ...node, 
            x: initX, 
            y: initY,
            vx: (Math.random() - 0.5) * 0.1,
            vy: (Math.random() - 0.5) * 0.1
        };
    });

    // Clean up nodeStateMap for removed nodes to prevent memory leak
    const currentIds = new Set(nodes.map((n: any) => n.id));
    for (const id of nodeStateMap.keys()) {
        if (!currentIds.has(id)) {
            nodeStateMap.delete(id);
        }
    }

    // Stop existing to prevent leaks or conflicts
    if (simulation) simulation.stop();

    // Re-create simulation with adaptive forces
    simulation = d3.forceSimulation(mergedNodes)
        .force('link', d3.forceLink(links).id((d: any) => d.id).distance((link: any) => {
             return link.type === 'owner' ? 0.5 : 0.8;
        }).strength(enableNamespaceProjection ? 0.05 : 1.5))
        
        // Charge force - repulsion between nodes
        .force('charge', d3.forceManyBody()
            .strength((d: any) => {
              if (d.kind === 'Node') return -100;
              // Weaker repulsion when namespace projection is on (they're grouped anyway)
              return enableNamespaceProjection ? -3 : -5;
            })
            .distanceMax(enableNamespaceProjection ? 30 : 50)
        )
        
        // X/Y forces pull nodes toward their namespace center
        // Cluster-scoped resources (no namespace) are pulled to center
        .force('x', d3.forceX((d: any) => {
            if (!enableNamespaceProjection) return 0;
            // getNamespaceForce handles null/undefined namespace -> cluster center
            return getNamespaceForce(d.namespace).x;
        }).strength(enableNamespaceProjection ? 0.8 : 0.15))
        
        .force('y', d3.forceY((d: any) => {
            if (!enableNamespaceProjection) return 0;
            return getNamespaceForce(d.namespace).y;
        }).strength(enableNamespaceProjection ? 0.8 : 0.15))
        
        // Collision detection
        .force('collide', d3.forceCollide((d: any) => {
          if (d.kind === 'Node') return 3.5;
          return enableNamespaceProjection ? 0.8 : 1.2;
        }).strength(0.7));

    // A. Warm-up
    // Pre-calculate some ticks without notifying UI to stabilize faster if it's a big change
    // or just to avoid initial jitter. 
    // For 'update', we might skip warmup if we trust previous positions.
    if (type === 'init') {
        simulation.tick(30); // 30 iterations silent warmup
    }

    // B. Temperature Control
    // If updating, restart with low alpha (heat) to avoid explosion
    // If init, full heat.
    const startAlpha = type === 'update' ? 0.05 : 1.0;
    simulation.alpha(startAlpha).restart();
    
    // Throttling State
    let lastPost = 0;

    simulation.on('tick', () => {
        // Update persistent map
        mergedNodes.forEach((node: any) => {
            nodeStateMap.set(node.id, { x: node.x, y: node.y, vx: node.vx, vy: node.vy });
        });

        // Throttle UI updates to 30fps to save Main Thread JSON parsing time
        const now = Date.now();
        if (now - lastPost < 32) return; // ~30ms = 30fps
        lastPost = now;

        // Send positions back
        const positions: Record<string, [number, number, number]> = {};
        mergedNodes.forEach((node: any) => {
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

             positions[node.id] = [node.x, height, node.y];
        });
        
        ctx.postMessage({ type: 'tick', positions });
    });
  } else if (type === 'stop') {
      if (simulation) simulation.stop();
  }
};
