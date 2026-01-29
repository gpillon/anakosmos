import React, { useState } from 'react';
import type { ClusterResource } from '../../../../api/types';
import { useClusterStore } from '../../../../store/useClusterStore';
import { 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Package,
  Calendar,
  Tag,
  Hash,
  ArrowDownCircle,
  Clock,
  Server
} from 'lucide-react';
import { clsx } from 'clsx';

interface Props {
  resource: ClusterResource;
  onApply: (updatedRaw: Record<string, unknown>) => Promise<void>;
}

export const HelmReleaseOverview: React.FC<Props> = ({ resource }) => {
  const raw = resource.raw;
  const spec = raw?.spec || {};
  const status = raw?.status || {};
  const metadata = raw?.metadata || {};
  const helmRelease = resource.helmRelease;
  
  const allResources = useClusterStore(state => state.resources);

  const [rolling, setRolling] = useState(false);

  // Calculate managed resources count
  const managedResourcesCount = Object.values(allResources).filter(r => 
    r.helmRelease?.releaseName === resource.name && 
    r.helmRelease?.releaseNamespace === resource.namespace &&
    r.kind !== 'HelmRelease'
  ).length;

  // Status info
  const releaseStatus = status.status || 'unknown';
  const revision = status.revision || helmRelease?.revision || 1;
  const lastDeployed = status.lastDeployed || metadata.creationTimestamp;

  // Determine overall health
  const getHealthStatus = () => {
    switch (releaseStatus) {
      case 'deployed': return 'healthy';
      case 'failed': return 'error';
      case 'pending-install':
      case 'pending-upgrade':
      case 'pending-rollback':
      case 'uninstalling':
        return 'warning';
      default: return 'warning';
    }
  };

  const healthStatus = getHealthStatus();

  const handleRollback = async () => {
    if (!useClusterStore.getState().client) return;
    if (revision <= 1) {
      alert('Cannot rollback: this is the first revision');
      return;
    }
    
    setRolling(true);
    try {
      const client = useClusterStore.getState().client;
      const success = await client!.rollbackHelmRelease(resource.namespace, resource.name, revision - 1);
      
      if (success) {
        alert(`Successfully rolled back to revision ${revision - 1}`);
        // Optionally trigger a refresh of the resource
      } else {
        alert('Failed to rollback release. Check console for details.');
      }
    } catch (e) {
      console.error('Rollback failed:', e);
      alert(`Error during rollback: ${e}`);
    } finally {
      setRolling(false);
    }
  };

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
              <div className="flex items-center gap-2">
                <Package size={20} className="text-sky-400" />
                <h2 className="text-xl font-bold text-white">{resource.name}</h2>
              </div>
              <p className="text-sm text-slate-400 mt-1">
                {resource.namespace} • Revision {revision}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleRollback}
              disabled={rolling || revision <= 1}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 rounded-lg transition-colors border border-slate-700"
              title="Rollback to previous revision"
            >
              <ArrowDownCircle size={16} className={rolling ? 'animate-spin' : ''} />
              Rollback
            </button>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard 
          icon={<Hash className="text-sky-400" />} 
          label="Revision" 
          value={revision} 
        />
        <StatCard 
          icon={<CheckCircle2 className={
            releaseStatus === 'deployed' ? "text-emerald-400" : 
            releaseStatus === 'failed' ? "text-red-400" : "text-amber-400"
          } />} 
          label="Status" 
          value={releaseStatus.charAt(0).toUpperCase() + releaseStatus.slice(1).replace(/-/g, ' ')} 
        />
        <StatCard 
          icon={<Server className="text-purple-400" />} 
          label="Resources" 
          value={managedResourcesCount} 
        />
        <StatCard 
          icon={<Clock className="text-slate-400" />} 
          label="Last Updated" 
          value={formatTimeAgo(lastDeployed)} 
        />
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Chart Info */}
        <div className="bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden">
          <div className="px-4 py-3 bg-slate-800/50 border-b border-slate-700 flex items-center gap-2">
            <Package size={16} className="text-sky-400" />
            <span className="font-semibold text-slate-200">Chart Information</span>
          </div>
          <div className="p-4 space-y-3 text-sm">
            <MetaRow label="Chart Name" value={spec.chart || helmRelease?.chartName || '-'} />
            <MetaRow label="Chart Version" value={spec.version || helmRelease?.chartVersion || '-'} />
            <MetaRow label="Release Name" value={spec.releaseName || resource.name} />
            <MetaRow label="Namespace" value={resource.namespace} />
          </div>
        </div>

        {/* Release Info */}
        <div className="bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden">
          <div className="px-4 py-3 bg-slate-800/50 border-b border-slate-700 flex items-center gap-2">
            <Calendar size={16} className="text-slate-400" />
            <span className="font-semibold text-slate-200">Release Details</span>
          </div>
          <div className="p-4 space-y-3 text-sm">
            <MetaRow label="Status" value={releaseStatus} />
            <MetaRow label="Revision" value={revision} />
            <MetaRow label="First Deployed" value={formatDate(metadata.creationTimestamp)} />
            <MetaRow label="Last Deployed" value={formatDate(lastDeployed)} />
          </div>
        </div>
      </div>

      {/* Labels */}
      <div className="bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden">
        <div className="px-4 py-3 bg-slate-800/50 border-b border-slate-700 flex items-center gap-2">
          <Tag size={16} className="text-slate-400" />
          <span className="font-semibold text-slate-200">Labels</span>
        </div>
        <div className="p-4">
          <div className="flex flex-wrap gap-2">
            {Object.entries(resource.labels || {}).map(([key, value]) => (
              <span key={key} className="flex items-center gap-1 bg-slate-800 text-slate-300 px-2 py-1 rounded-lg text-xs font-mono border border-slate-700">
                <span className="text-sky-400">{key}</span>
                <span className="text-slate-500">=</span>
                <span>{String(value)}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-sky-950/30 rounded-xl border border-sky-800/50 p-4">
        <div className="flex items-start gap-3">
          <Package size={16} className="text-sky-400 mt-0.5" />
          <div>
            <div className="font-semibold text-sky-300 text-sm">Helm Release Management</div>
            <p className="text-sm text-slate-400 mt-1">
              This release was detected from Helm's internal storage. To upgrade or rollback this release,
              you can use the Helm CLI: <code className="bg-slate-800 px-1 rounded">helm upgrade {resource.name}</code> or 
              <code className="bg-slate-800 px-1 rounded ml-1">helm rollback {resource.name}</code>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Helper Components
const StatCard: React.FC<{ icon: React.ReactNode; label: string; value: string | number }> = ({ icon, label, value }) => (
  <div className="bg-slate-900/50 rounded-xl border border-slate-800 p-4">
    <div className="flex items-center gap-3">
      <div className="p-2 rounded-lg bg-slate-800">{icon}</div>
      <div>
        <div className="text-xl font-bold text-white">{value}</div>
        <div className="text-xs text-slate-500 uppercase tracking-wider">{label}</div>
      </div>
    </div>
  </div>
);

const MetaRow: React.FC<{ label: string; value: string | number | undefined; mono?: boolean }> = ({ label, value, mono }) => (
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

function formatTimeAgo(dateStr: string): string {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
  } catch {
    return dateStr;
  }
}
