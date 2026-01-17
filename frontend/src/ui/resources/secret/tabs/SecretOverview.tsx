import React from 'react';
import type { ClusterResource } from '../../../../api/types';
import type { V1Secret } from '../../../../api/k8s-types';
import { useClusterStore } from '../../../../store/useClusterStore';
import { useResourceDetailsStore } from '../../../../store/useResourceDetailsStore';
import { 
  Lock, 
  Box,
  ExternalLink,
  Key,
  Shield,
  Tag
} from 'lucide-react';
import {
  StatusBanner,
  MetadataCard,
  LabelsCard,
  AnnotationsCard,
  Card,
  CardHeader,
  CardBody,
  MetaRow,
  type HealthStatus
} from '../../shared';
import { clsx } from 'clsx';

interface Props {
  resource: ClusterResource;
  model: V1Secret;
  updateModel: (updater: (current: V1Secret) => V1Secret) => void;
}

// Secret type descriptions
const SECRET_TYPE_INFO: Record<string, { label: string; description: string; color: string }> = {
  'Opaque': { 
    label: 'Opaque', 
    description: 'Generic secret for arbitrary user-defined data',
    color: 'text-slate-400'
  },
  'kubernetes.io/service-account-token': { 
    label: 'Service Account Token', 
    description: 'Token for Kubernetes service account',
    color: 'text-blue-400'
  },
  'kubernetes.io/dockercfg': { 
    label: 'Docker Config (legacy)', 
    description: 'Legacy Docker registry credentials',
    color: 'text-purple-400'
  },
  'kubernetes.io/dockerconfigjson': { 
    label: 'Docker Config JSON', 
    description: 'Docker registry credentials in JSON format',
    color: 'text-purple-400'
  },
  'kubernetes.io/basic-auth': { 
    label: 'Basic Auth', 
    description: 'Basic authentication credentials',
    color: 'text-amber-400'
  },
  'kubernetes.io/ssh-auth': { 
    label: 'SSH Auth', 
    description: 'SSH authentication credentials',
    color: 'text-emerald-400'
  },
  'kubernetes.io/tls': { 
    label: 'TLS', 
    description: 'TLS certificate and key pair',
    color: 'text-cyan-400'
  },
  'bootstrap.kubernetes.io/token': { 
    label: 'Bootstrap Token', 
    description: 'Token for cluster bootstrap',
    color: 'text-red-400'
  },
};

export const SecretOverview: React.FC<Props> = ({ resource, model, updateModel }) => {
  const allResources = useClusterStore(state => state.resources);
  const openDetails = useResourceDetailsStore(state => state.openDetails);
  
  const metadata = model.metadata;
  const data = model.data || {};
  const stringData = model.stringData || {};
  const secretType = model.type || 'Opaque';

  const dataKeyCount = Object.keys(data).length + Object.keys(stringData).length;
  const typeInfo = SECRET_TYPE_INFO[secretType] || { label: secretType, description: 'Custom secret type', color: 'text-slate-400' };

  // Find pods using this Secret
  const getUsingPods = () => {
    const secretName = metadata?.name;
    const namespace = metadata?.namespace;
    
    return Object.values(allResources).filter(r => {
      if (r.kind !== 'Pod' || r.namespace !== namespace) return false;
      
      const podSpec = r.raw?.spec;
      if (!podSpec) return false;

      // Check volumes
      const volumes = podSpec.volumes || [];
      for (const vol of volumes) {
        if (vol.secret?.secretName === secretName) return true;
        // Check projected volumes
        if (vol.projected?.sources) {
          for (const source of vol.projected.sources) {
            if (source.secret?.name === secretName) return true;
          }
        }
      }

      // Check envFrom in containers
      const containers = [...(podSpec.containers || []), ...(podSpec.initContainers || [])];
      for (const container of containers) {
        // envFrom
        for (const envFrom of container.envFrom || []) {
          if (envFrom.secretRef?.name === secretName) return true;
        }
        // env valueFrom
        for (const env of container.env || []) {
          if (env.valueFrom?.secretKeyRef?.name === secretName) return true;
        }
      }

      // Check imagePullSecrets
      for (const pullSecret of podSpec.imagePullSecrets || []) {
        if (pullSecret.name === secretName) return true;
      }
      
      return false;
    });
  };

  const usingPods = getUsingPods();

  // Find Ingresses using this Secret (for TLS)
  const getUsingIngresses = () => {
    const secretName = metadata?.name;
    const namespace = metadata?.namespace;
    
    return Object.values(allResources).filter(r => {
      if (r.kind !== 'Ingress' || r.namespace !== namespace) return false;
      
      const tls = r.raw?.spec?.tls || [];
      for (const tlsEntry of tls) {
        if (tlsEntry.secretName === secretName) return true;
      }
      
      return false;
    });
  };

  const usingIngresses = getUsingIngresses();

  const healthStatus: HealthStatus = 'healthy';

  // Handle label/annotation changes
  const handleAddLabel = (key: string, value: string) => {
    updateModel(current => ({
      ...current,
      metadata: {
        ...current.metadata,
        labels: {
          ...current.metadata?.labels,
          [key]: value
        }
      }
    }));
  };

  const handleRemoveLabel = (key: string) => {
    updateModel(current => {
      const newLabels = { ...current.metadata?.labels };
      delete newLabels[key];
      return {
        ...current,
        metadata: {
          ...current.metadata,
          labels: newLabels
        }
      };
    });
  };

  const handleAddAnnotation = (key: string, value: string) => {
    updateModel(current => ({
      ...current,
      metadata: {
        ...current.metadata,
        annotations: {
          ...current.metadata?.annotations,
          [key]: value
        }
      }
    }));
  };

  const handleRemoveAnnotation = (key: string) => {
    updateModel(current => {
      const newAnnotations = { ...current.metadata?.annotations };
      delete newAnnotations[key];
      return {
        ...current,
        metadata: {
          ...current.metadata,
          annotations: newAnnotations
        }
      };
    });
  };

  return (
    <div className="space-y-6">
      <StatusBanner
        name={resource.name}
        namespace={metadata?.namespace}
        health={healthStatus}
        statusText={typeInfo.label}
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader icon={<Tag size={16} />} title="Type" />
          <CardBody>
            <div className={clsx("text-lg font-mono", typeInfo.color)}>{typeInfo.label}</div>
            <div className="text-xs text-slate-500 mt-1">{typeInfo.description}</div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader icon={<Key size={16} />} title="Data Keys" />
          <CardBody>
            <div className="text-2xl font-mono text-amber-400">{dataKeyCount}</div>
            <div className="text-xs text-slate-500">secret entries</div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader icon={<Shield size={16} />} title="Used By" />
          <CardBody>
            <div className="text-2xl font-mono text-emerald-400">{usingPods.length + usingIngresses.length}</div>
            <div className="text-xs text-slate-500">
              {usingPods.length} pod{usingPods.length !== 1 ? 's' : ''}, {usingIngresses.length} ingress{usingIngresses.length !== 1 ? 'es' : ''}
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Pods using this Secret */}
      {usingPods.length > 0 && (
        <Card>
          <CardHeader 
            icon={<Box size={16} />} 
            title="Used by Pods"
            badge={<span className="text-xs text-slate-500 ml-2">({usingPods.length})</span>}
          />
          <CardBody>
            <div className="flex flex-wrap gap-2">
              {usingPods.map(pod => {
                const podPhase = pod.status as string;
                const isReady = pod.raw?.status?.conditions?.find((c: { type: string; status: string }) => c.type === 'Ready' && c.status === 'True');
                
                return (
                  <button
                    key={pod.id}
                    onClick={() => openDetails(pod.id)}
                    className={clsx(
                      "flex items-center gap-1.5 px-2 py-1.5 rounded-md border text-xs font-mono transition-all cursor-pointer",
                      "hover:scale-105 hover:shadow-lg",
                      podPhase === 'Running' && isReady 
                        ? "bg-emerald-900/30 border-emerald-700/50 text-emerald-300 hover:bg-emerald-900/50" 
                        : podPhase === 'Running' 
                        ? "bg-blue-900/30 border-blue-700/50 text-blue-300 hover:bg-blue-900/50" 
                        : "bg-amber-900/30 border-amber-700/50 text-amber-300 hover:bg-amber-900/50"
                    )}
                  >
                    <Box size={12} />
                    <span className="truncate max-w-[150px]">{pod.name}</span>
                    <ExternalLink size={10} className="text-slate-500" />
                  </button>
                );
              })}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Ingresses using this Secret */}
      {usingIngresses.length > 0 && (
        <Card>
          <CardHeader 
            icon={<Lock size={16} />} 
            title="Used by Ingresses (TLS)"
            badge={<span className="text-xs text-slate-500 ml-2">({usingIngresses.length})</span>}
          />
          <CardBody>
            <div className="flex flex-wrap gap-2">
              {usingIngresses.map(ing => (
                <button
                  key={ing.id}
                  onClick={() => openDetails(ing.id)}
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded-md border text-xs font-mono transition-all cursor-pointer bg-cyan-900/30 border-cyan-700/50 text-cyan-300 hover:bg-cyan-900/50 hover:scale-105 hover:shadow-lg"
                >
                  <Lock size={12} />
                  <span className="truncate max-w-[150px]">{ing.name}</span>
                  <ExternalLink size={10} className="text-slate-500" />
                </button>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Secret Details */}
      <Card>
        <CardHeader icon={<Lock size={16} />} title="Secret Details" />
        <CardBody className="space-y-3 text-sm">
          <MetaRow label="Type" value={secretType} />
          <MetaRow label="Data Keys" value={Object.keys(data).join(', ') || 'None'} />
          {Object.keys(stringData).length > 0 && (
            <MetaRow label="String Data Keys" value={Object.keys(stringData).join(', ')} />
          )}
        </CardBody>
      </Card>

      {/* Metadata */}
      <MetadataCard metadata={metadata} showGeneration={false} />

      {/* Labels */}
      <LabelsCard 
        labels={metadata?.labels} 
        editable 
        onAdd={handleAddLabel}
        onRemove={handleRemoveLabel}
      />

      {/* Annotations */}
      <AnnotationsCard 
        annotations={metadata?.annotations} 
        editable 
        onAdd={handleAddAnnotation}
        onRemove={handleRemoveAnnotation}
      />
    </div>
  );
};
