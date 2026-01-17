import yaml from 'js-yaml';
import type { AppDraft, DeploymentItem, ServiceItem, IngressItem, StorageItem, ConfigMapItem, SecretItem, GenericResourceItem } from '../../store/useResourceCreationStore';

/** Basic Kubernetes resource structure for rendering */
export interface K8sResource {
  apiVersion: string;
  kind: string;
  metadata: {
    name: string;
    namespace: string;
    labels: Record<string, string>;
    annotations?: Record<string, string>;
  };
  spec?: unknown;
}

interface K8sMetadata {
  name: string;
  namespace: string;
  labels: Record<string, string>;
  annotations?: Record<string, string>;
}

const buildMetadata = (draft: AppDraft, item: { name: string; labels: Record<string, string>; annotations: Record<string, string>; namespace?: string }) => {
  const labels = { ...draft.labels, ...item.labels, app: draft.name };
  const metadata: K8sMetadata = {
    name: item.name,
    namespace: item.namespace || draft.namespace,
    labels,
  };
  if (Object.keys(item.annotations || {}).length > 0) {
    metadata.annotations = item.annotations;
  }
  return { labels, metadata };
};

interface K8sContainer {
  name: string;
  image: string;
  ports?: Array<{ containerPort: number }>;
  env?: Array<{ name: string; value: string }>;
  volumeMounts?: Array<{ name: string; mountPath: string }>;
  envFrom?: Array<{ configMapRef?: { name: string }; secretRef?: { name: string } }>;
  command?: string[];
}

interface K8sPodSpec {
  containers: K8sContainer[];
  volumes?: Array<{ name: string; persistentVolumeClaim: { claimName: string } }>;
  restartPolicy?: string;
}

interface K8sDeploymentSpec {
  replicas: number;
  selector: { matchLabels: Record<string, string> };
  template: {
    metadata: { labels: Record<string, string> };
    spec: K8sPodSpec;
  };
}

const buildDeployment = (draft: AppDraft, item: DeploymentItem, storageItems: StorageItem[]) => {
  const { labels, metadata } = buildMetadata(draft, item);
  const container: K8sContainer = {
    name: item.name,
    image: item.image,
    ports: [{ containerPort: item.containerPort }],
    env: item.env.filter((entry) => entry.key).map((entry) => ({ name: entry.key, value: entry.value })),
  };

  if (draft.storage.enabled && storageItems.length > 0) {
    container.volumeMounts = storageItems.map((storage) => ({
      name: storage.name,
      mountPath: storage.mountPath,
    }));
  }

  if (draft.configMap.enabled || draft.secret.enabled) {
    container.envFrom = [];
    if (draft.configMap.enabled) {
      draft.configMap.data.forEach((configMap) => {
        container.envFrom!.push({ configMapRef: { name: configMap.name } });
      });
    }
    if (draft.secret.enabled) {
      draft.secret.data.forEach((secret) => {
        container.envFrom!.push({ secretRef: { name: secret.name } });
      });
    }
  }

  const spec: K8sDeploymentSpec = {
    replicas: item.replicas,
    selector: { matchLabels: labels },
    template: {
      metadata: { labels },
      spec: { containers: [container] },
    },
  };

  if (draft.storage.enabled && storageItems.length > 0) {
    spec.template.spec.volumes = storageItems.map((storage) => ({
      name: storage.name,
      persistentVolumeClaim: {
        claimName: storage.name,
      },
    }));
  }

  return {
    apiVersion: 'apps/v1',
    kind: 'Deployment',
    metadata,
    spec,
  };
};

const buildService = (draft: AppDraft, item: ServiceItem) => {
  const { labels, metadata } = buildMetadata(draft, item);
  return {
    apiVersion: 'v1',
    kind: 'Service',
    metadata,
    spec: {
      type: item.type,
      selector: Object.keys(item.selectorLabels).length > 0 ? item.selectorLabels : labels,
      ports: [
        {
          port: item.port,
          targetPort: item.targetPort,
        },
      ],
    },
  };
};

const buildIngress = (draft: AppDraft, item: IngressItem) => {
  const { metadata } = buildMetadata(draft, item);
  const servicePort =
    draft.service.data.find((svc) => svc.name === item.serviceName)?.port ||
    draft.service.data[0]?.port ||
    80;
  return {
    apiVersion: 'networking.k8s.io/v1',
    kind: 'Ingress',
    metadata: {
      ...metadata,
      annotations: {
        ...(metadata.annotations || {}),
        'kubernetes.io/ingress.class': metadata.annotations?.['kubernetes.io/ingress.class'] || 'nginx',
      },
    },
    spec: {
      rules: [
        {
          host: item.host,
          http: {
            paths: [
              {
                path: item.path,
                pathType: 'Prefix',
                backend: {
                  service: {
                    name: item.serviceName,
                    port: { number: servicePort },
                  },
                },
              },
            ],
          },
        },
      ],
    },
  };
};

const buildPVC = (draft: AppDraft, item: StorageItem) => {
  const { metadata } = buildMetadata(draft, item);
  return {
    apiVersion: 'v1',
    kind: 'PersistentVolumeClaim',
    metadata,
    spec: {
      accessModes: ['ReadWriteOnce'],
      resources: {
        requests: {
          storage: item.size,
        },
      },
      storageClassName: item.storageClassName || undefined,
    },
  };
};

const buildConfigMap = (draft: AppDraft, item: ConfigMapItem) => {
  const { metadata } = buildMetadata(draft, item);
  const data: Record<string, string> = {};
  item.entries.forEach((entry) => {
    if (entry.key) {
      data[entry.key] = entry.value;
    }
  });
  return {
    apiVersion: 'v1',
    kind: 'ConfigMap',
    metadata,
    data,
  };
};

const buildSecret = (draft: AppDraft, item: SecretItem) => {
  const { metadata } = buildMetadata(draft, item);
  const data: Record<string, string> = {};
  item.entries.forEach((entry) => {
    if (entry.key) {
      data[entry.key] = btoa(entry.value);
    }
  });
  return {
    apiVersion: 'v1',
    kind: 'Secret',
    type: 'Opaque',
    metadata,
    data,
  };
};

const buildPod = (draft: AppDraft, item: GenericResourceItem) => {
  const { metadata } = buildMetadata(draft, item as { name: string; labels: Record<string, string>; annotations: Record<string, string>; namespace?: string });
  return {
    apiVersion: 'v1',
    kind: 'Pod',
    metadata,
    spec: {
      restartPolicy: item.restartPolicy || 'Always',
      containers: [
        {
          name: item.name,
          image: item.image,
          ports: item.containerPort ? [{ containerPort: Number(item.containerPort) }] : undefined,
        },
      ],
    },
  };
};

const buildJob = (draft: AppDraft, item: GenericResourceItem) => {
  const { labels, metadata } = buildMetadata(draft, item as { name: string; labels: Record<string, string>; annotations: Record<string, string>; namespace?: string });
  const command = typeof item.command === 'string' 
    ? item.command.split(' ').filter(Boolean) 
    : Array.isArray(item.command) ? item.command : undefined;
  return {
    apiVersion: 'batch/v1',
    kind: 'Job',
    metadata,
    spec: {
      completions: Number(item.completions) || 1,
      backoffLimit: Number(item.backoffLimit) || 4,
      template: {
        metadata: { labels },
        spec: {
          restartPolicy: 'OnFailure',
          containers: [
            {
              name: item.name,
              image: item.image,
              command,
            },
          ],
        },
      },
    },
  };
};

const buildCronJob = (draft: AppDraft, item: GenericResourceItem) => {
  const { labels, metadata } = buildMetadata(draft, item as { name: string; labels: Record<string, string>; annotations: Record<string, string>; namespace?: string });
  const command = typeof item.command === 'string' 
    ? item.command.split(' ').filter(Boolean) 
    : Array.isArray(item.command) ? item.command : undefined;
  return {
    apiVersion: 'batch/v1',
    kind: 'CronJob',
    metadata,
    spec: {
      schedule: item.schedule || '*/5 * * * *',
      jobTemplate: {
        spec: {
          template: {
            metadata: { labels },
            spec: {
              restartPolicy: 'OnFailure',
              containers: [
                {
                  name: item.name,
                  image: item.image,
                  command,
                },
              ],
            },
          },
        },
      },
    },
  };
};

const buildHPA = (draft: AppDraft, item: GenericResourceItem) => {
  const { metadata } = buildMetadata(draft, item as { name: string; labels: Record<string, string>; annotations: Record<string, string>; namespace?: string });
  return {
    apiVersion: 'autoscaling/v2',
    kind: 'HorizontalPodAutoscaler',
    metadata,
    spec: {
      scaleTargetRef: {
        apiVersion: 'apps/v1',
        kind: item.targetKind || 'Deployment',
        name: item.targetName,
      },
      minReplicas: Number(item.minReplicas) || 1,
      maxReplicas: Number(item.maxReplicas) || 10,
      metrics: [
        {
          type: 'Resource',
          resource: {
            name: 'cpu',
            target: {
              type: 'Utilization',
              averageUtilization: Number(item.cpuTargetUtilization) || 80,
            },
          },
        },
      ],
    },
  };
};

const buildAdditionalResource = (draft: AppDraft, resourceTypeId: string, item: GenericResourceItem): unknown | null => {
  switch (resourceTypeId) {
    case 'pod':
      return buildPod(draft, item);
    case 'job':
      return buildJob(draft, item);
    case 'cronjob':
      return buildCronJob(draft, item);
    case 'hpa':
      return buildHPA(draft, item);
    default:
      return null;
  }
};

export const buildAppResources = (draft: AppDraft): K8sResource[] => {
  const resources: K8sResource[] = [];

  if (draft.configMap.enabled) {
    draft.configMap.data.forEach((item) => resources.push(buildConfigMap(draft, item) as K8sResource));
  }
  if (draft.secret.enabled) {
    draft.secret.data.forEach((item) => resources.push(buildSecret(draft, item) as K8sResource));
  }
  if (draft.storage.enabled) {
    draft.storage.data.forEach((item) => resources.push(buildPVC(draft, item) as K8sResource));
  }
  if (draft.deployment.enabled) {
    const storageItems = draft.storage.enabled ? draft.storage.data : [];
    draft.deployment.data.forEach((item) => resources.push(buildDeployment(draft, item, storageItems) as K8sResource));
  }
  if (draft.service.enabled) {
    draft.service.data.forEach((item) => resources.push(buildService(draft, item) as K8sResource));
  }
  if (draft.ingress.enabled) {
    draft.ingress.data.forEach((item) => resources.push(buildIngress(draft, item) as K8sResource));
  }

  // Handle additional resources
  if (draft.additionalResources) {
    Object.entries(draft.additionalResources).forEach(([resourceTypeId, section]) => {
      if (section.enabled) {
        section.data.forEach((item) => {
          const resource = buildAdditionalResource(draft, resourceTypeId, item);
          if (resource) resources.push(resource as K8sResource);
        });
      }
    });
  }

  return resources;
};

export const buildAppYaml = (draft: AppDraft): string => {
  const docs = buildAppResources(draft);
  if (docs.length === 0) return '';
  return docs.map((doc) => yaml.dump(doc, { noRefs: true, lineWidth: 120 })).join('\n---\n');
};
