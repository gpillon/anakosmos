export interface ClusterResource {
  id: string;
  name: string;
  kind: string;
  namespace: string;
  status: string;
  labels: Record<string, string>;
  ownerRefs: string[]; // IDs of owners
  creationTimestamp: string;
  // Dynamic metrics or other props
  cpu?: string;
  memory?: string;
}

export interface ClusterLink {
  source: string; // ID
  target: string; // ID
  type: 'owner' | 'network' | 'config' | 'storage';
}

