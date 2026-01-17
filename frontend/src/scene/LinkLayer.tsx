import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useDisplayResources } from '../store/useClusterStore';
import { useOnboardingStore } from '../store/useOnboardingStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { shouldShowResource } from '../logic/LayoutEngine';
import type { ClusterLink } from '../api/types';

interface LinkLayerProps {
  positionsRef: React.MutableRefObject<Record<string, [number, number, number]>>;
}

interface VisibleLink {
  link: ClusterLink;
  color: [number, number, number];
}

export const LinkLayer: React.FC<LinkLayerProps> = ({ positionsRef }) => {
  const isOnboardingActive = useOnboardingStore(state => state.isActive);
  const { resources, links } = useDisplayResources(isOnboardingActive);
  const hiddenLinkTypes = useSettingsStore(state => state.hiddenLinkTypes);
  const hiddenResourceKinds = useSettingsStore(state => state.hiddenResourceKinds);
  const statusFilters = useSettingsStore(state => state.statusFilters);
  const selectedResourceId = useSettingsStore(state => state.selectedResourceId);
  
  const searchQuery = useSettingsStore(state => state.searchQuery);
  const filterNamespaces = useSettingsStore(state => state.filterNamespaces);
  const hideSystemNamespaces = useSettingsStore(state => state.hideSystemNamespaces);
  const activePreset = useSettingsStore(state => state.activePreset);

  const geometryRef = useRef<THREE.BufferGeometry>(null);

  // Pre-compute visible links and colors
  const visibleLinks = useMemo(() => {
    const result: VisibleLink[] = [];

    const getColor = (type: string, dimmed: boolean): [number, number, number] => {
        if (dimmed) return [0.15, 0.15, 0.15];
        switch (type) {
            case 'owner': return [0.58, 0.64, 0.72];
            case 'network': return [0.23, 0.51, 0.96];
            case 'config': return [0.85, 0.45, 1.0];
            case 'storage': return [1.0, 0.6, 0.1];
            default: return [0.5, 0.5, 0.5];
        }
    };

    links.forEach(link => {
      const sourceRes = resources[link.source];
      const targetRes = resources[link.target];

      if (!sourceRes || !targetRes) return;
      if (hiddenLinkTypes.includes(link.type)) return;
      if (hiddenResourceKinds.includes(sourceRes.kind) || hiddenResourceKinds.includes(targetRes.kind)) return;

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
      const color = getColor(link.type, dimmed);

      result.push({ link, color });
    });

    return result;
  }, [links, resources, hiddenLinkTypes, hiddenResourceKinds, statusFilters, selectedResourceId, searchQuery, filterNamespaces, hideSystemNamespaces, activePreset]);

  const count = visibleLinks.length;
  const size = count * 6;

  const positionArray = useMemo(() => new Float32Array(size), [size]);
  const colorArray = useMemo(() => {
    const next = new Float32Array(size);
    visibleLinks.forEach((item, i) => {
      const [r, g, b] = item.color;
      const idx = i * 6;
      next[idx] = r;
      next[idx + 1] = g;
      next[idx + 2] = b;
      next[idx + 3] = r;
      next[idx + 4] = g;
      next[idx + 5] = b;
    });
    return next;
  }, [size, visibleLinks]);

  // Update positions every frame
  useFrame(() => {
    if (!geometryRef.current) return;
    
    const posAttr = geometryRef.current.attributes.position;
    if (!posAttr) return;
    
    const posArray = posAttr.array as Float32Array;
    let needsUpdate = false;

    for (let i = 0; i < visibleLinks.length; i++) {
        const { link } = visibleLinks[i];
        const start = positionsRef.current[link.source];
        const end = positionsRef.current[link.target];

        const idx = i * 6;
        if (start && end) {
            posArray[idx] = start[0];
            posArray[idx+1] = start[1];
            posArray[idx+2] = start[2];
            posArray[idx+3] = end[0];
            posArray[idx+4] = end[1];
            posArray[idx+5] = end[2];
            needsUpdate = true;
        } else {
            posArray[idx] = 0;
            posArray[idx+1] = 0;
            posArray[idx+2] = 0;
            posArray[idx+3] = 0;
            posArray[idx+4] = 0;
            posArray[idx+5] = 0;
        }
    }

    if (needsUpdate) {
        posAttr.needsUpdate = true;
    }
  });

  if (count === 0) return null;

  // Use key to force geometry recreation only when count changes
  // Disable raycast to prevent lines from blocking clicks on resources behind them
  return (
    <lineSegments key={`links-${count}`} raycast={() => null}>
      <bufferGeometry ref={geometryRef}>
        <bufferAttribute 
            attach="attributes-position" 
            args={[positionArray, 3]}
            usage={THREE.DynamicDrawUsage} 
        />
        <bufferAttribute 
            attach="attributes-color" 
            args={[colorArray, 3]}
        />
      </bufferGeometry>
      <lineBasicMaterial vertexColors transparent opacity={0.6} linewidth={1} />
    </lineSegments>
  );
};
