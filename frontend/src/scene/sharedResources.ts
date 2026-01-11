import * as THREE from 'three';

// Geometries - Each resource type has a UNIQUE shape
export const nodeGeo = new THREE.CylinderGeometry(2.5, 2.5, 0.4, 8);           // Node: flat octagonal platform
export const podGeo = new THREE.CapsuleGeometry(0.25, 0.5, 4, 16);              // Pod: capsule (pill shape)
export const serviceGeo = new THREE.IcosahedronGeometry(0.5);                   // Service: icosahedron (20 faces)
export const deployGeo = new THREE.DodecahedronGeometry(0.6);                   // Deployment: dodecahedron (12 faces)
export const statefulGeo = new THREE.SphereGeometry(0.5, 16, 12);               // StatefulSet: sphere
export const daemonGeo = new THREE.ConeGeometry(0.4, 0.8, 6);                   // DaemonSet: hexagonal cone
export const replicaGeo = new THREE.OctahedronGeometry(0.5);                    // ReplicaSet: octahedron (8 faces)
export const octGeo = new THREE.TorusGeometry(0.35, 0.12, 8, 16);               // Ingress: torus (ring)
export const diamondGeo = new THREE.OctahedronGeometry(0.4, 0);                 // Route: diamond (stretched octahedron)
export const smallBoxGeo = new THREE.BoxGeometry(0.4, 0.4, 0.4);                // ConfigMap: cube
export const pyramidGeo = new THREE.ConeGeometry(0.35, 0.6, 4);                 // Secret: pyramid (4-sided cone)
export const puckGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.2, 32);           // PVC: flat puck
export const barrelGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.8, 32);         // PV: tall barrel
export const slabGeo = new THREE.BoxGeometry(1, 0.15, 1);                       // StorageClass: flat slab
export const torusKnotGeo = new THREE.TorusKnotGeometry(0.3, 0.1, 64, 8, 2, 3); // NAD: torus knot
export const hexPrismGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.5, 6);        // NNCP: hexagonal prism
export const tetraGeo = new THREE.TetrahedronGeometry(0.5);                     // Fallback: tetrahedron

// Scale the diamond vertically for Route
diamondGeo.scale(1, 1.5, 1);

// Legacy aliases for backward compatibility
export const torusGeo = torusKnotGeo;
export const boxGeo = hexPrismGeo;

// Materials (Base shared materials, can be cloned or used with instanceColor)
export const nodeMat = new THREE.MeshPhysicalMaterial({
  color: '#1e293b',
  metalness: 0.2,
  roughness: 0.2,
  clearcoat: 0.5,
  transparent: true,
  flatShading: true
});

export const resourceMat = new THREE.MeshPhysicalMaterial({
  metalness: 0.5,
  roughness: 0.3,
  clearcoat: 0.8,
  transparent: true,
  flatShading: true
});
