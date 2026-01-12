import React, { useState } from 'react';
import type { ClusterResource } from '../../../../api/types';
import { useClusterStore } from '../../../../store/useClusterStore';
import { 
  Activity, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Scale,
  RefreshCw,
  Tag,
  Calendar,
  GitBranch,
  Layers,
  ArrowUpCircle,
  ArrowDownCircle,
  Minus,
  Plus,
  Copy
} from 'lucide-react';
import { clsx } from 'clsx';

interface Props {
  resource: ClusterResource;
  onApply: (updatedRaw: any) => Promise<void>;
}

export const DeploymentOverview: React.FC<Props> = ({ resource, onApply }) => {
  const raw = resource.raw;
  const spec = raw?.spec || {};
  const status = raw?.status || {};
  const metadata = raw?.metadata || {};

  // Store access for ReplicaSets
  const allResources = useClusterStore(state => state.resources);

  const [replicas, setReplicas] = useState(spec.replicas || 1);
  const [saving, setSaving] = useState(false);
  
  // Strategy State
  const [editingStrategy, setEditingStrategy] = useState(false);
  const [strategyType, setStrategyType] = useState(spec.strategy?.type || 'RollingUpdate');
  const [maxSurge, setMaxSurge] = useState(spec.strategy?.rollingUpdate?.maxSurge || '25%');
  const [maxUnavailable, setMaxUnavailable] = useState(spec.strategy?.rollingUpdate?.maxUnavailable || '25%');
  
  // History Limit State
  const [editingHistoryLimit, setEditingHistoryLimit] = useState(false);
  const [revisionHistoryLimit, setRevisionHistoryLimit] = useState(spec.revisionHistoryLimit ?? 10);

  const [editingLabels, setEditingLabels] = useState(false);
  const [editingAnnotations, setEditingAnnotations] = useState(false);
  const [newLabelKey, setNewLabelKey] = useState('');
  const [newLabelValue, setNewLabelValue] = useState('');
  const [newAnnotationKey, setNewAnnotationKey] = useState('');
  const [newAnnotationValue, setNewAnnotationValue] = useState('');

  const currentReplicas = spec.replicas || 1;

  const handleScale = async () => {
    if (replicas === currentReplicas) return;
    setSaving(true);
    try {
      const updated = JSON.parse(JSON.stringify(raw));
      updated.spec.replicas = replicas;
      await onApply(updated);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleAddLabel = async () => {
    if (!newLabelKey.trim()) return;
    setSaving(true);
    try {
      const updated = JSON.parse(JSON.stringify(raw));
      if (!updated.metadata.labels) updated.metadata.labels = {};
      updated.metadata.labels[newLabelKey] = newLabelValue;
      await onApply(updated);
      setNewLabelKey('');
      setNewLabelValue('');
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveLabel = async (key: string) => {
    setSaving(true);
    try {
      const updated = JSON.parse(JSON.stringify(raw));
      delete updated.metadata.labels[key];
      await onApply(updated);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleAddAnnotation = async () => {
    if (!newAnnotationKey.trim()) return;
    setSaving(true);
    try {
      const updated = JSON.parse(JSON.stringify(raw));
      if (!updated.metadata.annotations) updated.metadata.annotations = {};
      updated.metadata.annotations[newAnnotationKey] = newAnnotationValue;
      await onApply(updated);
      setNewAnnotationKey('');
      setNewAnnotationValue('');
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveAnnotation = async (key: string) => {
    setSaving(true);
    try {
      const updated = JSON.parse(JSON.stringify(raw));
      delete updated.metadata.annotations[key];
      await onApply(updated);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveStrategy = async () => {
    setSaving(true);
    try {
      const updated = JSON.parse(JSON.stringify(raw));
      
      // Update Strategy
      updated.spec.strategy = {
        type: strategyType,
      };
      
      if (strategyType === 'RollingUpdate') {
        updated.spec.strategy.rollingUpdate = {
          maxSurge: maxSurge,
          maxUnavailable: maxUnavailable
        };
      }

      await onApply(updated);
      setEditingStrategy(false);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveHistoryLimit = async () => {
    setSaving(true);
    try {
      const updated = JSON.parse(JSON.stringify(raw));
      
      // Update Revision History Limit
      // Ensure it's a number
      const limit = parseInt(String(revisionHistoryLimit), 10);
      if (!isNaN(limit)) {
        updated.spec.revisionHistoryLimit = limit;
      }

      await onApply(updated);
      setEditingHistoryLimit(false);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  // Helper to get ReplicaSets and Pods
  const getRelatedResources = () => {
    const replicaSets = Object.values(allResources).filter(r => 
      r.kind === 'ReplicaSet' && 
      r.namespace === resource.namespace &&
      r.ownerRefs.includes(resource.id)
    ).sort((a, b) => {
      // Sort by revision descending
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
  const readyReplicas = status.readyReplicas || 0;
  const availableReplicas = status.availableReplicas || 0;
  const unavailableReplicas = status.unavailableReplicas || 0;
  const updatedReplicas = status.updatedReplicas || 0;

  const healthStatus = readyReplicas === currentReplicas && currentReplicas > 0 
    ? 'healthy' 
    : readyReplicas > 0 
      ? 'warning' 
      : 'error';

  const strategy = spec.strategy || {};
  const conditions = status.conditions || [];

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
                {metadata.namespace} • {healthStatus === 'healthy' ? 'All replicas ready' : 
                 healthStatus === 'warning' ? 'Some replicas not ready' : 
                 'No replicas available'}
              </p>
            </div>
          </div>

          {/* Quick Scale */}
          <div className="flex items-center gap-3 bg-slate-900/50 rounded-lg p-2 border border-slate-700">
            {replicas !== currentReplicas && (
              <button
                onClick={handleScale}
                disabled={saving}
                className="mr-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-2"
              >
                {saving ? <RefreshCw className="animate-spin" size={12} /> : <Scale size={12} />}
                Apply
              </button>
            )}
            <button 
              onClick={() => setReplicas(Math.max(0, replicas - 1))}
              className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 transition-colors"
            >
              <Minus size={16} />
            </button>
            <div className="text-center min-w-[3rem]">
              <div className="text-xl font-bold text-white">{replicas}</div>
              <div className="text-[10px] text-slate-500 uppercase">Replicas</div>
            </div>
            <button 
              onClick={() => setReplicas(replicas + 1)}
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
            <MetaRow label="Namespace" value={metadata.namespace} />
            <MetaRow label="Created" value={formatDate(metadata.creationTimestamp)} />
            <MetaRow label="Generation" value={metadata.generation} />
            <MetaRow label="Resource Version" value={metadata.resourceVersion} />
            <MetaRow label="UID" value={metadata.uid} mono />
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
                    value={strategyType}
                    onChange={(e) => setStrategyType(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="RollingUpdate">RollingUpdate</option>
                    <option value="Recreate">Recreate</option>
                  </select>
                </div>

                {strategyType === 'RollingUpdate' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs text-slate-500 uppercase font-bold">Max Unavailable</label>
                      <input
                        type="text"
                        value={maxUnavailable}
                        onChange={(e) => setMaxUnavailable(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs text-slate-500 uppercase font-bold">Max Surge</label>
                      <input
                        type="text"
                        value={maxSurge}
                        onChange={(e) => setMaxSurge(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                )}

                <div className="flex justify-end pt-2">
                  <button
                    onClick={handleSaveStrategy}
                    disabled={saving}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold rounded transition-colors flex items-center gap-2"
                  >
                    {saving && <RefreshCw className="animate-spin" size={12} />}
                    Save Changes
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
                <MetaRow label="Min Ready Seconds" value={spec.minReadySeconds || 0} />
                <MetaRow label="Progress Deadline" value={`${spec.progressDeadlineSeconds || 600}s`} />
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
              (Limit: {spec.revisionHistoryLimit ?? 10})
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
                  value={revisionHistoryLimit}
                  onChange={(e) => setRevisionHistoryLimit(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <button
                onClick={handleSaveHistoryLimit}
                disabled={saving}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold rounded transition-colors flex items-center gap-2 h-[34px]"
              >
                {saving && <RefreshCw className="animate-spin" size={12} />}
                Save
              </button>
            </div>
          </div>
        )}

        <div className="divide-y divide-slate-800">
          {rsList.length > 0 ? (
            rsList.map(({ rs, pods }) => {
              const revision = rs.raw?.metadata?.annotations?.['deployment.kubernetes.io/revision'];
              const isCurrent = revision === metadata.annotations?.['deployment.kubernetes.io/revision'];
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
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {pods.map(pod => {
                            const podPhase = pod.status as string; // 'Running', 'Pending', etc.
                            const isReady = pod.raw?.status?.conditions?.find((c: any) => c.type === 'Ready' && c.status === 'True');
                            
                            return (
                              <div 
                                key={pod.id} 
                                className={clsx(
                                  "w-3 h-3 rounded-full border",
                                  podPhase === 'Running' && isReady ? "bg-emerald-500 border-emerald-400" :
                                  podPhase === 'Running' ? "bg-blue-500 border-blue-400" :
                                  podPhase === 'Pending' ? "bg-amber-500 border-amber-400" :
                                  "bg-red-500 border-red-400"
                                )}
                                title={`${pod.name} (${podPhase})`}
                              />
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
            {Object.entries(metadata.labels || {}).map(([key, value]) => (
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
                disabled={!newLabelKey.trim() || saving}
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
          {Object.entries(metadata.annotations || {}).length > 0 ? (
            <div className="space-y-2">
              {Object.entries(metadata.annotations || {}).map(([key, value]) => (
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
                disabled={!newAnnotationKey.trim() || saving}
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
            {conditions.map((c: any, i: number) => (
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
const StatCard: React.FC<{ icon: React.ReactNode; label: string; value: any; color: string }> = ({ icon, label, value }) => (
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

const MetaRow: React.FC<{ label: string; value: any; mono?: boolean }> = ({ label, value, mono }) => (
  <div className="flex justify-between items-center">
    <span className="text-slate-500">{label}</span>
    <span className={clsx("text-slate-200 truncate max-w-[60%]", mono && "font-mono text-xs")}>{value || '-'}</span>
  </div>
);

function formatDate(dateStr: string): string {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleString();
  } catch {
    return dateStr;
  }
}
