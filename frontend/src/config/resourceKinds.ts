import { 
  Server, 
  Box, 
  Share2, 
  Layers, 
  Copy, 
  FileJson, 
  Lock, 
  Globe, 
  ArrowRightLeft, 
  Network, 
  Settings, 
  HardDrive, 
  Database, 
  Disc,
} from 'lucide-react';

// Geometry types available in sharedResources.ts - ALL UNIQUE
export type GeometryType = 
  | 'node'       // flat octagonal platform (Node)
  | 'pod'        // capsule/pill (Pod)
  | 'service'    // icosahedron 20-faces (Service)
  | 'deploy'     // dodecahedron 12-faces (Deployment)
  | 'stateful'   // sphere (StatefulSet)
  | 'daemon'     // hexagonal cone (DaemonSet)
  | 'replica'    // torus ring (ReplicaSet)
  | 'oct'        // octahedron 8-faces (Ingress)
  | 'diamond'    // stretched diamond (Route)
  | 'smallBox'   // cube (ConfigMap)
  | 'pyramid'    // 4-sided pyramid (Secret)
  | 'puck'       // flat cylinder (PVC)
  | 'barrel'     // tall cylinder (PV)
  | 'slab'       // flat slab (StorageClass)
  | 'torusKnot'  // torus knot (NAD)
  | 'hexPrism'   // hexagonal prism (NNCP)
  | 'tetra';     // tetrahedron (fallback)

export interface KindConfig {
  kind: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string;
  geometry: GeometryType;
}

export const KIND_CONFIG: KindConfig[] = [
  { kind: 'Node', label: 'Nodes', icon: Server, color: '#1e293b', geometry: 'node' },
  { kind: 'Pod', label: 'Pods', icon: Box, color: '#60a5fa', geometry: 'pod' },
  { kind: 'Service', label: 'Services', icon: Share2, color: '#34d399', geometry: 'service' },
  { kind: 'Deployment', label: 'Deployments', icon: Layers, color: '#a78bfa', geometry: 'deploy' },
  { kind: 'StatefulSet', label: 'StatefulSets', icon: Database, color: '#8b5cf6', geometry: 'stateful' },
  { kind: 'DaemonSet', label: 'DaemonSets', icon: Copy, color: '#7c3aed', geometry: 'daemon' },
  { kind: 'ReplicaSet', label: 'ReplicaSets', icon: Copy, color: '#c4b5fd', geometry: 'replica' },
  { kind: 'Ingress', label: 'Ingresses', icon: Globe, color: '#e879f9', geometry: 'oct' },
  { kind: 'Route', label: 'Routes', icon: ArrowRightLeft, color: '#f472b6', geometry: 'diamond' },
  { kind: 'ConfigMap', label: 'ConfigMaps', icon: FileJson, color: '#fbbf24', geometry: 'smallBox' },
  { kind: 'Secret', label: 'Secrets', icon: Lock, color: '#f87171', geometry: 'pyramid' },
  { kind: 'PersistentVolumeClaim', label: 'PVCs', icon: Disc, color: '#f97316', geometry: 'puck' },
  { kind: 'PersistentVolume', label: 'PVs', icon: HardDrive, color: '#ea580c', geometry: 'barrel' },
  { kind: 'StorageClass', label: 'StorageClasses', icon: Settings, color: '#c2410c', geometry: 'slab' },
  { kind: 'NetworkAttachmentDefinition', label: 'Net Attach Defs', icon: Network, color: '#22d3ee', geometry: 'torusKnot' },
  { kind: 'NodeNetworkConfigurationPolicy', label: 'Node Net Configs', icon: Settings, color: '#94a3b8', geometry: 'hexPrism' },
];

export const ALL_KINDS = KIND_CONFIG.map(k => k.kind);

// Helper maps for quick lookups
export const KIND_COLOR_MAP: Record<string, string> = Object.fromEntries(
  KIND_CONFIG.map(k => [k.kind, k.color])
);

export const KIND_GEOMETRY_MAP: Record<string, GeometryType> = Object.fromEntries(
  KIND_CONFIG.map(k => [k.kind, k.geometry])
);

// Default color for unknown kinds
export const DEFAULT_COLOR = '#9ca3af';
export const DEFAULT_GEOMETRY: GeometryType = 'tetra';
