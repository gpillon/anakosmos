import React, { useState, useRef, memo, useMemo } from 'react';
import * as THREE from 'three';
import { Text } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';

/**
 * Computes the Convex Hull of a set of points (Jarvis March / Gift Wrapping).
 * Simplified 2D implementation for XZ plane.
 */
function getConvexHull(points: [number, number][]): [number, number][] {
  if (points.length < 3) return points;

  let left = 0;
  for (let i = 1; i < points.length; i++) {
    if (points[i][0] < points[left][0]) {
      left = i;
    }
  }

  const hull: [number, number][] = [];
  let p = left;
  let q: number;

  do {
    hull.push(points[p]);
    q = (p + 1) % points.length;
    
    for (let i = 0; i < points.length; i++) {
      const val = (points[i][1] - points[p][1]) * (points[q][0] - points[p][0]) -
                  (points[i][0] - points[p][0]) * (points[q][1] - points[p][1]);
      
      if (val < 0) {
        q = i;
      }
    }
    p = q;
  } while (p !== left);

  return hull;
}

const MIN_HULL_POINTS = 5;
const BASE_OFFSET = 2;

function ensureMinimumPoints(points: [number, number][], minPoints: number): [number, number][] {
  if (points.length >= minPoints) return points;
  
  let centerX = 0, centerZ = 0;
  points.forEach(p => { centerX += p[0]; centerZ += p[1]; });
  centerX /= points.length || 1;
  centerZ /= points.length || 1;
  
  let maxDist = 2;
  points.forEach(p => {
    const dist = Math.sqrt(Math.pow(p[0] - centerX, 2) + Math.pow(p[1] - centerZ, 2));
    maxDist = Math.max(maxDist, dist);
  });
  
  const radius = maxDist + 1.5;
  const result = [...points];
  const syntheticCount = minPoints - points.length;
  
  for (let i = 0; i < syntheticCount; i++) {
    const angle = (2 * Math.PI * i) / syntheticCount + Math.PI / 6;
    result.push([centerX + Math.cos(angle) * radius, centerZ + Math.sin(angle) * radius]);
  }
  
  return result;
}

interface ZoneProps {
  namespace: string;
  positionsKey: string;  // Only re-render when this key changes
  centerX: number;
  centerZ: number;
  hullPoints: [number, number][];
  color: string;
}

// Memoized zone component - only re-renders when positionsKey changes
// Uses positionsKey for comparison instead of deep comparing hullPoints array
const NamespaceZone = memo<ZoneProps>(({ namespace, positionsKey, centerX, centerZ, hullPoints, color }) => {
  // Use useMemo to create the Shape, R3F handles the geometry lifecycle automatically
  const shape = useMemo(() => {
    if (hullPoints.length === 0) return null;
    
    const s = new THREE.Shape();
    s.moveTo(hullPoints[0][0], hullPoints[0][1]); 
    for (let i = 1; i < hullPoints.length; i++) {
      s.lineTo(hullPoints[i][0], hullPoints[i][1]);
    }
    s.closePath();
    return s;
  }, [positionsKey, hullPoints]); // positionsKey changes when hullPoints changes significantly

  // Create points for the line loop matching the shape (local XY plane)
  const linePoints = useMemo(() => {
     if (hullPoints.length === 0) return null;
     // For LineLoop we don't need to duplicate the first point
     return hullPoints.map(p => new THREE.Vector3(p[0], p[1], 0));
  }, [positionsKey, hullPoints]);

  if (!shape || !linePoints) return null;

  // Custom raycast function that disables hit detection (clicks pass through)
  const noRaycast = () => null;
  
  return (
    <group>
        <mesh 
          key={`mesh-${positionsKey}`}
          position={[0, -(BASE_OFFSET + .95), 0]} 
          rotation={[Math.PI / 2, 0, 0]}
          raycast={noRaycast}
        >
            <shapeGeometry key={`shape-${positionsKey}`} args={[shape]} />
            <meshBasicMaterial color={color} transparent opacity={0.2} side={THREE.DoubleSide} />
        </mesh>

        <lineLoop 
            key={`line-${positionsKey}`}
            position={[0, -(BASE_OFFSET + .94), 0]} 
            rotation={[Math.PI / 2, 0, 0]}
            raycast={noRaycast}
        >
             <bufferGeometry key={`buff-${positionsKey}`}>
                <bufferAttribute
                    attach="attributes-position"
                    args={[new Float32Array(linePoints.flatMap(v => [v.x, v.y, v.z])), 3]}
                />
             </bufferGeometry>
             <lineBasicMaterial color={color} transparent opacity={0.6} />
        </lineLoop>
        
        <Text
            position={[centerX, -(BASE_OFFSET + 0.0), centerZ]}
            rotation={[-Math.PI / 2, 0, 0]} 
            fontSize={1.5}
            color="white"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.1}
            outlineColor="black"
            renderOrder={0}
            raycast={noRaycast}
        >
            {namespace}
        </Text>
    </group>
  );
}, (prevProps, nextProps) => {
  // Only re-render if positionsKey changes - this is the stable key based on bounds
  return prevProps.positionsKey === nextProps.positionsKey && 
         prevProps.namespace === nextProps.namespace &&
         prevProps.color === nextProps.color;
});

const CLUSTER_SCOPED_LABEL = 'Cluster';

interface ZoneData {
  key: string;
  centerX: number;
  centerZ: number;
  hullPoints: [number, number][];
}

export const NamespaceProjections: React.FC<{ 
  resources: any;
  positionsRef: React.RefObject<Record<string, [number, number, number]>>;
}> = ({ resources, positionsRef }) => {
  const [zones, setZones] = useState<Map<string, ZoneData>>(new Map());
  const lastUpdateRef = useRef(0);
  // Cache previous position bounds to detect significant changes
  const prevBoundsRef = useRef<Map<string, string>>(new Map());

  useFrame((state) => {
    // Update every 0.5s to save CPU (was 0.2s)
    if (state.clock.elapsedTime - lastUpdateRef.current < 0.5) return;
    lastUpdateRef.current = state.clock.elapsedTime;

    // Group resources by namespace using plain arrays (no THREE.Vector3)
    const nsGroups = new Map<string, [number, number][]>();
    
    Object.values(resources as Record<string, any>).forEach((res: any) => {
      const pos = positionsRef.current[res.id];
      if (!pos) return;
      
      const nsKey = res.namespace || CLUSTER_SCOPED_LABEL;
      
      if (!nsGroups.has(nsKey)) {
        nsGroups.set(nsKey, []);
      }
      nsGroups.get(nsKey)!.push([pos[0], pos[2]]); // Store as [x, z] tuple
    });
    
    // Check if anything changed significantly
    let hasChanges = false;
    const newBounds = new Map<string, string>();
    
    nsGroups.forEach((points, ns) => {
      if (points.length === 0) return;
      
      // Calculate bounds signature
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
      let sumX = 0, sumZ = 0;
      points.forEach(p => {
        sumX += p[0]; sumZ += p[1];
        minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]);
        minZ = Math.min(minZ, p[1]); maxZ = Math.max(maxZ, p[1]);
      });
      
      // Create a key based on count and rough bounds (rounded to reduce jitter)
      // Round to nearest 5 units to significantly reduce updates during physics stabilization
      const ROUND_FACTOR = 5;
      const boundsKey = `${points.length}-${Math.round(minX/ROUND_FACTOR)}-${Math.round(maxX/ROUND_FACTOR)}-${Math.round(minZ/ROUND_FACTOR)}-${Math.round(maxZ/ROUND_FACTOR)}`;
      newBounds.set(ns, boundsKey);
      
      if (prevBoundsRef.current.get(ns) !== boundsKey) {
        hasChanges = true;
      }
    });
    
    // Also check for removed namespaces
    prevBoundsRef.current.forEach((_, ns) => {
      if (!newBounds.has(ns)) hasChanges = true;
    });
    
    if (!hasChanges) return;
    
    prevBoundsRef.current = newBounds;
    
    // Compute hull data for changed zones
    const newZones = new Map<string, ZoneData>();
    
    nsGroups.forEach((points, ns) => {
      if (points.length === 0) return;
      
      // Calculate centroid
      let centerX = 0, centerZ = 0;
      points.forEach(p => { centerX += p[0]; centerZ += p[1]; });
      centerX /= points.length;
      centerZ /= points.length;
      
      // Ensure minimum points and compute hull
      const expandedPoints = ensureMinimumPoints(points, MIN_HULL_POINTS);
      const hullPoints = getConvexHull(expandedPoints);
      
      const boundsKey = newBounds.get(ns) || '';
      
      newZones.set(ns, {
        key: boundsKey,
        centerX,
        centerZ,
        hullPoints
      });
    });
    
    setZones(newZones);
  });

  const stringToColor = (str: string) => {
    if (str === CLUSTER_SCOPED_LABEL) {
      return '#64748b';
    }
    
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h = Math.abs(hash) % 360;
    return `hsl(${h}, 70%, 40%)`;
  };

  return (
    <group>
      {Array.from(zones.entries()).map(([ns, data]) => (
        <NamespaceZone
          key={ns} 
          namespace={ns}
          positionsKey={data.key}
          centerX={data.centerX}
          centerZ={data.centerZ}
          hullPoints={data.hullPoints}
          color={stringToColor(ns)} 
        />
      ))}
    </group>
  );
};
