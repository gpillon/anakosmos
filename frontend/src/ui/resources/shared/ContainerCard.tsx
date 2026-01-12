import React, { useState } from 'react';
import { Box, ChevronDown, ChevronRight, Play, Terminal, Shield } from 'lucide-react';
import type { V1Container, V1ContainerStatus } from '../../../api/k8s-types';
import { clsx } from 'clsx';
import { ProbeDisplay } from './ProbeDisplay';
import { ResourcesDisplay } from './ResourcesDisplay';
import { EnvVarsDisplay } from './EnvVarsDisplay';
import { getContainerStateInfo } from './formatters';

interface ContainerCardProps {
  container: V1Container;
  status?: V1ContainerStatus;
  isInit?: boolean;
  defaultExpanded?: boolean;
  editable?: boolean;
  onUpdate?: (updates: Partial<V1Container>) => void;
}

export const ContainerCard: React.FC<ContainerCardProps> = ({ 
  container, 
  status,
  isInit,
  defaultExpanded = false,
  // editable and onUpdate reserved for future editing capabilities
  editable: _editable = false,
  onUpdate: _onUpdate
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  
  // Silence unused variable warnings (reserved for future use)
  void _editable;
  void _onUpdate;
  
  const stateInfo = status?.state ? getContainerStateInfo(status.state) : null;
  const restartCount = status?.restartCount || 0;

  return (
    <div className="bg-slate-800/30 rounded-lg border border-slate-700 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-700/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          {expanded ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
          <Box size={16} className={isInit ? "text-amber-400" : "text-blue-400"} />
          <div className="text-left">
            <div className="flex items-center gap-2">
              <span className="font-medium text-slate-200">{container.name}</span>
              {isInit && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-900/30 text-amber-400 border border-amber-800/30">
                  init
                </span>
              )}
            </div>
            <div className="text-xs text-slate-500 font-mono truncate max-w-[300px]">
              {container.image}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Status indicator */}
          {stateInfo && (
            <div className="flex items-center gap-2">
              <span className={clsx("text-xs font-medium", stateInfo.color)}>
                {stateInfo.state}
              </span>
              {restartCount > 0 && (
                <span className="text-xs text-slate-500">
                  ({restartCount} restarts)
                </span>
              )}
            </div>
          )}
          
          {/* Quick info badges */}
          <div className="flex items-center gap-2">
            {container.ports && container.ports.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-400">
                {container.ports.length} port{container.ports.length !== 1 ? 's' : ''}
              </span>
            )}
            {(container.livenessProbe || container.readinessProbe || container.startupProbe) && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-900/30 text-emerald-400">
                probes
              </span>
            )}
            {container.securityContext && (
              <Shield size={12} className="text-purple-400" />
            )}
          </div>
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-slate-700">
          {/* Image and command */}
          <div className="pt-4 space-y-2">
            <div className="flex items-start gap-2">
              <span className="text-xs text-slate-500 min-w-[80px]">Image</span>
              <span className="text-xs text-slate-300 font-mono break-all">{container.image}</span>
            </div>
            {container.imagePullPolicy && (
              <div className="flex items-start gap-2">
                <span className="text-xs text-slate-500 min-w-[80px]">Pull Policy</span>
                <span className="text-xs text-slate-300">{container.imagePullPolicy}</span>
              </div>
            )}
            {container.command && container.command.length > 0 && (
              <div className="flex items-start gap-2">
                <span className="text-xs text-slate-500 min-w-[80px]">Command</span>
                <code className="text-xs text-emerald-400 font-mono bg-slate-900/50 px-2 py-1 rounded">
                  {container.command.join(' ')}
                </code>
              </div>
            )}
            {container.args && container.args.length > 0 && (
              <div className="flex items-start gap-2">
                <span className="text-xs text-slate-500 min-w-[80px]">Args</span>
                <code className="text-xs text-slate-300 font-mono bg-slate-900/50 px-2 py-1 rounded">
                  {container.args.join(' ')}
                </code>
              </div>
            )}
          </div>

          {/* Ports */}
          {container.ports && container.ports.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs text-slate-500 uppercase font-bold">Ports</div>
              <div className="flex flex-wrap gap-2">
                {container.ports.map((port, i) => (
                  <div key={i} className="flex items-center gap-1 text-xs bg-slate-700/50 px-2 py-1 rounded">
                    {port.name && <span className="text-blue-400">{port.name}:</span>}
                    <span className="text-slate-300 font-mono">{port.containerPort}</span>
                    <span className="text-slate-500">/{port.protocol || 'TCP'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Resources */}
          <ResourcesDisplay resources={container.resources} />

          {/* Probes */}
          {(container.livenessProbe || container.readinessProbe || container.startupProbe) && (
            <div className="space-y-2">
              <div className="text-xs text-slate-500 uppercase font-bold">Health Probes</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <ProbeDisplay probe={container.livenessProbe} type="liveness" />
                <ProbeDisplay probe={container.readinessProbe} type="readiness" />
                <ProbeDisplay probe={container.startupProbe} type="startup" />
              </div>
            </div>
          )}

          {/* Environment */}
          <EnvVarsDisplay env={container.env} envFrom={container.envFrom} />

          {/* Volume Mounts */}
          {container.volumeMounts && container.volumeMounts.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs text-slate-500 uppercase font-bold">Volume Mounts</div>
              <div className="space-y-1">
                {container.volumeMounts.map((mount, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="text-blue-400 font-mono">{mount.name}</span>
                    <span className="text-slate-600">→</span>
                    <span className="text-slate-300 font-mono">{mount.mountPath}</span>
                    {mount.readOnly && (
                      <span className="text-amber-400 text-[10px]">(ro)</span>
                    )}
                    {mount.subPath && (
                      <span className="text-slate-500 text-[10px]">subPath: {mount.subPath}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Security Context */}
          {container.securityContext && (
            <div className="space-y-2">
              <div className="text-xs text-slate-500 uppercase font-bold flex items-center gap-1">
                <Shield size={12} />
                Security Context
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {container.securityContext.runAsUser !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Run As User</span>
                    <span className="text-slate-300">{container.securityContext.runAsUser}</span>
                  </div>
                )}
                {container.securityContext.runAsGroup !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Run As Group</span>
                    <span className="text-slate-300">{container.securityContext.runAsGroup}</span>
                  </div>
                )}
                {container.securityContext.runAsNonRoot !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Non-Root</span>
                    <span className={container.securityContext.runAsNonRoot ? 'text-emerald-400' : 'text-red-400'}>
                      {container.securityContext.runAsNonRoot ? 'Yes' : 'No'}
                    </span>
                  </div>
                )}
                {container.securityContext.readOnlyRootFilesystem !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Read-Only FS</span>
                    <span className={container.securityContext.readOnlyRootFilesystem ? 'text-emerald-400' : 'text-amber-400'}>
                      {container.securityContext.readOnlyRootFilesystem ? 'Yes' : 'No'}
                    </span>
                  </div>
                )}
                {container.securityContext.privileged !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Privileged</span>
                    <span className={container.securityContext.privileged ? 'text-red-400' : 'text-emerald-400'}>
                      {container.securityContext.privileged ? 'Yes' : 'No'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TTY/stdin info */}
          {(container.tty || container.stdin) && (
            <div className="flex items-center gap-4 text-xs">
              {container.stdin && (
                <div className="flex items-center gap-1 text-slate-400">
                  <Terminal size={12} />
                  stdin
                </div>
              )}
              {container.tty && (
                <div className="flex items-center gap-1 text-slate-400">
                  <Play size={12} />
                  TTY
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
