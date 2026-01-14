import React, { useState, useMemo } from 'react';
import type { ClusterResource } from '../../../../api/types';
import { useClusterStore } from '../../../../store/useClusterStore';
import { useResourceDetailsStore } from '../../../../store/useResourceDetailsStore';
import { 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
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
  Activity
} from 'lucide-react';
import { clsx } from 'clsx';

interface Props {
  resource: ClusterResource;
}

export const ApplicationResources: React.FC<Props> = ({ resource }) => {
  const raw = resource.raw;
  const status = raw?.status || {};
  const managedResources = status.resources || [];
  
  const allResources = useClusterStore(state => state.resources);
  const openDetails = useResourceDetailsStore(state => state.openDetails);
  
  const [search, setSearch] = useState('');
  const [filterKind, setFilterKind] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');

  // Get unique kinds from managed resources
  const uniqueKinds = useMemo(() => {
    const kinds = new Set<string>();
    managedResources.forEach((r: any) => kinds.add(r.kind));
    return Array.from(kinds).sort();
  }, [managedResources]);

  // Filter resources
  const filteredResources = useMemo(() => {
    return managedResources.filter((r: any) => {
      const matchesSearch = !search || 
        r.name.toLowerCase().includes(search.toLowerCase()) ||
        r.kind.toLowerCase().includes(search.toLowerCase());
      const matchesKind = !filterKind || r.kind === filterKind;
      const matchesStatus = !filterStatus || r.status === filterStatus;
      return matchesSearch && matchesKind && matchesStatus;
    });
  }, [managedResources, search, filterKind, filterStatus]);

  // Stats
  const stats = useMemo(() => {
    const synced = managedResources.filter((r: any) => r.status === 'Synced').length;
    const outOfSync = managedResources.filter((r: any) => r.status === 'OutOfSync').length;
    const healthy = managedResources.filter((r: any) => r.health?.status === 'Healthy').length;
    const degraded = managedResources.filter((r: any) => r.health?.status === 'Degraded').length;
    return { synced, outOfSync, healthy, degraded, total: managedResources.length };
  }, [managedResources]);

  // Find matching resource in cluster
  const findClusterResource = (res: any) => {
    return Object.values(allResources).find(r => 
      r.kind === res.kind && 
      r.name === res.name && 
      (r.namespace === res.namespace || (!r.namespace && !res.namespace))
    );
  };

  if (managedResources.length === 0) {
    return (
      <div className="p-8 text-center text-slate-500">
        No managed resources found
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Total" value={stats.total} color="slate" />
        <StatCard label="Synced" value={stats.synced} color="emerald" />
        <StatCard label="Out of Sync" value={stats.outOfSync} color="amber" />
        <StatCard label="Healthy" value={stats.healthy} color="emerald" />
        <StatCard label="Degraded" value={stats.degraded} color="red" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search resources..."
            className="w-full bg-slate-800 border border-slate-700 rounded-lg py-2 pl-9 pr-3 text-sm text-slate-200 focus:outline-none focus:border-blue-500 placeholder-slate-500"
          />
        </div>
        <select
          value={filterKind}
          onChange={(e) => setFilterKind(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg py-2 px-3 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
        >
          <option value="">All Kinds</option>
          {uniqueKinds.map(kind => (
            <option key={kind} value={kind}>{kind}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg py-2 px-3 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
        >
          <option value="">All Statuses</option>
          <option value="Synced">Synced</option>
          <option value="OutOfSync">Out of Sync</option>
          <option value="Unknown">Unknown</option>
        </select>
      </div>

      {/* Resource List */}
      <div className="bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden">
        <div className="px-4 py-3 bg-slate-800/50 border-b border-slate-700">
          <span className="font-semibold text-slate-200">
            Managed Resources ({filteredResources.length})
          </span>
        </div>
        <div className="divide-y divide-slate-800 max-h-[600px] overflow-y-auto custom-scrollbar">
          {filteredResources.map((res: any, i: number) => {
            const clusterRes = findClusterResource(res);
            const isClickable = !!clusterRes;
            const syncStatus = res.status || 'Unknown';
            const healthStatus = res.health?.status || 'Unknown';
            const healthMessage = res.health?.message;
            
            return (
              <div 
                key={`${res.kind}-${res.namespace}-${res.name}-${i}`}
                onClick={() => isClickable && openDetails(clusterRes!.id)}
                className={clsx(
                  "px-4 py-3 transition-colors",
                  isClickable && "hover:bg-slate-800/50 cursor-pointer"
                )}
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
                      {res.namespace && (
                        <span className="text-xs text-slate-500">
                          {res.namespace}
                        </span>
                      )}
                    </div>
                    {healthMessage && (
                      <p className="text-xs text-slate-500 mt-1 truncate">{healthMessage}</p>
                    )}
                  </div>
                  
                  {/* Status Badges */}
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={clsx(
                      "flex items-center gap-1 text-xs px-2 py-1 rounded",
                      syncStatus === 'Synced' ? "bg-emerald-900/50 text-emerald-300" :
                      syncStatus === 'OutOfSync' ? "bg-amber-900/50 text-amber-300" :
                      "bg-slate-800 text-slate-400"
                    )}>
                      {syncStatus === 'Synced' ? <CheckCircle2 size={12} /> : 
                       syncStatus === 'OutOfSync' ? <AlertCircle size={12} /> : null}
                      {syncStatus}
                    </span>
                    <span className={clsx(
                      "flex items-center gap-1 text-xs px-2 py-1 rounded",
                      healthStatus === 'Healthy' ? "bg-emerald-900/50 text-emerald-300" :
                      healthStatus === 'Progressing' ? "bg-blue-900/50 text-blue-300" :
                      healthStatus === 'Degraded' ? "bg-red-900/50 text-red-300" :
                      healthStatus === 'Suspended' ? "bg-purple-900/50 text-purple-300" :
                      "bg-slate-800 text-slate-400"
                    )}>
                      {healthStatus === 'Healthy' ? <CheckCircle2 size={12} /> : 
                       healthStatus === 'Degraded' ? <XCircle size={12} /> :
                       healthStatus === 'Progressing' ? <Activity size={12} /> : null}
                      {healthStatus}
                    </span>
                  </div>
                  
                  {/* Arrow */}
                  {isClickable && (
                    <ChevronRight size={16} className="text-slate-500" />
                  )}
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
