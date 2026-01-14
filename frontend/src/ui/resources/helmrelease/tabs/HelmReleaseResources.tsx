import React, { useState, useMemo } from 'react';
import type { ClusterResource } from '../../../../api/types';
import { useClusterStore } from '../../../../store/useClusterStore';
import { useResourceDetailsStore } from '../../../../store/useResourceDetailsStore';
import { 
  Search,
  ChevronRight,
  Box,
  Layers,
  Database,
  Globe,
  Settings,
  FileJson,
  Lock,
  HardDrive,
  Server,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Package
} from 'lucide-react';
import { clsx } from 'clsx';

interface Props {
  resource: ClusterResource;
}

export const HelmReleaseResources: React.FC<Props> = ({ resource }) => {
  const allResources = useClusterStore(state => state.resources);
  const openDetails = useResourceDetailsStore(state => state.openDetails);
  
  const [search, setSearch] = useState('');
  const [filterKind, setFilterKind] = useState<string>('');

  // Get resources managed by this Helm release
  const managedResources = useMemo(() => {
    return Object.values(allResources).filter(r => 
      r.helmRelease?.releaseName === resource.name && 
      r.helmRelease?.releaseNamespace === resource.namespace &&
      r.kind !== 'HelmRelease' // Exclude the release itself
    );
  }, [allResources, resource.name, resource.namespace]);

  // Filter resources
  const filteredResources = useMemo(() => {
    return managedResources.filter(r => {
      const matchesSearch = !search || 
        r.name.toLowerCase().includes(search.toLowerCase()) ||
        r.kind.toLowerCase().includes(search.toLowerCase());
      const matchesKind = !filterKind || r.kind === filterKind;
      return matchesSearch && matchesKind;
    });
  }, [managedResources, search, filterKind]);

  // Stats by kind
  const statsByKind = useMemo(() => {
    const stats: Record<string, number> = {};
    managedResources.forEach(r => {
      stats[r.kind] = (stats[r.kind] || 0) + 1;
    });
    return stats;
  }, [managedResources]);

  // Health stats
  const healthStats = useMemo(() => {
    const healthy = managedResources.filter(r => r.health === 'ok' || !r.health).length;
    const warning = managedResources.filter(r => r.health === 'warning').length;
    const error = managedResources.filter(r => r.health === 'error').length;
    return { healthy, warning, error, total: managedResources.length };
  }, [managedResources]);

  if (managedResources.length === 0) {
    return (
      <div className="p-8 text-center">
        <Package size={48} className="mx-auto text-slate-600 mb-4" />
        <h3 className="text-lg font-semibold text-slate-300 mb-2">No Managed Resources Found</h3>
        <p className="text-sm text-slate-500">
          Resources created by this Helm release will appear here.
          <br />
          Make sure resources have the label <code className="bg-slate-800 px-1 rounded">app.kubernetes.io/instance={resource.name}</code>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total" value={healthStats.total} color="slate" />
        <StatCard label="Healthy" value={healthStats.healthy} color="emerald" />
        <StatCard label="Warning" value={healthStats.warning} color="amber" />
        <StatCard label="Error" value={healthStats.error} color="red" />
      </div>

      {/* Kind breakdown */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(statsByKind).map(([kind, count]) => (
          <button
            key={kind}
            onClick={() => setFilterKind(filterKind === kind ? '' : kind)}
            className={clsx(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors border",
              filterKind === kind 
                ? "bg-sky-900/50 border-sky-700 text-sky-300"
                : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
            )}
          >
            <KindIcon kind={kind} />
            <span>{kind}</span>
            <span className="bg-slate-700 px-1.5 py-0.5 rounded text-[10px]">{count}</span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search resources..."
          className="w-full bg-slate-800 border border-slate-700 rounded-lg py-2 pl-9 pr-3 text-sm text-slate-200 focus:outline-none focus:border-sky-500 placeholder-slate-500"
        />
      </div>

      {/* Resource List */}
      <div className="bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden">
        <div className="px-4 py-3 bg-slate-800/50 border-b border-slate-700 flex items-center justify-between">
          <span className="font-semibold text-slate-200">
            Managed Resources ({filteredResources.length})
          </span>
          {filterKind && (
            <button
              onClick={() => setFilterKind('')}
              className="text-xs text-slate-400 hover:text-slate-200"
            >
              Clear filter
            </button>
          )}
        </div>
        <div className="divide-y divide-slate-800 max-h-[500px] overflow-y-auto custom-scrollbar">
          {filteredResources.map(res => {
            const healthColor = res.health === 'error' ? 'red' : res.health === 'warning' ? 'amber' : 'emerald';
            
            return (
              <div 
                key={res.id}
                onClick={() => openDetails(res.id)}
                className="px-4 py-3 hover:bg-slate-800/50 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-4">
                  {/* Icon */}
                  <div className="p-2 rounded-lg bg-slate-800 shrink-0">
                    <KindIcon kind={res.kind} />
                  </div>
                  
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-200 truncate">
                        {res.name}
                      </span>
                      <span className="text-xs bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded">
                        {res.kind}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {res.namespace && `${res.namespace} • `}{res.status}
                    </div>
                  </div>
                  
                  {/* Health */}
                  <div className={clsx(
                    "flex items-center gap-1 text-xs px-2 py-1 rounded shrink-0",
                    healthColor === 'emerald' && "bg-emerald-900/50 text-emerald-300",
                    healthColor === 'amber' && "bg-amber-900/50 text-amber-300",
                    healthColor === 'red' && "bg-red-900/50 text-red-300"
                  )}>
                    {healthColor === 'emerald' ? <CheckCircle2 size={12} /> :
                     healthColor === 'amber' ? <AlertCircle size={12} /> :
                     <XCircle size={12} />}
                    {res.health || 'ok'}
                  </div>
                  
                  <ChevronRight size={16} className="text-slate-500 shrink-0" />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const StatCard: React.FC<{ label: string; value: number; color: string }> = ({ 
  label, value, color 
}) => (
  <div className={clsx(
    "rounded-lg border p-3",
    color === 'emerald' && "bg-emerald-950/30 border-emerald-800/50",
    color === 'amber' && "bg-amber-950/30 border-amber-800/50",
    color === 'red' && "bg-red-950/30 border-red-800/50",
    color === 'slate' && "bg-slate-900/50 border-slate-800"
  )}>
    <div className={clsx(
      "text-2xl font-bold",
      color === 'emerald' && "text-emerald-400",
      color === 'amber' && "text-amber-400",
      color === 'red' && "text-red-400",
      color === 'slate' && "text-slate-200"
    )}>
      {value}
    </div>
    <div className="text-xs text-slate-500 uppercase">{label}</div>
  </div>
);

const KindIcon: React.FC<{ kind: string }> = ({ kind }) => {
  const iconMap: Record<string, React.ReactNode> = {
    'Deployment': <Layers size={14} className="text-purple-400" />,
    'StatefulSet': <Database size={14} className="text-purple-400" />,
    'DaemonSet': <Layers size={14} className="text-purple-400" />,
    'ReplicaSet': <Layers size={14} className="text-slate-400" />,
    'Pod': <Box size={14} className="text-blue-400" />,
    'Service': <Globe size={14} className="text-emerald-400" />,
    'Ingress': <Globe size={14} className="text-pink-400" />,
    'ConfigMap': <FileJson size={14} className="text-amber-400" />,
    'Secret': <Lock size={14} className="text-red-400" />,
    'PersistentVolumeClaim': <HardDrive size={14} className="text-orange-400" />,
    'ServiceAccount': <Settings size={14} className="text-slate-400" />,
  };
  
  return iconMap[kind] || <Server size={14} className="text-slate-400" />;
};
