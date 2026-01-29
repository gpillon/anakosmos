import React, { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { Environment, Html, OrbitControls, Stars } from '@react-three/drei';
import * as THREE from 'three';
import { useApplicationDraftStore } from '../store/useApplicationDraftStore';
import { KIND_COLOR_MAP, KIND_GEOMETRY_MAP, DEFAULT_COLOR, DEFAULT_GEOMETRY } from '../config/resourceKinds';
import { 
  podGeo, serviceGeo, deployGeo, 
  octGeo, smallBoxGeo, pyramidGeo,
  puckGeo, jobGeo, cronJobGeo, hpaGeo, tetraGeo
} from './sharedResources';
import type { GeometryType } from '../config/resourceKinds';

// Geometry map for creation scene
const geometryMap: Partial<Record<GeometryType, THREE.BufferGeometry>> = {
  pod: podGeo,
  service: serviceGeo,
  deploy: deployGeo,
  oct: octGeo,
  smallBox: smallBoxGeo,
  pyramid: pyramidGeo,
  puck: puckGeo,
  job: jobGeo,
  cronJob: cronJobGeo,
  hpa: hpaGeo,
  tetra: tetraGeo,
};

const getGeometryForKind = (kind: string): THREE.BufferGeometry => {
  const geoType = KIND_GEOMETRY_MAP[kind] || DEFAULT_GEOMETRY;
  return geometryMap[geoType] || tetraGeo;
};

const getColorForKind = (kind: string): string => {
  return KIND_COLOR_MAP[kind] || DEFAULT_COLOR;
};

export const CreationScene: React.FC = () => {
  const resources = useApplicationDraftStore((state) => state.resources);
  
  // Position resources in a circle
  const positions = useMemo(() => {
    if (resources.length === 0) return [];
    const radius = Math.max(8, resources.length * 1.5);
    return resources.map((_, index) => {
      const angle = (index / resources.length) * Math.PI * 2 - Math.PI / 2;
      return [
        Math.cos(angle) * radius, 
        1.5, 
        Math.sin(angle) * radius
      ] as [number, number, number];
    });
  }, [resources]);

  return (
    <Canvas camera={{ position: [0, 20, 30], fov: 45 }}>
      <color attach="background" args={['#020617']} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 20, 10]} intensity={1.2} />
      <Stars radius={80} depth={40} count={2500} factor={2} />
      <Environment preset="city" />
      <OrbitControls 
        enablePan 
        enableZoom 
        enableRotate 
        minDistance={10}
        maxDistance={100}
      />

      {/* Ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <circleGeometry args={[20, 64]} />
        <meshStandardMaterial 
          color="#0f172a" 
          metalness={0.2} 
          roughness={0.8} 
          transparent
          opacity={0.8}
        />
      </mesh>

      {/* Draft resources */}
      {resources.map((res, index) => {
        const color = getColorForKind(res.kind);
        const geometry = getGeometryForKind(res.kind);
        const metadata = res.spec.metadata as Record<string, unknown> || {};
        const name = String(metadata.name || res.kind);
        
        return (
          <group key={res.id} position={positions[index]}>
            {/* Resource mesh */}
            <mesh geometry={geometry} scale={1.2}>
              <meshStandardMaterial 
                color={color} 
                emissive={color} 
                emissiveIntensity={0.3}
                metalness={0.3}
                roughness={0.5}
              />
            </mesh>
            
            {/* Glow ring */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1, 0]}>
              <ringGeometry args={[1.3, 1.5, 32]} />
              <meshBasicMaterial 
                color={color} 
                transparent 
                opacity={0.3}
              />
            </mesh>
            
            {/* Label */}
            <Html center style={{ pointerEvents: 'none' }} zIndexRange={[30, 0]}>
              <div className="px-2.5 py-1.5 bg-slate-900/90 text-white text-xs rounded-lg border border-slate-600 shadow-xl whitespace-nowrap backdrop-blur-sm">
                <div className="font-semibold">{name}</div>
                <div className="text-[10px] text-slate-400 flex items-center gap-1">
                  <span 
                    className="w-2 h-2 rounded-full" 
                    style={{ backgroundColor: color }}
                  />
                  {res.kind}
                </div>
              </div>
            </Html>
          </group>
        );
      })}

      {/* Empty state indicator */}
      {resources.length === 0 && (
        <Html center position={[0, 3, 0]} style={{ pointerEvents: 'none' }}>
          <div className="text-center">
            <div className="text-slate-500 text-sm">
              Select a blueprint or add resources
            </div>
            <div className="text-slate-600 text-xs mt-1">
              They will appear here in 3D
            </div>
          </div>
        </Html>
      )}
    </Canvas>
  );
};
