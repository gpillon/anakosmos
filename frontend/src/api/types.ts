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
  // Pod-specific
  nodeName?: string; // For Pods: which node they're scheduled on
  // Dynamic metrics or other props
  cpu?: string;
  memory?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  raw?: any; // The raw Kubernetes object
  
  // Helm management info
  helmRelease?: HelmReleaseInfo;
  
  // ArgoCD management info  
  argoApp?: ArgoAppInfo;
}

/**
 * Information about Helm management for a resource
 */
export interface HelmReleaseInfo {
  releaseName: string;
  releaseNamespace: string;
  chartName?: string;
  chartVersion?: string;
  appVersion?: string;
  revision?: number;
}

/**
 * Helm release history entry (from helm history command)
 */
export interface HelmHistoryEntry {
  version?: number;
  info?: {
    status?: string;
    last_deployed?: string;
    first_deployed?: string;
    description?: string;
  };
  chart?: {
    metadata?: {
      version?: string;
      appVersion?: string;
    };
  };
}

/**
 * Information about ArgoCD management for a resource
 */
export interface ArgoAppInfo {
  appName: string;
  appNamespace: string;
  project?: string;
}

/**
 * ArgoCD Application status
 */
export interface ArgoApplicationStatus {
  sync: {
    status: 'Synced' | 'OutOfSync' | 'Unknown';
    revision?: string;
    comparedTo?: {
      source: ArgoApplicationSource;
      destination: ArgoApplicationDestination;
    };
  };
  health: {
    status: 'Healthy' | 'Progressing' | 'Degraded' | 'Suspended' | 'Missing' | 'Unknown';
    message?: string;
  };
  operationState?: {
    phase: 'Running' | 'Succeeded' | 'Failed' | 'Error' | 'Terminating';
    message?: string;
    syncResult?: {
      revision: string;
      resources?: ArgoResourceStatus[];
    };
    startedAt?: string;
    finishedAt?: string;
  };
  resources?: ArgoResourceStatus[];
  reconciledAt?: string;
  sourceType?: string;
  summary?: {
    images?: string[];
    externalURLs?: string[];
  };
}

/**
 * ArgoCD Application source configuration
 */
export interface ArgoApplicationSource {
  repoURL: string;
  path?: string;
  targetRevision?: string;
  chart?: string;
  helm?: {
    releaseName?: string;
    valueFiles?: string[];
    values?: string;
    parameters?: Array<{
      name: string;
      value: string;
      forceString?: boolean;
    }>;
  };
  kustomize?: {
    namePrefix?: string;
    nameSuffix?: string;
    images?: string[];
  };
}

/**
 * ArgoCD Application destination
 */
export interface ArgoApplicationDestination {
  server?: string;
  namespace?: string;
  name?: string;
}

/**
 * ArgoCD managed resource status
 */
export interface ArgoResourceStatus {
  group?: string;
  version: string;
  kind: string;
  namespace?: string;
  name: string;
  status?: 'Synced' | 'OutOfSync' | 'Unknown';
  health?: {
    status: string;
    message?: string;
  };
  requiresPruning?: boolean;
}

/**
 * Helm Release from the cluster (via Helm secrets)
 */
export interface HelmRelease {
  name: string;
  namespace: string;
  revision: number;
  status: 'deployed' | 'failed' | 'pending-install' | 'pending-upgrade' | 'pending-rollback' | 'uninstalling' | 'superseded' | 'unknown';
  chart: string;
  chartVersion: string;
  appVersion?: string;
  updated: string;
  values?: Record<string, unknown>;
}

export interface ClusterLink {
  source: string; // ID
  target: string; // ID
  type: 'owner' | 'network' | 'config' | 'storage';
}

/**
 * Lightweight resource from /api/cluster/init endpoint
 * Contains only essential fields for display + link calculation
 */
export interface LightResource {
  id: string;
  name: string;
  namespace: string;
  kind: string;
  status: string;
  health?: 'ok' | 'warning' | 'error';
  labels: Record<string, string>;
  ownerRefs: string[];
  creationTimestamp: string;
  // Extra fields for link calculation (not needed in UI state)
  nodeName?: string;
  selector?: Record<string, string>;
  scaleTargetRef?: { kind: string; name: string };
  storageClassName?: string;
  ingressBackends?: { serviceName: string }[];
  volumes?: { type: string; name: string }[];
  envRefs?: { type: string; name: string }[];
  helmRelease?: HelmReleaseInfo;
}

/**
 * Response from /api/cluster/init endpoint
 */
export interface ClusterInitResponse {
  resources: LightResource[];
  links: ClusterLink[];
}
