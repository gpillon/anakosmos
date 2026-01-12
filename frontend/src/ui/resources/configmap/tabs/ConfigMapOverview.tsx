import React, { useState } from 'react';
import type { ClusterResource } from '../../../../api/types';
import type { V1ConfigMap } from '../../../../api/k8s-types';
import { useClusterStore } from '../../../../store/useClusterStore';
import { useResourceDetailsStore } from '../../../../store/useResourceDetailsStore';
import { 
  FileText, 
  Box,
  ExternalLink,
  Key
} from 'lucide-react';
import {
  StatusBanner,
  MetadataCard,
  LabelsCard,
  AnnotationsCard,
  Card,
  CardHeader,
  CardBody,
  type HealthStatus
} from '../../shared';
import { clsx } from 'clsx';

interface Props {
  resource: ClusterResource;
  configMap: V1ConfigMap;
  onApply: (updatedRaw: V1ConfigMap) => Promise<void>;
}

export const ConfigMapOverview: React.FC<Props> = ({ resource, configMap, onApply }) => {
  const [saving, setSaving] = useState(false);
  const allResources = useClusterStore(state => state.resources);
  const openDetails = useResourceDetailsStore(state => state.openDetails);
  
  const metadata = configMap.metadata;
  const data = configMap.data || {};
  const binaryData = configMap.binaryData || {};

  const dataKeyCount = Object.keys(data).length;
  const binaryKeyCount = Object.keys(binaryData).length;
  const totalKeys = dataKeyCount + binaryKeyCount;

  // Find pods using this ConfigMap
  const getUsingPods = () => {
    const configMapName = metadata?.name;
    const namespace = metadata?.namespace;
    
    return Object.values(allResources).filter(r => {
      if (r.kind !== 'Pod' || r.namespace !== namespace) return false;
      
      const podSpec = r.raw?.spec;
      if (!podSpec) return false;

      // Check volumes
      const volumes = podSpec.volumes || [];
      for (const vol of volumes) {
        if (vol.configMap?.name === configMapName) return true;
        // Check projected volumes
        if (vol.projected?.sources) {
          for (const source of vol.projected.sources) {
            if (source.configMap?.name === configMapName) return true;
          }
        }
      }

      // Check envFrom in containers
      const containers = [...(podSpec.containers || []), ...(podSpec.initContainers || [])];
      for (const container of containers) {
        // envFrom
        for (const envFrom of container.envFrom || []) {
          if (envFrom.configMapRef?.name === configMapName) return true;
        }
        // env valueFrom
        for (const env of container.env || []) {
          if (env.valueFrom?.configMapKeyRef?.name === configMapName) return true;
        }
      }
      
      return false;
    });
  };

  const usingPods = getUsingPods();

  const healthStatus: HealthStatus = 'healthy';

  // Handle label/annotation changes
  const handleAddLabel = async (key: string, value: string) => {
    setSaving(true);
    try {
      const updated = JSON.parse(JSON.stringify(configMap)) as V1ConfigMap;
      if (!updated.metadata) updated.metadata = {};
      if (!updated.metadata.labels) updated.metadata.labels = {};
      updated.metadata.labels[key] = value;
      await onApply(updated);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveLabel = async (key: string) => {
    setSaving(true);
    try {
      const updated = JSON.parse(JSON.stringify(configMap)) as V1ConfigMap;
      if (updated.metadata?.labels) {
        delete updated.metadata.labels[key];
      }
      await onApply(updated);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleAddAnnotation = async (key: string, value: string) => {
    setSaving(true);
    try {
      const updated = JSON.parse(JSON.stringify(configMap)) as V1ConfigMap;
      if (!updated.metadata) updated.metadata = {};
      if (!updated.metadata.annotations) updated.metadata.annotations = {};
      updated.metadata.annotations[key] = value;
      await onApply(updated);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveAnnotation = async (key: string) => {
    setSaving(true);
    try {
      const updated = JSON.parse(JSON.stringify(configMap)) as V1ConfigMap;
      if (updated.metadata?.annotations) {
        delete updated.metadata.annotations[key];
      }
      await onApply(updated);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <StatusBanner
        name={resource.name}
        namespace={metadata?.namespace}
        health={healthStatus}
        statusText={`${totalKeys} key${totalKeys !== 1 ? 's' : ''}`}
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader icon={<Key size={16} />} title="Data Keys" />
          <CardBody>
            <div className="text-2xl font-mono text-blue-400">{dataKeyCount}</div>
            <div className="text-xs text-slate-500">text entries</div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader icon={<FileText size={16} />} title="Binary Keys" />
          <CardBody>
            <div className="text-2xl font-mono text-purple-400">{binaryKeyCount}</div>
            <div className="text-xs text-slate-500">binary entries</div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader icon={<Box size={16} />} title="Used By" />
          <CardBody>
            <div className="text-2xl font-mono text-emerald-400">{usingPods.length}</div>
            <div className="text-xs text-slate-500">pod{usingPods.length !== 1 ? 's' : ''}</div>
          </CardBody>
        </Card>
      </div>

      {/* Pods using this ConfigMap */}
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
                const isReady = pod.raw?.status?.conditions?.find((c: any) => c.type === 'Ready' && c.status === 'True');
                
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

      {/* Metadata */}
      <MetadataCard metadata={metadata} showGeneration={false} />

      {/* Labels */}
      <LabelsCard 
        labels={metadata?.labels} 
        editable 
        onAdd={handleAddLabel}
        onRemove={handleRemoveLabel}
        saving={saving}
      />

      {/* Annotations */}
      <AnnotationsCard 
        annotations={metadata?.annotations} 
        editable 
        onAdd={handleAddAnnotation}
        onRemove={handleRemoveAnnotation}
        saving={saving}
      />
    </div>
  );
};
