import React, { useMemo, useState, useRef } from 'react';
import * as THREE from 'three';
import { Text } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';

/**
 * Computes the Convex Hull of a set of points (Jarvis March / Gift Wrapping).
 * Simplified 2D implementation for XZ plane.
 */
function getConvexHull(points: THREE.Vector3[]): THREE.Vector3[] {
  if (points.length < 3) return points; // Line or point

  // Find leftmost point
  let left = 0;
  for (let i = 1; i < points.length; i++) {
    if (points[i].x < points[left].x) {
      left = i;
    }
  }

  const hull: THREE.Vector3[] = [];
  let p = left;
  let q: number;

  do {
    hull.push(points[p]);
    q = (p + 1) % points.length;
    
    for (let i = 0; i < points.length; i++) {
      // Cross product to check turn direction
      const val = (points[i].z - points[p].z) * (points[q].x - points[p].x) -
                  (points[i].x - points[p].x) * (points[q].z - points[p].z);
      
      if (val < 0) { // Counter-clockwise turn
        q = i;
      }
    }
    p = q;
  } while (p !== left);

  return hull;
}

interface ZoneProps {
  namespace: string;
  positions: THREE.Vector3[];
  color: string;
}

const MIN_HULL_POINTS = 5;
const BASE_OFFSET = 2;
/**
 * Ensures we have at least MIN_HULL_POINTS for a visually pleasing zone
 * Adds synthetic points in a circle around the centroid if needed
 */
function ensureMinimumPoints(points: THREE.Vector3[], minPoints: number): THREE.Vector3[] {
  if (points.length >= minPoints) return points;
  
  // Calculate centroid and max distance from it
  const center = new THREE.Vector3();
  points.forEach(p => center.add(p));
  center.divideScalar(points.length || 1);
  
  // Find the maximum distance from center (minimum radius for synthetic points)
  let maxDist = 2; // Minimum radius
  points.forEach(p => {
    const dist = Math.sqrt(
      Math.pow(p.x - center.x, 2) + Math.pow(p.z - center.z, 2)
    );
    maxDist = Math.max(maxDist, dist);
  });
  
  // Add a bit of padding
  const radius = maxDist + 1.5;
  
  // Create synthetic points evenly distributed around the center
  const result = [...points];
  const syntheticCount = minPoints - points.length;
  
  for (let i = 0; i < syntheticCount; i++) {
    // Distribute evenly around the circle, offset by existing points
    const angle = (2 * Math.PI * i) / syntheticCount + Math.PI / 6;
    const syntheticPoint = new THREE.Vector3(
      center.x + Math.cos(angle) * radius,
      center.y,
      center.z + Math.sin(angle) * radius
    );
    result.push(syntheticPoint);
  }
  
  return result;
}

const NamespaceZone: React.FC<ZoneProps> = ({ namespace, positions, color }) => {
  // Compute dynamic geometry
  const { geometry, centroid } = useMemo(() => {
    if (positions.length === 0) return { geometry: null, centroid: new THREE.Vector3() };

    // 1. Calculate Centroid
    const center = new THREE.Vector3();
    positions.forEach(p => center.add(p));
    center.divideScalar(positions.length);

    // 2. Ensure minimum points for a nice shape
    const expandedPositions = ensureMinimumPoints(positions, MIN_HULL_POINTS);

    // 3. Convex Hull for boundary
    const hullPoints = getConvexHull(expandedPositions);
    
    // Create shape from hull points
    const shape = new THREE.Shape();
    if (hullPoints.length > 0) {
        // Map: 3D X -> 2D X, 3D Z -> 2D Y (Shape's Y is our Z)
        shape.moveTo(hullPoints[0].x, hullPoints[0].z); 
        for (let i = 1; i < hullPoints.length; i++) {
            shape.lineTo(hullPoints[i].x, hullPoints[i].z);
        }
        shape.closePath();
    }
    
    const shapeGeo = new THREE.ShapeGeometry(shape);
    
    return { geometry: shapeGeo, centroid: center };
  }, [positions]);

  if (!geometry) return null;



  return (
    <group>
        {/* Fill */}
        <mesh position={[0, -(BASE_OFFSET + .95), 0]} rotation={[Math.PI / 2, 0, 0]}>
            {/* 
               ShapeGeometry is on XY plane.
               Data is (x, z) mapped to (x, y).
               To put it on floor (XZ), we rotate X axis.
               
               If we use -PI/2 (Standard top-down): +Y becomes -Z.
               If our data Z was positive, it now points to -Z (Backwards).
               
               If we use +PI/2 (Bottom-up): +Y becomes +Z.
               This preserves the coordinate system direction.
             */}
            <primitive object={geometry} attach="geometry" />
            <meshBasicMaterial color={color} transparent opacity={0.2} side={THREE.DoubleSide} />
        </mesh>

        {/* Outline */}
        <lineSegments position={[0, -(BASE_OFFSET + .94), 0]} rotation={[Math.PI / 2, 0, 0]}>
             <primitive object={new THREE.WireframeGeometry(geometry)} attach="geometry" />
             <lineBasicMaterial color={color} transparent opacity={0.6} />
        </lineSegments>
        
        {/* Label */}
        <Text
            position={[centroid.x, -(BASE_OFFSET + 0.0), centroid.z]}
            rotation={[-Math.PI / 2, 0, 0]} 
            fontSize={1.5}
            color="white"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.1}
            outlineColor="black"
            renderOrder={0} // Ensure it doesn't render on top of UI
        >
            {namespace}
        </Text>
    </group>
  );
};

// Special key for cluster-scoped resources (no namespace)
const CLUSTER_SCOPED_LABEL = 'Cluster';

export const NamespaceProjections: React.FC<{ 
  resources: any;
  positionsRef: React.RefObject<Record<string, [number, number, number]>>;
}> = ({ resources, positionsRef }) => {
  const [groups, setGroups] = useState<Map<string, THREE.Vector3[]>>(new Map());
  const lastUpdateRef = useRef(0);

  useFrame((state) => {
    // Update every 0.2s (5 FPS) to save CPU
    if (state.clock.elapsedTime - lastUpdateRef.current > 0.2) {
      lastUpdateRef.current = state.clock.elapsedTime;

      const map = new Map<string, THREE.Vector3[]>();
      let hasData = false;
      
      Object.values(resources as Record<string, any>).forEach((res: any) => {
        const pos = positionsRef.current[res.id];
        if (!pos) return;
        
        // Use special label for cluster-scoped resources (no namespace)
        const nsKey = res.namespace || CLUSTER_SCOPED_LABEL;
        
        if (!map.has(nsKey)) {
          map.set(nsKey, []);
        }
        map.get(nsKey)!.push(new THREE.Vector3(pos[0], 0, pos[2]));
        hasData = true;
      });
      
      if (hasData) {
          setGroups(map);
      }
    }
  });

  const stringToColor = (str: string) => {
    // Special color for cluster-scoped zone
    if (str === CLUSTER_SCOPED_LABEL) {
      return '#64748b'; // Slate gray for cluster resources
    }
    
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h = Math.abs(hash) % 360;
    return `hsl(${h}, 70%, 40%)`; // Slightly darker for ground visibility
  };

  return (
    <group>
      {Array.from(groups.entries()).map(([ns, resourcePositions]) => (
        <NamespaceZone
          key={ns} 
          namespace={ns} 
          positions={resourcePositions} 
          color={stringToColor(ns)} 
        />
      ))}
    </group>
  );
};
