import React, { useMemo, useRef, useLayoutEffect } from 'react';
import { useFrame, createPortal, useThree } from '@react-three/fiber';
import { useFBO, Text } from '@react-three/drei';
import * as THREE from 'three';

// Create a soft circle texture for the "metaball" sprites
const softCircleTexture = (() => {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.Texture();
  
  // Clear
  ctx.clearRect(0, 0, 64, 64);
  
  // Draw gradient
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
  gradient.addColorStop(0.4, 'rgba(255, 255, 255, 0.5)'); 
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  return tex;
})();

const MetaballShader = {
  uniforms: {
    tDiffuse: { value: null },
    uColor: { value: new THREE.Color() },
    uThreshold: { value: 0.4 }, 
    uBorderWidth: { value: 0.05 },
    uOpacity: { value: 0.5 }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform vec3 uColor;
    uniform float uThreshold;
    uniform float uBorderWidth;
    uniform float uOpacity;
    varying vec2 vUv;
    
    void main() {
      // Sample the accumulated field
      vec4 tex = texture2D(tDiffuse, vUv);
      
      // We use the Red channel as intensity (since texture is white)
      // With additive blending, overlaps increase this value > 1.0
      float intensity = tex.r;
      
      // Thresholding
      float alpha = smoothstep(uThreshold - 0.05, uThreshold + 0.05, intensity);
      
      if (alpha < 0.01) discard;
      
      // Border
      // We want a highlight at the edge
      float edge = smoothstep(uThreshold, uThreshold + uBorderWidth, intensity);
      float border = 1.0 - edge;
      
      vec3 finalColor = mix(uColor, uColor * 0.4, border); // Darker border
      
      gl_FragColor = vec4(finalColor, uOpacity * alpha); 
    }
  `
};

interface Props {
  namespace: string;
  positions: THREE.Vector3[];
  color: string;
}

export const NamespaceMetaballs: React.FC<Props> = ({ namespace, positions, color }) => {
  const { gl } = useThree();
  const instancedMeshRef = useRef<THREE.InstancedMesh>(null);
  
  // Off-screen scene
  const offScene = useMemo(() => {
    const s = new THREE.Scene();
    return s;
  }, []);
  
  // FBO
  const fbo = useFBO(256, 256, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat,
    type: THREE.FloatType, // Float texture for additive blending > 1.0
    stencilBuffer: false,
    depthBuffer: false,
  });

  // Calculate dynamic bounds
  const bounds = useMemo(() => {
    if (positions.length === 0) return { center: new THREE.Vector3(), width: 1, height: 1 };
    
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    
    positions.forEach(p => {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.z < minZ) minZ = p.z;
      if (p.z > maxZ) maxZ = p.z;
    });
    
    const padding = 6; // Padding for the blob radius
    minX -= padding; maxX += padding;
    minZ -= padding; maxZ += padding;
    
    const width = maxX - minX;
    const height = maxZ - minZ;
    const centerX = minX + width / 2;
    const centerZ = minZ + height / 2;
    
    return { 
        center: new THREE.Vector3(centerX, 0, centerZ), 
        width: Math.max(width, 1), 
        height: Math.max(height, 1)
    };
  }, [positions]);

  // Update sprites in off-screen scene
  const dummy = useMemo(() => new THREE.Object3D(), []);
  
  useLayoutEffect(() => {
    if (!instancedMeshRef.current) return;
    
    // Position sprites relative to bounds center? 
    // No, let's keep them in world coords and move the camera.
    // That's easier.
    
    positions.forEach((p, i) => {
      dummy.position.set(p.x, 0, p.z);
      dummy.rotation.set(-Math.PI / 2, 0, 0); // Flat on XZ
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      instancedMeshRef.current!.setMatrixAt(i, dummy.matrix);
    });
    
    instancedMeshRef.current.instanceMatrix.needsUpdate = true;
  }, [positions, bounds]); // Update when positions change

  // Off-screen camera setup
  const cameraRef = useRef<THREE.OrthographicCamera>(null);
  
  useFrame(() => {
    if (!cameraRef.current) return;
    
    const cam = cameraRef.current;
    
    // Position camera above the cluster section
    cam.position.set(bounds.center.x, 10, bounds.center.z);
    cam.lookAt(bounds.center.x, 0, bounds.center.z);
    
    // Match frustum to bounds
    cam.left = -bounds.width / 2;
    cam.right = bounds.width / 2;
    cam.top = bounds.height / 2;
    cam.bottom = -bounds.height / 2;
    cam.updateProjectionMatrix();
    
    // Render to FBO
    const oldTarget = gl.getRenderTarget();
    gl.setRenderTarget(fbo);
    gl.clear();
    gl.render(offScene, cam);
    gl.setRenderTarget(oldTarget);
  });

  if (positions.length === 0) return null;

  return (
    <>
      {createPortal(
        <instancedMesh 
          ref={instancedMeshRef} 
          args={[undefined, undefined, positions.length]}
        >
          <planeGeometry args={[4, 4]} /> {/* Blob footprint size */}
          <meshBasicMaterial 
            map={softCircleTexture} 
            transparent 
            opacity={0.5} // Base opacity for additive
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </instancedMesh>,
        offScene
      )}
      
      <group position={[bounds.center.x, -4.95, bounds.center.z]} rotation={[-Math.PI/2, 0, 0]}>
        <mesh>
          <planeGeometry args={[bounds.width, bounds.height]} />
          <shaderMaterial 
            args={[MetaballShader]} 
            uniforms-tDiffuse-value={fbo.texture}
            uniforms-uColor-value={new THREE.Color(color)}
            transparent={true}
            depthWrite={false}
          />
        </mesh>
        
        {/* Namespace Label */}
        <Text
          position={[0, 0, 0.1]} // Slightly above plane
          rotation={[0, 0, 0]} // Text is flat on plane? No, text should face camera?
          // If we want it on the ground:
          // Parent is rotated -PI/2 (XZ plane).
          // So Text (0,0,0) is flat on ground.
          // To make it readable from top, it's fine.
          // To make it billboard? 
          // "anchored to the blob". Flat on ground is good for map-like view.
          fontSize={1.5}
          color="white"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.1}
          outlineColor="black"
        >
          {namespace}
        </Text>
      </group>
    </>
  );
};
