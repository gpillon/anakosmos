import React from 'react';
import type { ClusterResource } from '../../../../api/types';
import type { V1Deployment } from '../../../../api/k8s-types';
import { 
  Globe, 
  Plus, 
  Trash2, 
  Server,
  Network
} from 'lucide-react';

interface Props {
  resource: ClusterResource;
  model: V1Deployment;
  updateModel: (updater: (current: V1Deployment) => V1Deployment) => void;
}

export const DeploymentNetwork: React.FC<Props> = ({ model, updateModel }) => {
  const template = model?.spec?.template?.spec;

  // Helper to update template spec
  const updateTemplateSpec = (updates: Record<string, unknown>) => {
    updateModel(current => {
      const currentSpec = current.spec?.template?.spec;
      return {
        ...current,
        spec: {
          ...current.spec,
          selector: current.spec?.selector || { matchLabels: {} },
          template: {
            ...current.spec?.template,
            spec: {
              ...currentSpec,
              containers: currentSpec?.containers || [],
              ...updates
            }
          }
        }
      };
    });
  };

  const hostname = template?.hostname || '';
  const subdomain = template?.subdomain || '';
  const setHostnameAsFQDN = template?.setHostnameAsFQDN || false;
  const dnsPolicy = template?.dnsPolicy || 'ClusterFirst';
  const dnsConfig = template?.dnsConfig || {};
  const hostAliases = (template?.hostAliases || []) as Array<{ ip: string; hostnames: string[] }>;
  const enableServiceLinks = template?.enableServiceLinks;

  const updateDnsConfig = (updates: Record<string, unknown>) => {
    const newConfig = { ...dnsConfig, ...updates };
    Object.keys(newConfig).forEach(k => {
      if (!(newConfig as Record<string, unknown>)[k] || (Array.isArray((newConfig as Record<string, unknown>)[k]) && ((newConfig as Record<string, unknown>)[k] as unknown[]).length === 0)) {
        delete (newConfig as Record<string, unknown>)[k];
      }
    });
    updateTemplateSpec({ dnsConfig: Object.keys(newConfig).length > 0 ? newConfig : undefined });
  };

  return (
    <div className="space-y-6">
      {/* Hostname Settings */}
      <div className="bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden">
        <div className="px-4 py-3 bg-slate-800/50 border-b border-slate-700 flex items-center gap-2">
          <Server size={16} className="text-blue-400" />
          <span className="font-semibold text-slate-200">Hostname</span>
        </div>
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Hostname</label>
              <input
                type="text"
                value={hostname}
                onChange={(e) => updateTemplateSpec({ hostname: e.target.value || undefined })}
                placeholder="my-pod"
                className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Subdomain</label>
              <input
                type="text"
                value={subdomain}
                onChange={(e) => updateTemplateSpec({ subdomain: e.target.value || undefined })}
                placeholder="my-subdomain"
                className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={setHostnameAsFQDN}
              onChange={(e) => updateTemplateSpec({ setHostnameAsFQDN: e.target.checked || undefined })}
              className="w-4 h-4 rounded border-slate-600 bg-slate-800"
            />
            <span className="text-sm text-slate-300">Set Hostname as FQDN</span>
          </label>
          <p className="text-xs text-slate-500">
            When subdomain is set and a headless service with matching name exists, 
            the pod gets a FQDN: <code className="text-slate-400">hostname.subdomain.namespace.svc.cluster.local</code>
          </p>
        </div>
      </div>

      {/* DNS Configuration */}
      <div className="bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden">
        <div className="px-4 py-3 bg-slate-800/50 border-b border-slate-700 flex items-center gap-2">
          <Globe size={16} className="text-emerald-400" />
          <span className="font-semibold text-slate-200">DNS Configuration</span>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="text-xs text-slate-400 mb-1 block">DNS Policy</label>
            <select
              value={dnsPolicy}
              onChange={(e) => updateTemplateSpec({ dnsPolicy: e.target.value !== 'ClusterFirst' ? e.target.value : undefined })}
              className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
            >
              <option value="ClusterFirst">ClusterFirst (default)</option>
              <option value="ClusterFirstWithHostNet">ClusterFirstWithHostNet</option>
              <option value="Default">Default (use node's DNS)</option>
              <option value="None">None (requires dnsConfig)</option>
            </select>
            <p className="text-xs text-slate-500 mt-1">
              {dnsPolicy === 'ClusterFirst' && 'DNS queries go to cluster DNS first, then upstream.'}
              {dnsPolicy === 'ClusterFirstWithHostNet' && 'Same as ClusterFirst but for pods using host network.'}
              {dnsPolicy === 'Default' && 'Pod inherits DNS resolution from the node.'}
              {dnsPolicy === 'None' && 'All DNS settings come from dnsConfig below.'}
            </p>
          </div>

          {/* DNS Config */}
          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
            <h4 className="text-sm font-semibold text-slate-300 mb-3">Custom DNS Config</h4>
            
            {/* Nameservers */}
            <div className="mb-4">
              <label className="text-xs text-slate-400 mb-1 block">Nameservers</label>
              <input
                type="text"
                value={((dnsConfig as Record<string, unknown>).nameservers as string[] | undefined)?.join(', ') || ''}
                onChange={(e) => {
                  const servers = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                  updateDnsConfig({ nameservers: servers.length > 0 ? servers : undefined });
                }}
                placeholder="8.8.8.8, 8.8.4.4"
                className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-white font-mono"
              />
              <p className="text-xs text-slate-500 mt-1">Max 3 IP addresses</p>
            </div>

            {/* Searches */}
            <div className="mb-4">
              <label className="text-xs text-slate-400 mb-1 block">Search Domains</label>
              <input
                type="text"
                value={((dnsConfig as Record<string, unknown>).searches as string[] | undefined)?.join(', ') || ''}
                onChange={(e) => {
                  const searches = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                  updateDnsConfig({ searches: searches.length > 0 ? searches : undefined });
                }}
                placeholder="ns1.svc.cluster.local, svc.cluster.local"
                className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-white font-mono"
              />
              <p className="text-xs text-slate-500 mt-1">Max 6 search domains</p>
            </div>

            {/* Options */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs text-slate-400">Options</label>
                <button
                  onClick={() => {
                    updateDnsConfig({
                      options: [...(((dnsConfig as Record<string, unknown>).options as Array<{ name: string; value?: string }> | undefined) || []), { name: '', value: '' }]
                    });
                  }}
                  className="text-xs text-blue-400 hover:text-blue-300"
                >
                  <Plus size={12} className="inline mr-1" /> Add Option
                </button>
              </div>
              {(((dnsConfig as Record<string, unknown>).options as Array<{ name: string; value?: string }> | undefined) || []).length === 0 ? (
                <div className="text-xs text-slate-500">No custom options</div>
              ) : (
                <div className="space-y-2">
                  {(((dnsConfig as Record<string, unknown>).options as Array<{ name: string; value?: string }> | undefined) || []).map((opt, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <input
                        type="text"
                        value={opt.name}
                        onChange={(e) => {
                          const newOpts = [...(((dnsConfig as Record<string, unknown>).options as Array<{ name: string; value?: string }>) || [])];
                          newOpts[i] = { ...opt, name: e.target.value };
                          updateDnsConfig({ options: newOpts });
                        }}
                        placeholder="ndots"
                        className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-white"
                      />
                      <input
                        type="text"
                        value={opt.value || ''}
                        onChange={(e) => {
                          const newOpts = [...(((dnsConfig as Record<string, unknown>).options as Array<{ name: string; value?: string }>) || [])];
                          newOpts[i] = { ...opt, value: e.target.value || undefined };
                          updateDnsConfig({ options: newOpts });
                        }}
                        placeholder="5"
                        className="w-24 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-white"
                      />
                      <button
                        onClick={() => {
                          const newOpts = (((dnsConfig as Record<string, unknown>).options as Array<{ name: string; value?: string }>) || []).filter((_, idx) => idx !== i);
                          updateDnsConfig({ options: newOpts.length > 0 ? newOpts : undefined });
                        }}
                        className="text-red-400 hover:text-red-300"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Host Aliases */}
      <div className="bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden">
        <div className="px-4 py-3 bg-slate-800/50 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Network size={16} className="text-purple-400" />
            <span className="font-semibold text-slate-200">Host Aliases</span>
          </div>
          <button
            onClick={() => updateTemplateSpec({ hostAliases: [...hostAliases, { ip: '', hostnames: [] }] })}
            className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300"
          >
            <Plus size={14} /> Add Entry
          </button>
        </div>
        <div className="p-4">
          <p className="text-xs text-slate-500 mb-4">
            Add entries to the pod's /etc/hosts file. Useful for custom hostname resolution.
          </p>
          
          {hostAliases.length === 0 ? (
            <div className="text-center py-6 text-slate-500">
              <Network size={24} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">No host aliases configured</p>
            </div>
          ) : (
            <div className="space-y-3">
              {hostAliases.map((alias, i) => (
                <div key={i} className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
                  <div className="flex gap-3 items-start">
                    <div className="w-36">
                      <label className="text-xs text-slate-400 mb-1 block">IP Address</label>
                      <input
                        type="text"
                        value={alias.ip}
                        onChange={(e) => {
                          const newAliases = [...hostAliases];
                          newAliases[i] = { ...alias, ip: e.target.value };
                          updateTemplateSpec({ hostAliases: newAliases });
                        }}
                        placeholder="10.0.0.1"
                        className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-white font-mono"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs text-slate-400 mb-1 block">Hostnames</label>
                      <input
                        type="text"
                        value={alias.hostnames.join(', ')}
                        onChange={(e) => {
                          const newAliases = [...hostAliases];
                          newAliases[i] = { 
                            ...alias, 
                            hostnames: e.target.value.split(',').map(s => s.trim()).filter(Boolean) 
                          };
                          updateTemplateSpec({ hostAliases: newAliases });
                        }}
                        placeholder="host1.example.com, host2.example.com"
                        className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-white"
                      />
                    </div>
                    <button
                      onClick={() => {
                        const newAliases = hostAliases.filter((_, idx) => idx !== i);
                        updateTemplateSpec({ hostAliases: newAliases.length > 0 ? newAliases : undefined });
                      }}
                      className="mt-5 text-red-400 hover:text-red-300"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Service Links */}
      <div className="bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden">
        <div className="px-4 py-3 bg-slate-800/50 border-b border-slate-700 flex items-center gap-2">
          <Network size={16} className="text-cyan-400" />
          <span className="font-semibold text-slate-200">Service Discovery</span>
        </div>
        <div className="p-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={enableServiceLinks !== false}
              onChange={(e) => updateTemplateSpec({ enableServiceLinks: e.target.checked ? undefined : false })}
              className="w-4 h-4 rounded border-slate-600 bg-slate-800"
            />
            <span className="text-sm text-slate-300">Enable Service Links</span>
          </label>
          <p className="text-xs text-slate-500 mt-2">
            When enabled (default), environment variables are created for each service in the same namespace,
            following the Docker links naming convention (e.g., <code className="text-slate-400">MYSERVICE_SERVICE_HOST</code>).
            Disable if you have many services to avoid hitting environment variable limits.
          </p>
        </div>
      </div>
    </div>
  );
};
