import React from 'react';
import { Heart, Activity, Zap } from 'lucide-react';
import type { V1Probe } from '../../../api/k8s-types';
import { clsx } from 'clsx';

interface ProbeDisplayProps {
  probe: V1Probe | undefined;
  type: 'liveness' | 'readiness' | 'startup';
  compact?: boolean;
}

export const ProbeDisplay: React.FC<ProbeDisplayProps> = ({ probe, type, compact }) => {
  if (!probe) return null;

  const Icon = type === 'liveness' ? Heart : type === 'readiness' ? Activity : Zap;
  const label = type === 'liveness' ? 'Liveness' : type === 'readiness' ? 'Readiness' : 'Startup';
  const color = type === 'liveness' ? 'text-red-400' : type === 'readiness' ? 'text-emerald-400' : 'text-blue-400';

  const getProbeAction = (): string => {
    if (probe.httpGet) {
      return `HTTP GET ${probe.httpGet.path || '/'}:${probe.httpGet.port}`;
    }
    if (probe.tcpSocket) {
      return `TCP :${probe.tcpSocket.port}`;
    }
    if (probe.exec?.command) {
      return `Exec: ${probe.exec.command.join(' ')}`;
    }
    if (probe.grpc) {
      return `gRPC :${probe.grpc.port}`;
    }
    return 'Unknown';
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2 text-xs">
        <Icon size={12} className={color} />
        <span className="text-slate-400">{label}:</span>
        <span className="text-slate-300 font-mono truncate">{getProbeAction()}</span>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={14} className={color} />
        <span className={clsx("text-sm font-medium", color)}>{label} Probe</span>
      </div>
      <div className="space-y-1 text-xs">
        <div className="flex justify-between">
          <span className="text-slate-500">Action</span>
          <span className="text-slate-300 font-mono">{getProbeAction()}</span>
        </div>
        {probe.initialDelaySeconds !== undefined && (
          <div className="flex justify-between">
            <span className="text-slate-500">Initial Delay</span>
            <span className="text-slate-300">{probe.initialDelaySeconds}s</span>
          </div>
        )}
        {probe.periodSeconds !== undefined && (
          <div className="flex justify-between">
            <span className="text-slate-500">Period</span>
            <span className="text-slate-300">{probe.periodSeconds}s</span>
          </div>
        )}
        {probe.timeoutSeconds !== undefined && (
          <div className="flex justify-between">
            <span className="text-slate-500">Timeout</span>
            <span className="text-slate-300">{probe.timeoutSeconds}s</span>
          </div>
        )}
        {probe.failureThreshold !== undefined && (
          <div className="flex justify-between">
            <span className="text-slate-500">Failure Threshold</span>
            <span className="text-slate-300">{probe.failureThreshold}</span>
          </div>
        )}
      </div>
    </div>
  );
};
