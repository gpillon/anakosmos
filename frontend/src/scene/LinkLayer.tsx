import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useClusterStore } from '../store/useClusterStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { shouldShowResource } from '../logic/LayoutEngine';
import type { ClusterLink } from '../api/types';

interface LinkLayerProps {
  positionsRef: React.MutableRefObject<Record<string, [number, number, number]>>;
}

export const LinkLayer: React.FC<LinkLayerProps> = ({ positionsRef }) => {
  const { resources, links } = useClusterStore();
  const hiddenLinkTypes = useSettingsStore(state => state.hiddenLinkTypes);
  const hiddenResourceKinds = useSettingsStore(state => state.hiddenResourceKinds);
  const statusFilters = useSettingsStore(state => state.statusFilters);
  const selectedResourceId = useSettingsStore(state => state.selectedResourceId);
  
  // Need filtered context to hide orphan links if nodes are filtered out by search/namespace
  const searchQuery = useSettingsStore(state => state.searchQuery);
  const filterNamespaces = useSettingsStore(state => state.filterNamespaces);
  const hideSystemNamespaces = useSettingsStore(state => state.hideSystemNamespaces);
  const activePreset = useSettingsStore(state => state.activePreset);

  const geometryRef = useRef<THREE.BufferGeometry>(null);

  // Pre-compute visible links and colors. 
  // This memo only runs when topology or filtering settings change, not on position updates.
  const { visibleLinks, colors, count } = useMemo(() => {
    const validLinks: ClusterLink[] = [];
    const colorArray: number[] = [];

    // Helper to get color - brighter colors for better visibility
    const getColor = (type: string, dimmed: boolean) => {
        if (dimmed) return [0.15, 0.15, 0.15]; // Very dim gray
        switch (type) {
            case 'owner': return [0.58, 0.64, 0.72]; // Slate 400
            case 'network': return [0.23, 0.51, 0.96]; // Blue 500
            case 'config': return [0.85, 0.45, 1.0]; // Bright Magenta/Purple
            case 'storage': return [1.0, 0.6, 0.1]; // Bright Orange
            default: return [0.5, 0.5, 0.5];
        }
    };

    links.forEach(link => {
      const sourceRes = resources[link.source];
      const targetRes = resources[link.target];

      if (!sourceRes || !targetRes) return;
      if (hiddenLinkTypes.includes(link.type)) return;
      if (hiddenResourceKinds.includes(sourceRes.kind) || hiddenResourceKinds.includes(targetRes.kind)) return;

      // Check if nodes are visible according to current filters (Search, Namespace, etc)
      const isSourceVisible = shouldShowResource(sourceRes, searchQuery, filterNamespaces, hideSystemNamespaces, hiddenResourceKinds, activePreset, links, statusFilters);
      const isTargetVisible = shouldShowResource(targetRes, searchQuery, filterNamespaces, hideSystemNamespaces, hiddenResourceKinds, activePreset, links, statusFilters);
      
      if (!isSourceVisible || !isTargetVisible) return;

      const sourceStatusFilter = statusFilters[sourceRes.kind]?.[sourceRes.status] || 'default';
      const targetStatusFilter = statusFilters[targetRes.kind]?.[targetRes.status] || 'default';
      
      if (sourceStatusFilter === 'hidden' || targetStatusFilter === 'hidden') return;

      const isConnected = selectedResourceId 
        ? (link.source === selectedResourceId || link.target === selectedResourceId)
        : true;

      const dimmed = selectedResourceId !== null && !isConnected;
      const [r, g, b] = getColor(link.type, dimmed);

      validLinks.push(link);
      colorArray.push(r, g, b, r, g, b); // Two vertices per link
    });

    return { 
        visibleLinks: validLinks, 
        colors: new Float32Array(colorArray),
        count: validLinks.length 
    };
  }, [links, resources, hiddenLinkTypes, hiddenResourceKinds, statusFilters, selectedResourceId, searchQuery, filterNamespaces, hideSystemNamespaces, activePreset]);

  // Update positions every frame directly in the buffer attribute
  useFrame(() => {
    if (!geometryRef.current) return;
    
    const posAttr = geometryRef.current.attributes.position;
    const array = posAttr.array as Float32Array;
    let needsUpdate = false;

    // We assume the buffer size matches visibleLinks * 6 (2 vertices * 3 coords)
    // If visibleLinks changed, the geometry was recreated, so size should be correct.
    
    for (let i = 0; i < visibleLinks.length; i++) {
        const link = visibleLinks[i];
        const start = positionsRef.current[link.source];
        const end = positionsRef.current[link.target];

        if (start && end) {
            const idx = i * 6;
            // Start Point
            array[idx] = start[0];
            array[idx+1] = start[1];
            array[idx+2] = start[2];
            
            // End Point
            array[idx+3] = end[0];
            array[idx+4] = end[1];
            array[idx+5] = end[2];
            
            needsUpdate = true;
        } else {
            // Collapse line to 0 if positions not ready
            const idx = i * 6;
            array.fill(0, idx, idx + 6);
        }
    }

    if (needsUpdate) {
        posAttr.needsUpdate = true;
        // Recompute bounding sphere occasionally if needed, but for lines usually strict frustum culling isn't critical or we set big bounds
        if (!geometryRef.current.boundingSphere) {
             geometryRef.current.computeBoundingSphere();
        }
    }
  });

  if (count === 0) return null;

  return (
    <lineSegments>
      <bufferGeometry ref={geometryRef}>
        <bufferAttribute 
            attach="attributes-position" 
            count={count * 2} 
            args={[new Float32Array(count * 6), 3]}
            usage={THREE.DynamicDrawUsage} 
        />
        <bufferAttribute 
            attach="attributes-color" 
            count={count * 2} 
            args={[colors, 3]} 
        />
      </bufferGeometry>
      <lineBasicMaterial vertexColors transparent opacity={0.6} linewidth={1} />
    </lineSegments>
  );
};
