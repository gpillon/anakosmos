import React, { useState } from 'react';
import type { ClusterResource } from '../../../../api/types';
import type { V1Deployment } from '../../../../api/k8s-types';
import { useClusterStore } from '../../../../store/useClusterStore';
import { useResourceDetailsStore } from '../../../../store/useResourceDetailsStore';
import { 
  Activity, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Tag,
  Calendar,
  GitBranch,
  Layers,
  ArrowUpCircle,
  ArrowDownCircle,
  Minus,
  Plus,
  Copy,
  Box
} from 'lucide-react';
import { clsx } from 'clsx';

interface Props {
  resource: ClusterResource;
  model: V1Deployment;
  updateModel: (updater: (current: V1Deployment) => V1Deployment) => void;
}

export const DeploymentOverview: React.FC<Props> = ({ resource, model, updateModel }) => {
  const spec = model.spec;
  const status = model.status;
  const metadata = model.metadata;

  // Store access for ReplicaSets
  const allResources = useClusterStore(state => state.resources);
  const openDetails = useResourceDetailsStore(state => state.openDetails);

  // UI editing states (not data states)
  const [editingStrategy, setEditingStrategy] = useState(false);
  const [editingHistoryLimit, setEditingHistoryLimit] = useState(false);
  const [editingLabels, setEditingLabels] = useState(false);
  const [editingAnnotations, setEditingAnnotations] = useState(false);
  const [newLabelKey, setNewLabelKey] = useState('');
  const [newLabelValue, setNewLabelValue] = useState('');
  const [newAnnotationKey, setNewAnnotationKey] = useState('');
  const [newAnnotationValue, setNewAnnotationValue] = useState('');

  // Local UI state for editing (will sync to model when needed)
  const [localStrategyType, setLocalStrategyType] = useState(spec?.strategy?.type || 'RollingUpdate');
  const [localMaxSurge, setLocalMaxSurge] = useState(spec?.strategy?.rollingUpdate?.maxSurge || '25%');
  const [localMaxUnavailable, setLocalMaxUnavailable] = useState(spec?.strategy?.rollingUpdate?.maxUnavailable || '25%');
  const [localRevisionHistoryLimit, setLocalRevisionHistoryLimit] = useState(spec?.revisionHistoryLimit ?? 10);

  const currentReplicas = spec?.replicas ?? 1;

  // Helper to update spec while preserving required fields
  const updateSpec = (updates: Record<string, unknown>) => {
    updateModel(current => ({
      ...current,
      spec: {
        ...current.spec,
        selector: current.spec?.selector || { matchLabels: {} },
        template: current.spec?.template || { spec: { containers: [] } },
        ...updates
      }
    }));
  };

  // Update replicas directly in model
  const handleReplicasChange = (newReplicas: number) => {
    updateSpec({ replicas: Math.max(0, newReplicas) });
  };

  // Apply strategy changes to model
  const handleApplyStrategy = () => {
    updateSpec({
      strategy: {
        type: localStrategyType as 'RollingUpdate' | 'Recreate',
        ...(localStrategyType === 'RollingUpdate' ? {
          rollingUpdate: {
            maxSurge: localMaxSurge,
            maxUnavailable: localMaxUnavailable
          }
        } : {})
      }
    });
    setEditingStrategy(false);
  };

  // Apply history limit to model
  const handleApplyHistoryLimit = () => {
    const limit = parseInt(String(localRevisionHistoryLimit), 10);
    if (!isNaN(limit)) {
      updateSpec({ revisionHistoryLimit: limit });
    }
    setEditingHistoryLimit(false);
  };

  // Label management
  const handleAddLabel = () => {
    if (!newLabelKey.trim()) return;
    updateModel(current => ({
      ...current,
      metadata: {
        ...current.metadata,
        labels: {
          ...current.metadata?.labels,
          [newLabelKey]: newLabelValue
        }
      }
    }));
    setNewLabelKey('');
    setNewLabelValue('');
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

  // Annotation management
  const handleAddAnnotation = () => {
    if (!newAnnotationKey.trim()) return;
    updateModel(current => ({
      ...current,
      metadata: {
        ...current.metadata,
        annotations: {
          ...current.metadata?.annotations,
          [newAnnotationKey]: newAnnotationValue
        }
      }
    }));
    setNewAnnotationKey('');
    setNewAnnotationValue('');
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

  // Helper to get ReplicaSets and Pods
  const getRelatedResources = () => {
    const replicaSets = Object.values(allResources).filter(r => 
      r.kind === 'ReplicaSet' && 
      r.namespace === resource.namespace &&
      r.ownerRefs.includes(resource.id)
    ).sort((a, b) => {
      const revA = parseInt(a.raw?.metadata?.annotations?.['deployment.kubernetes.io/revision'] || '0');
      const revB = parseInt(b.raw?.metadata?.annotations?.['deployment.kubernetes.io/revision'] || '0');
      return revB - revA;
    });

    const rsWithPods = replicaSets.map(rs => {
      const pods = Object.values(allResources).filter(p => 
        p.kind === 'Pod' && 
        p.ownerRefs.includes(rs.id)
      );
      return { rs, pods };
    });

    return rsWithPods;
  };

  const rsList = getRelatedResources();

  // Status calculation
  const readyReplicas = status?.readyReplicas || 0;
  const availableReplicas = status?.availableReplicas || 0;
  const unavailableReplicas = status?.unavailableReplicas || 0;
  const updatedReplicas = status?.updatedReplicas || 0;

  const healthStatus = readyReplicas === currentReplicas
    ? 'healthy' 
    : readyReplicas > 0 
      ? 'warning' 
      : currentReplicas === 0 ? 'healthy' : 'error';

  const strategy = spec?.strategy || {};
  const conditions = status?.conditions || [];

  return (
    <div className="space-y-6">
      {/* Status Banner */}
      <div className={clsx(
        "rounded-xl p-6 border backdrop-blur-sm",
        healthStatus === 'healthy' && "bg-emerald-950/30 border-emerald-800/50",
        healthStatus === 'warning' && "bg-amber-950/30 border-amber-800/50",
        healthStatus === 'error' && "bg-red-950/30 border-red-800/50"
      )}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={clsx(
              "w-16 h-16 rounded-xl flex items-center justify-center",
              healthStatus === 'healthy' && "bg-emerald-500/20 text-emerald-400",
              healthStatus === 'warning' && "bg-amber-500/20 text-amber-400",
              healthStatus === 'error' && "bg-red-500/20 text-red-400"
            )}>
              {healthStatus === 'healthy' ? <CheckCircle2 size={32} /> : 
               healthStatus === 'warning' ? <AlertCircle size={32} /> : 
               <XCircle size={32} />}
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">{resource.name}</h2>
              <p className="text-sm text-slate-400 mt-1">
                {metadata?.namespace} • {healthStatus === 'healthy' ? 'All replicas ready' : 
                 healthStatus === 'warning' ? 'Some replicas not ready' : 
                 'No replicas available'}
              </p>
            </div>
          </div>

          {/* Quick Scale */}
          <div className="flex items-center gap-3 bg-slate-900/50 rounded-lg p-2 border border-slate-700">
            <button 
              onClick={() => handleReplicasChange((spec?.replicas ?? 1) - 1)}
              className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 transition-colors"
            >
              <Minus size={16} />
            </button>
            <div className="text-center min-w-[3rem]">
              <div className="text-xl font-bold text-white">{spec?.replicas ?? 1}</div>
              <div className="text-[10px] text-slate-500 uppercase">Replicas</div>
            </div>
            <button 
              onClick={() => handleReplicasChange((spec?.replicas ?? 1) + 1)}
              className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 transition-colors"
            >
              <Plus size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard 
          icon={<CheckCircle2 className="text-emerald-400" />} 
          label="Ready" 
          value={`${readyReplicas}/${currentReplicas}`} 
          color="emerald"
        />
        <StatCard 
          icon={<Activity className="text-blue-400" />} 
          label="Available" 
          value={availableReplicas} 
          color="blue"
        />
        <StatCard 
          icon={<ArrowUpCircle className="text-purple-400" />} 
          label="Updated" 
          value={updatedReplicas} 
          color="purple"
        />
        <StatCard 
          icon={<ArrowDownCircle className="text-red-400" />} 
          label="Unavailable" 
          value={unavailableReplicas} 
          color="red"
        />
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Metadata Card */}
        <div className="bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden">
          <div className="px-4 py-3 bg-slate-800/50 border-b border-slate-700 flex items-center gap-2">
            <Calendar size={16} className="text-slate-400" />
            <span className="font-semibold text-slate-200">Metadata</span>
          </div>
          <div className="p-4 space-y-3 text-sm">
            <MetaRow label="Namespace" value={metadata?.namespace} />
            <MetaRow label="Created" value={formatDate(metadata?.creationTimestamp)} />
            <MetaRow label="Generation" value={metadata?.generation} />
            <MetaRow label="Resource Version" value={metadata?.resourceVersion} />
            <MetaRow label="UID" value={metadata?.uid} mono />
          </div>
        </div>

        {/* Strategy Card */}
        <div className="bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden">
          <div className="px-4 py-3 bg-slate-800/50 border-b border-slate-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
            <GitBranch size={16} className="text-slate-400" />
            <span className="font-semibold text-slate-200">Update Strategy</span>
            </div>
            <button
              onClick={() => setEditingStrategy(!editingStrategy)}
              className="text-xs text-blue-400 hover:text-blue-300"
            >
              {editingStrategy ? 'Cancel' : 'Edit'}
            </button>
          </div>
          
          <div className="p-4 space-y-3 text-sm">
            {editingStrategy ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs text-slate-500 uppercase font-bold">Type</label>
                  <select
                    value={localStrategyType}
                    onChange={(e) => setLocalStrategyType(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="RollingUpdate">RollingUpdate</option>
                    <option value="Recreate">Recreate</option>
                  </select>
                </div>

                {localStrategyType === 'RollingUpdate' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs text-slate-500 uppercase font-bold">Max Unavailable</label>
                      <input
                        type="text"
                        value={localMaxUnavailable}
                        onChange={(e) => setLocalMaxUnavailable(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs text-slate-500 uppercase font-bold">Max Surge</label>
                      <input
                        type="text"
                        value={localMaxSurge}
                        onChange={(e) => setLocalMaxSurge(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                )}

                <div className="flex justify-end pt-2">
                  <button
                    onClick={handleApplyStrategy}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded transition-colors"
                  >
                    Apply
                  </button>
                </div>
              </div>
            ) : (
              <>
            <MetaRow label="Type" value={strategy.type || 'RollingUpdate'} />
            {strategy.type === 'RollingUpdate' && strategy.rollingUpdate && (
              <>
                <MetaRow label="Max Unavailable" value={strategy.rollingUpdate.maxUnavailable} />
                <MetaRow label="Max Surge" value={strategy.rollingUpdate.maxSurge} />
              </>
            )}
            <MetaRow label="Min Ready Seconds" value={spec?.minReadySeconds || 0} />
            <MetaRow label="Progress Deadline" value={`${spec?.progressDeadlineSeconds || 600}s`} />
              </>
            )}
          </div>
        </div>
      </div>

      {/* ReplicaSets Section */}
      <div className="bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden">
        <div className="px-4 py-3 bg-slate-800/50 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Copy size={16} className="text-slate-400" />
            <span className="font-semibold text-slate-200">ReplicaSets History</span>
            <span className="text-xs text-slate-500 ml-2">
              (Limit: {spec?.revisionHistoryLimit ?? 10})
            </span>
          </div>
          <button
            onClick={() => setEditingHistoryLimit(!editingHistoryLimit)}
            className="text-xs text-blue-400 hover:text-blue-300"
          >
            {editingHistoryLimit ? 'Cancel' : 'Edit'}
          </button>
        </div>
        
        {editingHistoryLimit && (
          <div className="p-4 bg-slate-800/20 border-b border-slate-800">
            <div className="flex items-end gap-3">
              <div className="flex-1 space-y-2">
                <label className="text-xs text-slate-500 uppercase font-bold">Revision History Limit</label>
                <input
                  type="number"
                  value={localRevisionHistoryLimit}
                  onChange={(e) => setLocalRevisionHistoryLimit(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <button
                onClick={handleApplyHistoryLimit}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded transition-colors h-[34px]"
              >
                Apply
              </button>
            </div>
          </div>
        )}

        <div className="divide-y divide-slate-800">
          {rsList.length > 0 ? (
            rsList.map(({ rs, pods }) => {
              const revision = rs.raw?.metadata?.annotations?.['deployment.kubernetes.io/revision'];
              const isCurrent = revision === metadata?.annotations?.['deployment.kubernetes.io/revision'];
              const hasPods = pods.length > 0;

              return (
                <div key={rs.id} className={clsx("px-4 py-3 transition-colors hover:bg-slate-800/30", !hasPods && "py-2")}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={clsx("font-mono text-sm", isCurrent ? "text-emerald-400 font-bold" : "text-slate-300")}>
                          {rs.name}
                        </span>
                        {revision && (
                          <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded border border-slate-700">
                            Rev: {revision}
                          </span>
                        )}
                        {isCurrent && (
                          <span className="text-[10px] bg-emerald-900/30 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-800/30">
                            Active
                          </span>
                        )}
                      </div>
                      
                      {/* Pods Grid */}
                      {hasPods ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {pods.map(pod => {
                            const podPhase = pod.status as string;
                            const isReady = pod.raw?.status?.conditions?.find((c: { type: string; status: string }) => c.type === 'Ready' && c.status === 'True');
                            const shortName = pod.name.replace(rs.name + '-', '');
                            
                            return (
                              <button 
                                key={pod.id}
                                onClick={() => openDetails(pod.id)}
                                className={clsx(
                                  "flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs font-mono transition-all cursor-pointer",
                                  "hover:scale-105 hover:shadow-lg",
                                  podPhase === 'Running' && isReady 
                                    ? "bg-emerald-900/30 border-emerald-700/50 text-emerald-300 hover:bg-emerald-900/50 hover:border-emerald-600" 
                                    : podPhase === 'Running' 
                                    ? "bg-blue-900/30 border-blue-700/50 text-blue-300 hover:bg-blue-900/50 hover:border-blue-600" 
                                    : podPhase === 'Pending' 
                                    ? "bg-amber-900/30 border-amber-700/50 text-amber-300 hover:bg-amber-900/50 hover:border-amber-600" 
                                    : "bg-red-900/30 border-red-700/50 text-red-300 hover:bg-red-900/50 hover:border-red-600"
                                )}
                                title={`${pod.name} (${podPhase}${isReady ? ', Ready' : ''})`}
                              >
                                <Box size={12} />
                                <span className="truncate max-w-[80px]">{shortName}</span>
                                <span className={clsx(
                                  "w-2 h-2 rounded-full shrink-0",
                                  podPhase === 'Running' && isReady ? "bg-emerald-400" :
                                  podPhase === 'Running' ? "bg-blue-400" :
                                  podPhase === 'Pending' ? "bg-amber-400 animate-pulse" :
                                  "bg-red-400"
                                )} />
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-[10px] text-slate-600 mt-0.5">0 pods</div>
                      )}
                    </div>
                    
                    <div className="text-xs text-slate-500 whitespace-nowrap">
                      {formatDate(rs.raw?.metadata?.creationTimestamp)}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-4 text-center text-slate-500 text-sm">
              No ReplicaSets found
            </div>
          )}
        </div>
      </div>

      {/* Labels Section */}
      <div className="bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden">
        <div className="px-4 py-3 bg-slate-800/50 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Tag size={16} className="text-slate-400" />
            <span className="font-semibold text-slate-200">Labels</span>
          </div>
          <button
            onClick={() => setEditingLabels(!editingLabels)}
            className="text-xs text-blue-400 hover:text-blue-300"
          >
            {editingLabels ? 'Done' : 'Edit'}
          </button>
        </div>
        <div className="p-4">
          <div className="flex flex-wrap gap-2">
            {Object.entries(metadata?.labels || {}).map(([key, value]) => (
              <span key={key} className="group flex items-center gap-1 bg-slate-800 text-slate-300 px-2 py-1 rounded-lg text-xs font-mono border border-slate-700">
                <span className="text-blue-400">{key}</span>
                <span className="text-slate-500">=</span>
                <span>{String(value)}</span>
                {editingLabels && !key.includes('kubernetes.io') && (
                  <button
                    onClick={() => handleRemoveLabel(key)}
                    className="ml-1 text-red-400 hover:text-red-300 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <XCircle size={12} />
                  </button>
                )}
              </span>
            ))}
          </div>
          {editingLabels && (
            <div className="mt-3 flex gap-2">
              <input
                type="text"
                placeholder="Key"
                value={newLabelKey}
                onChange={(e) => setNewLabelKey(e.target.value)}
                className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
              <input
                type="text"
                placeholder="Value"
                value={newLabelValue}
                onChange={(e) => setNewLabelValue(e.target.value)}
                className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={handleAddLabel}
                disabled={!newLabelKey.trim()}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-medium rounded transition-colors"
              >
                Add
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Annotations Section */}
      <div className="bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden">
        <div className="px-4 py-3 bg-slate-800/50 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers size={16} className="text-slate-400" />
            <span className="font-semibold text-slate-200">Annotations</span>
          </div>
          <button
            onClick={() => setEditingAnnotations(!editingAnnotations)}
            className="text-xs text-blue-400 hover:text-blue-300"
          >
            {editingAnnotations ? 'Done' : 'Edit'}
          </button>
        </div>
        <div className="p-4">
          {Object.entries(metadata?.annotations || {}).length > 0 ? (
            <div className="space-y-2">
              {Object.entries(metadata?.annotations || {}).map(([key, value]) => (
                <div key={key} className="group flex items-start gap-2 bg-slate-800/50 p-2 rounded border border-slate-700">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-blue-400 font-mono truncate">{key}</div>
                    <div className="text-xs text-slate-300 font-mono mt-1 break-all">{String(value)}</div>
                  </div>
                  {editingAnnotations && !key.includes('kubernetes.io') && !key.includes('kubectl') && (
                    <button
                      onClick={() => handleRemoveAnnotation(key)}
                      className="text-red-400 hover:text-red-300 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    >
                      <XCircle size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-slate-500 text-sm">No annotations</div>
          )}
          {editingAnnotations && (
            <div className="mt-3 flex gap-2">
              <input
                type="text"
                placeholder="Key"
                value={newAnnotationKey}
                onChange={(e) => setNewAnnotationKey(e.target.value)}
                className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
              <input
                type="text"
                placeholder="Value"
                value={newAnnotationValue}
                onChange={(e) => setNewAnnotationValue(e.target.value)}
                className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={handleAddAnnotation}
                disabled={!newAnnotationKey.trim()}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-medium rounded transition-colors"
              >
                Add
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Conditions */}
      {conditions.length > 0 && (
        <div className="bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden">
          <div className="px-4 py-3 bg-slate-800/50 border-b border-slate-700 flex items-center gap-2">
            <Activity size={16} className="text-slate-400" />
            <span className="font-semibold text-slate-200">Conditions</span>
          </div>
          <div className="divide-y divide-slate-800">
            {conditions.map((c, i: number) => (
              <div key={i} className="px-4 py-3 flex items-center gap-4">
                <div className={clsx(
                  "w-2 h-2 rounded-full shrink-0",
                  c.status === 'True' ? 'bg-emerald-400' : 'bg-red-400'
                )} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-200 text-sm">{c.type}</span>
                    <span className={clsx(
                      "text-xs px-1.5 py-0.5 rounded",
                      c.status === 'True' ? 'bg-emerald-900/50 text-emerald-400' : 'bg-red-900/50 text-red-400'
                    )}>
                      {c.status}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1">{c.message}</div>
                </div>
                <div className="text-xs text-slate-600 shrink-0">
                  {formatDate(c.lastUpdateTime || c.lastTransitionTime)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Helper Components
const StatCard: React.FC<{ icon: React.ReactNode; label: string; value: string | number; color: string }> = ({ icon, label, value }) => (
  <div className="bg-slate-900/50 rounded-xl border border-slate-800 p-4">
    <div className="flex items-center gap-3">
      <div className="p-2 rounded-lg bg-slate-800">{icon}</div>
      <div>
        <div className="text-2xl font-bold text-white">{value}</div>
        <div className="text-xs text-slate-500 uppercase tracking-wider">{label}</div>
      </div>
    </div>
  </div>
);

const MetaRow: React.FC<{ label: string; value: string | number | undefined; mono?: boolean }> = ({ label, value, mono }) => (
  <div className="flex justify-between items-center">
    <span className="text-slate-500">{label}</span>
    <span className={clsx("text-slate-200 truncate max-w-[60%]", mono && "font-mono text-xs")}>{value ?? '-'}</span>
  </div>
);

function formatDate(dateStr: string | Date | undefined): string {
  if (!dateStr) return '-';
  try {
    if (dateStr instanceof Date) {
      return dateStr.toLocaleString();
    }
    return new Date(dateStr).toLocaleString();
  } catch {
    return String(dateStr);
  }
}
