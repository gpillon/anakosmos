import React, { useState } from 'react';
import type { ClusterResource } from '../../../../api/types';
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
  Plus
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

  const [replicas, setReplicas] = useState(spec.replicas || 1);
  const [saving, setSaving] = useState(false);
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
            {replicas !== currentReplicas && (
              <button
                onClick={handleScale}
                disabled={saving}
                className="ml-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-2"
              >
                {saving ? <RefreshCw className="animate-spin" size={12} /> : <Scale size={12} />}
                Apply
              </button>
            )}
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
          <div className="px-4 py-3 bg-slate-800/50 border-b border-slate-700 flex items-center gap-2">
            <GitBranch size={16} className="text-slate-400" />
            <span className="font-semibold text-slate-200">Update Strategy</span>
          </div>
          <div className="p-4 space-y-3 text-sm">
            <MetaRow label="Type" value={strategy.type || 'RollingUpdate'} />
            {strategy.type === 'RollingUpdate' && strategy.rollingUpdate && (
              <>
                <MetaRow label="Max Unavailable" value={strategy.rollingUpdate.maxUnavailable} />
                <MetaRow label="Max Surge" value={strategy.rollingUpdate.maxSurge} />
              </>
            )}
            <MetaRow label="Min Ready Seconds" value={spec.minReadySeconds || 0} />
            <MetaRow label="Revision History Limit" value={spec.revisionHistoryLimit || 10} />
            <MetaRow label="Progress Deadline" value={`${spec.progressDeadlineSeconds || 600}s`} />
          </div>
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
