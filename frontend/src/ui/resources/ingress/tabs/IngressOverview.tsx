import React, { useState } from 'react';
import type { ClusterResource } from '../../../../api/types';
import type { V1Ingress } from '../../../../api/k8s-types';
import { useClusterStore } from '../../../../store/useClusterStore';
import { useResourceDetailsStore } from '../../../../store/useResourceDetailsStore';
import { 
  Globe, 
  Shield, 
  Server,
  Lock,
  Network,
  ExternalLink,
  Route,
  Layers
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
  model: V1Ingress;
  updateModel: (updater: (current: V1Ingress) => V1Ingress) => void;
}

export const IngressOverview: React.FC<Props> = ({ resource, model, updateModel }) => {
  const allResources = useClusterStore(state => state.resources);
  const openDetails = useResourceDetailsStore(state => state.openDetails);
  
  const metadata = model.metadata;
  const spec = model.spec;
  const status = model.status;

  // Get ingress class
  const ingressClass = spec?.ingressClassName || metadata?.annotations?.['kubernetes.io/ingress.class'] || 'default';

  // Get external addresses from status
  const getExternalAddresses = (): string[] => {
    const addresses: string[] = [];
    if (status?.loadBalancer?.ingress) {
      for (const ing of status.loadBalancer.ingress) {
        if (ing.ip) addresses.push(ing.ip);
        if (ing.hostname) addresses.push(ing.hostname);
      }
    }
    return addresses;
  };

  const externalAddresses = getExternalAddresses();

  // Get all hosts from rules
  const getAllHosts = (): string[] => {
    const hosts = new Set<string>();
    if (spec?.rules) {
      for (const rule of spec.rules) {
        if (rule.host) hosts.add(rule.host);
      }
    }
    return Array.from(hosts);
  };

  const allHosts = getAllHosts();

  // Get TLS hosts
  const getTlsHosts = (): { host: string; secretName?: string }[] => {
    const tlsHosts: { host: string; secretName?: string }[] = [];
    if (spec?.tls) {
      for (const tls of spec.tls) {
        if (tls.hosts) {
          for (const host of tls.hosts) {
            tlsHosts.push({ host, secretName: tls.secretName });
          }
        }
      }
    }
    return tlsHosts;
  };

  const tlsHosts = getTlsHosts();

  // Count rules and paths
  const getRuleCounts = () => {
    let ruleCount = spec?.rules?.length || 0;
    let pathCount = 0;
    if (spec?.rules) {
      for (const rule of spec.rules) {
        pathCount += rule.http?.paths?.length || 0;
      }
    }
    return { ruleCount, pathCount };
  };

  const { ruleCount, pathCount } = getRuleCounts();

  // Get all backend services
  const getAllBackendServices = (): { name: string; port: string | number; resource?: ClusterResource }[] => {
    const services: Map<string, { name: string; port: string | number; resource?: ClusterResource }> = new Map();
    
    // Default backend
    if (spec?.defaultBackend?.service?.name) {
      const svcName = spec.defaultBackend.service.name;
      const port = spec.defaultBackend.service.port?.number || spec.defaultBackend.service.port?.name || '';
      services.set(`${svcName}:${port}`, { name: svcName, port });
    }
    
    // Rule backends
    if (spec?.rules) {
      for (const rule of spec.rules) {
        if (rule.http?.paths) {
          for (const path of rule.http.paths) {
            if (path.backend?.service?.name) {
              const svcName = path.backend.service.name;
              const port = path.backend.service.port?.number || path.backend.service.port?.name || '';
              services.set(`${svcName}:${port}`, { name: svcName, port });
            }
          }
        }
      }
    }
    
    // Match with actual resources
    const result = Array.from(services.values()).map(svc => {
      const matchingService = Object.values(allResources).find(r => 
        r.kind === 'Service' && 
        r.name === svc.name && 
        r.namespace === metadata?.namespace
      );
      return { ...svc, resource: matchingService };
    });
    
    return result;
  };

  const backendServices = getAllBackendServices();

  // Calculate health status
  const getHealthStatus = (): HealthStatus => {
    // If we have external addresses, it's healthy
    if (externalAddresses.length > 0) {
      return 'healthy';
    }
    // If no rules, it's a warning
    if (!spec?.rules || spec.rules.length === 0) {
      return 'warning';
    }
    // Might be pending external IP
    return 'warning';
  };

  const healthStatus = getHealthStatus();

  const getStatusText = (): string => {
    if (externalAddresses.length > 0) {
      return `Active - ${externalAddresses.length} address${externalAddresses.length > 1 ? 'es' : ''}`;
    }
    if (!spec?.rules || spec.rules.length === 0) {
      return 'No rules defined';
    }
    return 'Pending external address';
  };

  // Handle label changes
  const handleAddLabel = (key: string, value: string) => {
    updateModel(current => ({
      ...current,
      metadata: {
        ...current.metadata,
        labels: {
          ...current.metadata?.labels,
          [key]: value
        }
      }
    }));
  };

  const handleRemoveLabel = (key: string) => {
    updateModel(current => {
      const newLabels = { ...current.metadata?.labels };
      delete newLabels[key];
      return {
        ...current,
        metadata: {
          ...current.metadata,
          labels: newLabels
        }
      };
    });
  };

  // Handle annotation changes
  const handleAddAnnotation = (key: string, value: string) => {
    updateModel(current => ({
      ...current,
      metadata: {
        ...current.metadata,
        annotations: {
          ...current.metadata?.annotations,
          [key]: value
        }
      }
    }));
  };

  const handleRemoveAnnotation = (key: string) => {
    updateModel(current => {
      const newAnnotations = { ...current.metadata?.annotations };
      delete newAnnotations[key];
      return {
        ...current,
        metadata: {
          ...current.metadata,
          annotations: newAnnotations
        }
      };
    });
  };

  // Editing ingress class
  const [editingClass, setEditingClass] = useState(false);
  const [newIngressClass, setNewIngressClass] = useState(spec?.ingressClassName || '');

  const handleSaveClass = () => {
    updateModel(current => ({
      ...current,
      spec: {
        ...current.spec,
        ingressClassName: newIngressClass || undefined
      }
    }));
    setEditingClass(false);
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

      {/* Top Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Ingress Class Card */}
        <Card>
          <CardHeader 
            icon={<Layers size={16} />} 
            title="Ingress Class"
            action={
              <button
                onClick={() => setEditingClass(!editingClass)}
                className="text-xs text-blue-400 hover:text-blue-300"
              >
                {editingClass ? 'Cancel' : 'Edit'}
              </button>
            }
          />
          <CardBody>
            {editingClass ? (
              <div className="space-y-3">
                <input
                  type="text"
                  value={newIngressClass}
                  onChange={(e) => setNewIngressClass(e.target.value)}
                  placeholder="nginx, traefik, etc."
                  className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
                />
                <button
                  onClick={handleSaveClass}
                  className="w-full px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded transition-colors flex items-center justify-center gap-2"
                >
                  Apply
                </button>
              </div>
            ) : (
              <div className="text-xl font-mono text-white">{ingressClass}</div>
            )}
          </CardBody>
        </Card>

        {/* Rules Summary Card */}
        <Card>
          <CardHeader icon={<Route size={16} />} title="Rules Summary" />
          <CardBody>
            <div className="flex items-center gap-4">
              <div>
                <div className="text-2xl font-mono text-blue-400">{ruleCount}</div>
                <div className="text-xs text-slate-500">Rules</div>
              </div>
              <div className="text-slate-600 text-xl">/</div>
              <div>
                <div className="text-2xl font-mono text-cyan-400">{pathCount}</div>
                <div className="text-xs text-slate-500">Paths</div>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* TLS Card */}
        <Card>
          <CardHeader icon={<Lock size={16} />} title="TLS" />
          <CardBody>
            {tlsHosts.length > 0 ? (
              <div className="space-y-1">
                <div className="text-xl font-mono text-emerald-400 flex items-center gap-2">
                  <Shield size={16} />
                  {tlsHosts.length} host{tlsHosts.length > 1 ? 's' : ''} secured
                </div>
                <div className="text-xs text-slate-500">
                  {tlsHosts.map(t => t.host).join(', ')}
                </div>
              </div>
            ) : (
              <div className="text-lg text-amber-400 flex items-center gap-2">
                <Shield size={16} className="opacity-50" />
                No TLS configured
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* External Addresses */}
      <Card>
        <CardHeader 
          icon={<Globe size={16} />} 
          title="External Addresses"
          badge={
            externalAddresses.length > 0 ? (
              <span className="text-xs ml-2 px-1.5 py-0.5 rounded bg-emerald-900/30 text-emerald-400 border border-emerald-800/30">
                {externalAddresses.length} active
              </span>
            ) : (
              <span className="text-xs ml-2 px-1.5 py-0.5 rounded bg-amber-900/30 text-amber-400 border border-amber-800/30">
                pending
              </span>
            )
          }
        />
        <CardBody>
          {externalAddresses.length > 0 ? (
            <div className="space-y-2">
              {externalAddresses.map((addr, i) => (
                <div key={i} className="flex items-center gap-2 bg-slate-800/50 p-2 rounded border border-slate-700">
                  <Network size={14} className="text-emerald-400" />
                  <span className="font-mono text-emerald-300">{addr}</span>
                  {allHosts.map(host => (
                    <a 
                      key={host}
                      href={`https://${host}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-auto text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                    >
                      {host}
                      <ExternalLink size={10} />
                    </a>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-4 text-slate-500">
              <Globe size={24} className="mx-auto mb-2 opacity-50" />
              <div className="text-sm">Waiting for load balancer...</div>
              <div className="text-xs mt-1">External address not yet assigned</div>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Hosts */}
      {allHosts.length > 0 && (
        <Card>
          <CardHeader 
            icon={<Globe size={16} />} 
            title="Hosts"
            badge={<span className="text-xs text-slate-500 ml-2">({allHosts.length})</span>}
          />
          <CardBody>
            <div className="flex flex-wrap gap-2">
              {allHosts.map(host => {
                const isTls = tlsHosts.some(t => t.host === host);
                return (
                  <span 
                    key={host}
                    className={clsx(
                      "flex items-center gap-1.5 px-2 py-1 rounded-lg text-sm font-mono border",
                      isTls 
                        ? "bg-emerald-900/20 border-emerald-800/50 text-emerald-300" 
                        : "bg-slate-800 border-slate-700 text-slate-300"
                    )}
                  >
                    {isTls && <Lock size={12} className="text-emerald-400" />}
                    {host}
                  </span>
                );
              })}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Backend Services */}
      <Card>
        <CardHeader 
          icon={<Server size={16} />} 
          title="Backend Services"
          badge={
            <span className={clsx(
              "text-xs ml-2 px-1.5 py-0.5 rounded",
              backendServices.length > 0 
                ? "bg-blue-900/30 text-blue-400 border border-blue-800/30" 
                : "bg-slate-800 text-slate-500 border border-slate-700"
            )}>
              {backendServices.length} service{backendServices.length !== 1 ? 's' : ''}
            </span>
          }
        />
        <CardBody>
          {backendServices.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {backendServices.map((svc, i) => (
                <button
                  key={i}
                  onClick={() => svc.resource && openDetails(svc.resource.id)}
                  disabled={!svc.resource}
                  className={clsx(
                    "flex items-center gap-2 px-3 py-2 rounded-md border text-sm font-mono transition-all",
                    svc.resource 
                      ? "bg-blue-900/30 border-blue-700/50 text-blue-300 hover:bg-blue-900/50 cursor-pointer hover:scale-105" 
                      : "bg-slate-800/50 border-slate-700 text-slate-400 cursor-not-allowed"
                  )}
                  title={svc.resource ? `Open ${svc.name}` : `Service ${svc.name} not found`}
                >
                  <Server size={14} />
                  <span>{svc.name}</span>
                  {svc.port && (
                    <span className="text-xs bg-slate-800 px-1.5 py-0.5 rounded">
                      :{svc.port}
                    </span>
                  )}
                  {svc.resource && <ExternalLink size={10} className="text-slate-500" />}
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-4 text-slate-500">
              <Server size={24} className="mx-auto mb-2 opacity-50" />
              <div className="text-sm">No backend services defined</div>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Metadata & Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <MetadataCard metadata={metadata} showGeneration={false} />

        {/* TLS Details */}
        {tlsHosts.length > 0 && (
          <Card>
            <CardHeader icon={<Lock size={16} />} title="TLS Configuration" />
            <CardBody className="space-y-3 text-sm">
              {spec?.tls?.map((tls, i) => (
                <div key={i} className="bg-slate-800/50 p-3 rounded border border-slate-700 space-y-2">
                  <MetaRow label="Secret" value={tls.secretName || 'No secret'} />
                  <div className="text-xs text-slate-500">
                    Hosts: {tls.hosts?.join(', ') || 'All'}
                  </div>
                </div>
              ))}
            </CardBody>
          </Card>
        )}
      </div>

      {/* Labels */}
      <LabelsCard 
        labels={metadata?.labels} 
        editable 
        onAdd={handleAddLabel}
        onRemove={handleRemoveLabel}
      />

      {/* Annotations */}
      <AnnotationsCard 
        annotations={metadata?.annotations} 
        editable 
        onAdd={handleAddAnnotation}
        onRemove={handleRemoveAnnotation}
      />
    </div>
  );
};
