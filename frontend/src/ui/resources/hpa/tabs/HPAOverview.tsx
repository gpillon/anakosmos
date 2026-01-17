import React, { useMemo, useState } from 'react';
import type { ClusterResource } from '../../../../api/types';
import type { V2HorizontalPodAutoscaler, V2HorizontalPodAutoscalerCondition } from '../../../../api/k8s-types';
import { useClusterStore } from '../../../../store/useClusterStore';
import { useResourceDetailsStore } from '../../../../store/useResourceDetailsStore';
import {
  Card, CardHeader, CardBody, MetadataCard, LabelsCard, AnnotationsCard,
  ConditionsCard, StatusBanner,
} from '../../shared';
import type { HealthStatus } from '../../shared';
import { Activity, Target, TrendingUp, TrendingDown, Layers, Edit2, Check, X, Minus, Plus } from 'lucide-react';

interface HPAOverviewProps {
  resource: ClusterResource;
  model: V2HorizontalPodAutoscaler;
  updateModel: (updater: (current: V2HorizontalPodAutoscaler) => V2HorizontalPodAutoscaler) => void;
}

export const HPAOverview: React.FC<HPAOverviewProps> = ({ resource, model, updateModel }) => {
  const resources = useClusterStore(state => state.resources);
  const openDetails = useResourceDetailsStore(state => state.openDetails);

  const spec = model.spec;
  const status = model.status;

  // Local UI editing states
  const [isEditingReplicas, setIsEditingReplicas] = useState(false);
  const [localMinReplicas, setLocalMinReplicas] = useState(spec?.minReplicas ?? 1);
  const [localMaxReplicas, setLocalMaxReplicas] = useState(spec?.maxReplicas ?? 10);

  // Status
  const conditions = (status?.conditions || []) as V2HorizontalPodAutoscalerCondition[];
  const ableCond = conditions.find(c => c.type === 'AbleToScale');
  const scalingActiveCond = conditions.find(c => c.type === 'ScalingActive');
  const scalingLimitedCond = conditions.find(c => c.type === 'ScalingLimited');

  let healthStatus: HealthStatus = 'unknown';
  let statusText = 'Unknown';
  
  if (ableCond?.status === 'True' && scalingActiveCond?.status === 'True') {
    healthStatus = 'healthy';
    statusText = 'Active';
  } else if (ableCond?.status === 'True') {
    healthStatus = 'unknown';
    statusText = 'Ready';
  } else if (ableCond?.status === 'False') {
    healthStatus = 'error';
    statusText = 'Unable to Scale';
  }

  if (scalingLimitedCond?.status === 'True') {
    healthStatus = 'warning';
    statusText = 'Scaling Limited';
  }

  // Current/Desired
  const currentReplicas = status?.currentReplicas ?? 0;
  const desiredReplicas = status?.desiredReplicas ?? 0;

  // Find target resource
  const targetRef = spec?.scaleTargetRef;
  const targetResource = useMemo(() => {
    if (!targetRef) return null;
    return Object.values(resources).find(r => 
      r.kind === targetRef.kind && 
      r.name === targetRef.name &&
      r.namespace === resource.namespace
    );
  }, [resources, targetRef, resource.namespace]);

  const handleSaveReplicas = () => {
    updateModel(current => ({
      ...current,
      spec: {
        ...current.spec!,
        minReplicas: localMinReplicas,
        maxReplicas: localMaxReplicas
      }
    }));
    setIsEditingReplicas(false);
  };

  return (
    <div className="space-y-6">
      {/* Status Banner */}
      <StatusBanner 
        name={resource.name}
        namespace={resource.namespace}
        health={healthStatus} 
        statusText={statusText}
      >
        {ableCond?.message && <p>{ableCond.message}</p>}
        {scalingLimitedCond?.status === 'True' && scalingLimitedCond.message && (
          <p className="text-amber-400">{scalingLimitedCond.message}</p>
        )}
      </StatusBanner>

      {/* Current State */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-900/50 rounded-lg border border-slate-800 p-4 text-center">
          <div className="text-3xl font-bold text-blue-400">{currentReplicas}</div>
          <div className="text-xs text-slate-500">Current Replicas</div>
        </div>
        <div className="bg-slate-900/50 rounded-lg border border-slate-800 p-4 text-center">
          <div className="text-3xl font-bold text-emerald-400">{desiredReplicas}</div>
          <div className="text-xs text-slate-500">Desired Replicas</div>
        </div>
        <div className="bg-slate-900/50 rounded-lg border border-slate-800 p-4 text-center">
          <div className="text-3xl font-bold text-cyan-400">{spec?.minReplicas ?? 1}</div>
          <div className="text-xs text-slate-500">Min Replicas</div>
        </div>
        <div className="bg-slate-900/50 rounded-lg border border-slate-800 p-4 text-center">
          <div className="text-3xl font-bold text-purple-400">{spec?.maxReplicas ?? 10}</div>
          <div className="text-xs text-slate-500">Max Replicas</div>
        </div>
      </div>

      {/* Scale Target */}
      <Card>
        <CardHeader title="Scale Target" icon={<Target size={16} />} />
        <CardBody>
          {targetRef && (
            <div className="flex items-center gap-4">
              {targetResource ? (
                <button
                  onClick={() => openDetails(targetResource.id)}
                  className="flex items-center gap-3 px-4 py-3 bg-purple-900/30 hover:bg-purple-900/50 border border-purple-700/50 rounded-lg transition-colors"
                >
                  <Layers size={18} className="text-purple-400" />
                  <div className="text-left">
                    <div className="text-sm font-medium text-slate-200">{targetRef.name}</div>
                    <div className="text-xs text-slate-500">{targetRef.kind}</div>
                  </div>
                </button>
              ) : (
                <div className="flex items-center gap-3 px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-lg">
                  <Layers size={18} className="text-slate-400" />
                  <div className="text-left">
                    <div className="text-sm font-medium text-slate-200">{targetRef.name}</div>
                    <div className="text-xs text-slate-500">{targetRef.kind} (not found)</div>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Replica Limits */}
      <Card>
        <CardHeader 
          title="Replica Limits" 
          icon={<Activity size={16} />}
          action={
            !isEditingReplicas ? (
              <button 
                onClick={() => setIsEditingReplicas(true)}
                className="text-blue-400 hover:text-blue-300 p-1"
              >
                <Edit2 size={14} />
              </button>
            ) : null
          }
        />
        <CardBody>
          {isEditingReplicas ? (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <span className="text-sm text-slate-400 w-24">Min Replicas:</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setLocalMinReplicas(Math.max(0, localMinReplicas - 1))}
                    className="p-1.5 bg-slate-700 hover:bg-slate-600 rounded"
                  >
                    <Minus size={14} />
                  </button>
                  <input
                    type="number"
                    value={localMinReplicas}
                    onChange={(e) => setLocalMinReplicas(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-20 bg-slate-800 border border-slate-700 rounded px-3 py-1 text-center text-slate-200"
                  />
                  <button
                    onClick={() => setLocalMinReplicas(localMinReplicas + 1)}
                    className="p-1.5 bg-slate-700 hover:bg-slate-600 rounded"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm text-slate-400 w-24">Max Replicas:</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setLocalMaxReplicas(Math.max(1, localMaxReplicas - 1))}
                    className="p-1.5 bg-slate-700 hover:bg-slate-600 rounded"
                  >
                    <Minus size={14} />
                  </button>
                  <input
                    type="number"
                    value={localMaxReplicas}
                    onChange={(e) => setLocalMaxReplicas(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-20 bg-slate-800 border border-slate-700 rounded px-3 py-1 text-center text-slate-200"
                  />
                  <button
                    onClick={() => setLocalMaxReplicas(localMaxReplicas + 1)}
                    className="p-1.5 bg-slate-700 hover:bg-slate-600 rounded"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <button
                  onClick={handleSaveReplicas}
                  className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded text-white text-sm"
                >
                  <Check size={14} />
                  Apply
                </button>
                <button
                  onClick={() => {
                    setLocalMinReplicas(spec?.minReplicas ?? 1);
                    setLocalMaxReplicas(spec?.maxReplicas ?? 10);
                    setIsEditingReplicas(false);
                  }}
                  className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-slate-300 text-sm"
                >
                  <X size={14} />
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-2">
                <TrendingDown size={16} className="text-cyan-400" />
                <span className="text-sm text-slate-400">Min:</span>
                <span className="text-lg font-bold text-slate-200">{spec?.minReplicas ?? 1}</span>
              </div>
              <div className="flex items-center gap-2">
                <TrendingUp size={16} className="text-purple-400" />
                <span className="text-sm text-slate-400">Max:</span>
                <span className="text-lg font-bold text-slate-200">{spec?.maxReplicas ?? 10}</span>
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Metadata */}
      <MetadataCard metadata={model.metadata} />

      {/* Labels */}
      <LabelsCard 
        labels={model.metadata?.labels}
        editable
        onAdd={(key, value) => {
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
        }}
        onRemove={(key) => {
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
        }}
      />

      {/* Annotations */}
      <AnnotationsCard 
        annotations={model.metadata?.annotations}
        editable
        onAdd={(key, value) => {
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
        }}
        onRemove={(key) => {
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
        }}
      />

      {/* Conditions */}
      {conditions.length > 0 && (
        <ConditionsCard 
          conditions={conditions.map(c => ({
            type: c.type || '',
            status: c.status || '',
            reason: c.reason,
            message: c.message,
            lastTransitionTime: c.lastTransitionTime ? String(c.lastTransitionTime) : undefined,
          }))} 
        />
      )}
    </div>
  );
};
