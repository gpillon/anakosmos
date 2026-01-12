import React from 'react';
import type { ClusterResource } from '../../../../api/types';
import type { V1Pod } from '../../../../api/k8s-types';
import { useClusterStore } from '../../../../store/useClusterStore';
import { useResourceDetailsStore } from '../../../../store/useResourceDetailsStore';
import { useTerminalStore } from '../../../../store/useTerminalStore';
import { 
  CheckCircle2, 
  Server,
  Clock,
  ArrowUpCircle,
  Box,
  Terminal,
  FileText,
  Network,
  ExternalLink,
  Key,
  Lock
} from 'lucide-react';
import {
  StatusBanner,
  MetadataCard,
  LabelsCard,
  AnnotationsCard,
  ConditionsCard,
  StatCard,
  Card,
  CardHeader,
  CardBody,
  MetaRow,
  formatAge,
  OwnerReferencesCard,
  type HealthStatus
} from '../../shared';

interface Props {
  resource: ClusterResource;
  pod: V1Pod;
}

export const PodOverview: React.FC<Props> = ({ resource, pod }) => {
  const allResources = useClusterStore(state => state.resources);
  const openTerminal = useTerminalStore(state => state.openTerminal);
  const openDetails = useResourceDetailsStore(state => state.openDetails);
  
  const metadata = pod.metadata;
  const spec = pod.spec;
  const status = pod.status;
  const podLabels = metadata?.labels || {};

  // Calculate health status
  const getHealthStatus = (): HealthStatus => {
    const phase = status?.phase;
    if (phase === 'Running') {
      const ready = status?.conditions?.find(c => c.type === 'Ready' && c.status === 'True');
      return ready ? 'healthy' : 'warning';
    }
    if (phase === 'Succeeded') return 'healthy';
    if (phase === 'Pending') return 'warning';
    if (phase === 'Failed' || phase === 'Unknown') return 'error';
    return 'unknown';
  };

  const healthStatus = getHealthStatus();
  
  const getStatusText = (): string => {
    const phase = status?.phase || 'Unknown';
    if (phase === 'Running') {
      const ready = status?.conditions?.find(c => c.type === 'Ready' && c.status === 'True');
      return ready ? 'Running and Ready' : 'Running (not ready)';
    }
    return phase;
  };


  // Find services that target this pod
  const getRelatedServices = () => {
    return Object.values(allResources).filter(r => {
      if (r.kind !== 'Service' || r.namespace !== metadata?.namespace) return false;
      
      const selector = r.raw?.spec?.selector as Record<string, string> | undefined;
      if (!selector || Object.keys(selector).length === 0) return false;
      
      // Check if all selector labels match pod labels
      return Object.entries(selector).every(([key, value]) => podLabels[key] === value);
    });
  };

  const relatedServices = getRelatedServices();

  // Find ConfigMaps used by this Pod
  const getUsedConfigMaps = () => {
    const configMapNames = new Set<string>();
    const namespace = metadata?.namespace;
    
    // From volumes
    const volumes = spec?.volumes || [];
    for (const vol of volumes) {
      if (vol.configMap?.name) configMapNames.add(vol.configMap.name);
      // Projected sources
      if (vol.projected?.sources) {
        for (const source of vol.projected.sources) {
          if (source.configMap?.name) configMapNames.add(source.configMap.name);
        }
      }
    }
    
    // From containers
    const containers = [...(spec?.containers || []), ...(spec?.initContainers || [])];
    for (const container of containers) {
      // envFrom
      for (const envFrom of container.envFrom || []) {
        if (envFrom.configMapRef?.name) configMapNames.add(envFrom.configMapRef.name);
      }
      // env valueFrom
      for (const env of container.env || []) {
        if (env.valueFrom?.configMapKeyRef?.name) configMapNames.add(env.valueFrom.configMapKeyRef.name);
      }
    }
    
    // Match with actual resources
    return Array.from(configMapNames).map(name => {
      const cm = Object.values(allResources).find(
        r => r.kind === 'ConfigMap' && r.name === name && r.namespace === namespace
      );
      return { name, resource: cm };
    });
  };

  // Find Secrets used by this Pod
  const getUsedSecrets = () => {
    const secretNames = new Set<string>();
    const namespace = metadata?.namespace;
    
    // From volumes
    const volumes = spec?.volumes || [];
    for (const vol of volumes) {
      if (vol.secret?.secretName) secretNames.add(vol.secret.secretName);
      // Projected sources
      if (vol.projected?.sources) {
        for (const source of vol.projected.sources) {
          if (source.secret?.name) secretNames.add(source.secret.name);
        }
      }
    }
    
    // From containers
    const containers = [...(spec?.containers || []), ...(spec?.initContainers || [])];
    for (const container of containers) {
      // envFrom
      for (const envFrom of container.envFrom || []) {
        if (envFrom.secretRef?.name) secretNames.add(envFrom.secretRef.name);
      }
      // env valueFrom
      for (const env of container.env || []) {
        if (env.valueFrom?.secretKeyRef?.name) secretNames.add(env.valueFrom.secretKeyRef.name);
      }
    }
    
    // imagePullSecrets
    for (const pullSecret of spec?.imagePullSecrets || []) {
      if (pullSecret.name) secretNames.add(pullSecret.name);
    }
    
    // Match with actual resources
    return Array.from(secretNames).map(name => {
      const sec = Object.values(allResources).find(
        r => r.kind === 'Secret' && r.name === name && r.namespace === namespace
      );
      return { name, resource: sec };
    });
  };

  const usedConfigMaps = getUsedConfigMaps();
  const usedSecrets = getUsedSecrets();

  // Container counts
  const containerCount = spec?.containers?.length || 0;
  const initContainerCount = spec?.initContainers?.length || 0;
  const readyContainers = status?.containerStatuses?.filter(c => c.ready).length || 0;
  const totalRestarts = status?.containerStatuses?.reduce((sum, c) => sum + (c.restartCount || 0), 0) || 0;

  // Handler for opening terminal/logs for specific container
  const handleOpenTerminal = (type: 'shell' | 'logs', containerName?: string) => {
    openTerminal(
      resource.id,
      resource.name,
      metadata?.namespace || 'default',
      type,
      containerName
    );
  };

  return (
    <div className="space-y-6">
      {/* Status Banner */}
      <StatusBanner
        name={resource.name}
        namespace={metadata?.namespace}
        health={healthStatus}
        statusText={getStatusText()}
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard 
          icon={<CheckCircle2 className="text-emerald-400" />} 
          label="Ready" 
          value={`${readyContainers}/${containerCount}`} 
        />
        <StatCard 
          icon={<Box className="text-blue-400" />} 
          label="Containers" 
          value={containerCount + initContainerCount} 
        />
        <StatCard 
          icon={<ArrowUpCircle className="text-purple-400" />} 
          label="Restarts" 
          value={totalRestarts} 
        />
        <StatCard 
          icon={<Clock className="text-amber-400" />} 
          label="Age" 
          value={formatAge(metadata?.creationTimestamp?.toString())} 
        />
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Metadata */}
        <MetadataCard 
          metadata={metadata}
          showGeneration={false}
        />

        {/* Pod Info */}
        <Card>
          <CardHeader icon={<Server size={16} />} title="Pod Info" />
          <CardBody className="space-y-3 text-sm">
            <MetaRow label="Phase" value={
              <span className={
                status?.phase === 'Running' ? 'text-emerald-400' :
                status?.phase === 'Succeeded' ? 'text-blue-400' :
                status?.phase === 'Pending' ? 'text-amber-400' :
                'text-red-400'
              }>
                {status?.phase || 'Unknown'}
              </span>
            } />
            <MetaRow label="Node" value={spec?.nodeName || 'Not scheduled'} />
            <MetaRow label="Pod IP" value={status?.podIP || '-'} mono />
            <MetaRow label="Host IP" value={status?.hostIP || '-'} mono />
            <MetaRow label="QoS Class" value={status?.qosClass || '-'} />
            <MetaRow label="Restart Policy" value={spec?.restartPolicy || 'Always'} />
            {spec?.serviceAccountName && (
              <MetaRow label="Service Account" value={spec.serviceAccountName} />
            )}
            {spec?.priorityClassName && (
              <MetaRow label="Priority Class" value={spec.priorityClassName} />
            )}
          </CardBody>
        </Card>
      </div>

      {/* Owners / Controlled By - Generic Component with Full Chain */}
      <OwnerReferencesCard 
        ownerReferences={metadata?.ownerReferences}
        showFullChain
      />

      {/* Related Services */}
      {relatedServices.length > 0 && (
        <Card>
          <CardHeader 
            icon={<Network size={16} />} 
            title="Exposed By Services"
            badge={<span className="text-xs text-slate-500 ml-2">({relatedServices.length})</span>}
          />
          <CardBody>
            <div className="flex flex-wrap gap-2">
              {relatedServices.map(svc => {
                const svcType = svc.raw?.spec?.type || 'ClusterIP';
                const ports = svc.raw?.spec?.ports || [];
                
                return (
                  <button
                    key={svc.id}
                    onClick={() => openDetails(svc.id)}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg border bg-cyan-900/30 border-cyan-700/50 hover:bg-cyan-900/50 transition-all cursor-pointer hover:scale-105"
                    title={`Open Service: ${svc.name}`}
                  >
                    <Network size={14} className="text-cyan-400" />
                    <div className="text-left">
                      <div className="text-sm font-mono text-slate-200">{svc.name}</div>
                      <div className="text-xs text-slate-500">
                        {svcType} • {ports.map((p: any) => `${p.port}${p.targetPort ? ':' + p.targetPort : ''}`).join(', ')}
                      </div>
                    </div>
                    <ExternalLink size={12} className="text-slate-500" />
                  </button>
                );
              })}
            </div>
          </CardBody>
        </Card>
      )}

      {/* ConfigMaps Used */}
      {usedConfigMaps.length > 0 && (
        <Card>
          <CardHeader 
            icon={<Key size={16} />} 
            title="ConfigMaps Used"
            badge={<span className="text-xs text-slate-500 ml-2">({usedConfigMaps.length})</span>}
          />
          <CardBody>
            <div className="flex flex-wrap gap-2">
              {usedConfigMaps.map(cm => (
                <button
                  key={cm.name}
                  onClick={() => cm.resource && openDetails(cm.resource.id)}
                  disabled={!cm.resource}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${
                    cm.resource 
                      ? 'bg-blue-900/30 border-blue-700/50 hover:bg-blue-900/50 cursor-pointer hover:scale-105' 
                      : 'bg-slate-800/30 border-slate-700/50 cursor-not-allowed opacity-60'
                  }`}
                  title={cm.resource ? `Open ConfigMap: ${cm.name}` : `ConfigMap ${cm.name} not found`}
                >
                  <Key size={14} className="text-blue-400" />
                  <span className="text-sm font-mono text-slate-200">{cm.name}</span>
                  {cm.resource && <ExternalLink size={10} className="text-slate-500" />}
                </button>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Secrets Used */}
      {usedSecrets.length > 0 && (
        <Card>
          <CardHeader 
            icon={<Lock size={16} />} 
            title="Secrets Used"
            badge={<span className="text-xs text-slate-500 ml-2">({usedSecrets.length})</span>}
          />
          <CardBody>
            <div className="flex flex-wrap gap-2">
              {usedSecrets.map(sec => (
                <button
                  key={sec.name}
                  onClick={() => sec.resource && openDetails(sec.resource.id)}
                  disabled={!sec.resource}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${
                    sec.resource 
                      ? 'bg-amber-900/30 border-amber-700/50 hover:bg-amber-900/50 cursor-pointer hover:scale-105' 
                      : 'bg-slate-800/30 border-slate-700/50 cursor-not-allowed opacity-60'
                  }`}
                  title={sec.resource ? `Open Secret: ${sec.name}` : `Secret ${sec.name} not found`}
                >
                  <Lock size={14} className="text-amber-400" />
                  <span className="text-sm font-mono text-slate-200">{sec.name}</span>
                  {sec.resource && <ExternalLink size={10} className="text-slate-500" />}
                </button>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Container Statuses Quick View */}
      {status?.containerStatuses && status.containerStatuses.length > 0 && (
        <Card>
          <CardHeader 
            icon={<Box size={16} />} 
            title="Container Status"
            badge={<span className="text-xs text-slate-500 ml-2">({status.containerStatuses.length})</span>}
          />
          <div className="divide-y divide-slate-800">
            {status.containerStatuses.map((cs, i) => {
              const state = cs.state;
              const isRunning = !!state?.running;
              const isWaiting = !!state?.waiting;
              const isTerminated = !!state?.terminated;
              
              return (
                <div key={i} className="px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${
                      isRunning && cs.ready ? 'bg-emerald-400' :
                      isRunning ? 'bg-blue-400' :
                      isWaiting ? 'bg-amber-400' :
                      isTerminated ? 'bg-slate-400' : 'bg-red-400'
                    }`} />
                    <div>
                      <span className="text-sm font-medium text-slate-200">{cs.name}</span>
                      <span className="text-xs text-slate-500 ml-2">
                        {isRunning ? 'Running' : isWaiting ? `Waiting: ${state?.waiting?.reason}` : isTerminated ? 'Terminated' : 'Unknown'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Container Actions */}
                    <button
                      onClick={() => handleOpenTerminal('shell', cs.name)}
                      disabled={!isRunning}
                      className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-emerald-900/20 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      title={isRunning ? `Open shell in ${cs.name}` : 'Container not running'}
                    >
                      <Terminal size={14} />
                    </button>
                    <button
                      onClick={() => handleOpenTerminal('logs', cs.name)}
                      className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-blue-900/20 rounded transition-colors"
                      title={`View logs for ${cs.name}`}
                    >
                      <FileText size={14} />
                    </button>
                    
                    {/* Status info */}
                    <div className="flex items-center gap-3 ml-2 text-xs text-slate-500">
                      {cs.restartCount !== undefined && cs.restartCount > 0 && (
                        <span>{cs.restartCount} restart{cs.restartCount !== 1 ? 's' : ''}</span>
                      )}
                      {cs.ready && (
                        <span className="text-emerald-400">Ready</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Labels */}
      <LabelsCard labels={metadata?.labels} editable={false} />

      {/* Annotations */}
      <AnnotationsCard annotations={metadata?.annotations} editable={false} />

      {/* Conditions */}
      <ConditionsCard conditions={status?.conditions?.map(c => ({
        ...c,
        lastTransitionTime: c.lastTransitionTime?.toString()
      }))} />
    </div>
  );
};
