import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Grid, Environment, CameraControls, Instances, Instance, Html, Stars } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette, Noise } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import * as THREE from 'three';
import { useClusterStore } from '../store/useClusterStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { useResourceDetailsStore } from '../store/useResourceDetailsStore';
import { LinkLayer } from './LinkLayer';
import { NamespaceProjections } from './NamespaceProjections';
import { useForceLayout, shouldShowResource } from '../logic/LayoutEngine';
import type { ClusterResource } from '../api/types';
import { SceneStatsReporter } from '../ui/HUD';
import { 
  nodeGeo, podGeo, serviceGeo, deployGeo, 
  statefulGeo, daemonGeo, replicaGeo,
  octGeo, diamondGeo, smallBoxGeo, pyramidGeo,
  puckGeo, barrelGeo, slabGeo, torusKnotGeo, hexPrismGeo, tetraGeo,
  jobGeo, cronJobGeo, hpaGeo 
} from './sharedResources';
import { KIND_COLOR_MAP, KIND_GEOMETRY_MAP, DEFAULT_COLOR, DEFAULT_GEOMETRY } from '../config/resourceKinds';
import type { GeometryType } from '../config/resourceKinds';

// ... CameraManager component (unchanged) ...
const CameraManager: React.FC<{ selectedPos?: [number, number, number] }> = ({ selectedPos }) => {
  const controlsRef = useRef<CameraControls>(null);
  const [lastPos, setLastPos] = useState<THREE.Vector3 | null>(null);
  const [lastTarget, setLastTarget] = useState<THREE.Vector3 | null>(null);

  useEffect(() => {
    if (!controlsRef.current) return;
    const bbox = new THREE.Box3(
        new THREE.Vector3(-5000, 0, -5000),
        new THREE.Vector3(5000, 0, 5000)
    );
    controlsRef.current.setBoundary(bbox);
  }, []);

  useFrame(() => {
      if (!controlsRef.current) return;
      const camera = controlsRef.current.camera;
      const minHeight = 10;
      if (camera.position.y < minHeight) {
          camera.position.setY(minHeight);
      }
  });

  useEffect(() => {
    if (!controlsRef.current) return;
    if (selectedPos) {
      if (!lastPos) {
        setLastPos(controlsRef.current.getPosition(new THREE.Vector3()));
        setLastTarget(controlsRef.current.getTarget(new THREE.Vector3()));
      }
      const [x, y, z] = selectedPos;
      controlsRef.current.setLookAt(
        x + 8, Math.max(y + 8, 10), z + 8,
        x, y, z,
        true
      );
    } else if (lastPos && lastTarget) {
      controlsRef.current.setLookAt(
        lastPos.x, lastPos.y, lastPos.z,
        lastTarget.x, lastTarget.y, lastTarget.z,
        true
      );
      setLastPos(null);
      setLastTarget(null);
    }
  }, [selectedPos]);

  return <CameraControls 
    ref={controlsRef} 
    makeDefault 
    maxPolarAngle={Math.PI / 2.2}
    minPolarAngle={0} 
    minDistance={10} 
    maxDistance={500} 
    dollyToCursor={true} 
  />;
};

// Optimized Instanced Node Component
const AnimatedInstance: React.FC<any> = ({ isUnhealthy, scale, id, positionsRef, kind, onDoubleClick, ...props }) => {
  const ref = useRef<any>(null);
  
  useFrame((state) => {
    if (ref.current && positionsRef.current[id]) {
      const pos = positionsRef.current[id];
      // Update position directly from ref, bypassing React render cycle
      ref.current.position.set(pos[0], pos[1] + (kind === 'Node' ? 0.2 : 0), pos[2]);
      
      if (isUnhealthy) {
        const t = state.clock.getElapsedTime();
        const factor = 1 + (Math.sin(t * 8) * 0.15); 
        ref.current.scale.setScalar(scale * factor);
      }
    }
  });

  return (
    <Instance 
        ref={ref} 
        scale={scale} 
        onDoubleClick={(e: any) => {
            e.stopPropagation();
            if (onDoubleClick) onDoubleClick(id);
        }}
        {...props} 
    />
  );
};

// Label Component using Html overlay
const ResourceLabel: React.FC<{
  id: string;
  resources: Record<string, ClusterResource>;
  positionsRef: React.MutableRefObject<Record<string, [number, number, number]>>;
}> = ({ id, resources, positionsRef }) => {
  const groupRef = useRef<THREE.Group>(null);
  const res = resources[id];

  useFrame(() => {
    if (groupRef.current && positionsRef.current[id]) {
        const [x, y, z] = positionsRef.current[id];
        // Height offset depends on kind, but +2.5 is a safe default for now
        groupRef.current.position.set(x, y + 2.0, z);
    }
  });

  if (!res) return null;

  return (
    <group ref={groupRef}>
        <Html center style={{ pointerEvents: 'none' }} zIndexRange={[100, 0]}>
            <div className="px-2 py-1 bg-slate-900/80 text-white text-xs rounded border border-slate-600 shadow-xl whitespace-nowrap backdrop-blur-sm flex flex-col items-center">
                <div className="font-bold">{res.name}</div>
                <div className="text-[10px] text-slate-400">{res.kind}</div>
            </div>
        </Html>
    </group>
  );
};

const LabelsLayer: React.FC<{
  resources: Record<string, ClusterResource>;
  positionsRef: React.MutableRefObject<Record<string, [number, number, number]>>;
  selectedId: string | null;
  hoveredId: string | null;
  focusedKind: string | null;
  statusFilters: Record<string, Record<string, string>>;
  searchQuery: string;
  filterNamespaces: string[];
  hideSystemNamespaces: boolean;
  activePreset: string;
  hiddenResourceKinds: string[];
  links: any[]; // Avoid circular dependency with ClusterLink if possible, or import it
}> = ({ resources, positionsRef, selectedId, hoveredId, focusedKind, statusFilters, searchQuery, filterNamespaces, hideSystemNamespaces, activePreset, hiddenResourceKinds, links }) => {
    const ids = useMemo(() => {
        const set = new Set<string>();
        if (selectedId) set.add(selectedId);
        if (hoveredId) set.add(hoveredId);
        
        // Add all resources if their kind is focused (but respect global filters!)
        if (focusedKind) {
            Object.values(resources).forEach(r => {
                if (r.kind === focusedKind && shouldShowResource(r, searchQuery, filterNamespaces, hideSystemNamespaces, hiddenResourceKinds, activePreset, links, statusFilters)) {
                    set.add(r.id);
                }
            });
        }

        // Add all resources that have 'focused' status filter (but respect global filters!)
        Object.entries(statusFilters).forEach(([kind, statuses]) => {
            Object.entries(statuses).forEach(([status, filterState]) => {
                if (filterState === 'focused') {
                    Object.values(resources).forEach(r => {
                        if (r.kind === kind && r.status === status && shouldShowResource(r, searchQuery, filterNamespaces, hideSystemNamespaces, hiddenResourceKinds, activePreset, links, statusFilters)) {
                            set.add(r.id);
                        }
                    });
                }
            });
        });

        return Array.from(set);
    }, [selectedId, hoveredId, focusedKind, statusFilters, resources, searchQuery, filterNamespaces, hideSystemNamespaces, hiddenResourceKinds, activePreset, links]);

    return (
        <>
            {ids.map(id => (
                <ResourceLabel 
                    key={id} 
                    id={id} 
                    resources={resources} 
                    positionsRef={positionsRef} 
                />
            ))}
        </>
    );
};

const InstancedNodes: React.FC<{
  resources: ClusterResource[];
  positionsRef: React.MutableRefObject<Record<string, [number, number, number]>>;
  geometry: THREE.BufferGeometry;
  baseColor: string;
  onClick: (id: string) => void;
  onDoubleClick: (id: string) => void;
  selectedId: string | null;
  connectedIds: Set<string>;
  focusedKind: string | null;
  statusFilters: Record<string, Record<string, string>>;
  hoveredId: string | null;
  setHoveredId: (id: string | null) => void;
}> = ({ resources, positionsRef, geometry, baseColor, onClick, onDoubleClick, selectedId, connectedIds, focusedKind, statusFilters, hoveredId, setHoveredId }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  // Update bounding sphere less frequently or in useFrame if needed.
  // For 500 objects, we can just set a large fixed bounding sphere to avoid culling issues 
  // or update it periodically.
  // Here we'll rely on a one-time calculation when resources change, using the current positions (if any).
  // Or simpler: disable frustum culling for these instances if they move a lot within the view.
  useEffect(() => {
    if (meshRef.current) {
        meshRef.current.frustumCulled = false; // Simple fix for moving objects
    }
  }, []);

  return (
    <Instances ref={meshRef} range={resources.length} geometry={geometry}>
      <meshPhysicalMaterial 
          metalness={0.5}
          roughness={0.3}
          clearcoat={0.8}
          transparent
          flatShading={true}
      />
      {resources.map((res) => {
        // We render the component ONCE (unless selection/resources change)
        // Position is handled by AnimatedInstance internally.
        
        const isSelected = selectedId === res.id;
        const isHovered = hoveredId === res.id;
        const isFocused = focusedKind === res.kind;
        const isConnected = connectedIds.has(res.id);
        const isDimmed = selectedId !== null && !isConnected && !isSelected;
        
        // Status Check
        const isUnhealthy = res.health === 'warning' || res.health === 'error';
        // Added 'Complete' for Jobs, 'Suspended' for CronJobs (not unhealthy, just paused)
        const isLegacyUnhealthy = !['Running', 'Ready', 'Active', 'Available', 'Bound', 'Succeeded', 'Complete', 'Suspended'].includes(res.status);
        const finalIsUnhealthy = res.health ? isUnhealthy : isLegacyUnhealthy;
        
        const statusFilter = statusFilters[res.kind]?.[res.status] || 'default';
        const isGrayed = statusFilter === 'grayed';
        const isFocusedStatus = statusFilter === 'focused';

        let color = baseColor;
        let scale = 1;

        if (isSelected) {
            color = '#f472b6';
        } else if (isFocused || isFocusedStatus) {
            color = '#fbbf24';
        } else if (finalIsUnhealthy) {
            color = '#ef4444';
        } else if (isHovered) {
            color = '#ffffff';
        } else if (isGrayed) {
            color = '#333333'; // Dimmed for grayed status
        }

        if (isDimmed) {
            color = '#333333';
        }
        
        // Ensure grayed wins over dimmed if strictly grayed, but dimmed usually wins if not selected.
        // Actually if isGrayed is true, we want it dark regardless of other non-selected states.
        
        if (isHovered || isSelected || isFocused || isFocusedStatus || finalIsUnhealthy) {
            scale = 1.2;
        }

        return (
            <AnimatedInstance
                key={res.id}
                id={res.id}
                kind={res.kind}
                positionsRef={positionsRef}
                isUnhealthy={finalIsUnhealthy}
                scale={scale}
                color={color}
                onClick={(e: any) => {
                    e.stopPropagation();
                    onClick(res.id);
                }}
                onDoubleClick={onDoubleClick}
                onPointerOver={(e: any) => {
                    e.stopPropagation();
                    setHoveredId(res.id);
                }}
                onPointerOut={() => setHoveredId(null)}
            />
        );
      })}
    </Instances>
  );
};

// Layout System to handle Interpolation
const LayoutSystem: React.FC<{
  targetPositionsRef: React.MutableRefObject<Record<string, [number, number, number]>>;
  children: (interpolatedRef: React.MutableRefObject<Record<string, [number, number, number]>>) => React.ReactNode;
}> = ({ targetPositionsRef, children }) => {
  const interpolatedRef = useRef<Record<string, [number, number, number]>>({});
  
  // High priority -1 to run before components read positions
  useFrame((_state, delta) => {
    const targets = targetPositionsRef.current;
    const current = interpolatedRef.current;
    
    // Smooth factor: 10% per frame at 60fps (adjusted for delta)
    // lerp factor = 1 - exp(-decay * dt)
    // decay 10 gives ~0.16 at 60fps (16ms) -> 0.16 movement per frame
    const factor = 1 - Math.exp(-10 * delta); 

    for (const id in targets) {
        const t = targets[id];
        if (!current[id]) {
            // New node, snap immediately
            current[id] = [...t];
            continue;
        }
        
        const c = current[id];
        
        // Simple LERP
        c[0] += (t[0] - c[0]) * factor;
        c[1] += (t[1] - c[1]) * factor; // Height usually constant, but lerp anyway
        c[2] += (t[2] - c[2]) * factor;
    }
    
    // Remove old keys? 
    // Usually strict sync isn't required every frame, garbage collection can happen on re-renders of the list
  }, -1);

  return <>{children(interpolatedRef)}</>;
};

export const ClusterScene: React.FC = () => {
  const { resources, links, setSceneReady } = useClusterStore();
  const selectedResourceId = useSettingsStore(state => state.selectedResourceId);
  const setSelectedResourceId = useSettingsStore(state => state.setSelectedResourceId);
  const focusedResourceKind = useSettingsStore(state => state.focusedResourceKind);
  const enableNamespaceProjection = useSettingsStore(state => state.enableNamespaceProjection);
  
  const hiddenResourceKinds = useSettingsStore(state => state.hiddenResourceKinds);
  const searchQuery = useSettingsStore(state => state.searchQuery);
  const filterNamespaces = useSettingsStore(state => state.filterNamespaces);
  const hideSystemNamespaces = useSettingsStore(state => state.hideSystemNamespaces);
  const activePreset = useSettingsStore(state => state.activePreset);
  const statusFilters = useSettingsStore(state => state.statusFilters);
  
  const openDetails = useResourceDetailsStore(state => state.openDetails);
  
  // Filter visible resources
  const visibleResources = useMemo(() => {
      const filtered: Record<string, ClusterResource> = {};
      Object.values(resources).forEach(r => {
          if (shouldShowResource(r, searchQuery, filterNamespaces, hideSystemNamespaces, hiddenResourceKinds, activePreset, links, statusFilters)) {
              filtered[r.id] = r;
          }
      });
      return filtered;
  }, [resources, searchQuery, filterNamespaces, hideSystemNamespaces, hiddenResourceKinds, activePreset, links, statusFilters]);

  // Group resources by kind for instancing
  const resourcesByKind = useMemo(() => {
      const groups: Record<string, ClusterResource[]> = {};
      Object.values(visibleResources).forEach(r => {
          if (!groups[r.kind]) groups[r.kind] = [];
          groups[r.kind].push(r);
      });
      return groups;
  }, [visibleResources]);

  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Use the ref-based hook
  const { positionsRef: targetPositionsRef, hasPositions } = useForceLayout(resources, links);

  // Notify store when scene is ready (physics calculated)
  useEffect(() => {
    if (hasPositions || Object.keys(resources).length === 0) {
      setSceneReady(true);
    }
  }, [hasPositions, resources, setSceneReady]);

  const connectedIds = useMemo(() => {
    if (!selectedResourceId) return new Set<string>();
    const set = new Set<string>();
    set.add(selectedResourceId);
    links.forEach(link => {
      if (link.source === selectedResourceId) set.add(link.target);
      if (link.target === selectedResourceId) set.add(link.source);
    });
    return set;
  }, [selectedResourceId, links]);

  const handleMiss = () => {
    setSelectedResourceId(null);
  };
  
  const handleDoubleClick = (id: string) => {
      if (resources[id]) openDetails(id);
  };

  // Geometry map from type to actual THREE geometry - ALL UNIQUE
  const geometryMap: Record<GeometryType, THREE.BufferGeometry> = {
    node: nodeGeo,           // flat octagonal platform
    pod: podGeo,             // capsule/pill
    service: serviceGeo,     // icosahedron (20 faces)
    deploy: deployGeo,       // dodecahedron (12 faces)
    stateful: statefulGeo,   // sphere
    daemon: daemonGeo,       // hexagonal cone
    replica: replicaGeo,     // torus ring
    oct: octGeo,             // octahedron (8 faces)
    diamond: diamondGeo,     // stretched diamond
    smallBox: smallBoxGeo,   // cube
    pyramid: pyramidGeo,     // 4-sided pyramid
    puck: puckGeo,           // flat cylinder
    barrel: barrelGeo,       // tall cylinder
    slab: slabGeo,           // flat slab
    torusKnot: torusKnotGeo, // torus knot
    hexPrism: hexPrismGeo,   // hexagonal prism
    tetra: tetraGeo,         // tetrahedron (fallback)
    job: jobGeo,             // flat box
    cronJob: cronJobGeo,     // rotated flat box
    hpa: hpaGeo,             // thin ring
  };

  const getGeometryForKind = (kind: string) => {
    const geoType = KIND_GEOMETRY_MAP[kind] || DEFAULT_GEOMETRY;
    return geometryMap[geoType];
  };

  const getColorForKind = (kind: string) => {
    return KIND_COLOR_MAP[kind] || DEFAULT_COLOR;
  };

  const resourceCount = Object.keys(resources).length;
  // Show loading overlay when we don't have positions yet
  // Note: if resourceCount is 0 (empty cluster or all filtered), LayoutEngine sets hasPositions=true immediately
  const showLoadingOverlay = !hasPositions;

  return (
    <div className="absolute inset-0 z-0 bg-slate-900">
      {/* Physics Initialization Overlay */}
      {showLoadingOverlay && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-900/90 backdrop-blur-sm text-white transition-opacity duration-500">
          <div className="flex flex-col items-center space-y-6 animate-in fade-in zoom-in-95 duration-300">
            <div className="relative w-20 h-20">
               <div className="absolute inset-0 border-4 border-blue-500/20 rounded-full"></div>
               <div className="absolute inset-0 border-4 border-t-blue-500 rounded-full animate-spin"></div>
               <div className="absolute inset-0 flex items-center justify-center">
                 <div className="w-2 h-2 bg-blue-400 rounded-full animate-ping"></div>
               </div>
            </div>
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">
                {resourceCount > 0 ? 'Stabilizing Cluster' : 'Loading Resources'}
              </h2>
              <div className="flex flex-col gap-1 text-sm text-slate-400">
                <p>{resourceCount > 0 ? 'Initializing physics engine...' : 'Fetching cluster data...'}</p>
                {resourceCount > 0 && (
                  <p className="font-mono text-xs text-slate-500">
                    Calculated {resourceCount} nodes
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <Canvas camera={{ position: [15, 15, 15], fov: 50, far: 5000 }} onPointerMissed={handleMiss}>
        <color attach="background" args={['#050505']} />
        
        <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
        
        <ambientLight intensity={1.5} />
        <pointLight position={[10, 20, 10]} intensity={2} />
        <Environment preset="city" />
        
        <Grid 
          infiniteGrid 
          cellSize={1} 
          sectionSize={5} 
          fadeDistance={500} 
          sectionColor="#4f4f4f" 
          cellColor="#2f2f2f"
          position={[0, -3, 0]} 
        />
        
        {/* CameraManager needs direct access to interpolated positions or target? 
            Target is fine for lookAt usually, but interpolated is smoother.
            However, we can't easily access interpolated ref here outside the LayoutSystem render prop unless we restructure.
            For now, let's keep camera on TARGET positions to be responsive, or move it inside.
        */}
        <CameraManager selectedPos={selectedResourceId ? targetPositionsRef.current[selectedResourceId] : undefined} />

        {hasPositions && (
          <LayoutSystem targetPositionsRef={targetPositionsRef}>
            {(interpolatedRef) => (
                <group>
                     {enableNamespaceProjection && (
                        <NamespaceProjections resources={visibleResources} positionsRef={interpolatedRef} />
                    )}

                    {Object.entries(resourcesByKind).map(([kind, kindResources]) => (
                        <InstancedNodes 
                            key={kind}
                            resources={kindResources}
                            positionsRef={interpolatedRef}
                            geometry={getGeometryForKind(kind)}
                            baseColor={getColorForKind(kind)}
                            onClick={setSelectedResourceId}
                            onDoubleClick={handleDoubleClick}
                            selectedId={selectedResourceId}
                    connectedIds={connectedIds}
                    focusedKind={focusedResourceKind}
                    statusFilters={statusFilters}
                    hoveredId={hoveredId}
                    setHoveredId={setHoveredId}
                />
            ))}
                    
                    <LinkLayer positionsRef={interpolatedRef} />
                    <LabelsLayer 
                        resources={visibleResources} 
                        positionsRef={interpolatedRef} 
                        selectedId={selectedResourceId}  
                        hoveredId={hoveredId}
                        focusedKind={focusedResourceKind}
                        statusFilters={statusFilters}
                        searchQuery={searchQuery}
                        filterNamespaces={filterNamespaces}
                        hideSystemNamespaces={hideSystemNamespaces}
                        activePreset={activePreset}
                        hiddenResourceKinds={hiddenResourceKinds}
                        links={links}
                    />
                </group>
            )}
          </LayoutSystem>
        )}

        <EffectComposer enableNormalPass={false}>
           <Bloom luminanceThreshold={1} mipmapBlur intensity={1.5} radius={0.4} />
           <Vignette eskil={false} offset={0.1} darkness={1.1} />
           <Noise opacity={0.02} blendFunction={BlendFunction.OVERLAY} />
        </EffectComposer>
        
        <SceneStatsReporter />
      </Canvas>
    </div>
  );
};
