import React, { useState } from 'react';
import type { ClusterResource } from '../../../../api/types';
import { 
  Shield, 
  Plus, 
  Trash2, 
  User,
  Lock,
  Key,
  FileKey,
  AlertTriangle,
  Save,
  RefreshCw,
  AlertCircle
} from 'lucide-react';

interface Props {
  resource: ClusterResource;
  onApply: (updatedRaw: any) => Promise<void>;
}

export const DeploymentSecurity: React.FC<Props> = ({ resource, onApply }) => {
  const raw = resource.raw;
  const template = raw?.spec?.template?.spec || {};
  
  const [serviceAccountName, setServiceAccountName] = useState<string>(template.serviceAccountName || '');
  const [automountServiceAccountToken, setAutomountServiceAccountToken] = useState<boolean | undefined>(template.automountServiceAccountToken);
  const [securityContext, setSecurityContext] = useState<any>(template.securityContext || {});
  const [imagePullSecrets, setImagePullSecrets] = useState<Array<{ name: string }>>(template.imagePullSecrets || []);
  const [hostNetwork, setHostNetwork] = useState<boolean>(template.hostNetwork || false);
  const [hostPID, setHostPID] = useState<boolean>(template.hostPID || false);
  const [hostIPC, setHostIPC] = useState<boolean>(template.hostIPC || false);
  const [shareProcessNamespace, setShareProcessNamespace] = useState<boolean>(template.shareProcessNamespace || false);
  
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = JSON.parse(JSON.stringify(raw));
      const spec = updated.spec.template.spec;
      
      spec.serviceAccountName = serviceAccountName || undefined;
      spec.automountServiceAccountToken = automountServiceAccountToken;
      spec.securityContext = Object.keys(securityContext).length > 0 ? securityContext : undefined;
      spec.imagePullSecrets = imagePullSecrets.length > 0 ? imagePullSecrets : undefined;
      spec.hostNetwork = hostNetwork || undefined;
      spec.hostPID = hostPID || undefined;
      spec.hostIPC = hostIPC || undefined;
      spec.shareProcessNamespace = shareProcessNamespace || undefined;
      
      await onApply(updated);
      setHasChanges(false);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const markChanged = () => setHasChanges(true);

  const updateSecurityContext = (updates: any) => {
    const newCtx = { ...securityContext, ...updates };
    // Clean undefined values
    Object.keys(newCtx).forEach(k => {
      if (newCtx[k] === undefined || newCtx[k] === false || newCtx[k] === null) {
        delete newCtx[k];
      }
    });
    setSecurityContext(newCtx);
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

      {/* Service Account */}
      <div className="bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden">
        <div className="px-4 py-3 bg-slate-800/50 border-b border-slate-700 flex items-center gap-2">
          <User size={16} className="text-blue-400" />
          <span className="font-semibold text-slate-200">Service Account</span>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Service Account Name</label>
            <input
              type="text"
              value={serviceAccountName}
              onChange={(e) => { setServiceAccountName(e.target.value); markChanged(); }}
              placeholder="default"
              className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
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
                setAutomountServiceAccountToken(e.target.checked ? undefined : false); 
                markChanged(); 
              }}
              className="w-4 h-4 rounded border-slate-600 bg-slate-800"
            />
            <span className="text-sm text-slate-300">Automount Service Account Token</span>
          </label>
        </div>
      </div>

      {/* Image Pull Secrets */}
      <div className="bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden">
        <div className="px-4 py-3 bg-slate-800/50 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileKey size={16} className="text-amber-400" />
            <span className="font-semibold text-slate-200">Image Pull Secrets</span>
          </div>
          <button
            onClick={() => { setImagePullSecrets([...imagePullSecrets, { name: '' }]); markChanged(); }}
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
                  <input
                    type="text"
                    value={secret.name}
                    onChange={(e) => {
                      const newSecrets = [...imagePullSecrets];
                      newSecrets[i] = { name: e.target.value };
                      setImagePullSecrets(newSecrets);
                      markChanged();
                    }}
                    placeholder="Secret name"
                    className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-white"
                  />
                  <button
                    onClick={() => {
                      setImagePullSecrets(imagePullSecrets.filter((_, idx) => idx !== i));
                      markChanged();
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
      <div className="bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden">
        <div className="px-4 py-3 bg-slate-800/50 border-b border-slate-700 flex items-center gap-2">
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
                value={securityContext.runAsUser ?? ''}
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
                value={securityContext.runAsGroup ?? ''}
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
                value={securityContext.fsGroup ?? ''}
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
                value={securityContext.fsGroupChangePolicy || ''}
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
                checked={securityContext.runAsNonRoot || false}
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
              value={securityContext.supplementalGroups?.join(', ') || ''}
              onChange={(e) => {
                const groups = e.target.value.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
                updateSecurityContext({ supplementalGroups: groups.length > 0 ? groups : undefined });
              }}
              placeholder="1000, 2000, 3000"
              className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-white font-mono"
            />
          </div>

          {/* Sysctls */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-slate-400">Sysctls</label>
              <button
                onClick={() => {
                  updateSecurityContext({
                    sysctls: [...(securityContext.sysctls || []), { name: '', value: '' }]
                  });
                }}
                className="text-xs text-blue-400 hover:text-blue-300"
              >
                <Plus size={12} className="inline mr-1" /> Add
              </button>
            </div>
            {(securityContext.sysctls || []).length === 0 ? (
              <div className="text-xs text-slate-500">No sysctls configured</div>
            ) : (
              <div className="space-y-2">
                {securityContext.sysctls?.map((sysctl: any, i: number) => (
                  <div key={i} className="flex gap-2 items-center">
                    <input
                      type="text"
                      value={sysctl.name}
                      onChange={(e) => {
                        const newSysctls = [...securityContext.sysctls];
                        newSysctls[i] = { ...sysctl, name: e.target.value };
                        updateSecurityContext({ sysctls: newSysctls });
                      }}
                      placeholder="kernel.shm_rmid_forced"
                      className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-white font-mono"
                    />
                    <input
                      type="text"
                      value={sysctl.value}
                      onChange={(e) => {
                        const newSysctls = [...securityContext.sysctls];
                        newSysctls[i] = { ...sysctl, value: e.target.value };
                        updateSecurityContext({ sysctls: newSysctls });
                      }}
                      placeholder="1"
                      className="w-24 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-white font-mono"
                    />
                    <button
                      onClick={() => {
                        const newSysctls = securityContext.sysctls.filter((_: any, idx: number) => idx !== i);
                        updateSecurityContext({ sysctls: newSysctls.length > 0 ? newSysctls : undefined });
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

          {/* SELinux Options */}
          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
            <h4 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
              <Lock size={14} className="text-purple-400" />
              SELinux Options
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">User</label>
                <input
                  type="text"
                  value={securityContext.seLinuxOptions?.user || ''}
                  onChange={(e) => updateSecurityContext({
                    seLinuxOptions: { ...securityContext.seLinuxOptions, user: e.target.value || undefined }
                  })}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-white"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Role</label>
                <input
                  type="text"
                  value={securityContext.seLinuxOptions?.role || ''}
                  onChange={(e) => updateSecurityContext({
                    seLinuxOptions: { ...securityContext.seLinuxOptions, role: e.target.value || undefined }
                  })}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-white"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Type</label>
                <input
                  type="text"
                  value={securityContext.seLinuxOptions?.type || ''}
                  onChange={(e) => updateSecurityContext({
                    seLinuxOptions: { ...securityContext.seLinuxOptions, type: e.target.value || undefined }
                  })}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-white"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Level</label>
                <input
                  type="text"
                  value={securityContext.seLinuxOptions?.level || ''}
                  onChange={(e) => updateSecurityContext({
                    seLinuxOptions: { ...securityContext.seLinuxOptions, level: e.target.value || undefined }
                  })}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-white"
                />
              </div>
            </div>
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
                  value={securityContext.seccompProfile?.type || ''}
                  onChange={(e) => updateSecurityContext({
                    seccompProfile: e.target.value ? { 
                      ...securityContext.seccompProfile, 
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
              {securityContext.seccompProfile?.type === 'Localhost' && (
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Localhost Profile</label>
                  <input
                    type="text"
                    value={securityContext.seccompProfile?.localhostProfile || ''}
                    onChange={(e) => updateSecurityContext({
                      seccompProfile: { ...securityContext.seccompProfile, localhostProfile: e.target.value }
                    })}
                    placeholder="profiles/audit.json"
                    className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-white"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Windows Options (for completeness) */}
          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
            <h4 className="text-sm font-semibold text-slate-300 mb-3">Windows Options</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">GMSA Credential Spec Name</label>
                <input
                  type="text"
                  value={securityContext.windowsOptions?.gmsaCredentialSpecName || ''}
                  onChange={(e) => updateSecurityContext({
                    windowsOptions: { ...securityContext.windowsOptions, gmsaCredentialSpecName: e.target.value || undefined }
                  })}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-white"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Run As User Name</label>
                <input
                  type="text"
                  value={securityContext.windowsOptions?.runAsUserName || ''}
                  onChange={(e) => updateSecurityContext({
                    windowsOptions: { ...securityContext.windowsOptions, runAsUserName: e.target.value || undefined }
                  })}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-white"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Host Namespaces */}
      <div className="bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden">
        <div className="px-4 py-3 bg-slate-800/50 border-b border-slate-700 flex items-center gap-2">
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
                onChange={(e) => { setHostNetwork(e.target.checked); markChanged(); }}
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
                onChange={(e) => { setHostPID(e.target.checked); markChanged(); }}
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
                onChange={(e) => { setHostIPC(e.target.checked); markChanged(); }}
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
                onChange={(e) => { setShareProcessNamespace(e.target.checked); markChanged(); }}
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
