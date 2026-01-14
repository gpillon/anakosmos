import React from 'react';
import type { ClusterResource } from '../../../../api/types';
import { 
  GitCommit,
  User,
  Bot,
  Clock,
  ExternalLink,
  GitBranch
} from 'lucide-react';
import { clsx } from 'clsx';

interface Props {
  resource: ClusterResource;
}

export const ApplicationSyncHistory: React.FC<Props> = ({ resource }) => {
  const raw = resource.raw;
  const status = raw?.status || {};
  const history = status.history || [];

  if (history.length === 0) {
    return (
      <div className="p-8 text-center text-slate-500">
        No sync history available
      </div>
    );
  }

  // Sort by ID descending (most recent first)
  const sortedHistory = [...history].sort((a: any, b: any) => b.id - a.id);

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="bg-slate-900/50 rounded-xl border border-slate-800 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GitCommit size={16} className="text-slate-400" />
            <span className="font-semibold text-slate-200">Sync History</span>
          </div>
          <span className="text-sm text-slate-500">
            {history.length} revision{history.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Vertical Line */}
        <div className="absolute left-6 top-0 bottom-0 w-px bg-slate-700" />
        
        <div className="space-y-4">
          {sortedHistory.map((entry: any, index: number) => (
            <HistoryEntry 
              key={entry.id} 
              entry={entry} 
              isLatest={index === 0}
              repoUrl={raw?.spec?.source?.repoURL || raw?.spec?.sources?.[0]?.repoURL}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

const HistoryEntry: React.FC<{ 
  entry: any; 
  isLatest: boolean;
  repoUrl?: string;
}> = ({ entry, isLatest, repoUrl }) => {
  const source = entry.source || entry.sources?.[0];
  const initiatedBy = entry.initiatedBy;
  const isAutomated = initiatedBy?.automated === true;
  const username = initiatedBy?.username;
  
  // Parse dates
  const deployedAt = entry.deployedAt ? new Date(entry.deployedAt) : null;
  const deployStartedAt = entry.deployStartedAt ? new Date(entry.deployStartedAt) : null;
  
  // Calculate duration if both times available
  let duration = '';
  if (deployedAt && deployStartedAt) {
    const diffMs = deployedAt.getTime() - deployStartedAt.getTime();
    if (diffMs < 1000) {
      duration = '<1s';
    } else if (diffMs < 60000) {
      duration = `${Math.round(diffMs / 1000)}s`;
    } else {
      duration = `${Math.round(diffMs / 60000)}m`;
    }
  }

  // Build commit URL if possible
  const commitUrl = repoUrl && entry.revision 
    ? buildCommitUrl(repoUrl, entry.revision) 
    : null;

  return (
    <div className="relative pl-12">
      {/* Timeline Dot */}
      <div className={clsx(
        "absolute left-4 w-4 h-4 rounded-full border-2",
        isLatest 
          ? "bg-emerald-500 border-emerald-400" 
          : "bg-slate-800 border-slate-600"
      )} />

      {/* Card */}
      <div className={clsx(
        "rounded-xl border overflow-hidden",
        isLatest 
          ? "bg-slate-900/80 border-slate-700" 
          : "bg-slate-900/50 border-slate-800"
      )}>
        {/* Header */}
        <div className="px-4 py-3 bg-slate-800/30 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className={clsx(
              "text-sm font-bold",
              isLatest ? "text-emerald-400" : "text-slate-300"
            )}>
              Revision #{entry.id}
            </span>
            {isLatest && (
              <span className="text-xs bg-emerald-900/50 text-emerald-300 px-2 py-0.5 rounded">
                Current
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Clock size={12} />
            {formatDate(entry.deployedAt)}
            {duration && (
              <span className="text-slate-600">({duration})</span>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3">
          {/* Revision */}
          <div className="flex items-center gap-3">
            <GitCommit size={14} className="text-slate-500 shrink-0" />
            <div className="flex items-center gap-2 min-w-0">
              <code className="text-sm text-slate-300 font-mono truncate">
                {entry.revision?.substring(0, 12) || 'Unknown'}
              </code>
              {commitUrl && (
                <a
                  href={commitUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 shrink-0"
                >
                  <ExternalLink size={12} />
                </a>
              )}
            </div>
          </div>

          {/* Source Info */}
          {source && (
            <div className="flex items-center gap-3">
              <GitBranch size={14} className="text-slate-500 shrink-0" />
              <div className="text-sm text-slate-400 truncate">
                {source.path || source.chart || source.repoURL?.split('/').pop()?.replace('.git', '')}
                {source.targetRevision && source.targetRevision !== 'HEAD' && (
                  <span className="ml-2 text-slate-500">@ {source.targetRevision}</span>
                )}
              </div>
            </div>
          )}

          {/* Initiated By */}
          <div className="flex items-center gap-3">
            {isAutomated ? (
              <Bot size={14} className="text-purple-400 shrink-0" />
            ) : (
              <User size={14} className="text-blue-400 shrink-0" />
            )}
            <span className="text-sm text-slate-400">
              {isAutomated ? 'Automated sync' : username || 'Manual sync'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

function buildCommitUrl(repoUrl: string, revision: string): string | null {
  try {
    // Handle GitHub
    if (repoUrl.includes('github.com')) {
      const cleanUrl = repoUrl.replace('.git', '');
      return `${cleanUrl}/commit/${revision}`;
    }
    // Handle GitLab
    if (repoUrl.includes('gitlab.com') || repoUrl.includes('gitlab')) {
      const cleanUrl = repoUrl.replace('.git', '');
      return `${cleanUrl}/-/commit/${revision}`;
    }
    // Handle Bitbucket
    if (repoUrl.includes('bitbucket.org')) {
      const cleanUrl = repoUrl.replace('.git', '');
      return `${cleanUrl}/commits/${revision}`;
    }
    return null;
  } catch {
    return null;
  }
}

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
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
  } catch {
    return dateStr;
  }
}
