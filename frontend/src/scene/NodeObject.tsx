import React, { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import type { ClusterResource } from '../api/types';
import { useSettingsStore } from '../store/useSettingsStore';
import { 
  nodeGeo, serviceGeo, podGeo, deployGeo, octGeo, 
  torusGeo, boxGeo, smallBoxGeo, puckGeo, barrelGeo, slabGeo, tetraGeo 
} from './sharedResources';

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
  PersistentVolumeClaim: '#f97316', 
  PersistentVolume: '#ea580c', 
  StorageClass: '#c2410c', 
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
  const isUnhealthy = resource.health === 'warning' || resource.health === 'error';
  // Fallback if health not calculated yet (backward compatibility or mock)
  const isLegacyUnhealthy = !['Running', 'Ready', 'Active', 'Available', 'Bound', 'Succeeded'].includes(resource.status);
  const finalIsUnhealthy = resource.health ? isUnhealthy : isLegacyUnhealthy;
  
  useFrame((state) => {
    if (!meshRef.current) return;
    
    const t = state.clock.getElapsedTime();

    // Focus Pulse
    if (isFocusedKind || statusFilterState === 'focused') {
        const scale = 1.5 + Math.sin(t * 5) * 0.1; 
        meshRef.current.scale.setScalar(scale);
        meshRef.current.rotation.y += 0.01;
    } 
    // Unhealthy Pulse
    else if (finalIsUnhealthy && statusFilterState !== 'grayed') {
      const scale = 1 + Math.sin(t * 8) * 0.1; 
      meshRef.current.scale.setScalar(scale);
    } else {
      meshRef.current.scale.setScalar(1);
      meshRef.current.rotation.y = 0;
    }
  });

  // Return null if hidden by status filter
  if (statusFilterState === 'hidden') return null;

  const baseColor = finalIsUnhealthy ? '#ef4444' : (KIND_COLORS[resource.kind] || '#9ca3af');
  
  let displayColor = baseColor;
  let finalOpacity = dimmed ? 0.1 : 1;
  let finalEmissive = '#000000';
  let finalEmissiveIntensity = 0;

  // Selection/Focus Logic
  if (isSelected) {
      displayColor = '#f472b6';
      finalEmissive = '#f472b6';
      finalEmissiveIntensity = 3;
  }
  else if (isFocusedKind || statusFilterState === 'focused') {
      displayColor = '#fbbf24';
      finalEmissive = '#fbbf24';
      finalEmissiveIntensity = 3;
  }
  else if (statusFilterState === 'grayed') {
      displayColor = '#475569';
      finalOpacity = 0.2;
      finalEmissiveIntensity = 0;
  }
  else if (finalIsUnhealthy) {
      displayColor = '#ef4444';
      finalEmissive = '#ef4444';
      finalEmissiveIntensity = 1.5;
  }
  else if (hovered) {
      displayColor = '#ffffff';
  }

  // Select shared geometry
  let geometry;
  if (resource.kind === 'Node') geometry = nodeGeo;
  else if (resource.kind === 'Service') geometry = serviceGeo;
  else if (resource.kind === 'Pod') geometry = podGeo;
  else if (resource.kind === 'Deployment') geometry = deployGeo;
  else if (resource.kind === 'Ingress' || resource.kind === 'Route') geometry = octGeo;
  else if (resource.kind === 'NetworkAttachmentDefinition') geometry = torusGeo;
  else if (resource.kind === 'NodeNetworkConfigurationPolicy') geometry = boxGeo;
  else if (resource.kind === 'Secret' || resource.kind === 'ConfigMap') geometry = smallBoxGeo;
  else if (resource.kind === 'PersistentVolumeClaim') geometry = puckGeo;
  else if (resource.kind === 'PersistentVolume') geometry = barrelGeo;
  else if (resource.kind === 'StorageClass') geometry = slabGeo;
  else geometry = tetraGeo;

  // Adjust Y pos for Node
  const yOffset = resource.kind === 'Node' ? 0.2 : 0;

  return (
    <group position={[position[0], position[1] + yOffset, position[2]]}>
      <mesh
        ref={meshRef}
        geometry={geometry}
        onClick={onClick}
        onPointerOver={(e) => { e.stopPropagation(); setHover(true); }}
        onPointerOut={() => setHover(false)}
      >
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
      
      {/* Node Label (Always visible but dimmed) */}
      {resource.kind === 'Node' && (
        <Html position={[0, 0.3, 0]} center transform sprite>
          <div className={`text-[10px] font-mono tracking-widest pointer-events-none transition-opacity ${dimmed || statusFilterState === 'grayed' ? 'opacity-20' : 'opacity-80 text-slate-400'}`}>
            {resource.name}
          </div>
        </Html>
      )}
      
      {/* Hover Label for others (Only on hover/select/focus) */}
      {resource.kind !== 'Node' && (hovered || isSelected || isFocusedKind || statusFilterState === 'focused') && (
        <Html>
          <div className="bg-slate-900/90 backdrop-blur border border-slate-700 text-white text-xs px-2 py-1 rounded shadow-xl whitespace-nowrap pointer-events-none transform -translate-y-8 pointer-events-none z-0">
            <span className={`font-bold mr-1 ${finalIsUnhealthy ? 'text-red-400' : 'text-slate-400'}`}>
              {resource.kind}:
            </span>
            {resource.name}
            {finalIsUnhealthy && <span className="ml-2 text-red-500 font-bold">!</span>}
          </div>
        </Html>
      )}
    </group>
  );
};
