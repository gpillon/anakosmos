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

export const KIND_CONFIG = [
  { kind: 'Node', label: 'Nodes', icon: Server, color: '#1e293b' },
  { kind: 'Pod', label: 'Pods', icon: Box, color: '#60a5fa' },
  { kind: 'Service', label: 'Services', icon: Share2, color: '#34d399' },
  { kind: 'Deployment', label: 'Deployments', icon: Layers, color: '#a78bfa' },
  { kind: 'StatefulSet', label: 'StatefulSets', icon: Database, color: '#a78bfa' },
  { kind: 'DaemonSet', label: 'DaemonSets', icon: Copy, color: '#a78bfa' },
  { kind: 'ReplicaSet', label: 'ReplicaSets', icon: Copy, color: '#c4b5fd' },
  { kind: 'Ingress', label: 'Ingresses', icon: Globe, color: '#e879f9' },
  { kind: 'Route', label: 'Routes', icon: ArrowRightLeft, color: '#f472b6' },
  { kind: 'ConfigMap', label: 'ConfigMaps', icon: FileJson, color: '#fbbf24' },
  { kind: 'Secret', label: 'Secrets', icon: Lock, color: '#f87171' },
  { kind: 'PersistentVolumeClaim', label: 'PVCs', icon: Disc, color: '#f97316' },
  { kind: 'PersistentVolume', label: 'PVs', icon: HardDrive, color: '#ea580c' },
  { kind: 'StorageClass', label: 'StorageClasses', icon: Settings, color: '#c2410c' },
  { kind: 'NetworkAttachmentDefinition', label: 'Net Attach Defs', icon: Network, color: '#22d3ee' },
  { kind: 'NodeNetworkConfigurationPolicy', label: 'Node Net Configs', icon: Settings, color: '#94a3b8' },
];

export const ALL_KINDS = KIND_CONFIG.map(k => k.kind);
