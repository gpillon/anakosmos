import React, { useState, useEffect } from 'react';
import type { V1Ingress } from '../../../../api/k8s-types';
import { useClusterStore } from '../../../../store/useClusterStore';
import { 
  Lock, 
  Shield, 
  Plus, 
  Trash2, 
  RefreshCw,
  Check,
  AlertTriangle,
  Award
} from 'lucide-react';
import {
  Card,
  CardHeader,
  CardBody,
  Combobox,
} from '../../shared';
import { clsx } from 'clsx';

interface Props {
  ingress: V1Ingress;
  onApply: (updatedRaw: V1Ingress) => Promise<void>;
}

export const IngressTLS: React.FC<Props> = ({ ingress, onApply }) => {
  const { client } = useClusterStore();
  const [saving, setSaving] = useState(false);
  
  // TLS List State
  const [addingTls, setAddingTls] = useState(false);
  const [newTls, setNewTls] = useState({ hosts: '', secretName: '' });

  // Cert Manager State
  const [issuers, setIssuers] = useState<string[]>([]);
  const [clusterIssuers, setClusterIssuers] = useState<string[]>([]);
  const [loadingIssuers, setLoadingIssuers] = useState(false);
  
  const metadata = ingress.metadata;
  const spec = ingress.spec;
  const annotations = metadata?.annotations || {};
  
  const certManagerIssuer = annotations['cert-manager.io/issuer'];
  const certManagerClusterIssuer = annotations['cert-manager.io/cluster-issuer'];
  const hasCertManager = !!(certManagerIssuer || certManagerClusterIssuer);
  
  const [useCertManager, setUseCertManager] = useState(hasCertManager);
  const [selectedIssuerType, setSelectedIssuerType] = useState<'Issuer' | 'ClusterIssuer'>(
    certManagerClusterIssuer ? 'ClusterIssuer' : 'Issuer'
  );
  const [selectedIssuer, setSelectedIssuer] = useState(
    certManagerClusterIssuer || certManagerIssuer || ''
  );

  // Fetch Issuers and ClusterIssuers
  useEffect(() => {
    const fetchIssuers = async () => {
      if (!client) return;
      setLoadingIssuers(true);
      try {
        // Try fetching Issuers in current namespace (try v1, fallback handling in client handled by try-catch usually)
        // We assume cert-manager v1 is used
        const issuersList = await client.listResources('cert-manager.io/v1', 'issuers');
        if (issuersList?.items) {
          setIssuers(issuersList.items
            .filter((i: any) => i.metadata.namespace === metadata?.namespace)
            .map((i: any) => i.metadata.name)
          );
        }

        // Try fetching ClusterIssuers
        const clusterIssuersList = await client.listResources('cert-manager.io/v1', 'clusterissuers');
        if (clusterIssuersList?.items) {
          setClusterIssuers(clusterIssuersList.items.map((i: any) => i.metadata.name));
        }
      } catch (e) {
        console.warn('Failed to fetch cert-manager resources. Cert-manager might not be installed.', e);
      } finally {
        setLoadingIssuers(false);
      }
    };

    fetchIssuers();
  }, [client, metadata?.namespace]);

  // Handle adding TLS entry
  const handleAddTls = async () => {
    if (!newTls.hosts.trim() || !newTls.secretName.trim()) return;
    
    setSaving(true);
    try {
      const updated = JSON.parse(JSON.stringify(ingress)) as V1Ingress;
      if (!updated.spec) updated.spec = {};
      if (!updated.spec.tls) updated.spec.tls = [];
      
      updated.spec.tls.push({
        hosts: newTls.hosts.split(',').map(h => h.trim()).filter(h => h),
        secretName: newTls.secretName.trim()
      });
      
      await onApply(updated);
      setNewTls({ hosts: '', secretName: '' });
      setAddingTls(false);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  // Handle removing TLS entry
  const handleRemoveTls = async (index: number) => {
    if (!confirm('Remove this TLS configuration?')) return;
    
    setSaving(true);
    try {
      const updated = JSON.parse(JSON.stringify(ingress)) as V1Ingress;
      if (updated.spec?.tls) {
        updated.spec.tls.splice(index, 1);
      }
      await onApply(updated);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  // Handle Cert Manager changes
  const handleSaveCertManager = async () => {
    setSaving(true);
    try {
      const updated = JSON.parse(JSON.stringify(ingress)) as V1Ingress;
      if (!updated.metadata) updated.metadata = {};
      if (!updated.metadata.annotations) updated.metadata.annotations = {};
      
      // Clean up old annotations
      delete updated.metadata.annotations['cert-manager.io/issuer'];
      delete updated.metadata.annotations['cert-manager.io/cluster-issuer'];
      
      if (useCertManager && selectedIssuer) {
        if (selectedIssuerType === 'Issuer') {
          updated.metadata.annotations['cert-manager.io/issuer'] = selectedIssuer;
        } else {
          updated.metadata.annotations['cert-manager.io/cluster-issuer'] = selectedIssuer;
        }
        
        // Ensure there is at least one TLS entry if using cert-manager
        // Often users want to auto-configure this, but we'll leave spec.tls management to them
        // or we could auto-add a placeholder if empty? For now let's just set the annotation.
      }
      
      await onApply(updated);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Cert Manager Integration */}
      <Card>
        <CardHeader 
          icon={<Award size={16} />} 
          title="Cert Manager Integration" 
          badge={hasCertManager ? <span className="text-xs text-emerald-400 bg-emerald-900/30 px-2 py-0.5 rounded border border-emerald-800/30">Enabled</span> : null}
        />
        <CardBody className="space-y-4">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="use-cert-manager"
              checked={useCertManager}
              onChange={(e) => setUseCertManager(e.target.checked)}
              className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-offset-slate-900"
            />
            <label htmlFor="use-cert-manager" className="text-sm font-medium text-slate-200">
              Use cert-manager for automatic certificate management
            </label>
          </div>

          {useCertManager && (
            <div className="pl-7 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs text-slate-400 font-medium">Issuer Type</label>
                  <div className="flex bg-slate-800 rounded p-1 border border-slate-700">
                    <button
                      onClick={() => setSelectedIssuerType('ClusterIssuer')}
                      className={clsx(
                        "flex-1 py-1 text-xs font-medium rounded transition-colors",
                        selectedIssuerType === 'ClusterIssuer' 
                          ? "bg-blue-600 text-white shadow" 
                          : "text-slate-400 hover:text-slate-200"
                      )}
                    >
                      Cluster Issuer
                    </button>
                    <button
                      onClick={() => setSelectedIssuerType('Issuer')}
                      className={clsx(
                        "flex-1 py-1 text-xs font-medium rounded transition-colors",
                        selectedIssuerType === 'Issuer' 
                          ? "bg-blue-600 text-white shadow" 
                          : "text-slate-400 hover:text-slate-200"
                      )}
                    >
                      Namespaced Issuer
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs text-slate-400 font-medium">
                    {selectedIssuerType === 'ClusterIssuer' ? 'Cluster Issuer Name' : 'Issuer Name'}
                  </label>
                  <Combobox
                    value={selectedIssuer}
                    onChange={setSelectedIssuer}
                    options={selectedIssuerType === 'ClusterIssuer' ? clusterIssuers : issuers}
                    placeholder={selectedIssuerType === 'ClusterIssuer' ? 'letsencrypt-prod' : 'my-issuer'}
                    allowCustom
                    size="md"
                    icon={<Award size={14} />}
                    label={loadingIssuers ? 'Loading issuers...' : `${(selectedIssuerType === 'ClusterIssuer' ? clusterIssuers : issuers).length} ${selectedIssuerType.toLowerCase()}s found`}
                    emptyMessage={loadingIssuers ? 'Loading...' : 'No issuers found - type a custom name'}
                  />
                </div>
              </div>

              <div className="bg-slate-800/50 p-3 rounded border border-slate-700 text-xs text-slate-400 flex gap-2 items-start">
                <AlertTriangle size={14} className="shrink-0 mt-0.5 text-amber-500" />
                <p>
                  Enabling cert-manager will add the 
                  <code className="mx-1 bg-slate-800 px-1 py-0.5 rounded text-amber-200">cert-manager.io/{selectedIssuerType.toLowerCase()}</code> 
                  annotation to this Ingress. Ensure you also define the secret name in the TLS rules below.
                </p>
              </div>

              <button
                onClick={handleSaveCertManager}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-bold rounded transition-colors flex items-center gap-2"
              >
                {saving ? <RefreshCw className="animate-spin" size={14} /> : <Check size={14} />}
                Apply Cert Manager Settings
              </button>
            </div>
          )}
        </CardBody>
      </Card>

      {/* TLS Rules List */}
      <Card>
        <CardHeader 
          icon={<Lock size={16} />} 
          title="TLS Rules" 
          badge={<span className="text-xs text-slate-500 ml-2">({spec?.tls?.length || 0})</span>}
          action={
            <button
              onClick={() => setAddingTls(true)}
              className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
            >
              <Plus size={12} />
              Add TLS Rule
            </button>
          }
        />
        <CardBody className="space-y-4">
          {addingTls && (
            <div className="bg-emerald-900/10 border border-emerald-800/30 rounded-lg p-4 space-y-3">
              <div className="text-sm font-medium text-emerald-400">New TLS Entry</div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-slate-400">Hosts (comma separated)</label>
                  <input
                    type="text"
                    value={newTls.hosts}
                    onChange={(e) => setNewTls(t => ({ ...t, hosts: e.target.value }))}
                    placeholder="example.com, api.example.com"
                    className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-400">Secret Name</label>
                  <input
                    type="text"
                    value={newTls.secretName}
                    onChange={(e) => setNewTls(t => ({ ...t, secretName: e.target.value }))}
                    placeholder="my-cert-secret"
                    className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setAddingTls(false)}
                  className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs rounded transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddTls}
                  disabled={saving || !newTls.hosts.trim() || !newTls.secretName.trim()}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold rounded transition-colors flex items-center gap-2"
                >
                  {saving && <RefreshCw className="animate-spin" size={12} />}
                  Add Rule
                </button>
              </div>
            </div>
          )}

          {(!spec?.tls || spec.tls.length === 0) ? (
            <div className="text-center py-8 text-slate-500">
              <Shield size={32} className="mx-auto mb-3 opacity-50" />
              <div className="text-sm">No TLS rules defined</div>
              <div className="text-xs mt-1">Add a rule to enable HTTPS</div>
            </div>
          ) : (
            <div className="space-y-3">
              {spec.tls.map((tls, index) => (
                <div key={index} className="flex items-center gap-4 bg-slate-800/30 p-4 rounded-lg border border-slate-700">
                  <div className="bg-emerald-900/20 p-2 rounded-full">
                    <Lock size={16} className="text-emerald-400" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-slate-200">
                      {tls.hosts?.join(', ') || <span className="italic text-slate-500">All hosts</span>}
                    </div>
                    <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                      Secret: 
                      <span className="font-mono text-emerald-300/80 bg-emerald-900/20 px-1 rounded">
                        {tls.secretName}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveTls(index)}
                    className="p-2 hover:bg-red-900/30 text-slate-500 hover:text-red-400 rounded transition-colors"
                    title="Remove TLS rule"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
};
