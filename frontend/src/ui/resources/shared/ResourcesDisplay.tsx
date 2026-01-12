import React from 'react';
import { Cpu, HardDrive } from 'lucide-react';
import type { V1ResourceRequirements } from '../../../api/k8s-types';

interface ResourcesDisplayProps {
  resources: V1ResourceRequirements | undefined;
  compact?: boolean;
}

export const ResourcesDisplay: React.FC<ResourcesDisplayProps> = ({ resources, compact }) => {
  if (!resources) return null;

  const { requests, limits } = resources;

  if (compact) {
    return (
      <div className="flex items-center gap-4 text-xs">
        {(requests?.cpu || limits?.cpu) && (
          <div className="flex items-center gap-1">
            <Cpu size={12} className="text-blue-400" />
            <span className="text-slate-400">
              {requests?.cpu || '-'} / {limits?.cpu || '-'}
            </span>
          </div>
        )}
        {(requests?.memory || limits?.memory) && (
          <div className="flex items-center gap-1">
            <HardDrive size={12} className="text-purple-400" />
            <span className="text-slate-400">
              {requests?.memory || '-'} / {limits?.memory || '-'}
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {/* CPU */}
      <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
        <div className="flex items-center gap-2 mb-2">
          <Cpu size={14} className="text-blue-400" />
          <span className="text-sm font-medium text-blue-400">CPU</span>
        </div>
        <div className="space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-500">Request</span>
            <span className="text-slate-300 font-mono">{requests?.cpu || '-'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Limit</span>
            <span className="text-slate-300 font-mono">{limits?.cpu || '-'}</span>
          </div>
        </div>
      </div>

      {/* Memory */}
      <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
        <div className="flex items-center gap-2 mb-2">
          <HardDrive size={14} className="text-purple-400" />
          <span className="text-sm font-medium text-purple-400">Memory</span>
        </div>
        <div className="space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-500">Request</span>
            <span className="text-slate-300 font-mono">{requests?.memory || '-'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Limit</span>
            <span className="text-slate-300 font-mono">{limits?.memory || '-'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
