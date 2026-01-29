/**
 * Application Blueprints
 * 
 * Pre-configured templates that set up common application patterns.
 * Each blueprint generates a set of draft resources.
 */

import type { DraftResource, Blueprint } from '../../../store/useApplicationDraftStore';

// Helper to generate unique IDs
const genId = () => `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

/**
 * Web Application Blueprint
 * Frontend app with Service and Ingress
 */
const webAppBlueprint: Blueprint = {
  id: 'web-app',
  name: 'Web Application',
  description: 'Frontend with Service and Ingress',
  icon: 'Globe',
  createResources: (appName: string, namespace: string): DraftResource[] => [
    {
      id: genId(),
      kind: 'Deployment',
      fromBlueprint: 'web-app',
      spec: {
        apiVersion: 'apps/v1',
        kind: 'Deployment',
        metadata: {
          name: `${appName}`,
          namespace,
          labels: { app: appName, tier: 'frontend' },
        },
        spec: {
          replicas: 2,
          selector: { matchLabels: { app: appName } },
          template: {
            metadata: { labels: { app: appName, tier: 'frontend' } },
            spec: {
              containers: [{
                name: 'main',
                image: 'nginx:latest',
                ports: [{ containerPort: 80 }],
              }],
            },
          },
        },
      },
    },
    {
      id: genId(),
      kind: 'Service',
      fromBlueprint: 'web-app',
      spec: {
        apiVersion: 'v1',
        kind: 'Service',
        metadata: {
          name: `${appName}-svc`,
          namespace,
          labels: { app: appName },
        },
        spec: {
          type: 'ClusterIP',
          selector: { app: appName },
          ports: [{ port: 80, targetPort: 80 }],
        },
      },
    },
    {
      id: genId(),
      kind: 'Ingress',
      fromBlueprint: 'web-app',
      spec: {
        apiVersion: 'networking.k8s.io/v1',
        kind: 'Ingress',
        metadata: {
          name: `${appName}-ingress`,
          namespace,
          labels: { app: appName },
          annotations: { 'kubernetes.io/ingress.class': 'nginx' },
        },
        spec: {
          rules: [{
            host: `${appName}.local`,
            http: {
              paths: [{
                path: '/',
                pathType: 'Prefix',
                backend: {
                  service: { name: `${appName}-svc`, port: { number: 80 } },
                },
              }],
            },
          }],
        },
      },
    },
  ],
};

/**
 * API Service Blueprint
 * Backend API with ConfigMap and Secret
 */
const apiServiceBlueprint: Blueprint = {
  id: 'api-service',
  name: 'API Service',
  description: 'Backend API with config and secrets',
  icon: 'Server',
  createResources: (appName: string, namespace: string): DraftResource[] => [
    {
      id: genId(),
      kind: 'ConfigMap',
      fromBlueprint: 'api-service',
      spec: {
        apiVersion: 'v1',
        kind: 'ConfigMap',
        metadata: {
          name: `${appName}-config`,
          namespace,
          labels: { app: appName },
        },
        data: {
          LOG_LEVEL: 'info',
          API_PORT: '8080',
        },
      },
    },
    {
      id: genId(),
      kind: 'Secret',
      fromBlueprint: 'api-service',
      spec: {
        apiVersion: 'v1',
        kind: 'Secret',
        metadata: {
          name: `${appName}-secrets`,
          namespace,
          labels: { app: appName },
        },
        type: 'Opaque',
        stringData: {
          API_KEY: 'change-me',
          DB_PASSWORD: 'change-me',
        },
      },
    },
    {
      id: genId(),
      kind: 'Deployment',
      fromBlueprint: 'api-service',
      spec: {
        apiVersion: 'apps/v1',
        kind: 'Deployment',
        metadata: {
          name: `${appName}`,
          namespace,
          labels: { app: appName, tier: 'backend' },
        },
        spec: {
          replicas: 2,
          selector: { matchLabels: { app: appName } },
          template: {
            metadata: { labels: { app: appName, tier: 'backend' } },
            spec: {
              containers: [{
                name: 'api',
                image: 'node:20-alpine',
                ports: [{ containerPort: 8080 }],
                envFrom: [
                  { configMapRef: { name: `${appName}-config` } },
                  { secretRef: { name: `${appName}-secrets` } },
                ],
              }],
            },
          },
        },
      },
    },
    {
      id: genId(),
      kind: 'Service',
      fromBlueprint: 'api-service',
      spec: {
        apiVersion: 'v1',
        kind: 'Service',
        metadata: {
          name: `${appName}-svc`,
          namespace,
          labels: { app: appName },
        },
        spec: {
          type: 'ClusterIP',
          selector: { app: appName },
          ports: [{ port: 8080, targetPort: 8080 }],
        },
      },
    },
  ],
};

/**
 * Stateful Application Blueprint
 * Application with persistent storage
 */
const statefulAppBlueprint: Blueprint = {
  id: 'stateful-app',
  name: 'Stateful Application',
  description: 'App with persistent storage',
  icon: 'Database',
  createResources: (appName: string, namespace: string): DraftResource[] => [
    {
      id: genId(),
      kind: 'PersistentVolumeClaim',
      fromBlueprint: 'stateful-app',
      spec: {
        apiVersion: 'v1',
        kind: 'PersistentVolumeClaim',
        metadata: {
          name: `${appName}-data`,
          namespace,
          labels: { app: appName },
        },
        spec: {
          accessModes: ['ReadWriteOnce'],
          resources: { requests: { storage: '10Gi' } },
        },
      },
    },
    {
      id: genId(),
      kind: 'Deployment',
      fromBlueprint: 'stateful-app',
      spec: {
        apiVersion: 'apps/v1',
        kind: 'Deployment',
        metadata: {
          name: `${appName}`,
          namespace,
          labels: { app: appName },
        },
        spec: {
          replicas: 1,
          selector: { matchLabels: { app: appName } },
          template: {
            metadata: { labels: { app: appName } },
            spec: {
              containers: [{
                name: 'db',
                image: 'postgres:16',
                ports: [{ containerPort: 5432 }],
                env: [
                  { name: 'POSTGRES_DB', value: appName },
                  { name: 'POSTGRES_USER', value: 'admin' },
                  { name: 'POSTGRES_PASSWORD', value: 'change-me' },
                ],
                volumeMounts: [{
                  name: 'data',
                  mountPath: '/var/lib/postgresql/data',
                }],
              }],
              volumes: [{
                name: 'data',
                persistentVolumeClaim: { claimName: `${appName}-data` },
              }],
            },
          },
        },
      },
    },
    {
      id: genId(),
      kind: 'Service',
      fromBlueprint: 'stateful-app',
      spec: {
        apiVersion: 'v1',
        kind: 'Service',
        metadata: {
          name: `${appName}-svc`,
          namespace,
          labels: { app: appName },
        },
        spec: {
          type: 'ClusterIP',
          selector: { app: appName },
          ports: [{ port: 5432, targetPort: 5432 }],
        },
      },
    },
  ],
};

/**
 * Worker/Job Blueprint
 * Background worker with CronJob
 */
const workerBlueprint: Blueprint = {
  id: 'worker',
  name: 'Background Worker',
  description: 'CronJob for scheduled tasks',
  icon: 'Clock',
  createResources: (appName: string, namespace: string): DraftResource[] => [
    {
      id: genId(),
      kind: 'ConfigMap',
      fromBlueprint: 'worker',
      spec: {
        apiVersion: 'v1',
        kind: 'ConfigMap',
        metadata: {
          name: `${appName}-config`,
          namespace,
          labels: { app: appName },
        },
        data: {
          TASK_INTERVAL: '5m',
        },
      },
    },
    {
      id: genId(),
      kind: 'CronJob',
      fromBlueprint: 'worker',
      spec: {
        apiVersion: 'batch/v1',
        kind: 'CronJob',
        metadata: {
          name: `${appName}`,
          namespace,
          labels: { app: appName },
        },
        spec: {
          schedule: '*/5 * * * *',
          jobTemplate: {
            spec: {
              template: {
                metadata: { labels: { app: appName } },
                spec: {
                  restartPolicy: 'OnFailure',
                  containers: [{
                    name: 'worker',
                    image: 'busybox:latest',
                    command: ['sh', '-c', 'echo "Running scheduled task at $(date)"'],
                    envFrom: [{ configMapRef: { name: `${appName}-config` } }],
                  }],
                },
              },
            },
          },
        },
      },
    },
  ],
};

/**
 * Minimal Blueprint
 * Just a Deployment
 */
const minimalBlueprint: Blueprint = {
  id: 'minimal',
  name: 'Minimal',
  description: 'Single Deployment, add more as needed',
  icon: 'Box',
  createResources: (appName: string, namespace: string): DraftResource[] => [
    {
      id: genId(),
      kind: 'Deployment',
      fromBlueprint: 'minimal',
      spec: {
        apiVersion: 'apps/v1',
        kind: 'Deployment',
        metadata: {
          name: `${appName}`,
          namespace,
          labels: { app: appName },
        },
        spec: {
          replicas: 1,
          selector: { matchLabels: { app: appName } },
          template: {
            metadata: { labels: { app: appName } },
            spec: {
              containers: [{
                name: 'main',
                image: 'nginx:latest',
                ports: [{ containerPort: 80 }],
              }],
            },
          },
        },
      },
    },
  ],
};

/**
 * All available blueprints
 */
export const BLUEPRINTS: Blueprint[] = [
  webAppBlueprint,
  apiServiceBlueprint,
  statefulAppBlueprint,
  workerBlueprint,
  minimalBlueprint,
];

/**
 * Get blueprint by ID
 */
export function getBlueprintById(id: string): Blueprint | undefined {
  return BLUEPRINTS.find(b => b.id === id);
}
