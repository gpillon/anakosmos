import React, { useState, useEffect } from 'react';
import type { ClusterResource } from '../../../../api/types';
import { useClusterStore } from '../../../../store/useClusterStore';
import { 
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowDownCircle,
  Hash,
  RefreshCw,
  Info
} from 'lucide-react';
import { clsx } from 'clsx';

interface Props {
  resource: ClusterResource;
}

interface ReleaseRevision {
  revision: number;
  status: string;
  chartVersion: string;
  appVersion?: string;
  updated: string;
  description?: string;
}

export const HelmReleaseHistory: React.FC<Props> = ({ resource }) => {
  const client = useClusterStore(state => state.client);
  const [history, setHistory] = useState<ReleaseRevision[]>([]);
  const [loading, setLoading] = useState(true);
  const [rolling, setRolling] = useState<number | null>(null);

  // Fetch history from backend
  useEffect(() => {
    const fetchHistory = async () => {
      if (!client) return;
      setLoading(true);
      
      try {
        const releases = await client.getHelmHistory(resource.namespace, resource.name);
        
        // Transform Helm Release objects to our ReleaseRevision interface
        const transformedHistory: ReleaseRevision[] = releases.map((rel: { version?: number; info?: { status?: string; last_deployed?: string; first_deployed?: string; description?: string }; chart?: { metadata?: { version?: string; appVersion?: string } } }) => ({
          revision: rel.version || 0,
          status: rel.info?.status || 'unknown',
          chartVersion: rel.chart?.metadata?.version || '',
          appVersion: rel.chart?.metadata?.appVersion,
          updated: rel.info?.last_deployed || rel.info?.first_deployed || '',
          description: rel.info?.description || ''
        }));
        
        // Sort by revision descending (newest first)
        transformedHistory.sort((a, b) => b.revision - a.revision);
        
        setHistory(transformedHistory);
      } catch (e) {
        console.error('Failed to fetch Helm history:', e);
        setHistory([]);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [resource, client, resource.namespace, resource.name]);

  const handleRollback = async (revision: number) => {
    if (!client) return;
    setRolling(revision);
    
    try {
      const success = await client.rollbackHelmRelease(resource.namespace, resource.name, revision);
      if (success) {
        alert(`Successfully rolled back to revision ${revision}`);
        // Refetch history
        const releases = await client.getHelmHistory(resource.namespace, resource.name);
        const transformedHistory: ReleaseRevision[] = releases.map((rel: { version?: number; info?: { status?: string; last_deployed?: string; first_deployed?: string; description?: string }; chart?: { metadata?: { version?: string; appVersion?: string } } }) => ({
          revision: rel.version || 0,
          status: rel.info?.status || 'unknown',
          chartVersion: rel.chart?.metadata?.version || '',
          appVersion: rel.chart?.metadata?.appVersion,
          updated: rel.info?.last_deployed || rel.info?.first_deployed || '',
          description: rel.info?.description || ''
        }));
        transformedHistory.sort((a, b) => b.revision - a.revision);
        setHistory(transformedHistory);
      } else {
        alert(`Failed to rollback to revision ${revision}`);
      }
    } catch (e) {
      console.error('Rollback error:', e);
      alert(`Error during rollback: ${e}`);
    } finally {
      setRolling(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="animate-spin text-slate-400" size={24} />
        <span className="ml-2 text-slate-400">Loading history...</span>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Info */}
      <div className="bg-sky-950/30 rounded-xl border border-sky-800/50 p-4">
        <div className="flex items-start gap-3">
          <Info size={16} className="text-sky-400 mt-0.5" />
          <div>
            <p className="text-sm text-slate-300">
              Helm stores a history of releases. You can rollback to any previous revision.
            </p>
            <code className="text-xs text-slate-500 mt-2 block">
              helm history {resource.name} -n {resource.namespace}
            </code>
          </div>
        </div>
      </div>

      {/* History Timeline */}
      <div className="bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden">
        <div className="px-4 py-3 bg-slate-800/50 border-b border-slate-700">
          <span className="font-semibold text-slate-200">Release History</span>
        </div>
        
        <div className="divide-y divide-slate-800">
          {history.map((rev, index) => {
            const isCurrent = index === 0;
            const statusColor = rev.status === 'deployed' ? 'emerald' : 
                               rev.status === 'failed' ? 'red' : 
                               rev.status === 'superseded' ? 'slate' : 'amber';
            
            return (
              <div 
                key={rev.revision}
                className={clsx(
                  "px-4 py-4 transition-colors",
                  isCurrent && "bg-slate-800/30"
                )}
              >
                <div className="flex items-start gap-4">
                  {/* Revision number */}
                  <div className={clsx(
                    "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
                    isCurrent ? "bg-sky-500/20 text-sky-400" : "bg-slate-800 text-slate-400"
                  )}>
                    <Hash size={20} />
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={clsx(
                        "font-bold",
                        isCurrent ? "text-sky-400" : "text-slate-300"
                      )}>
                        Revision {rev.revision}
                      </span>
                      {isCurrent && (
                        <span className="text-xs bg-sky-900/50 text-sky-300 px-2 py-0.5 rounded">
                          Current
                        </span>
                      )}
                      <span className={clsx(
                        "flex items-center gap-1 text-xs px-2 py-0.5 rounded",
                        statusColor === 'emerald' && "bg-emerald-900/50 text-emerald-300",
                        statusColor === 'amber' && "bg-amber-900/50 text-amber-300",
                        statusColor === 'red' && "bg-red-900/50 text-red-300",
                        statusColor === 'slate' && "bg-slate-800 text-slate-400"
                      )}>
                        {statusColor === 'emerald' ? <CheckCircle2 size={10} /> :
                         statusColor === 'red' ? <XCircle size={10} /> :
                         statusColor === 'amber' ? <AlertCircle size={10} /> : null}
                        {rev.status}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm text-slate-500">
                      <span className="flex items-center gap-1">
                        <Clock size={12} />
                        {formatDate(rev.updated)}
                      </span>
                      {rev.chartVersion && (
                        <span>Chart: {rev.chartVersion}</span>
                      )}
                    </div>
                    
                    {rev.description && (
                      <p className="text-sm text-slate-400 mt-2">{rev.description}</p>
                    )}
                  </div>
                  
                  {/* Rollback button */}
                  {!isCurrent && rev.status !== 'failed' && (
                    <button
                      onClick={() => handleRollback(rev.revision)}
                      disabled={rolling === rev.revision}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 text-xs rounded-lg transition-colors border border-slate-700 shrink-0"
                    >
                      {rolling === rev.revision ? (
                        <RefreshCw size={12} className="animate-spin" />
                      ) : (
                        <ArrowDownCircle size={12} />
                      )}
                      Rollback
                    </button>
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

function formatDate(dateStr: string): string {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays < 7) return `${diffDays} days ago`;
    
    return date.toLocaleDateString();
  } catch {
    return dateStr;
  }
}
