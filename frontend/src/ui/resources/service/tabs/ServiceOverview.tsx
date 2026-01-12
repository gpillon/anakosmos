import React, { useState } from 'react';
import type { ClusterResource } from '../../../../api/types';
import type { V1Service } from '../../../../api/k8s-types';
import { useClusterStore } from '../../../../store/useClusterStore';
import { useResourceDetailsStore } from '../../../../store/useResourceDetailsStore';
import { 
  Network, 
  Globe, 
  Shield, 
  Server,
  RefreshCw,
  Tag,
  Box,
  ExternalLink
} from 'lucide-react';
import {
  StatusBanner,
  MetadataCard,
  LabelsCard,
  AnnotationsCard,
  Card,
  CardHeader,
  CardBody,
  MetaRow,
  type HealthStatus
} from '../../shared';
import { clsx } from 'clsx';

interface Props {
  resource: ClusterResource;
  service: V1Service;
  onApply: (updatedRaw: V1Service) => Promise<void>;
}

export const ServiceOverview: React.FC<Props> = ({ resource, service, onApply }) => {
  const [saving, setSaving] = useState(false);
  const allResources = useClusterStore(state => state.resources);
  const openDetails = useResourceDetailsStore(state => state.openDetails);
  
  const metadata = service.metadata;
  const spec = service.spec;
  const status = service.status;
  const selector = spec?.selector as Record<string, string> | undefined;

  // Find pods matching the service selector
  const getMatchingPods = () => {
    if (!selector || Object.keys(selector).length === 0) return [];
    
    return Object.values(allResources).filter(r => {
      if (r.kind !== 'Pod' || r.namespace !== metadata?.namespace) return false;
      
      const podLabels = r.raw?.metadata?.labels as Record<string, string> | undefined;
      if (!podLabels) return false;
      
      // Check if all selector labels match pod labels
      return Object.entries(selector).every(([key, value]) => podLabels[key] === value);
    });
  };

  const matchingPods = getMatchingPods();

  // Calculate health status
  const getHealthStatus = (): HealthStatus => {
    if (!spec) return 'unknown';
    
    // LoadBalancer service without external IP might be pending
    if (spec.type === 'LoadBalancer') {
      const hasExternalIP = status?.loadBalancer?.ingress && status.loadBalancer.ingress.length > 0;
      return hasExternalIP ? 'healthy' : 'warning';
    }
    
    // ClusterIP and NodePort are generally healthy if they exist
    return 'healthy';
  };

  const healthStatus = getHealthStatus();

  const getStatusText = (): string => {
    const type = spec?.type || 'ClusterIP';
    if (type === 'LoadBalancer') {
      const hasExternalIP = status?.loadBalancer?.ingress && status.loadBalancer.ingress.length > 0;
      return hasExternalIP ? 'LoadBalancer Active' : 'LoadBalancer Pending';
    }
    return `${type} Active`;
  };

  // External IP display
  const getExternalIP = (): string => {
    if (status?.loadBalancer?.ingress?.[0]?.ip) {
      return status.loadBalancer.ingress[0].ip;
    }
    if (status?.loadBalancer?.ingress?.[0]?.hostname) {
      return status.loadBalancer.ingress[0].hostname;
    }
    if (spec?.externalIPs && spec.externalIPs.length > 0) {
      return spec.externalIPs.join(', ');
    }
    return 'None';
  };

  // Handle label changes
  const handleAddLabel = async (key: string, value: string) => {
    setSaving(true);
    try {
      const updated = JSON.parse(JSON.stringify(service)) as V1Service;
      if (!updated.metadata) updated.metadata = {};
      if (!updated.metadata.labels) updated.metadata.labels = {};
      updated.metadata.labels[key] = value;
      await onApply(updated);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveLabel = async (key: string) => {
    setSaving(true);
    try {
      const updated = JSON.parse(JSON.stringify(service)) as V1Service;
      if (updated.metadata?.labels) {
        delete updated.metadata.labels[key];
      }
      await onApply(updated);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  // Handle annotation changes
  const handleAddAnnotation = async (key: string, value: string) => {
    setSaving(true);
    try {
      const updated = JSON.parse(JSON.stringify(service)) as V1Service;
      if (!updated.metadata) updated.metadata = {};
      if (!updated.metadata.annotations) updated.metadata.annotations = {};
      updated.metadata.annotations[key] = value;
      await onApply(updated);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveAnnotation = async (key: string) => {
    setSaving(true);
    try {
      const updated = JSON.parse(JSON.stringify(service)) as V1Service;
      if (updated.metadata?.annotations) {
        delete updated.metadata.annotations[key];
      }
      await onApply(updated);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  // Editing service type
  const [editingType, setEditingType] = useState(false);
  const [serviceType, setServiceType] = useState(spec?.type || 'ClusterIP');

  const handleSaveType = async () => {
    setSaving(true);
    try {
      const updated = JSON.parse(JSON.stringify(service)) as V1Service;
      if (!updated.spec) updated.spec = {};
      updated.spec.type = serviceType;
      await onApply(updated);
      setEditingType(false);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
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

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Type Card */}
        <Card>
          <CardHeader 
            icon={<Network size={16} />} 
            title="Type"
            action={
              <button
                onClick={() => setEditingType(!editingType)}
                className="text-xs text-blue-400 hover:text-blue-300"
              >
                {editingType ? 'Cancel' : 'Edit'}
              </button>
            }
          />
          <CardBody>
            {editingType ? (
              <div className="space-y-3">
                <select
                  value={serviceType}
                  onChange={(e) => setServiceType(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="ClusterIP">ClusterIP</option>
                  <option value="NodePort">NodePort</option>
                  <option value="LoadBalancer">LoadBalancer</option>
                  <option value="ExternalName">ExternalName</option>
                </select>
                <button
                  onClick={handleSaveType}
                  disabled={saving}
                  className="w-full px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold rounded transition-colors flex items-center justify-center gap-2"
                >
                  {saving && <RefreshCw className="animate-spin" size={12} />}
                  Save
                </button>
              </div>
            ) : (
              <div className="text-xl font-mono text-white">{spec?.type || 'ClusterIP'}</div>
            )}
          </CardBody>
        </Card>

        {/* Cluster IP Card */}
        <Card>
          <CardHeader icon={<Shield size={16} />} title="Cluster IP" />
          <CardBody>
            <div className="text-lg font-mono text-emerald-400">
              {spec?.clusterIP || 'None'}
            </div>
            {spec?.clusterIPs && spec.clusterIPs.length > 1 && (
              <div className="mt-2 text-xs text-slate-500">
                {spec.clusterIPs.slice(1).join(', ')}
              </div>
            )}
          </CardBody>
        </Card>

        {/* External IP Card */}
        <Card>
          <CardHeader icon={<Globe size={16} />} title="External IP" />
          <CardBody>
            <div className="text-lg font-mono text-blue-400">
              {getExternalIP()}
            </div>
          </CardBody>
        </Card>
      </div>

      {/* More Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Metadata */}
        <MetadataCard metadata={metadata} showGeneration={false} />

        {/* Service Details */}
        <Card>
          <CardHeader icon={<Server size={16} />} title="Service Details" />
          <CardBody className="space-y-3 text-sm">
            <MetaRow label="Session Affinity" value={spec?.sessionAffinity || 'None'} />
            <MetaRow label="IP Families" value={spec?.ipFamilies?.join(', ') || 'IPv4'} />
            <MetaRow label="IP Family Policy" value={spec?.ipFamilyPolicy || 'SingleStack'} />
            {spec?.externalTrafficPolicy && (
              <MetaRow label="External Traffic Policy" value={spec.externalTrafficPolicy} />
            )}
            {spec?.internalTrafficPolicy && (
              <MetaRow label="Internal Traffic Policy" value={spec.internalTrafficPolicy} />
            )}
            {spec?.healthCheckNodePort && (
              <MetaRow label="Health Check Node Port" value={spec.healthCheckNodePort} />
            )}
          </CardBody>
        </Card>
      </div>

      {/* Selector */}
      {spec?.selector && Object.keys(spec.selector).length > 0 && (
        <Card>
          <CardHeader 
            icon={<Tag size={16} />} 
            title="Selector"
            badge={<span className="text-xs text-slate-500 ml-2">({Object.keys(spec.selector).length})</span>}
          />
          <CardBody>
            <div className="flex flex-wrap gap-2">
              {Object.entries(spec.selector).map(([key, value]) => (
                <span 
                  key={key} 
                  className="flex items-center gap-1 bg-slate-800 text-slate-300 px-2 py-1 rounded-lg text-xs font-mono border border-slate-700"
                >
                  <span className="text-purple-400">{key}</span>
                  <span className="text-slate-500">=</span>
                  <span>{String(value)}</span>
                </span>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Target Pods */}
      <Card>
        <CardHeader 
          icon={<Box size={16} />} 
          title="Target Pods"
          badge={
            <span className={clsx(
              "text-xs ml-2 px-1.5 py-0.5 rounded",
              matchingPods.length > 0 
                ? "bg-emerald-900/30 text-emerald-400 border border-emerald-800/30" 
                : "bg-amber-900/30 text-amber-400 border border-amber-800/30"
            )}>
              {matchingPods.length} {matchingPods.length === 1 ? 'pod' : 'pods'}
            </span>
          }
        />
        <CardBody>
          {matchingPods.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {matchingPods.map(pod => {
                const podPhase = pod.status as string;
                const isReady = pod.raw?.status?.conditions?.find((c: any) => c.type === 'Ready' && c.status === 'True');
                
                return (
                  <button
                    key={pod.id}
                    onClick={() => openDetails(pod.id)}
                    className={clsx(
                      "flex items-center gap-1.5 px-2 py-1.5 rounded-md border text-xs font-mono transition-all cursor-pointer",
                      "hover:scale-105 hover:shadow-lg",
                      podPhase === 'Running' && isReady 
                        ? "bg-emerald-900/30 border-emerald-700/50 text-emerald-300 hover:bg-emerald-900/50" 
                        : podPhase === 'Running' 
                        ? "bg-blue-900/30 border-blue-700/50 text-blue-300 hover:bg-blue-900/50" 
                        : podPhase === 'Pending' 
                        ? "bg-amber-900/30 border-amber-700/50 text-amber-300 hover:bg-amber-900/50" 
                        : "bg-red-900/30 border-red-700/50 text-red-300 hover:bg-red-900/50"
                    )}
                    title={`${pod.name} (${podPhase}${isReady ? ', Ready' : ''})`}
                  >
                    <Box size={12} />
                    <span className="truncate max-w-[120px]">{pod.name}</span>
                    <span className={clsx(
                      "w-2 h-2 rounded-full shrink-0",
                      podPhase === 'Running' && isReady ? "bg-emerald-400" :
                      podPhase === 'Running' ? "bg-blue-400" :
                      podPhase === 'Pending' ? "bg-amber-400 animate-pulse" :
                      "bg-red-400"
                    )} />
                    <ExternalLink size={10} className="text-slate-500" />
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-4 text-slate-500">
              <Box size={24} className="mx-auto mb-2 opacity-50" />
              <div className="text-sm">No matching pods found</div>
              <div className="text-xs mt-1">
                {selector && Object.keys(selector).length > 0 
                  ? 'No pods match the selector labels'
                  : 'Service has no selector defined'}
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Labels */}
      <LabelsCard 
        labels={metadata?.labels} 
        editable 
        onAdd={handleAddLabel}
        onRemove={handleRemoveLabel}
        saving={saving}
      />

      {/* Annotations */}
      <AnnotationsCard 
        annotations={metadata?.annotations} 
        editable 
        onAdd={handleAddAnnotation}
        onRemove={handleRemoveAnnotation}
        saving={saving}
      />
    </div>
  );
};
