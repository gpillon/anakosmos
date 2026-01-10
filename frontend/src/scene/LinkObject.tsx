import React, { useLayoutEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

interface LinkObjectProps {
  start: [number, number, number];
  end: [number, number, number];
  type: 'owner' | 'network' | 'config' | 'storage';
  dimmed?: boolean;
}

const TrafficParticle: React.FC<{ start: THREE.Vector3; end: THREE.Vector3; dimmed: boolean }> = ({ start, end, dimmed }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const [offset] = useState(() => Math.random());
  const speed = 1.5;

  useFrame((state) => {
    if (!meshRef.current) return;
    const time = state.clock.getElapsedTime();
    const t = (time * speed + offset) % 1;
    meshRef.current.position.lerpVectors(start, end, t);
    
    // Scale effect
    const scale = Math.sin(t * Math.PI) * 1.5;
    meshRef.current.scale.setScalar(scale > 0 ? scale : 0);
  });

  if (dimmed) return null;

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[0.08, 8, 8]} />
      <meshBasicMaterial color="#60a5fa" toneMapped={false} /> {/* toneMapped false for Bloom */}
    </mesh>
  );
};

export const LinkObject: React.FC<LinkObjectProps> = ({ start, end, type, dimmed = false }) => {
  const ref = useRef<any>(null);
  const startVec = new THREE.Vector3(...start);
  const endVec = new THREE.Vector3(...end);

  useLayoutEffect(() => {
    if (ref.current) {
      const geometry = ref.current.geometry;
      geometry.setFromPoints([startVec, endVec]);
    }
  }, [start, end]);

  const color = type === 'owner' ? '#94a3b8' // Slate 400 (Lighter than 600)
    : type === 'network' ? '#3b82f6' 
    : type === 'config' ? '#a855f7' // Purple 500
    : '#d97706'; // Storage (Orange)
    
  const opacity = dimmed ? 0.05 : (type === 'owner' ? 0.3 : 0.4);
  const isNetwork = type === 'network';

  return (
    <group>
      <line ref={ref}>
        <bufferGeometry />
        <lineBasicMaterial color={color} opacity={opacity} transparent linewidth={1} />
      </line>
      
      {isNetwork && !dimmed && (
        <TrafficParticle start={startVec} end={endVec} dimmed={dimmed} />
      )}
    </group>
  );
};
