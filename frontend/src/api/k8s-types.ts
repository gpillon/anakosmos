/**
 * Re-export Kubernetes types from @kubernetes/client-node
 * 
 * This module provides type-safe access to official Kubernetes API types.
 * Using these types ensures our internal representations match the K8s API spec.
 */

// Core types
export type {
  V1ObjectMeta,
  V1LabelSelector,
  V1LabelSelectorRequirement,
  V1OwnerReference,
  V1ManagedFieldsEntry,
  V1Condition,
} from '@kubernetes/client-node';

// Import for local use in interfaces
import type { V1ObjectMeta as V1ObjectMetaType } from '@kubernetes/client-node';

// Type alias for local use
type V1ObjectMetaLocal = V1ObjectMetaType;

// Pod types
export type {
  V1Pod,
  V1PodSpec,
  V1PodStatus,
  V1PodCondition,
  V1PodTemplateSpec,
  V1Container,
  V1ContainerStatus,
  V1ContainerPort,
  V1EnvVar,
  V1EnvVarSource,
  V1EnvFromSource,
  V1VolumeMount,
  V1Volume,
  V1Probe,
  V1HTTPGetAction,
  V1TCPSocketAction,
  V1ExecAction,
  V1GRPCAction,
  V1ResourceRequirements,
  V1SecurityContext,
  V1PodSecurityContext,
  V1Capabilities,
  V1Lifecycle,
  V1LifecycleHandler,
} from '@kubernetes/client-node';

// Deployment types
export type {
  V1Deployment,
  V1DeploymentSpec,
  V1DeploymentStatus,
  V1DeploymentCondition,
  V1DeploymentStrategy,
  V1RollingUpdateDeployment,
} from '@kubernetes/client-node';

// ReplicaSet types
export type {
  V1ReplicaSet,
  V1ReplicaSetSpec,
  V1ReplicaSetStatus,
  V1ReplicaSetCondition,
} from '@kubernetes/client-node';

// StatefulSet types
export type {
  V1StatefulSet,
  V1StatefulSetSpec,
  V1StatefulSetStatus,
} from '@kubernetes/client-node';

// DaemonSet types
export type {
  V1DaemonSet,
  V1DaemonSetSpec,
  V1DaemonSetStatus,
} from '@kubernetes/client-node';

// Service types
export type {
  V1Service,
  V1ServiceSpec,
  V1ServiceStatus,
  V1ServicePort,
} from '@kubernetes/client-node';

// ConfigMap and Secret
export type {
  V1ConfigMap,
  V1Secret,
} from '@kubernetes/client-node';

// Volumes
export type {
  V1PersistentVolumeClaim,
  V1PersistentVolumeClaimSpec,
  V1PersistentVolumeClaimStatus,
  V1PersistentVolumeClaimCondition,
  V1PersistentVolume,
  V1PersistentVolumeSpec,
  V1PersistentVolumeStatus,
  V1EmptyDirVolumeSource,
  V1ConfigMapVolumeSource,
  V1SecretVolumeSource,
  V1HostPathVolumeSource,
  V1PersistentVolumeClaimVolumeSource,
} from '@kubernetes/client-node';

// Storage
export type {
  V1StorageClass,
  V1VolumeNodeAffinity,
} from '@kubernetes/client-node';

// Node types
export type {
  V1Node,
  V1NodeSpec,
  V1NodeStatus,
  V1NodeCondition,
  V1Taint,
  V1Toleration,
} from '@kubernetes/client-node';

// Scheduling
export type {
  V1Affinity,
  V1NodeAffinity,
  V1PodAffinity,
  V1PodAntiAffinity,
  V1NodeSelector,
  V1NodeSelectorTerm,
  V1NodeSelectorRequirement,
  V1PodAffinityTerm,
  V1WeightedPodAffinityTerm,
  V1PreferredSchedulingTerm,
} from '@kubernetes/client-node';

// Ingress
export type {
  V1Ingress,
  V1IngressSpec,
  V1IngressStatus,
  V1IngressRule,
  V1HTTPIngressPath,
  V1HTTPIngressRuleValue,
  V1IngressBackend,
  V1IngressServiceBackend,
  V1ServiceBackendPort,
  V1IngressTLS,
  V1IngressLoadBalancerStatus,
  V1IngressLoadBalancerIngress,
  V1IngressPortStatus,
} from '@kubernetes/client-node';

// Job/CronJob
export type {
  V1Job,
  V1JobSpec,
  V1JobStatus,
  V1JobCondition,
  V1CronJob,
  V1CronJobSpec,
  V1CronJobStatus,
  V1JobTemplateSpec,
} from '@kubernetes/client-node';

// HorizontalPodAutoscaler
export type {
  V2HorizontalPodAutoscaler,
  V2HorizontalPodAutoscalerSpec,
  V2HorizontalPodAutoscalerStatus,
  V2HorizontalPodAutoscalerCondition,
  V2CrossVersionObjectReference,
  V2MetricSpec,
  V2MetricStatus,
  V2ResourceMetricSource,
  V2ResourceMetricStatus,
  V2ContainerResourceMetricSource,
  V2ContainerResourceMetricStatus,
  V2PodsMetricSource,
  V2PodsMetricStatus,
  V2ObjectMetricSource,
  V2ObjectMetricStatus,
  V2ExternalMetricSource,
  V2ExternalMetricStatus,
  V2MetricTarget,
  V2MetricValueStatus,
  V2HPAScalingRules,
  V2HPAScalingPolicy,
  V2HorizontalPodAutoscalerBehavior,
} from '@kubernetes/client-node';

// Events
export type {
  CoreV1Event,
  V1EventSource,
} from '@kubernetes/client-node';

// Also export KubernetesObject for generic handling
export type { KubernetesObject, KubernetesListObject } from '@kubernetes/client-node';

// ============================================
// ArgoCD Types (Custom Resource Definitions)
// ============================================

/**
 * ArgoCD Application resource
 * API Group: argoproj.io/v1alpha1
 */
export interface ArgoApplication {
  apiVersion: 'argoproj.io/v1alpha1';
  kind: 'Application';
  metadata: V1ObjectMetaLocal;
  spec: ArgoApplicationSpec;
  status?: ArgoApplicationStatusFull;
  operation?: ArgoOperation;
}

export interface ArgoApplicationSpec {
  project: string;
  source?: ArgoSource;
  sources?: ArgoSource[];
  destination: ArgoDestination;
  syncPolicy?: ArgoSyncPolicy;
  ignoreDifferences?: ArgoResourceIgnoreDifferences[];
  info?: Array<{ name: string; value: string }>;
  revisionHistoryLimit?: number;
}

export interface ArgoSource {
  repoURL: string;
  path?: string;
  targetRevision?: string;
  chart?: string;
  ref?: string;
  helm?: ArgoHelmSource;
  kustomize?: ArgoKustomizeSource;
  directory?: ArgoDirectorySource;
  plugin?: ArgoPluginSource;
}

export interface ArgoHelmSource {
  releaseName?: string;
  valueFiles?: string[];
  values?: string;
  parameters?: Array<{
    name: string;
    value: string;
    forceString?: boolean;
  }>;
  fileParameters?: Array<{
    name: string;
    path: string;
  }>;
  passCredentials?: boolean;
  ignoreMissingValueFiles?: boolean;
  skipCrds?: boolean;
  version?: string;
}

export interface ArgoKustomizeSource {
  namePrefix?: string;
  nameSuffix?: string;
  images?: string[];
  commonLabels?: Record<string, string>;
  commonAnnotations?: Record<string, string>;
  forceCommonLabels?: boolean;
  forceCommonAnnotations?: boolean;
  version?: string;
  patches?: Array<{
    path?: string;
    patch?: string;
    target?: {
      group?: string;
      version?: string;
      kind?: string;
      name?: string;
      namespace?: string;
      labelSelector?: string;
      annotationSelector?: string;
    };
  }>;
}

export interface ArgoDirectorySource {
  recurse?: boolean;
  jsonnet?: {
    extVars?: Array<{ name: string; value: string; code?: boolean }>;
    tlas?: Array<{ name: string; value: string; code?: boolean }>;
    libs?: string[];
  };
  exclude?: string;
  include?: string;
}

export interface ArgoPluginSource {
  name?: string;
  env?: Array<{ name: string; value: string }>;
  parameters?: Array<{
    name?: string;
    string?: string;
    array?: string[];
    map?: Record<string, string>;
  }>;
}

export interface ArgoDestination {
  server?: string;
  namespace?: string;
  name?: string;
}

export interface ArgoSyncPolicy {
  automated?: {
    prune?: boolean;
    selfHeal?: boolean;
    allowEmpty?: boolean;
  };
  syncOptions?: string[];
  retry?: {
    limit?: number;
    backoff?: {
      duration?: string;
      factor?: number;
      maxDuration?: string;
    };
  };
  managedNamespaceMetadata?: {
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
  };
}

export interface ArgoResourceIgnoreDifferences {
  group?: string;
  kind: string;
  name?: string;
  namespace?: string;
  jsonPointers?: string[];
  jqPathExpressions?: string[];
  managedFieldsManagers?: string[];
}

export interface ArgoApplicationStatusFull {
  sync: {
    status: 'Synced' | 'OutOfSync' | 'Unknown';
    revision?: string;
    comparedTo?: {
      source?: ArgoSource;
      sources?: ArgoSource[];
      destination: ArgoDestination;
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
      source?: ArgoSource;
      sources?: ArgoSource[];
      resources?: ArgoManagedResource[];
    };
    startedAt?: string;
    finishedAt?: string;
    retryCount?: number;
  };
  conditions?: ArgoApplicationCondition[];
  resources?: ArgoManagedResource[];
  reconciledAt?: string;
  sourceType?: string;
  sourceTypes?: string[];
  summary?: {
    images?: string[];
    externalURLs?: string[];
  };
  history?: ArgoRevisionHistory[];
  controllerNamespace?: string;
}

export interface ArgoManagedResource {
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
  hook?: boolean;
  requiresPruning?: boolean;
}

export interface ArgoApplicationCondition {
  type: string;
  message: string;
  lastTransitionTime?: string;
}

export interface ArgoRevisionHistory {
  revision: string;
  deployedAt: string;
  id: number;
  source?: ArgoSource;
  sources?: ArgoSource[];
  deployStartedAt?: string;
  initiatedBy?: {
    username?: string;
    automated?: boolean;
  };
}

export interface ArgoOperation {
  sync?: {
    revision?: string;
    prune?: boolean;
    dryRun?: boolean;
    syncStrategy?: {
      apply?: { force?: boolean };
      hook?: { force?: boolean };
    };
    resources?: Array<{
      group?: string;
      kind: string;
      name: string;
      namespace?: string;
    }>;
    source?: ArgoSource;
    sources?: ArgoSource[];
    manifests?: string[];
    syncOptions?: string[];
  };
  initiatedBy?: {
    username?: string;
    automated?: boolean;
  };
  info?: Array<{ name: string; value: string }>;
  retry?: {
    limit?: number;
    backoff?: {
      duration?: string;
      factor?: number;
      maxDuration?: string;
    };
  };
}


// ============================================
// Helper type utilities
// ============================================

/**
 * Type guard to check if an object is a valid Kubernetes resource
 */
export function isKubernetesObject(obj: unknown): obj is KubernetesObject {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'apiVersion' in obj &&
    'kind' in obj
  );
}

/**
 * Extract the resource kind from a Kubernetes object
 */
export function getResourceKind(obj: KubernetesObject): string {
  return obj.kind || 'Unknown';
}

/**
 * Get a display name for a Kubernetes resource
 */
export function getResourceDisplayName(obj: KubernetesObject): string {
  return obj.metadata?.name || 'Unnamed';
}

/**
 * Get the namespace of a Kubernetes resource
 */
export function getResourceNamespace(obj: KubernetesObject): string {
  return obj.metadata?.namespace || 'default';
}

// Import KubernetesObject for type guard
import type { KubernetesObject } from '@kubernetes/client-node';
