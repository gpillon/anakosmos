import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { forwardRef, useImperativeHandle, useRef, useEffect } from 'react';

interface AnimatedInstancedMaterialProps {
  metalness?: number;
  roughness?: number;
  clearcoat?: number;
  transparent?: boolean;
  blinkSpeed?: number;
  blinkIntensity?: number;
}

export const AnimatedInstancedMaterial = forwardRef<
  THREE.MeshPhysicalMaterial,
  AnimatedInstancedMaterialProps
>(({ 
  metalness = 0.5, 
  roughness = 0.3,
  clearcoat = 0.8, 
  transparent = true,
  blinkSpeed = 8.0,
  blinkIntensity = 0.15
}, ref) => {
  const materialRef = useRef<THREE.MeshPhysicalMaterial>(null);
  const uniformsRef = useRef({
    uTime: { value: 0 },
    uBlinkSpeed: { value: blinkSpeed },
    uBlinkIntensity: { value: blinkIntensity },
  });
  
  useImperativeHandle(ref, () => materialRef.current!);
  
  // Inject custom shader code into MeshPhysicalMaterial using onBeforeCompile
  useEffect(() => {
    if (!materialRef.current) return;
    
    materialRef.current.onBeforeCompile = (shader) => {
      // Add custom uniforms
      shader.uniforms.uTime = uniformsRef.current.uTime;
      shader.uniforms.uBlinkSpeed = uniformsRef.current.uBlinkSpeed;
      shader.uniforms.uBlinkIntensity = uniformsRef.current.uBlinkIntensity;
      
      // Add custom attributes
      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        `
        #include <common>
        attribute float isUnhealthy;
        attribute vec3 instanceColor;
        uniform float uTime;
        uniform float uBlinkSpeed;
        uniform float uBlinkIntensity;
        varying float vBlinkFactor;
        `
      );
      
      // Inject blinking scale animation in vertex shader
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
        #include <begin_vertex>
        
        // Calculate blinking factor (GPU-accelerated)
        vBlinkFactor = 0.0;
        if (isUnhealthy > 0.5) {
          vBlinkFactor = sin(uTime * uBlinkSpeed) * uBlinkIntensity;
          // Apply scale animation
          transformed *= (1.0 + vBlinkFactor);
        }
        `
      );
      
      // Override color with instanceColor
      shader.vertexShader = shader.vertexShader.replace(
        '#include <color_vertex>',
        `
        #include <color_vertex>
        #if defined( USE_COLOR_ALPHA )
          vColor = vec4(instanceColor, 1.0);
        #elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR )
          vColor = vec3(instanceColor);
        #endif
        `
      );
      
      // Pass vBlinkFactor to fragment shader for intensity modulation
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <common>',
        `
        #include <common>
        varying float vBlinkFactor;
        `
      );
      
      // Enhance color intensity when blinking
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <color_fragment>',
        `
        #include <color_fragment>
        if (vBlinkFactor > 0.01) {
          diffuseColor.rgb = mix(diffuseColor.rgb * 0.9, diffuseColor.rgb * 1.1, 0.5 + vBlinkFactor * 0.5);
        }
        `
      );
    };
    
    materialRef.current.needsUpdate = true;
  }, [blinkSpeed, blinkIntensity]);
  
  // Update time uniform once per frame (much more efficient than per-instance)
  useFrame((state) => {
    uniformsRef.current.uTime.value = state.clock.getElapsedTime();
  });
  
  return (
    <meshPhysicalMaterial
      ref={materialRef}
      metalness={metalness}
      roughness={roughness}
      clearcoat={clearcoat}
      transparent={transparent}
      flatShading={true}
      vertexColors={true}
    />
  );
});

AnimatedInstancedMaterial.displayName = 'AnimatedInstancedMaterial';
