export interface ClusterResource {
  id: string;
  name: string;
  kind: string;
  namespace: string;
  status: string;
  health?: 'ok' | 'warning' | 'error';
  labels: Record<string, string>;
  ownerRefs: string[]; // IDs of owners
  creationTimestamp: string;
  // Dynamic metrics or other props
  cpu?: string;
  memory?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  raw?: any; // The raw Kubernetes object
}

export interface ClusterLink {
  source: string; // ID
  target: string; // ID
  type: 'owner' | 'network' | 'config' | 'storage';
}

