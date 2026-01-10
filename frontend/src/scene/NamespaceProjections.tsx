import React, { useMemo } from 'react';
import * as THREE from 'three';
import type { ClusterResource } from '../api/types';
import { NamespaceMetaballs } from './NamespaceMetaballs';

const stringToColor = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash) % 360;
  return `hsl(${h}, 70%, 50%)`;
};

interface Props {
  resources: Record<string, ClusterResource>;
  positions: Record<string, [number, number, number]>;
}

export const NamespaceProjections: React.FC<Props> = ({ resources, positions }) => {
  const groups = useMemo(() => {
    const map = new Map<string, THREE.Vector3[]>();
    
    Object.values(resources).forEach(res => {
      const pos = positions[res.id];
      // Only project if it has a valid position and namespace
      if (!pos || !res.namespace) return;
      
      if (!map.has(res.namespace)) {
        map.set(res.namespace, []);
      }
      map.get(res.namespace)!.push(new THREE.Vector3(pos[0], 0, pos[2]));
    });
    
    return map;
  }, [resources, positions]);

  return (
    <group>
      {Array.from(groups.entries()).map(([ns, resourcePositions]) => (
        <NamespaceMetaballs 
          key={ns} 
          namespace={ns} 
          positions={resourcePositions} 
          color={stringToColor(ns)} 
        />
      ))}
    </group>
  );
};
