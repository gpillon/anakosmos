import React, { useMemo } from 'react';
import * as THREE from 'three';
import { useClusterStore } from '../store/useClusterStore';
import { useSettingsStore } from '../store/useSettingsStore';

interface LinkLayerProps {
  positions: Record<string, [number, number, number]>;
}

export const LinkLayer: React.FC<LinkLayerProps> = ({ positions }) => {
  const { resources, links } = useClusterStore();
  const hiddenLinkTypes = useSettingsStore(state => state.hiddenLinkTypes);
  const hiddenResourceKinds = useSettingsStore(state => state.hiddenResourceKinds);
  const statusFilters = useSettingsStore(state => state.statusFilters);
  const selectedResourceId = useSettingsStore(state => state.selectedResourceId);

  // Group links by type to use different colors/materials in a single batch
  // or just use one big LineSegments with vertex colors.
  // Vertex colors is best for single draw call.

  const { geometry } = useMemo(() => {
    const points: number[] = [];
    const colors: number[] = [];
    
    // Helper to get color
    const getColor = (type: string, dimmed: boolean) => {
        if (dimmed) return [0.2, 0.2, 0.2]; // Very dim gray
        switch (type) {
            case 'owner': return [0.58, 0.64, 0.72]; // Slate 400
            case 'network': return [0.23, 0.51, 0.96]; // Blue 500
            case 'config': return [0.66, 0.33, 0.96]; // Purple 500
            case 'storage': return [0.85, 0.47, 0.02]; // Orange
            default: return [0.5, 0.5, 0.5];
        }
    };

    let visibleLinksCount = 0;

    links.forEach(link => {
      const start = positions[link.source];
      const end = positions[link.target];
      const sourceRes = resources[link.source];
      const targetRes = resources[link.target];

      if (!start || !end || !sourceRes || !targetRes) return;
      if (hiddenLinkTypes.includes(link.type)) return;
      if (hiddenResourceKinds.includes(sourceRes.kind) || hiddenResourceKinds.includes(targetRes.kind)) return;

      const sourceStatusFilter = statusFilters[sourceRes.kind]?.[sourceRes.status] || 'default';
      const targetStatusFilter = statusFilters[targetRes.kind]?.[targetRes.status] || 'default';
      
      if (sourceStatusFilter === 'hidden' || targetStatusFilter === 'hidden') return;

      const isConnected = selectedResourceId 
        ? (link.source === selectedResourceId || link.target === selectedResourceId)
        : true;

      const dimmed = selectedResourceId !== null && !isConnected;
      const [r, g, b] = getColor(link.type, dimmed);

      // Add segment
      points.push(...start, ...end);
      colors.push(r, g, b, r, g, b); // Vertex colors for both ends
      visibleLinksCount++;
    });

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    return { geometry: geo, count: visibleLinksCount };
  }, [links, positions, hiddenLinkTypes, hiddenResourceKinds, statusFilters, selectedResourceId, resources]);

  if (geometry.attributes.position.count === 0) return null;

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial vertexColors transparent opacity={0.4} linewidth={1} />
    </lineSegments>
  );
};
