import React from 'react';
import type { ClusterResource } from '../../../../api/types';
import type { V1Deployment } from '../../../../api/k8s-types';
import { 
  Shield, 
  Plus, 
  Trash2, 
  User,
  Lock,
  Key,
  FileKey,
  AlertTriangle
} from 'lucide-react';
import { Combobox, useServiceAccountNames, useSecretNames } from '../../shared';

interface Props {
  resource: ClusterResource;
  model: V1Deployment;
  updateModel: (updater: (current: V1Deployment) => V1Deployment) => void;
}

export const DeploymentSecurity: React.FC<Props> = ({ resource, model, updateModel }) => {
  const namespace = resource.namespace;
  const template = model?.spec?.template?.spec;
  
  // Get available resources
  const serviceAccountNames = useServiceAccountNames(namespace);
  const secretNames = useSecretNames(namespace);

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

  const updateSecurityContext = (updates: Record<string, unknown>) => {
    const currentCtx = template?.securityContext || {};
    const newCtx = { ...currentCtx, ...updates };
    // Clean undefined values
    Object.keys(newCtx).forEach(k => {
      if ((newCtx as Record<string, unknown>)[k] === undefined || (newCtx as Record<string, unknown>)[k] === false || (newCtx as Record<string, unknown>)[k] === null) {
        delete (newCtx as Record<string, unknown>)[k];
      }
    });
    updateTemplateSpec({ securityContext: Object.keys(newCtx).length > 0 ? newCtx : undefined });
  };

  const serviceAccountName = template?.serviceAccountName || '';
  const automountServiceAccountToken = template?.automountServiceAccountToken;
  const securityContext = template?.securityContext || {};
  const imagePullSecrets = (template?.imagePullSecrets || []) as Array<{ name: string }>;
  const hostNetwork = template?.hostNetwork || false;
  const hostPID = template?.hostPID || false;
  const hostIPC = template?.hostIPC || false;
  const shareProcessNamespace = template?.shareProcessNamespace || false;

  return (
    <div className="space-y-6">
      {/* Service Account */}
      <div className="bg-slate-900/50 rounded-xl border border-slate-800">
        <div className="px-4 py-3 bg-slate-800/50 border-b border-slate-700 rounded-t-xl flex items-center gap-2">
          <User size={16} className="text-blue-400" />
          <span className="font-semibold text-slate-200">Service Account</span>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Service Account Name</label>
            <Combobox
              value={serviceAccountName}
              onChange={(v) => updateTemplateSpec({ serviceAccountName: v || undefined })}
              options={serviceAccountNames}
              placeholder="Select or type service account..."
              allowCustom={true}
              size="md"
              emptyMessage="No ServiceAccounts in namespace"
            />
            <p className="text-xs text-slate-500 mt-1">
              Leave empty to use "default" service account
            </p>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={automountServiceAccountToken !== false}
              onChange={(e) => { 
                updateTemplateSpec({ automountServiceAccountToken: e.target.checked ? undefined : false }); 
              }}
              className="w-4 h-4 rounded border-slate-600 bg-slate-800"
            />
            <span className="text-sm text-slate-300">Automount Service Account Token</span>
          </label>
        </div>
      </div>

      {/* Image Pull Secrets */}
      <div className="bg-slate-900/50 rounded-xl border border-slate-800">
        <div className="px-4 py-3 bg-slate-800/50 border-b border-slate-700 rounded-t-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileKey size={16} className="text-amber-400" />
            <span className="font-semibold text-slate-200">Image Pull Secrets</span>
          </div>
          <button
            onClick={() => updateTemplateSpec({ imagePullSecrets: [...imagePullSecrets, { name: '' }] })}
            className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300"
          >
            <Plus size={14} /> Add Secret
          </button>
        </div>
        <div className="p-4">
          {imagePullSecrets.length === 0 ? (
            <div className="text-sm text-slate-500">No image pull secrets configured</div>
          ) : (
            <div className="space-y-2">
              {imagePullSecrets.map((secret, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <div className="flex-1">
                    <Combobox
                      value={secret.name}
                      onChange={(v) => {
                        const newSecrets = [...imagePullSecrets];
                        newSecrets[i] = { name: v };
                        updateTemplateSpec({ imagePullSecrets: newSecrets });
                      }}
                      options={secretNames}
                      placeholder="Select Secret..."
                      allowCustom={true}
                      size="sm"
                      emptyMessage="No Secrets in namespace"
                    />
                  </div>
                  <button
                    onClick={() => {
                      const newSecrets = imagePullSecrets.filter((_, idx) => idx !== i);
                      updateTemplateSpec({ imagePullSecrets: newSecrets.length > 0 ? newSecrets : undefined });
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

      {/* Pod Security Context */}
      <div className="bg-slate-900/50 rounded-xl border border-slate-800">
        <div className="px-4 py-3 bg-slate-800/50 border-b border-slate-700 rounded-t-xl flex items-center gap-2">
          <Shield size={16} className="text-emerald-400" />
          <span className="font-semibold text-slate-200">Pod Security Context</span>
        </div>
        <div className="p-4 space-y-6">
          {/* User/Group Settings */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Run As User</label>
              <input
                type="number"
                value={String((securityContext as Record<string, unknown>).runAsUser ?? '')}
                onChange={(e) => updateSecurityContext({ 
                  runAsUser: e.target.value ? parseInt(e.target.value) : undefined 
                })}
                placeholder="UID"
                className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-white"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Run As Group</label>
              <input
                type="number"
                value={String((securityContext as Record<string, unknown>).runAsGroup ?? '')}
                onChange={(e) => updateSecurityContext({ 
                  runAsGroup: e.target.value ? parseInt(e.target.value) : undefined 
                })}
                placeholder="GID"
                className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-white"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">FS Group</label>
              <input
                type="number"
                value={String((securityContext as Record<string, unknown>).fsGroup ?? '')}
                onChange={(e) => updateSecurityContext({ 
                  fsGroup: e.target.value ? parseInt(e.target.value) : undefined 
                })}
                placeholder="GID"
                className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-white"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">FS Group Change Policy</label>
              <select
                value={((securityContext as Record<string, unknown>).fsGroupChangePolicy || '') as string}
                onChange={(e) => updateSecurityContext({ 
                  fsGroupChangePolicy: e.target.value || undefined 
                })}
                className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-white"
              >
                <option value="">Default</option>
                <option value="OnRootMismatch">OnRootMismatch</option>
                <option value="Always">Always</option>
              </select>
            </div>
          </div>

          {/* Boolean Flags */}
          <div className="grid grid-cols-2 gap-3">
            <label className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-slate-800/50">
              <input
                type="checkbox"
                checked={((securityContext as Record<string, unknown>).runAsNonRoot || false) as boolean}
                onChange={(e) => updateSecurityContext({ runAsNonRoot: e.target.checked || undefined })}
                className="w-4 h-4 rounded border-slate-600 bg-slate-800"
              />
              <span className="text-sm text-slate-300">Run As Non-Root</span>
            </label>
          </div>

          {/* Supplemental Groups */}
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Supplemental Groups</label>
            <input
              type="text"
              value={((securityContext as Record<string, unknown>).supplementalGroups as number[] | undefined)?.join(', ') || ''}
              onChange={(e) => {
                const groups = e.target.value.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
                updateSecurityContext({ supplementalGroups: groups.length > 0 ? groups : undefined });
              }}
              placeholder="1000, 2000, 3000"
              className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-white font-mono"
            />
          </div>

          {/* Seccomp Profile */}
          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
            <h4 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
              <Key size={14} className="text-cyan-400" />
              Seccomp Profile
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Type</label>
                <select
                  value={((securityContext as Record<string, unknown>).seccompProfile as { type?: string } | undefined)?.type || ''}
                  onChange={(e) => updateSecurityContext({
                    seccompProfile: e.target.value ? { 
                      ...((securityContext as Record<string, unknown>).seccompProfile as Record<string, unknown> || {}), 
                      type: e.target.value 
                    } : undefined
                  })}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-white"
                >
                  <option value="">Not set</option>
                  <option value="RuntimeDefault">RuntimeDefault</option>
                  <option value="Unconfined">Unconfined</option>
                  <option value="Localhost">Localhost</option>
                </select>
              </div>
            </div>
          </div>

          {/* SELinux Options */}
          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
            <h4 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
              <Lock size={14} className="text-purple-400" />
              SELinux Options
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {(['user', 'role', 'type', 'level'] as const).map(field => (
                <div key={field}>
                  <label className="text-xs text-slate-400 mb-1 block capitalize">{field}</label>
                  <input
                    type="text"
                    value={(((securityContext as Record<string, unknown>).seLinuxOptions as Record<string, string> | undefined)?.[field] || '')}
                    onChange={(e) => updateSecurityContext({
                      seLinuxOptions: { 
                        ...((securityContext as Record<string, unknown>).seLinuxOptions as Record<string, string> || {}), 
                        [field]: e.target.value || undefined 
                      }
                    })}
                    className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-white"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Host Namespaces */}
      <div className="bg-slate-900/50 rounded-xl border border-slate-800">
        <div className="px-4 py-3 bg-slate-800/50 border-b border-slate-700 rounded-t-xl flex items-center gap-2">
          <AlertTriangle size={16} className="text-red-400" />
          <span className="font-semibold text-slate-200">Host Namespaces</span>
          <span className="text-xs text-red-400 bg-red-900/30 px-2 py-0.5 rounded">Privileged</span>
        </div>
        <div className="p-4">
          <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-3 text-xs text-red-200 mb-4">
            <strong>Warning:</strong> These options grant elevated privileges. Use with caution.
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex items-center gap-2 cursor-pointer p-3 rounded-lg border border-slate-700 hover:bg-slate-800/50">
              <input
                type="checkbox"
                checked={hostNetwork}
                onChange={(e) => updateTemplateSpec({ hostNetwork: e.target.checked || undefined })}
                className="w-4 h-4 rounded border-slate-600 bg-slate-800"
              />
              <div>
                <span className="text-sm text-slate-300 block">Host Network</span>
                <span className="text-xs text-slate-500">Use host's network namespace</span>
              </div>
            </label>
            <label className="flex items-center gap-2 cursor-pointer p-3 rounded-lg border border-slate-700 hover:bg-slate-800/50">
              <input
                type="checkbox"
                checked={hostPID}
                onChange={(e) => updateTemplateSpec({ hostPID: e.target.checked || undefined })}
                className="w-4 h-4 rounded border-slate-600 bg-slate-800"
              />
              <div>
                <span className="text-sm text-slate-300 block">Host PID</span>
                <span className="text-xs text-slate-500">Use host's PID namespace</span>
              </div>
            </label>
            <label className="flex items-center gap-2 cursor-pointer p-3 rounded-lg border border-slate-700 hover:bg-slate-800/50">
              <input
                type="checkbox"
                checked={hostIPC}
                onChange={(e) => updateTemplateSpec({ hostIPC: e.target.checked || undefined })}
                className="w-4 h-4 rounded border-slate-600 bg-slate-800"
              />
              <div>
                <span className="text-sm text-slate-300 block">Host IPC</span>
                <span className="text-xs text-slate-500">Use host's IPC namespace</span>
              </div>
            </label>
            <label className="flex items-center gap-2 cursor-pointer p-3 rounded-lg border border-slate-700 hover:bg-slate-800/50">
              <input
                type="checkbox"
                checked={shareProcessNamespace}
                onChange={(e) => updateTemplateSpec({ shareProcessNamespace: e.target.checked || undefined })}
                className="w-4 h-4 rounded border-slate-600 bg-slate-800"
              />
              <div>
                <span className="text-sm text-slate-300 block">Share Process Namespace</span>
                <span className="text-xs text-slate-500">Share PID between containers</span>
              </div>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};
