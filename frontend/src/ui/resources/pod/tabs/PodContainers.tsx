import React from 'react';
import type { V1Pod } from '../../../../api/k8s-types';
import type { ClusterResource } from '../../../../api/types';
import { useTerminalStore } from '../../../../store/useTerminalStore';
import { Terminal, FileText, Box, ChevronDown, ChevronRight, Shield } from 'lucide-react';
import { clsx } from 'clsx';
import {
  Card,
  CardHeader,
  CardBody,
  ProbeDisplay,
  ResourcesDisplay,
  EnvVarsDisplay,
  getContainerStateInfo
} from '../../shared';

interface Props {
  resource: ClusterResource;
  pod: V1Pod;
}

export const PodContainers: React.FC<Props> = ({ resource, pod }) => {
  const spec = pod.spec;
  const status = pod.status;
  const openTerminal = useTerminalStore(state => state.openTerminal);
  
  const [expandedContainers, setExpandedContainers] = React.useState<Set<string>>(
    new Set([spec?.containers?.[0]?.name].filter(Boolean) as string[])
  );

  const toggleExpanded = (name: string) => {
    const next = new Set(expandedContainers);
    if (next.has(name)) {
      next.delete(name);
    } else {
      next.add(name);
    }
    setExpandedContainers(next);
  };

  const handleOpenTerminal = (type: 'shell' | 'logs', containerName: string) => {
    openTerminal(
      resource.id,
      resource.name,
      pod.metadata?.namespace || 'default',
      type,
      containerName
    );
  };

  const getContainerStatus = (name: string) => {
    return status?.containerStatuses?.find(s => s.name === name);
  };

  const getInitContainerStatus = (name: string) => {
    return status?.initContainerStatuses?.find(s => s.name === name);
  };

  const containers = spec?.containers || [];
  const initContainers = spec?.initContainers || [];
  const totalContainers = containers.length + initContainers.length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader 
          icon={<Box size={16} />} 
          title="Containers"
          badge={<span className="text-xs text-slate-500 ml-2">({totalContainers})</span>}
        />
        <CardBody className="space-y-3">
          {/* Init Containers */}
          {initContainers.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs text-slate-500 uppercase font-bold">Init Containers</div>
              {initContainers.map((container) => {
                const cs = getInitContainerStatus(container.name);
                const isExpanded = expandedContainers.has(container.name);
                const stateInfo = cs?.state ? getContainerStateInfo(cs.state) : null;
                const isRunning = !!cs?.state?.running;

                return (
                  <ContainerCardWithActions
                    key={container.name}
                    container={container}
                    status={cs}
                    stateInfo={stateInfo}
                    isInit
                    isExpanded={isExpanded}
                    isRunning={isRunning}
                    onToggle={() => toggleExpanded(container.name)}
                    onShell={() => handleOpenTerminal('shell', container.name)}
                    onLogs={() => handleOpenTerminal('logs', container.name)}
                  />
                );
              })}
            </div>
          )}

          {/* Regular Containers */}
          {containers.length > 0 && (
            <div className="space-y-2">
              {initContainers.length > 0 && (
                <div className="text-xs text-slate-500 uppercase font-bold">Containers</div>
              )}
              {containers.map((container) => {
                const cs = getContainerStatus(container.name);
                const isExpanded = expandedContainers.has(container.name);
                const stateInfo = cs?.state ? getContainerStateInfo(cs.state) : null;
                const isRunning = !!cs?.state?.running;

                return (
                  <ContainerCardWithActions
                    key={container.name}
                    container={container}
                    status={cs}
                    stateInfo={stateInfo}
                    isExpanded={isExpanded}
                    isRunning={isRunning}
                    onToggle={() => toggleExpanded(container.name)}
                    onShell={() => handleOpenTerminal('shell', container.name)}
                    onLogs={() => handleOpenTerminal('logs', container.name)}
                  />
                );
              })}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
};

// Internal component for container card with actions
interface ContainerCardWithActionsProps {
  container: any;
  status: any;
  stateInfo: { state: string; color: string; detail?: string } | null;
  isInit?: boolean;
  isExpanded: boolean;
  isRunning: boolean;
  onToggle: () => void;
  onShell: () => void;
  onLogs: () => void;
}

const ContainerCardWithActions: React.FC<ContainerCardWithActionsProps> = ({
  container,
  status,
  stateInfo,
  isInit,
  isExpanded,
  isRunning,
  onToggle,
  onShell,
  onLogs
}) => {
  const restartCount = status?.restartCount || 0;

  return (
    <div className="bg-slate-800/30 rounded-lg border border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between">
        <button
          onClick={onToggle}
          className="flex items-center gap-3 flex-1 text-left hover:bg-slate-700/20 -m-2 p-2 rounded transition-colors"
        >
          {isExpanded ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
          <Box size={16} className={isInit ? "text-amber-400" : "text-blue-400"} />
          <div>
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
        </button>
        
        <div className="flex items-center gap-2">
          {/* Status */}
          {stateInfo && (
            <span className={clsx("text-xs font-medium mr-2", stateInfo.color)}>
              {stateInfo.state}
              {restartCount > 0 && ` (${restartCount} restarts)`}
            </span>
          )}
          
          {/* Actions */}
          <button
            onClick={onShell}
            disabled={!isRunning}
            className="p-2 text-slate-400 hover:text-emerald-400 hover:bg-emerald-900/20 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title={isRunning ? `Open shell in ${container.name}` : 'Container not running'}
          >
            <Terminal size={16} />
          </button>
          <button
            onClick={onLogs}
            className="p-2 text-slate-400 hover:text-blue-400 hover:bg-blue-900/20 rounded transition-colors"
            title={`View logs for ${container.name}`}
          >
            <FileText size={16} />
          </button>
        </div>
      </div>

      {/* Expanded content */}
      {isExpanded && (
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
                {container.ports.map((port: any, i: number) => (
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
                {container.volumeMounts.map((mount: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="text-blue-400 font-mono">{mount.name}</span>
                    <span className="text-slate-600">→</span>
                    <span className="text-slate-300 font-mono">{mount.mountPath}</span>
                    {mount.readOnly && (
                      <span className="text-amber-400 text-[10px]">(ro)</span>
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
        </div>
      )}
    </div>
  );
};
