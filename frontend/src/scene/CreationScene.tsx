import React, { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { Environment, Html, OrbitControls, Stars } from '@react-three/drei';
import * as THREE from 'three';
import { useResourceCreationStore } from '../store/useResourceCreationStore';
import { buildAppResources } from '../ui/resourceCreation/appYaml';

const KIND_COLORS: Record<string, string> = {
  Deployment: '#60a5fa',
  Service: '#34d399',
  Ingress: '#fbbf24',
  ConfigMap: '#a78bfa',
  Secret: '#f87171',
  PersistentVolumeClaim: '#38bdf8',
};

const nodeGeometry = new THREE.IcosahedronGeometry(1.1, 0);

export const CreationScene: React.FC = () => {
  const draft = useResourceCreationStore((state) => state.appDraft);
  const resources = useMemo(() => buildAppResources(draft), [draft]);
  const positions = useMemo(() => {
    const radius = 10;
    return resources.map((_, index) => {
      const angle = (index / Math.max(resources.length, 1)) * Math.PI * 2;
      return [Math.cos(angle) * radius, 1.5, Math.sin(angle) * radius] as [number, number, number];
    });
  }, [resources]);

  return (
    <Canvas camera={{ position: [0, 15, 25], fov: 45 }}>
      <color attach="background" args={['#020617']} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 20, 10]} intensity={1.2} />
      <Stars radius={80} depth={40} count={2500} factor={2} />
      <Environment preset="city" />
      <OrbitControls enablePan enableZoom enableRotate />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <circleGeometry args={[18, 64]} />
        <meshStandardMaterial color="#0f172a" metalness={0.2} roughness={0.8} />
      </mesh>

      {resources.map((res, index) => {
        const color = KIND_COLORS[res.kind] || '#94a3b8';
        return (
          <group key={`${res.kind}-${res.metadata?.name || index}`} position={positions[index]}>
            <mesh geometry={nodeGeometry}>
              <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.25} />
            </mesh>
            <Html center style={{ pointerEvents: 'none' }} zIndexRange={[30, 0]}>
              <div className="px-2 py-1 bg-slate-900/80 text-white text-xs rounded border border-slate-600 shadow-xl whitespace-nowrap">
                <div className="font-semibold">{res.metadata?.name || res.kind}</div>
                <div className="text-[10px] text-slate-400">{res.kind}</div>
              </div>
            </Html>
          </group>
        );
      })}
    </Canvas>
  );
};
