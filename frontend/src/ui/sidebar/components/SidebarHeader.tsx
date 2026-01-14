import React from 'react';
import { X } from 'lucide-react';
import { clsx } from 'clsx';
import type { ClusterResource } from '../../../api/types';
import { StatusPill } from './StatusPill';

interface SidebarHeaderProps {
  resource: ClusterResource;
  onClose: () => void;
}

export const SidebarHeader: React.FC<SidebarHeaderProps> = ({ resource, onClose }) => {
  const isUnhealthy = resource.health
    ? resource.health !== 'ok'
    : resource.status !== 'Running' &&
      resource.status !== 'Ready' &&
      resource.status !== 'Active' &&
      resource.status !== 'Available';

  return (
    <div className="p-6 border-b border-slate-700/50 flex flex-col gap-4">
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-widest">
          {resource.kind}
          {resource.namespace && (
            <span className="bg-slate-800 px-2 py-0.5 rounded text-slate-400">
              {resource.namespace}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-white"
          aria-label="Close sidebar"
        >
          <X size={20} />
        </button>
      </div>

      <h2 className="text-2xl font-bold break-all leading-tight">{resource.name}</h2>

      <div className="flex gap-2 items-center flex-wrap">
        <StatusPill
          status={resource.status || 'Unknown'}
          health={resource.health || (isUnhealthy ? 'warning' : 'ok')}
        />
        {resource.health && resource.health !== 'ok' && (
          <div className={clsx(
            'px-2.5 py-1 rounded-md text-xs font-semibold border',
            resource.health === 'error'
              ? 'bg-red-500/20 text-red-400 border-red-500/30'
              : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
          )}>
            {resource.health.toUpperCase()}
          </div>
        )}
      </div>
    </div>
  );
};
