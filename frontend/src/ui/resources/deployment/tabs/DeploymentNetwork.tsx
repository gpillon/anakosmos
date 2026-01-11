import React, { useState } from 'react';
import type { ClusterResource } from '../../../../api/types';
import { 
  Globe, 
  Plus, 
  Trash2, 
  Server,
  Network,
  Save,
  RefreshCw,
  AlertCircle
} from 'lucide-react';

interface Props {
  resource: ClusterResource;
  onApply: (updatedRaw: any) => Promise<void>;
}

export const DeploymentNetwork: React.FC<Props> = ({ resource, onApply }) => {
  const raw = resource.raw;
  const template = raw?.spec?.template?.spec || {};
  
  const [hostname, setHostname] = useState<string>(template.hostname || '');
  const [subdomain, setSubdomain] = useState<string>(template.subdomain || '');
  const [setHostnameAsFQDN, setSetHostnameAsFQDN] = useState<boolean>(template.setHostnameAsFQDN || false);
  const [dnsPolicy, setDnsPolicy] = useState<string>(template.dnsPolicy || 'ClusterFirst');
  const [dnsConfig, setDnsConfig] = useState<any>(template.dnsConfig || {});
  const [hostAliases, setHostAliases] = useState<Array<{ ip: string; hostnames: string[] }>>(template.hostAliases || []);
  const [enableServiceLinks, setEnableServiceLinks] = useState<boolean | undefined>(template.enableServiceLinks);
  
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = JSON.parse(JSON.stringify(raw));
      const spec = updated.spec.template.spec;
      
      spec.hostname = hostname || undefined;
      spec.subdomain = subdomain || undefined;
      spec.setHostnameAsFQDN = setHostnameAsFQDN || undefined;
      spec.dnsPolicy = dnsPolicy !== 'ClusterFirst' ? dnsPolicy : undefined;
      spec.dnsConfig = Object.keys(dnsConfig).length > 0 ? dnsConfig : undefined;
      spec.hostAliases = hostAliases.length > 0 ? hostAliases : undefined;
      spec.enableServiceLinks = enableServiceLinks;
      
      await onApply(updated);
      setHasChanges(false);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const markChanged = () => setHasChanges(true);

  const updateDnsConfig = (updates: any) => {
    const newConfig = { ...dnsConfig, ...updates };
    Object.keys(newConfig).forEach(k => {
      if (!newConfig[k] || (Array.isArray(newConfig[k]) && newConfig[k].length === 0)) {
        delete newConfig[k];
      }
    });
    setDnsConfig(newConfig);
    markChanged();
  };

  return (
    <div className="space-y-6">
      {/* Save Banner */}
      {hasChanges && (
        <div className="sticky top-0 z-10 bg-amber-900/80 backdrop-blur-sm border border-amber-700 rounded-lg p-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-amber-200">
            <AlertCircle size={16} />
            <span className="text-sm font-medium">You have unsaved changes</span>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-1.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-sm font-bold rounded transition-colors"
          >
            {saving ? <RefreshCw className="animate-spin" size={14} /> : <Save size={14} />}
            Save Changes
          </button>
        </div>
      )}

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
                onChange={(e) => { setHostname(e.target.value); markChanged(); }}
                placeholder="my-pod"
                className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Subdomain</label>
              <input
                type="text"
                value={subdomain}
                onChange={(e) => { setSubdomain(e.target.value); markChanged(); }}
                placeholder="my-subdomain"
                className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={setHostnameAsFQDN}
              onChange={(e) => { setSetHostnameAsFQDN(e.target.checked); markChanged(); }}
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
              onChange={(e) => { setDnsPolicy(e.target.value); markChanged(); }}
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

          {/* DNS Config (always shown, required for None policy) */}
          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
            <h4 className="text-sm font-semibold text-slate-300 mb-3">Custom DNS Config</h4>
            
            {/* Nameservers */}
            <div className="mb-4">
              <label className="text-xs text-slate-400 mb-1 block">Nameservers</label>
              <input
                type="text"
                value={dnsConfig.nameservers?.join(', ') || ''}
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
                value={dnsConfig.searches?.join(', ') || ''}
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
                      options: [...(dnsConfig.options || []), { name: '', value: '' }]
                    });
                  }}
                  className="text-xs text-blue-400 hover:text-blue-300"
                >
                  <Plus size={12} className="inline mr-1" /> Add Option
                </button>
              </div>
              {(dnsConfig.options || []).length === 0 ? (
                <div className="text-xs text-slate-500">No custom options</div>
              ) : (
                <div className="space-y-2">
                  {dnsConfig.options?.map((opt: any, i: number) => (
                    <div key={i} className="flex gap-2 items-center">
                      <input
                        type="text"
                        value={opt.name}
                        onChange={(e) => {
                          const newOpts = [...dnsConfig.options];
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
                          const newOpts = [...dnsConfig.options];
                          newOpts[i] = { ...opt, value: e.target.value || undefined };
                          updateDnsConfig({ options: newOpts });
                        }}
                        placeholder="5"
                        className="w-24 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-white"
                      />
                      <button
                        onClick={() => {
                          const newOpts = dnsConfig.options.filter((_: any, idx: number) => idx !== i);
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

          {/* Common DNS Options Reference */}
          <div className="text-xs text-slate-500 bg-slate-800/30 rounded p-3 border border-slate-700/50">
            <strong>Common DNS Options:</strong>
            <ul className="mt-1 space-y-1">
              <li><code className="text-slate-400">ndots</code> - Number of dots in a name to trigger absolute lookup (default: 5)</li>
              <li><code className="text-slate-400">timeout</code> - Initial timeout for DNS query (default: varies)</li>
              <li><code className="text-slate-400">attempts</code> - Number of attempts before giving up (default: varies)</li>
              <li><code className="text-slate-400">rotate</code> - Round-robin selection of nameservers</li>
              <li><code className="text-slate-400">single-request</code> - Make A and AAAA queries sequentially</li>
            </ul>
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
            onClick={() => { 
              setHostAliases([...hostAliases, { ip: '', hostnames: [] }]); 
              markChanged(); 
            }}
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
                          setHostAliases(newAliases);
                          markChanged();
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
                          setHostAliases(newAliases);
                          markChanged();
                        }}
                        placeholder="host1.example.com, host2.example.com"
                        className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-white"
                      />
                    </div>
                    <button
                      onClick={() => {
                        setHostAliases(hostAliases.filter((_, idx) => idx !== i));
                        markChanged();
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
              onChange={(e) => { 
                setEnableServiceLinks(e.target.checked ? undefined : false); 
                markChanged(); 
              }}
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
