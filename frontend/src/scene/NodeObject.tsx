import React, { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import type { ClusterResource } from '../api/types';
import { useSettingsStore } from '../store/useSettingsStore';

interface NodeObjectProps {
  resource: ClusterResource;
  position: [number, number, number];
  onClick?: (e: ThreeEvent<MouseEvent>) => void;
  dimmed?: boolean;
}

const KIND_COLORS: Record<string, string> = {
  Node: '#1e293b', 
  Pod: '#60a5fa', 
  Service: '#34d399', 
  Deployment: '#a78bfa', 
  ReplicaSet: '#c4b5fd', 
  ConfigMap: '#fbbf24', 
  Secret: '#f87171', 
  Ingress: '#e879f9', 
  Route: '#f472b6', 
  NetworkAttachmentDefinition: '#22d3ee', 
  NodeNetworkConfigurationPolicy: '#94a3b8', 
  PersistentVolumeClaim: '#f97316', // Orange 500
  PersistentVolume: '#ea580c', // Orange 600
  StorageClass: '#c2410c', // Orange 700
};

export const NodeObject: React.FC<NodeObjectProps> = ({ resource, position, onClick, dimmed = false }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHover] = useState(false);
  const selectedResourceId = useSettingsStore(state => state.selectedResourceId);
  const focusedResourceKind = useSettingsStore(state => state.focusedResourceKind);
  const statusFilters = useSettingsStore(state => state.statusFilters);
  
  const isSelected = selectedResourceId === resource.id;
  const isFocusedKind = focusedResourceKind === resource.kind;
  
  // Status Filter State
  const kindFilters = statusFilters[resource.kind] || {};
  const statusFilterState = kindFilters[resource.status] || 'default';

  // Pulse effect for unhealthy resources
  // 'Succeeded' is a healthy state for completed Jobs/Pods
  const isHealthy = ['Running', 'Ready', 'Active', 'Available', 'Bound', 'Succeeded'].includes(resource.status);
  const isUnhealthy = !isHealthy;
  
  useFrame((state) => {
    if (!meshRef.current) return;
    
    const t = state.clock.getElapsedTime();

    // Focus Pulse (Global Focus or Specific Status Focus)
    if (isFocusedKind || statusFilterState === 'focused') {
        const scale = 1.5 + Math.sin(t * 5) * 0.1; 
        meshRef.current.scale.setScalar(scale);
        
        // Rotate slowly if focused
        meshRef.current.rotation.y += 0.01;
    } 
    // Unhealthy Pulse (only if not grayed)
    else if (isUnhealthy && statusFilterState !== 'grayed') {
      const scale = 1 + Math.sin(t * 8) * 0.1; // Fast pulse
      meshRef.current.scale.setScalar(scale);
    } else {
      meshRef.current.scale.setScalar(1);
      meshRef.current.rotation.y = 0;
    }
  });

  // Return null if hidden by status filter
  if (statusFilterState === 'hidden') return null;

  const baseColor = isUnhealthy ? '#ef4444' : (KIND_COLORS[resource.kind] || '#9ca3af');
  
  let displayColor = baseColor;
  let finalOpacity = dimmed ? 0.1 : 1;
  let finalEmissive = '#000000';
  let finalEmissiveIntensity = 0;

  // Selection Override
  if (isSelected) {
      displayColor = '#f472b6';
      finalEmissive = '#f472b6';
      finalEmissiveIntensity = 3;
  }
  // Focus (Kind or Status) Override
  else if (isFocusedKind || statusFilterState === 'focused') {
      displayColor = '#fbbf24'; // Amber
      finalEmissive = '#fbbf24';
      finalEmissiveIntensity = 3;
  }
  // Grayed Override
  else if (statusFilterState === 'grayed') {
      displayColor = '#475569'; // Slate 600
      finalOpacity = 0.2;
      finalEmissiveIntensity = 0;
  }
  // Unhealthy Override (if not grayed)
  else if (isUnhealthy) {
      displayColor = '#ef4444';
      finalEmissive = '#ef4444';
      finalEmissiveIntensity = 1.5;
  }
  // Hover Override (lowest priority)
  else if (hovered) {
      displayColor = '#ffffff';
  }

  // Render logic based on Kind
  if (resource.kind === 'Node') {
    return (
      <group position={[position[0], position[1] + 0.2, position[2]]}>
        <mesh
          ref={meshRef}
          onClick={onClick}
          onPointerOver={(e) => { e.stopPropagation(); setHover(true); }}
          onPointerOut={() => setHover(false)}
        >
          <cylinderGeometry args={[2.5, 2.5, 0.4, 8]} />
          <meshPhysicalMaterial 
            color={displayColor}
            metalness={0.2}
            roughness={0.2}
            clearcoat={0.5}
            transparent
            opacity={finalOpacity}
            flatShading
            emissive={finalEmissive}
            emissiveIntensity={finalEmissiveIntensity}
          />
        </mesh>
        <Html position={[0, 0.3, 0]} center transform sprite>
          <div className={`text-[10px] font-mono tracking-widest pointer-events-none transition-opacity ${dimmed || statusFilterState === 'grayed' ? 'opacity-20' : 'opacity-80 text-slate-400'}`}>
            {resource.name}
          </div>
        </Html>
      </group>
    );
  }

  // Floating resources
  let geometry;
  if (resource.kind === 'Service') geometry = <icosahedronGeometry args={[0.5]} />;
  else if (resource.kind === 'Pod') geometry = <capsuleGeometry args={[0.25, 0.5, 4, 16]} />;
  else if (resource.kind === 'Deployment') geometry = <dodecahedronGeometry args={[0.6]} />;
  else if (resource.kind === 'Ingress' || resource.kind === 'Route') geometry = <octahedronGeometry args={[0.5]} />;
  else if (resource.kind === 'NetworkAttachmentDefinition') geometry = <torusKnotGeometry args={[0.3, 0.1, 64, 8, 2, 3]} />;
  else if (resource.kind === 'NodeNetworkConfigurationPolicy') geometry = <boxGeometry args={[0.8, 0.2, 0.8]} />;
  else if (resource.kind === 'Secret' || resource.kind === 'ConfigMap') geometry = <boxGeometry args={[0.4, 0.4, 0.4]} />;
  else if (resource.kind === 'PersistentVolumeClaim') geometry = <cylinderGeometry args={[0.4, 0.4, 0.2, 32]} />; // Disc/Puck
  else if (resource.kind === 'PersistentVolume') geometry = <cylinderGeometry args={[0.5, 0.5, 0.8, 32]} />; // Barrel
  else if (resource.kind === 'StorageClass') geometry = <boxGeometry args={[1, 0.2, 1]} />; // Slab
  else geometry = <tetrahedronGeometry args={[0.5]} />;

  return (
    <group position={position}>
      <mesh
        ref={meshRef}
        onClick={onClick}
        onPointerOver={(e) => { e.stopPropagation(); setHover(true); }}
        onPointerOut={() => setHover(false)}
      >
        {geometry}
        <meshPhysicalMaterial 
          color={displayColor}
          metalness={0.5}
          roughness={0.3}
          clearcoat={0.8}
          transparent
          opacity={finalOpacity}
          flatShading={true}
          emissive={finalEmissive}
          emissiveIntensity={finalEmissiveIntensity}
        />
      </mesh>
      
      {(hovered || isSelected || isFocusedKind || statusFilterState === 'focused') && (
        <Html>
          <div className="bg-slate-900/90 backdrop-blur border border-slate-700 text-white text-xs px-2 py-1 rounded shadow-xl whitespace-nowrap pointer-events-none transform -translate-y-8 pointer-events-none z-0">
            <span className={`font-bold mr-1 ${isUnhealthy ? 'text-red-400' : 'text-slate-400'}`}>
              {resource.kind}:
            </span>
            {resource.name}
            {isUnhealthy && <span className="ml-2 text-red-500 font-bold">!</span>}
          </div>
        </Html>
      )}
    </group>
  );
};
