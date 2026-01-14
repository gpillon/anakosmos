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
  Play,
  Clock,
  Activity,
  Shield,
  GitBranch,
  Package,
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
  | 'tetra'      // tetrahedron (fallback)
  | 'job'        // flat box (Job)
  | 'cronJob'    // rotated flat box (CronJob)
  | 'hpa'        // thin ring (HPA)
  | 'argoApp'    // ArgoCD Application - compass-like shape
  | 'helmRelease'; // Helm Release - package/box shape

// Resource categories for legend organization
export type ResourceCategory = 'workload' | 'network' | 'config' | 'storage' | 'rbac' | 'gitops' | 'other';

export const CATEGORY_CONFIG: { id: ResourceCategory; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
  { id: 'workload', label: 'Workloads', icon: Layers },
  { id: 'network', label: 'Network', icon: Globe },
  { id: 'config', label: 'Config', icon: FileJson },
  { id: 'storage', label: 'Storage', icon: HardDrive },
  { id: 'rbac', label: 'RBAC', icon: Shield },
  { id: 'gitops', label: 'GitOps', icon: GitBranch },
  { id: 'other', label: 'Other', icon: Server },
];

export interface KindConfig {
  kind: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string;
  geometry: GeometryType;
  category: ResourceCategory;
}

export const KIND_CONFIG: KindConfig[] = [
  // Other / Infrastructure
  { kind: 'Node', label: 'Nodes', icon: Server, color: '#1e293b', geometry: 'node', category: 'other' },
  
  // Workloads
  { kind: 'Pod', label: 'Pods', icon: Box, color: '#60a5fa', geometry: 'pod', category: 'workload' },
  { kind: 'Deployment', label: 'Deployments', icon: Layers, color: '#a78bfa', geometry: 'deploy', category: 'workload' },
  { kind: 'StatefulSet', label: 'StatefulSets', icon: Database, color: '#8b5cf6', geometry: 'stateful', category: 'workload' },
  { kind: 'DaemonSet', label: 'DaemonSets', icon: Copy, color: '#7c3aed', geometry: 'daemon', category: 'workload' },
  { kind: 'ReplicaSet', label: 'ReplicaSets', icon: Copy, color: '#c4b5fd', geometry: 'replica', category: 'workload' },
  { kind: 'Job', label: 'Jobs', icon: Play, color: '#06b6d4', geometry: 'job', category: 'workload' },
  { kind: 'CronJob', label: 'CronJobs', icon: Clock, color: '#0891b2', geometry: 'cronJob', category: 'workload' },
  { kind: 'HorizontalPodAutoscaler', label: 'HPAs', icon: Activity, color: '#14b8a6', geometry: 'hpa', category: 'workload' },
  
  // Network
  { kind: 'Service', label: 'Services', icon: Share2, color: '#34d399', geometry: 'service', category: 'network' },
  { kind: 'Ingress', label: 'Ingresses', icon: Globe, color: '#e879f9', geometry: 'oct', category: 'network' },
  { kind: 'Route', label: 'Routes', icon: ArrowRightLeft, color: '#f472b6', geometry: 'diamond', category: 'network' },
  { kind: 'NetworkAttachmentDefinition', label: 'Net Attach Defs', icon: Network, color: '#22d3ee', geometry: 'torusKnot', category: 'network' },
  { kind: 'NodeNetworkConfigurationPolicy', label: 'Node Net Configs', icon: Settings, color: '#94a3b8', geometry: 'hexPrism', category: 'network' },
  
  // Config
  { kind: 'ConfigMap', label: 'ConfigMaps', icon: FileJson, color: '#6f007c', geometry: 'smallBox', category: 'config' },
  { kind: 'Secret', label: 'Secrets', icon: Lock, color: '#b8a300', geometry: 'pyramid', category: 'config' },
  
  // Storage
  { kind: 'PersistentVolumeClaim', label: 'PVCs', icon: Disc, color: '#f97316', geometry: 'puck', category: 'storage' },
  { kind: 'PersistentVolume', label: 'PVs', icon: HardDrive, color: '#ea580c', geometry: 'barrel', category: 'storage' },
  { kind: 'StorageClass', label: 'StorageClasses', icon: Settings, color: '#c2410c', geometry: 'slab', category: 'storage' },
  
  // RBAC (to be filled)
  // { kind: 'ServiceAccount', label: 'Service Accounts', icon: User, color: '#...', geometry: '...', category: 'rbac' },
  // { kind: 'Role', label: 'Roles', icon: Shield, color: '#...', geometry: '...', category: 'rbac' },
  // { kind: 'ClusterRole', label: 'ClusterRoles', icon: Shield, color: '#...', geometry: '...', category: 'rbac' },
  // { kind: 'RoleBinding', label: 'RoleBindings', icon: Link, color: '#...', geometry: '...', category: 'rbac' },
  // { kind: 'ClusterRoleBinding', label: 'ClusterRoleBindings', icon: Link, color: '#...', geometry: '...', category: 'rbac' },
  
  // GitOps
  { kind: 'Application', label: 'Argo Applications', icon: GitBranch, color: '#ef6c00', geometry: 'argoApp', category: 'gitops' },
  { kind: 'HelmRelease', label: 'Helm Releases', icon: Package, color: '#0ea5e9', geometry: 'helmRelease', category: 'gitops' },
];

export const ALL_KINDS = KIND_CONFIG.map(k => k.kind);

// Helper maps for quick lookups
export const KIND_COLOR_MAP: Record<string, string> = Object.fromEntries(
  KIND_CONFIG.map(k => [k.kind, k.color])
);

export const KIND_GEOMETRY_MAP: Record<string, GeometryType> = Object.fromEntries(
  KIND_CONFIG.map(k => [k.kind, k.geometry])
);

export const KIND_CATEGORY_MAP: Record<string, ResourceCategory> = Object.fromEntries(
  KIND_CONFIG.map(k => [k.kind, k.category])
);

// Group kinds by category
export const KINDS_BY_CATEGORY: Record<ResourceCategory, KindConfig[]> = KIND_CONFIG.reduce((acc, kind) => {
  if (!acc[kind.category]) acc[kind.category] = [];
  acc[kind.category].push(kind);
  return acc;
}, {} as Record<ResourceCategory, KindConfig[]>);

// Default color for unknown kinds
export const DEFAULT_COLOR = '#9ca3af';
export const DEFAULT_GEOMETRY: GeometryType = 'tetra';
