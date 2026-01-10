import * as THREE from 'three';

// Geometries
export const nodeGeo = new THREE.CylinderGeometry(2.5, 2.5, 0.4, 8);
export const serviceGeo = new THREE.IcosahedronGeometry(0.5);
export const podGeo = new THREE.CapsuleGeometry(0.25, 0.5, 4, 16);
export const deployGeo = new THREE.DodecahedronGeometry(0.6);
export const octGeo = new THREE.OctahedronGeometry(0.5); // Ingress/Route
export const torusGeo = new THREE.TorusKnotGeometry(0.3, 0.1, 64, 8, 2, 3); // NAD
export const boxGeo = new THREE.BoxGeometry(0.8, 0.2, 0.8); // NNCP
export const smallBoxGeo = new THREE.BoxGeometry(0.4, 0.4, 0.4); // Secret/ConfigMap
export const puckGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.2, 32); // PVC
export const barrelGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.8, 32); // PV
export const slabGeo = new THREE.BoxGeometry(1, 0.2, 1); // StorageClass
export const tetraGeo = new THREE.TetrahedronGeometry(0.5); // Fallback

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
