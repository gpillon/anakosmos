/**
 * Resource Type Registry for Creation Hub
 * 
 * This file defines all available resource types that can be created through the creation hub.
 * The configuration is declarative to avoid hardcoding in the UI components.
 */

import { 
  Layers, 
  Network, 
  Globe, 
  Database, 
  FileText, 
  Shield,
  Play,
  Clock,
  Gauge,
  Box,
  type LucideIcon
} from 'lucide-react';

export interface ResourceTypeConfig {
  /** Unique identifier */
  id: string;
  /** Kubernetes kind */
  kind: string;
  /** Display label */
  label: string;
  /** Description shown in UI */
  description: string;
  /** Icon component */
  icon: LucideIcon;
  /** Category: 'core' resources are shown by default, 'other' are in expandable section */
  category: 'core' | 'other';
  /** API Version for generating YAML */
  apiVersion: string;
  /** Whether the resource is namespace-scoped */
  namespaced: boolean;
  /** Default values for creating a new instance */
  defaultItem: () => Record<string, unknown>;
  /** Fields configuration for the simple form */
  fields: FieldConfig[];
}

export interface FieldConfig {
  /** Field key in the item object */
  key: string;
  /** Display label */
  label: string;
  /** Field type */
  type: 'text' | 'number' | 'select' | 'keyvalue' | 'textarea';
  /** Placeholder text */
  placeholder?: string;
  /** Options for select type */
  options?: Array<{ value: string; label: string }>;
  /** Whether field is required */
  required?: boolean;
  /** Grid column span (1-3) */
  colSpan?: 1 | 2 | 3;
}

/**
 * Core resource types - always shown in the creation form
 */
export const CORE_RESOURCE_TYPES: ResourceTypeConfig[] = [
  {
    id: 'deployment',
    kind: 'Deployment',
    label: 'Deployment',
    description: 'Workload definition and container settings',
    icon: Layers,
    category: 'core',
    apiVersion: 'apps/v1',
    namespaced: true,
    defaultItem: () => ({
      name: 'my-deployment',
      image: 'nginx:latest',
      replicas: 2,
      containerPort: 80,
      env: [],
      labels: {},
      annotations: {},
    }),
    fields: [
      { key: 'name', label: 'Name', type: 'text', placeholder: 'my-deployment', required: true },
      { key: 'image', label: 'Image', type: 'text', placeholder: 'nginx:latest', required: true },
      { key: 'replicas', label: 'Replicas', type: 'number', placeholder: '2' },
      { key: 'containerPort', label: 'Container Port', type: 'number', placeholder: '80' },
      { key: 'env', label: 'Environment Variables', type: 'keyvalue', colSpan: 2 },
    ],
  },
  {
    id: 'service',
    kind: 'Service',
    label: 'Service',
    description: 'Expose your workload internally or externally',
    icon: Network,
    category: 'core',
    apiVersion: 'v1',
    namespaced: true,
    defaultItem: () => ({
      name: 'my-service',
      type: 'ClusterIP',
      port: 80,
      targetPort: 80,
      selectorLabels: {},
      labels: {},
      annotations: {},
    }),
    fields: [
      { key: 'name', label: 'Name', type: 'text', placeholder: 'my-service', required: true },
      { 
        key: 'type', 
        label: 'Type', 
        type: 'select', 
        options: [
          { value: 'ClusterIP', label: 'ClusterIP' },
          { value: 'NodePort', label: 'NodePort' },
          { value: 'LoadBalancer', label: 'LoadBalancer' },
        ]
      },
      { key: 'port', label: 'Port', type: 'number', placeholder: '80' },
      { key: 'targetPort', label: 'Target Port', type: 'number', placeholder: '80' },
      { key: 'selectorLabels', label: 'Selector Labels', type: 'keyvalue', colSpan: 2 },
    ],
  },
  {
    id: 'ingress',
    kind: 'Ingress',
    label: 'Ingress',
    description: 'Expose your service with a hostname',
    icon: Globe,
    category: 'core',
    apiVersion: 'networking.k8s.io/v1',
    namespaced: true,
    defaultItem: () => ({
      name: 'my-ingress',
      host: 'app.local',
      path: '/',
      serviceName: '',
      servicePort: 80,
      labels: {},
      annotations: {},
    }),
    fields: [
      { key: 'name', label: 'Name', type: 'text', placeholder: 'my-ingress', required: true },
      { key: 'host', label: 'Host', type: 'text', placeholder: 'app.local', required: true },
      { key: 'path', label: 'Path', type: 'text', placeholder: '/' },
      { key: 'serviceName', label: 'Service Name', type: 'text', placeholder: 'my-service' },
      { key: 'servicePort', label: 'Service Port', type: 'number', placeholder: '80' },
    ],
  },
  {
    id: 'pvc',
    kind: 'PersistentVolumeClaim',
    label: 'Storage (PVC)',
    description: 'Persistent storage for your workloads',
    icon: Database,
    category: 'core',
    apiVersion: 'v1',
    namespaced: true,
    defaultItem: () => ({
      name: 'my-pvc',
      size: '1Gi',
      accessMode: 'ReadWriteOnce',
      storageClassName: '',
      labels: {},
      annotations: {},
    }),
    fields: [
      { key: 'name', label: 'Name', type: 'text', placeholder: 'my-pvc', required: true },
      { key: 'size', label: 'Size', type: 'text', placeholder: '1Gi', required: true },
      { 
        key: 'accessMode', 
        label: 'Access Mode', 
        type: 'select', 
        options: [
          { value: 'ReadWriteOnce', label: 'ReadWriteOnce' },
          { value: 'ReadOnlyMany', label: 'ReadOnlyMany' },
          { value: 'ReadWriteMany', label: 'ReadWriteMany' },
        ]
      },
      { key: 'storageClassName', label: 'Storage Class', type: 'text', placeholder: 'Leave empty for default' },
    ],
  },
  {
    id: 'configmap',
    kind: 'ConfigMap',
    label: 'ConfigMap',
    description: 'Non-secret configuration injected into pods',
    icon: FileText,
    category: 'core',
    apiVersion: 'v1',
    namespaced: true,
    defaultItem: () => ({
      name: 'my-configmap',
      data: [{ key: 'KEY', value: 'value' }],
      labels: {},
      annotations: {},
    }),
    fields: [
      { key: 'name', label: 'Name', type: 'text', placeholder: 'my-configmap', required: true },
      { key: 'data', label: 'Data Entries', type: 'keyvalue', colSpan: 3 },
    ],
  },
  {
    id: 'secret',
    kind: 'Secret',
    label: 'Secret',
    description: 'Sensitive data stored securely',
    icon: Shield,
    category: 'core',
    apiVersion: 'v1',
    namespaced: true,
    defaultItem: () => ({
      name: 'my-secret',
      type: 'Opaque',
      data: [{ key: 'PASSWORD', value: 'change-me' }],
      labels: {},
      annotations: {},
    }),
    fields: [
      { key: 'name', label: 'Name', type: 'text', placeholder: 'my-secret', required: true },
      { 
        key: 'type', 
        label: 'Secret Type', 
        type: 'select', 
        options: [
          { value: 'Opaque', label: 'Opaque (generic)' },
          { value: 'kubernetes.io/dockerconfigjson', label: 'Docker Config' },
          { value: 'kubernetes.io/tls', label: 'TLS' },
          { value: 'kubernetes.io/basic-auth', label: 'Basic Auth' },
        ]
      },
      { key: 'data', label: 'Data Entries', type: 'keyvalue', colSpan: 2 },
    ],
  },
];

/**
 * Other resource types - shown in expandable "Add Other Resource" section
 */
export const OTHER_RESOURCE_TYPES: ResourceTypeConfig[] = [
  {
    id: 'pod',
    kind: 'Pod',
    label: 'Pod',
    description: 'Single container or multi-container pod',
    icon: Box,
    category: 'other',
    apiVersion: 'v1',
    namespaced: true,
    defaultItem: () => ({
      name: 'my-pod',
      image: 'nginx:latest',
      containerPort: 80,
      restartPolicy: 'Always',
      labels: {},
      annotations: {},
    }),
    fields: [
      { key: 'name', label: 'Name', type: 'text', placeholder: 'my-pod', required: true },
      { key: 'image', label: 'Image', type: 'text', placeholder: 'nginx:latest', required: true },
      { key: 'containerPort', label: 'Container Port', type: 'number', placeholder: '80' },
      { 
        key: 'restartPolicy', 
        label: 'Restart Policy', 
        type: 'select', 
        options: [
          { value: 'Always', label: 'Always' },
          { value: 'OnFailure', label: 'OnFailure' },
          { value: 'Never', label: 'Never' },
        ]
      },
    ],
  },
  {
    id: 'job',
    kind: 'Job',
    label: 'Job',
    description: 'Run a task to completion',
    icon: Play,
    category: 'other',
    apiVersion: 'batch/v1',
    namespaced: true,
    defaultItem: () => ({
      name: 'my-job',
      image: 'busybox:latest',
      command: ['echo', 'Hello'],
      backoffLimit: 4,
      completions: 1,
      labels: {},
      annotations: {},
    }),
    fields: [
      { key: 'name', label: 'Name', type: 'text', placeholder: 'my-job', required: true },
      { key: 'image', label: 'Image', type: 'text', placeholder: 'busybox:latest', required: true },
      { key: 'command', label: 'Command', type: 'text', placeholder: 'echo Hello' },
      { key: 'completions', label: 'Completions', type: 'number', placeholder: '1' },
      { key: 'backoffLimit', label: 'Backoff Limit', type: 'number', placeholder: '4' },
    ],
  },
  {
    id: 'cronjob',
    kind: 'CronJob',
    label: 'CronJob',
    description: 'Run jobs on a schedule',
    icon: Clock,
    category: 'other',
    apiVersion: 'batch/v1',
    namespaced: true,
    defaultItem: () => ({
      name: 'my-cronjob',
      image: 'busybox:latest',
      schedule: '*/5 * * * *',
      command: ['echo', 'Hello'],
      labels: {},
      annotations: {},
    }),
    fields: [
      { key: 'name', label: 'Name', type: 'text', placeholder: 'my-cronjob', required: true },
      { key: 'schedule', label: 'Schedule (cron)', type: 'text', placeholder: '*/5 * * * *', required: true },
      { key: 'image', label: 'Image', type: 'text', placeholder: 'busybox:latest', required: true },
      { key: 'command', label: 'Command', type: 'text', placeholder: 'echo Hello' },
    ],
  },
  {
    id: 'hpa',
    kind: 'HorizontalPodAutoscaler',
    label: 'HPA',
    description: 'Autoscale workloads based on metrics',
    icon: Gauge,
    category: 'other',
    apiVersion: 'autoscaling/v2',
    namespaced: true,
    defaultItem: () => ({
      name: 'my-hpa',
      targetKind: 'Deployment',
      targetName: '',
      minReplicas: 1,
      maxReplicas: 10,
      cpuTargetUtilization: 80,
      labels: {},
      annotations: {},
    }),
    fields: [
      { key: 'name', label: 'Name', type: 'text', placeholder: 'my-hpa', required: true },
      { 
        key: 'targetKind', 
        label: 'Target Kind', 
        type: 'select', 
        options: [
          { value: 'Deployment', label: 'Deployment' },
          { value: 'StatefulSet', label: 'StatefulSet' },
          { value: 'ReplicaSet', label: 'ReplicaSet' },
        ]
      },
      { key: 'targetName', label: 'Target Name', type: 'text', placeholder: 'my-deployment', required: true },
      { key: 'minReplicas', label: 'Min Replicas', type: 'number', placeholder: '1' },
      { key: 'maxReplicas', label: 'Max Replicas', type: 'number', placeholder: '10' },
      { key: 'cpuTargetUtilization', label: 'CPU Target %', type: 'number', placeholder: '80' },
    ],
  },
];

/**
 * All resource types combined
 */
export const ALL_RESOURCE_TYPES: ResourceTypeConfig[] = [
  ...CORE_RESOURCE_TYPES,
  ...OTHER_RESOURCE_TYPES,
];

/**
 * Get resource type config by id
 */
export function getResourceTypeById(id: string): ResourceTypeConfig | undefined {
  return ALL_RESOURCE_TYPES.find((rt) => rt.id === id);
}

/**
 * Get resource type config by kind
 */
export function getResourceTypeByKind(kind: string): ResourceTypeConfig | undefined {
  return ALL_RESOURCE_TYPES.find((rt) => rt.kind === kind);
}
