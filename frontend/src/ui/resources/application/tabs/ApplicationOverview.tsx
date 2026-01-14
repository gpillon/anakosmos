import React, { useState } from 'react';
import type { ClusterResource } from '../../../../api/types';
import { useClusterStore } from '../../../../store/useClusterStore';
import { 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  RefreshCw,
  Calendar,
  GitBranch,
  Cloud,
  Target,
  PlayCircle,
  PauseCircle,
  Loader2,
  ExternalLink
} from 'lucide-react';
import { clsx } from 'clsx';

interface Props {
  resource: ClusterResource;
  onApply: (updatedRaw: any) => Promise<void>;
}

export const ApplicationOverview: React.FC<Props> = ({ resource }) => {
  const raw = resource.raw;
  const spec = raw?.spec || {};
  const status = raw?.status || {};
  const metadata = raw?.metadata || {};
  const client = useClusterStore(state => state.client);

  const [syncing, setSyncing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Status info
  const syncStatus = status.sync?.status || 'Unknown';
  const healthStatus = status.health?.status || 'Unknown';
  const healthMessage = status.health?.message || '';
  const operationState = status.operationState;
  const reconciledAt = status.reconciledAt;

  // Determine overall health
  const getOverallHealth = () => {
    if (healthStatus === 'Degraded' || healthStatus === 'Missing') return 'error';
    if (healthStatus === 'Progressing' || syncStatus === 'OutOfSync') return 'warning';
    if (healthStatus === 'Healthy' && syncStatus === 'Synced') return 'healthy';
    if (healthStatus === 'Suspended') return 'warning';
    return 'warning';
  };

  const overallHealth = getOverallHealth();

  // Actions
  const handleSync = async (prune = true, dryRun = false) => {
    if (!client || syncing) return;
    setSyncing(true);
    try {
      await client.syncArgoApplication(metadata.namespace, metadata.name, { prune, dryRun });
    } catch (e) {
      console.error('Sync failed:', e);
    } finally {
      setSyncing(false);
    }
  };

  const handleRefresh = async (hard = false) => {
    if (!client || refreshing) return;
    setRefreshing(true);
    try {
      await client.refreshArgoApplication(metadata.namespace, metadata.name, hard);
    } catch (e) {
      console.error('Refresh failed:', e);
    } finally {
      setTimeout(() => setRefreshing(false), 1000);
    }
  };

  // Source info
  const source = spec.source || spec.sources?.[0] || {};
  const destination = spec.destination || {};

  return (
    <div className="space-y-6">
      {/* Status Banner */}
      <div className={clsx(
        "rounded-xl p-6 border backdrop-blur-sm",
        overallHealth === 'healthy' && "bg-emerald-950/30 border-emerald-800/50",
        overallHealth === 'warning' && "bg-amber-950/30 border-amber-800/50",
        overallHealth === 'error' && "bg-red-950/30 border-red-800/50"
      )}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={clsx(
              "w-16 h-16 rounded-xl flex items-center justify-center",
              overallHealth === 'healthy' && "bg-emerald-500/20 text-emerald-400",
              overallHealth === 'warning' && "bg-amber-500/20 text-amber-400",
              overallHealth === 'error' && "bg-red-500/20 text-red-400"
            )}>
              {overallHealth === 'healthy' ? <CheckCircle2 size={32} /> : 
               overallHealth === 'warning' ? <AlertCircle size={32} /> : 
               <XCircle size={32} />}
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">{resource.name}</h2>
              <p className="text-sm text-slate-400 mt-1">
                {spec.project || 'default'} • {metadata.namespace}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleRefresh(false)}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 rounded-lg transition-colors border border-slate-700"
            >
              <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
              Refresh
            </button>
            <button
              onClick={() => handleSync(true, false)}
              disabled={syncing}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg transition-colors"
            >
              {syncing ? <Loader2 size={16} className="animate-spin" /> : <PlayCircle size={16} />}
              Sync
            </button>
          </div>
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatusCard 
          label="Sync Status"
          value={syncStatus}
          color={syncStatus === 'Synced' ? 'emerald' : syncStatus === 'OutOfSync' ? 'amber' : 'slate'}
          icon={syncStatus === 'Synced' ? <CheckCircle2 className="text-emerald-400" /> : <AlertCircle className="text-amber-400" />}
        />
        <StatusCard 
          label="Health"
          value={healthStatus}
          color={healthStatus === 'Healthy' ? 'emerald' : healthStatus === 'Progressing' ? 'blue' : healthStatus === 'Degraded' ? 'red' : 'amber'}
          icon={healthStatus === 'Healthy' ? <CheckCircle2 className="text-emerald-400" /> : <AlertCircle className="text-amber-400" />}
        />
        <StatusCard 
          label="Project"
          value={spec.project || 'default'}
          color="purple"
          icon={<Target className="text-purple-400" />}
        />
        <StatusCard 
          label="Destination"
          value={destination.namespace || destination.server || '-'}
          color="blue"
          icon={<Cloud className="text-blue-400" />}
        />
      </div>

      {/* Operation State (if active) */}
      {operationState && (
        <div className={clsx(
          "rounded-xl border p-4",
          operationState.phase === 'Running' ? "bg-blue-950/30 border-blue-800/50" :
          operationState.phase === 'Succeeded' ? "bg-emerald-950/30 border-emerald-800/50" :
          operationState.phase === 'Failed' || operationState.phase === 'Error' ? "bg-red-950/30 border-red-800/50" :
          "bg-slate-900/50 border-slate-800"
        )}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {operationState.phase === 'Running' ? (
                <Loader2 size={16} className="text-blue-400 animate-spin" />
              ) : operationState.phase === 'Succeeded' ? (
                <CheckCircle2 size={16} className="text-emerald-400" />
              ) : (
                <XCircle size={16} className="text-red-400" />
              )}
              <span className="font-semibold text-slate-200">
                {operationState.phase === 'Running' ? 'Sync in Progress' : 
                 operationState.phase === 'Succeeded' ? 'Last Sync Succeeded' :
                 'Last Sync Failed'}
              </span>
            </div>
            <span className="text-xs text-slate-500">
              {operationState.startedAt && formatDate(operationState.startedAt)}
            </span>
          </div>
          {operationState.message && (
            <p className="text-sm text-slate-400">{operationState.message}</p>
          )}
        </div>
      )}

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Source Info */}
        <div className="bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden">
          <div className="px-4 py-3 bg-slate-800/50 border-b border-slate-700 flex items-center gap-2">
            <GitBranch size={16} className="text-orange-400" />
            <span className="font-semibold text-slate-200">Source</span>
          </div>
          <div className="p-4 space-y-3 text-sm">
            <MetaRow label="Repository" value={source.repoURL} truncate />
            {source.path && <MetaRow label="Path" value={source.path} />}
            {source.chart && <MetaRow label="Chart" value={source.chart} />}
            <MetaRow label="Target Revision" value={source.targetRevision || 'HEAD'} />
            {source.helm?.releaseName && (
              <MetaRow label="Helm Release" value={source.helm.releaseName} />
            )}
          </div>
        </div>

        {/* Destination Info */}
        <div className="bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden">
          <div className="px-4 py-3 bg-slate-800/50 border-b border-slate-700 flex items-center gap-2">
            <Cloud size={16} className="text-blue-400" />
            <span className="font-semibold text-slate-200">Destination</span>
          </div>
          <div className="p-4 space-y-3 text-sm">
            <MetaRow label="Server" value={destination.server || 'https://kubernetes.default.svc'} truncate />
            <MetaRow label="Namespace" value={destination.namespace || '-'} />
            {destination.name && <MetaRow label="Cluster Name" value={destination.name} />}
          </div>
        </div>

        {/* Metadata */}
        <div className="bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden">
          <div className="px-4 py-3 bg-slate-800/50 border-b border-slate-700 flex items-center gap-2">
            <Calendar size={16} className="text-slate-400" />
            <span className="font-semibold text-slate-200">Metadata</span>
          </div>
          <div className="p-4 space-y-3 text-sm">
            <MetaRow label="Namespace" value={metadata.namespace} />
            <MetaRow label="Created" value={formatDate(metadata.creationTimestamp)} />
            <MetaRow label="Reconciled" value={formatDate(reconciledAt)} />
            <MetaRow label="UID" value={metadata.uid} mono />
          </div>
        </div>

        {/* Sync Policy */}
        <div className="bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden">
          <div className="px-4 py-3 bg-slate-800/50 border-b border-slate-700 flex items-center gap-2">
            <RefreshCw size={16} className="text-slate-400" />
            <span className="font-semibold text-slate-200">Sync Policy</span>
          </div>
          <div className="p-4 space-y-3 text-sm">
            <div className="flex items-center gap-2">
              {spec.syncPolicy?.automated ? (
                <span className="flex items-center gap-1 text-emerald-400">
                  <CheckCircle2 size={14} /> Automated
                </span>
              ) : (
                <span className="flex items-center gap-1 text-slate-400">
                  <PauseCircle size={14} /> Manual
                </span>
              )}
            </div>
            {spec.syncPolicy?.automated && (
              <>
                <MetaRow 
                  label="Self-Heal" 
                  value={spec.syncPolicy.automated.selfHeal ? 'Enabled' : 'Disabled'} 
                />
                <MetaRow 
                  label="Auto-Prune" 
                  value={spec.syncPolicy.automated.prune ? 'Enabled' : 'Disabled'} 
                />
              </>
            )}
            {spec.syncPolicy?.syncOptions && (
              <div className="flex flex-wrap gap-1 mt-2">
                {spec.syncPolicy.syncOptions.map((opt: string, i: number) => (
                  <span key={i} className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded">
                    {opt}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Health Message if present */}
      {healthMessage && (
        <div className={clsx(
          "rounded-xl border p-4",
          healthStatus === 'Degraded' ? "bg-red-950/30 border-red-800/50" :
          healthStatus === 'Progressing' ? "bg-blue-950/30 border-blue-800/50" :
          "bg-slate-900/50 border-slate-800"
        )}>
          <div className="flex items-start gap-3">
            <AlertCircle size={16} className={
              healthStatus === 'Degraded' ? "text-red-400" : "text-blue-400"
            } />
            <div>
              <div className="font-semibold text-slate-200 text-sm">Health Message</div>
              <p className="text-sm text-slate-400 mt-1">{healthMessage}</p>
            </div>
          </div>
        </div>
      )}

      {/* External URLs */}
      {status.summary?.externalURLs && status.summary.externalURLs.length > 0 && (
        <div className="bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden">
          <div className="px-4 py-3 bg-slate-800/50 border-b border-slate-700 flex items-center gap-2">
            <ExternalLink size={16} className="text-slate-400" />
            <span className="font-semibold text-slate-200">External URLs</span>
          </div>
          <div className="p-4 flex flex-wrap gap-2">
            {status.summary.externalURLs.map((url: string, i: number) => (
              <a
                key={i}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300 bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700 hover:border-blue-700 transition-colors"
              >
                <ExternalLink size={12} />
                {url}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Helper Components
const StatusCard: React.FC<{ 
  label: string; 
  value: string; 
  color: string; 
  icon: React.ReactNode;
}> = ({ label, value, icon }) => (
  <div className="bg-slate-900/50 rounded-xl border border-slate-800 p-4">
    <div className="flex items-center gap-3">
      <div className="p-2 rounded-lg bg-slate-800">{icon}</div>
      <div>
        <div className="text-lg font-bold text-white">{value}</div>
        <div className="text-xs text-slate-500 uppercase tracking-wider">{label}</div>
      </div>
    </div>
  </div>
);

const MetaRow: React.FC<{ label: string; value: any; mono?: boolean; truncate?: boolean }> = ({ 
  label, value, mono, truncate 
}) => (
  <div className="flex justify-between items-center gap-4">
    <span className="text-slate-500 shrink-0">{label}</span>
    <span className={clsx(
      "text-slate-200", 
      mono && "font-mono text-xs",
      truncate && "truncate max-w-[200px]"
    )} title={truncate ? String(value) : undefined}>
      {value || '-'}
    </span>
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
