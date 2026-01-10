import React, { useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Grid, Environment, CameraControls } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette, Noise } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import * as THREE from 'three';
import { useClusterStore } from '../store/useClusterStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { NodeObject } from './NodeObject';
import { LinkObject } from './LinkObject';
import { NamespaceProjections } from './NamespaceProjections';
import { useForceLayout } from '../logic/LayoutEngine';

const CameraManager: React.FC<{ selectedPos?: [number, number, number] }> = ({ selectedPos }) => {
  const controlsRef = useRef<CameraControls>(null);
  const [lastPos, setLastPos] = useState<THREE.Vector3 | null>(null);
  const [lastTarget, setLastTarget] = useState<THREE.Vector3 | null>(null);

  useEffect(() => {
    if (!controlsRef.current) return;

    if (selectedPos) {
      // Save current position before zooming in, if we haven't already
      if (!lastPos) {
        setLastPos(controlsRef.current.getPosition(new THREE.Vector3()));
        setLastTarget(controlsRef.current.getTarget(new THREE.Vector3()));
      }

      // Smoothly fit the camera to look at the selected object
      // Reduced Zoom: +8 instead of +5
      const [x, y, z] = selectedPos;
      
      controlsRef.current.setLookAt(
        x + 8, y + 8, z + 8, // Further away
        x, y, z,             // Target Position
        true                 // Enable transition
      );
    } else if (lastPos && lastTarget) {
      // Restore previous position on deselect
      controlsRef.current.setLookAt(
        lastPos.x, lastPos.y, lastPos.z,
        lastTarget.x, lastTarget.y, lastTarget.z,
        true
      );
      // Clear saved state
      setLastPos(null);
      setLastTarget(null);
    }
  }, [selectedPos]);

  return <CameraControls ref={controlsRef} makeDefault maxPolarAngle={Math.PI / 2.1} dollyToCursor={true} />;
};

export const ClusterScene: React.FC = () => {
  const { resources, links } = useClusterStore();
  const selectedResourceId = useSettingsStore(state => state.selectedResourceId);
  const setSelectedResourceId = useSettingsStore(state => state.setSelectedResourceId);
  const hiddenResourceKinds = useSettingsStore(state => state.hiddenResourceKinds);
  const hiddenLinkTypes = useSettingsStore(state => state.hiddenLinkTypes);
  const statusFilters = useSettingsStore(state => state.statusFilters);
  const enableNamespaceProjection = useSettingsStore(state => state.enableNamespaceProjection);
  
  // Use physics layout - now returns positions AND dynamic zones
  const { positions } = useForceLayout(resources, links);

  // Pre-calculate connectivity set for focus mode
  const connectedIds = React.useMemo(() => {
    if (!selectedResourceId) return new Set<string>();
    const set = new Set<string>();
    set.add(selectedResourceId);
    links.forEach(link => {
      if (link.source === selectedResourceId) set.add(link.target);
      if (link.target === selectedResourceId) set.add(link.source);
    });
    return set;
  }, [selectedResourceId, links]);

  // Handle background click to deselect
  const handleMiss = () => {
    setSelectedResourceId(null);
  };

  const selectedPos = selectedResourceId ? positions[selectedResourceId] : undefined;

  return (
    <div className="w-full h-full bg-slate-900">
      <Canvas camera={{ position: [15, 15, 15], fov: 50 }} onPointerMissed={handleMiss}>
        <color attach="background" args={['#050505']} />
        
        {/* Lighting & Environment */}
        <ambientLight intensity={1.5} />
        <pointLight position={[10, 20, 10]} intensity={2} />
        <Environment preset="city" />
        
        {/* Ground Plane - Lowered to create floating effect */}
        <Grid 
          infiniteGrid 
          cellSize={1} 
          sectionSize={5} 
          fadeDistance={200} 
          sectionColor="#4f4f4f" 
          cellColor="#2f2f2f"
          position={[0, -5, 0]} 
        />
        
        <CameraManager selectedPos={selectedPos} />

        {enableNamespaceProjection && (
            <NamespaceProjections resources={resources} positions={positions} />
        )}

        <group>
          {Object.values(resources).map(resource => (
            positions[resource.id] && (
              <NodeObject 
                key={resource.id} 
                resource={resource} 
                position={positions[resource.id]}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedResourceId(resource.id);
                }}
                dimmed={selectedResourceId !== null && !connectedIds.has(resource.id)}
              />
            )
          ))}
          
          {links.map((link, i) => {
            const start = positions[link.source];
            const end = positions[link.target];
            const sourceRes = resources[link.source];
            const targetRes = resources[link.target];

            // Safety check
            if (!start || !end || !sourceRes || !targetRes) return null;

            // Check if hidden by Link Type
            if (hiddenLinkTypes.includes(link.type)) return null;

            // Check if hidden by Kind
            if (hiddenResourceKinds.includes(sourceRes.kind) || hiddenResourceKinds.includes(targetRes.kind)) return null;

            // Check if hidden by Status
            const sourceStatusFilter = statusFilters[sourceRes.kind]?.[sourceRes.status] || 'default';
            const targetStatusFilter = statusFilters[targetRes.kind]?.[targetRes.status] || 'default';
            
            if (sourceStatusFilter === 'hidden' || targetStatusFilter === 'hidden') return null;

            const isConnected = selectedResourceId 
              ? (link.source === selectedResourceId || link.target === selectedResourceId)
              : true;

            return (
              <LinkObject 
                key={i} 
                start={start} 
                end={end} 
                type={link.type} 
                dimmed={selectedResourceId !== null && !isConnected}
              />
            );
          })}
        </group>

        {/* Post Processing */}
        <EffectComposer enableNormalPass={false}>
           <Bloom luminanceThreshold={1} mipmapBlur intensity={1.5} radius={0.4} />
           <Vignette eskil={false} offset={0.1} darkness={1.1} />
           <Noise opacity={0.02} blendFunction={BlendFunction.OVERLAY} />
        </EffectComposer>
      </Canvas>
    </div>
  );
};
