import React, { useState } from 'react';
import type { ClusterResource } from '../../../../api/types';
import type { V1Deployment, V1Volume } from '../../../../api/k8s-types';
import { 
  HardDrive, 
  Plus, 
  Trash2, 
  ChevronDown, 
  ChevronRight,
  Database,
  FileKey,
  FileText,
  Folder,
  Server,
  Layers,
  Cloud,
  Settings
} from 'lucide-react';
import { Combobox, useConfigMapNames, useSecretNames, usePVCNames } from '../../shared';

interface Props {
  resource: ClusterResource;
  model: V1Deployment;
  updateModel: (updater: (current: V1Deployment) => V1Deployment) => void;
}

type VolumeType = 
  | 'emptyDir' 
  | 'configMap' 
  | 'secret' 
  | 'persistentVolumeClaim' 
  | 'hostPath' 
  | 'projected' 
  | 'downwardAPI'
  | 'nfs'
  | 'csi';

const volumeTypeIcons: Record<VolumeType, React.ReactNode> = {
  emptyDir: <Folder className="text-slate-400" size={16} />,
  configMap: <FileText className="text-blue-400" size={16} />,
  secret: <FileKey className="text-amber-400" size={16} />,
  persistentVolumeClaim: <Database className="text-emerald-400" size={16} />,
  hostPath: <Server className="text-purple-400" size={16} />,
  projected: <Layers className="text-cyan-400" size={16} />,
  downwardAPI: <Settings className="text-pink-400" size={16} />,
  nfs: <Cloud className="text-orange-400" size={16} />,
  csi: <HardDrive className="text-indigo-400" size={16} />,
};

const volumeTypeLabels: Record<VolumeType, string> = {
  emptyDir: 'Empty Directory',
  configMap: 'ConfigMap',
  secret: 'Secret',
  persistentVolumeClaim: 'PVC',
  hostPath: 'Host Path',
  projected: 'Projected',
  downwardAPI: 'Downward API',
  nfs: 'NFS',
  csi: 'CSI',
};

export const DeploymentVolumes: React.FC<Props> = ({ resource, model, updateModel }) => {
  const namespace = resource.namespace;
  const template = model?.spec?.template?.spec;
  const volumes = (template?.volumes || []) as V1Volume[];
  
  const [expandedVolumes, setExpandedVolumes] = useState<Set<string>>(new Set());
  const [showAddModal, setShowAddModal] = useState(false);

  const updateVolumes = (newVolumes: V1Volume[]) => {
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
              volumes: newVolumes.length > 0 ? newVolumes : undefined
            }
          }
        }
      };
    });
  };

  const toggleExpanded = (name: string) => {
    const next = new Set(expandedVolumes);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    setExpandedVolumes(next);
  };

  const addVolume = (type: VolumeType) => {
    const baseName = `volume-${Date.now()}`;
    let newVolume: V1Volume = { name: baseName };

    switch (type) {
      case 'emptyDir':
        newVolume.emptyDir = {};
        break;
      case 'configMap':
        newVolume.configMap = { name: '' };
        break;
      case 'secret':
        newVolume.secret = { secretName: '' };
        break;
      case 'persistentVolumeClaim':
        newVolume.persistentVolumeClaim = { claimName: '' };
        break;
      case 'hostPath':
        newVolume.hostPath = { path: '' };
        break;
      case 'projected':
        newVolume.projected = { sources: [] };
        break;
      case 'downwardAPI':
        newVolume.downwardAPI = { items: [] };
        break;
      case 'nfs':
        newVolume.nfs = { server: '', path: '' };
        break;
      case 'csi':
        newVolume.csi = { driver: '' };
        break;
    }

    updateVolumes([...volumes, newVolume]);
    setExpandedVolumes(new Set([...expandedVolumes, baseName]));
    setShowAddModal(false);
  };

  const updateVolume = (index: number, updates: Partial<V1Volume>) => {
    const newVolumes = [...volumes];
    newVolumes[index] = { ...newVolumes[index], ...updates };
    updateVolumes(newVolumes);
  };

  const removeVolume = (index: number) => {
    updateVolumes(volumes.filter((_, i) => i !== index));
  };

  const getVolumeType = (volume: V1Volume): VolumeType => {
    if (volume.emptyDir !== undefined) return 'emptyDir';
    if (volume.configMap) return 'configMap';
    if (volume.secret) return 'secret';
    if (volume.persistentVolumeClaim) return 'persistentVolumeClaim';
    if (volume.hostPath) return 'hostPath';
    if (volume.projected) return 'projected';
    if (volume.downwardAPI) return 'downwardAPI';
    if (volume.nfs) return 'nfs';
    if (volume.csi) return 'csi';
    return 'emptyDir';
  };

  // Find containers that mount each volume
  const containerMounts = (volumeName: string) => {
    const containers = [...(template?.containers || []), ...(template?.initContainers || [])];
    return containers
      .filter((c) => c.volumeMounts?.some((m: { name?: string }) => m.name === volumeName))
      .map((c) => ({
        name: c.name,
        mount: c.volumeMounts?.find((m: { name?: string }) => m.name === volumeName)
      }));
  };

  return (
    <div className="space-y-6">
      {/* Volumes Section */}
      <div className="bg-slate-900/50 rounded-xl border border-slate-800">
        <div className="px-4 py-3 bg-slate-800/50 border-b border-slate-700 rounded-t-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HardDrive size={16} className="text-emerald-400" />
            <span className="font-semibold text-slate-200">Volumes</span>
            <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">{volumes.length}</span>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            <Plus size={14} /> Add Volume
          </button>
        </div>

        {volumes.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <HardDrive size={32} className="mx-auto mb-3 opacity-50" />
            <p className="text-sm font-medium">No volumes defined</p>
            <p className="text-xs mt-1 mb-4">Add volumes to store data and mount configurations</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm rounded-lg border border-slate-700 transition-colors"
            >
              <Plus size={14} className="inline mr-2" />
              Add Your First Volume
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {volumes.map((volume, idx) => {
              const type = getVolumeType(volume);
              const mounts = containerMounts(volume.name || '');
              const isExpanded = expandedVolumes.has(volume.name || '');

              return (
                <div key={volume.name} className="bg-slate-900/30">
                  {/* Volume Header */}
                  <div 
                    className="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-slate-800/30 transition-colors"
                    onClick={() => toggleExpanded(volume.name || '')}
                  >
                    {isExpanded ? <ChevronDown size={16} className="text-slate-500" /> : <ChevronRight size={16} className="text-slate-500" />}
                    {volumeTypeIcons[type]}
                    <div className="flex-1">
                      <span className="font-mono font-medium text-slate-200">{volume.name}</span>
                      <span className="ml-3 text-xs px-2 py-0.5 bg-slate-800 text-slate-400 rounded">{volumeTypeLabels[type]}</span>
                      {mounts.length > 0 && (
                        <span className="ml-2 text-xs text-slate-500">
                          → {mounts.map(m => m.mount?.mountPath).join(', ')}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); removeVolume(idx); }}
                      className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  {/* Volume Editor */}
                  {isExpanded && (
                    <div className="px-4 pb-4 ml-8">
                      <VolumeEditor 
                        volume={volume} 
                        type={type} 
                        onUpdate={(updates) => updateVolume(idx, updates)}
                        mounts={mounts}
                        namespace={namespace}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Volume Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-2xl mx-4">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Add Volume</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white">×</button>
            </div>
            <div className="p-6">
              <p className="text-sm text-slate-400 mb-6">Select the type of volume to add:</p>
              <div className="grid grid-cols-3 gap-3">
                {(Object.keys(volumeTypeLabels) as VolumeType[]).map(type => (
                  <button
                    key={type}
                    onClick={() => addVolume(type)}
                    className="flex flex-col items-center gap-2 p-4 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 hover:border-slate-600 rounded-lg transition-colors group"
                  >
                    <div className="p-2 bg-slate-700/50 rounded-lg group-hover:scale-110 transition-transform">
                      {volumeTypeIcons[type]}
                    </div>
                    <span className="text-sm text-slate-300 font-medium">{volumeTypeLabels[type]}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Reference */}
      <div className="bg-slate-900/50 rounded-xl border border-slate-800 p-4">
        <h4 className="text-xs font-bold text-slate-500 uppercase mb-3">Volume Types Reference</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
          <div className="flex items-start gap-2">
            {volumeTypeIcons.emptyDir}
            <div>
              <div className="text-slate-300 font-medium">Empty Dir</div>
              <div className="text-slate-500">Temporary storage, deleted with pod</div>
            </div>
          </div>
          <div className="flex items-start gap-2">
            {volumeTypeIcons.configMap}
            <div>
              <div className="text-slate-300 font-medium">ConfigMap</div>
              <div className="text-slate-500">Mount config data as files</div>
            </div>
          </div>
          <div className="flex items-start gap-2">
            {volumeTypeIcons.secret}
            <div>
              <div className="text-slate-300 font-medium">Secret</div>
              <div className="text-slate-500">Mount sensitive data as files</div>
            </div>
          </div>
          <div className="flex items-start gap-2">
            {volumeTypeIcons.persistentVolumeClaim}
            <div>
              <div className="text-slate-300 font-medium">PVC</div>
              <div className="text-slate-500">Persistent storage claim</div>
            </div>
          </div>
          <div className="flex items-start gap-2">
            {volumeTypeIcons.hostPath}
            <div>
              <div className="text-slate-300 font-medium">Host Path</div>
              <div className="text-slate-500">Mount host filesystem path</div>
            </div>
          </div>
          <div className="flex items-start gap-2">
            {volumeTypeIcons.projected}
            <div>
              <div className="text-slate-300 font-medium">Projected</div>
              <div className="text-slate-500">Combine multiple sources</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Volume Editor based on type
interface VolumeEditorProps {
  volume: V1Volume;
  type: VolumeType;
  onUpdate: (updates: Partial<V1Volume>) => void;
  mounts: Array<{ name?: string; mount: { mountPath?: string; readOnly?: boolean } | undefined }>;
  namespace: string;
}

const VolumeEditor: React.FC<VolumeEditorProps> = ({ volume, type, onUpdate, mounts, namespace }) => {
  return (
    <div className="space-y-4">
      {/* Name field */}
      <div>
        <label className="text-xs text-slate-400 mb-1 block">Volume Name</label>
        <input
          type="text"
          value={volume.name || ''}
          onChange={(e) => onUpdate({ name: e.target.value })}
          className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-blue-500"
        />
      </div>

      {/* Type-specific editors */}
      {type === 'emptyDir' && <EmptyDirEditor volume={volume} onUpdate={onUpdate} />}
      {type === 'configMap' && <ConfigMapVolumeEditor volume={volume} onUpdate={onUpdate} namespace={namespace} />}
      {type === 'secret' && <SecretVolumeEditor volume={volume} onUpdate={onUpdate} namespace={namespace} />}
      {type === 'persistentVolumeClaim' && <PVCVolumeEditor volume={volume} onUpdate={onUpdate} namespace={namespace} />}
      {type === 'hostPath' && <HostPathVolumeEditor volume={volume} onUpdate={onUpdate} />}
      {type === 'nfs' && <NFSVolumeEditor volume={volume} onUpdate={onUpdate} />}
      {type === 'csi' && <CSIVolumeEditor volume={volume} onUpdate={onUpdate} />}

      {/* Mount Info */}
      {mounts.length > 0 && (
        <div className="bg-slate-800/30 rounded-lg p-3 border border-slate-700/50">
          <h5 className="text-xs font-bold text-slate-500 uppercase mb-2">Mounted By</h5>
          <div className="space-y-1">
            {mounts.map((m, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="text-slate-400">{m.name}</span>
                <span className="text-slate-600">→</span>
                <span className="text-slate-300 font-mono">{m.mount?.mountPath}</span>
                {m.mount?.readOnly && <span className="text-amber-500">(RO)</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Empty Dir Editor
const EmptyDirEditor: React.FC<{ volume: V1Volume; onUpdate: (u: Partial<V1Volume>) => void }> = ({ volume, onUpdate }) => (
  <div className="grid grid-cols-2 gap-4">
    <div>
      <label className="text-xs text-slate-400 mb-1 block">Medium</label>
      <select
        value={volume.emptyDir?.medium || ''}
        onChange={(e) => onUpdate({ emptyDir: { ...volume.emptyDir, medium: e.target.value || undefined } })}
        className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
      >
        <option value="">Default (disk)</option>
        <option value="Memory">Memory (tmpfs)</option>
      </select>
    </div>
    <div>
      <label className="text-xs text-slate-400 mb-1 block">Size Limit</label>
      <input
        type="text"
        value={volume.emptyDir?.sizeLimit || ''}
        onChange={(e) => onUpdate({ emptyDir: { ...volume.emptyDir, sizeLimit: e.target.value || undefined } })}
        placeholder="e.g., 1Gi"
        className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
      />
    </div>
  </div>
);

// ConfigMap Volume Editor
const ConfigMapVolumeEditor: React.FC<{ volume: V1Volume; onUpdate: (u: Partial<V1Volume>) => void; namespace: string }> = ({ volume, onUpdate, namespace }) => {
  const configMapNames = useConfigMapNames(namespace);
  
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-slate-400 mb-1 block">ConfigMap Name *</label>
          <Combobox
            value={volume.configMap?.name || ''}
            onChange={(v) => onUpdate({ configMap: { ...volume.configMap!, name: v } })}
            options={configMapNames}
            placeholder="Select ConfigMap..."
            allowCustom={true}
            emptyMessage="No ConfigMaps in namespace"
          />
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Default Mode</label>
          <input
            type="text"
            value={volume.configMap?.defaultMode !== undefined ? volume.configMap.defaultMode.toString(8) : ''}
            onChange={(e) => {
              const mode = parseInt(e.target.value, 8);
              onUpdate({ configMap: { ...volume.configMap!, defaultMode: isNaN(mode) ? undefined : mode } });
            }}
            placeholder="0644"
            className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={volume.configMap?.optional || false}
          onChange={(e) => onUpdate({ configMap: { ...volume.configMap!, optional: e.target.checked || undefined } })}
          className="w-4 h-4 rounded border-slate-600 bg-slate-800"
        />
        <span className="text-sm text-slate-300">Optional (don't fail if ConfigMap doesn't exist)</span>
      </label>
    </div>
  );
};

// Secret Volume Editor
const SecretVolumeEditor: React.FC<{ volume: V1Volume; onUpdate: (u: Partial<V1Volume>) => void; namespace: string }> = ({ volume, onUpdate, namespace }) => {
  const secretNames = useSecretNames(namespace);
  
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Secret Name *</label>
          <Combobox
            value={volume.secret?.secretName || ''}
            onChange={(v) => onUpdate({ secret: { ...volume.secret!, secretName: v } })}
            options={secretNames}
            placeholder="Select Secret..."
            allowCustom={true}
            emptyMessage="No Secrets in namespace"
          />
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Default Mode</label>
          <input
            type="text"
            value={volume.secret?.defaultMode !== undefined ? volume.secret.defaultMode.toString(8) : ''}
            onChange={(e) => {
              const mode = parseInt(e.target.value, 8);
              onUpdate({ secret: { ...volume.secret!, defaultMode: isNaN(mode) ? undefined : mode } });
            }}
            placeholder="0644"
            className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={volume.secret?.optional || false}
          onChange={(e) => onUpdate({ secret: { ...volume.secret!, optional: e.target.checked || undefined } })}
          className="w-4 h-4 rounded border-slate-600 bg-slate-800"
        />
        <span className="text-sm text-slate-300">Optional (don't fail if Secret doesn't exist)</span>
      </label>
    </div>
  );
};

// PVC Volume Editor
const PVCVolumeEditor: React.FC<{ volume: V1Volume; onUpdate: (u: Partial<V1Volume>) => void; namespace: string }> = ({ volume, onUpdate, namespace }) => {
  const pvcNames = usePVCNames(namespace);
  
  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs text-slate-400 mb-1 block">Claim Name *</label>
        <Combobox
          value={volume.persistentVolumeClaim?.claimName || ''}
          onChange={(v) => onUpdate({ persistentVolumeClaim: { ...volume.persistentVolumeClaim!, claimName: v } })}
          options={pvcNames}
          placeholder="Select PersistentVolumeClaim..."
          allowCustom={true}
          emptyMessage="No PVCs in namespace"
        />
      </div>
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={volume.persistentVolumeClaim?.readOnly || false}
          onChange={(e) => onUpdate({ persistentVolumeClaim: { ...volume.persistentVolumeClaim!, readOnly: e.target.checked || undefined } })}
          className="w-4 h-4 rounded border-slate-600 bg-slate-800"
        />
        <span className="text-sm text-slate-300">Read Only</span>
      </label>
    </div>
  );
};

// Host Path Volume Editor
const HostPathVolumeEditor: React.FC<{ volume: V1Volume; onUpdate: (u: Partial<V1Volume>) => void }> = ({ volume, onUpdate }) => (
  <div className="space-y-4">
    <div>
      <label className="text-xs text-slate-400 mb-1 block">Path *</label>
      <input
        type="text"
        value={volume.hostPath?.path || ''}
        onChange={(e) => onUpdate({ hostPath: { ...volume.hostPath!, path: e.target.value } })}
        placeholder="/data"
        className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-blue-500"
      />
    </div>
    <div>
      <label className="text-xs text-slate-400 mb-1 block">Type</label>
      <select
        value={volume.hostPath?.type || ''}
        onChange={(e) => onUpdate({ hostPath: { ...volume.hostPath!, type: e.target.value || undefined } })}
        className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
      >
        <option value="">Default (no checks)</option>
        <option value="DirectoryOrCreate">DirectoryOrCreate</option>
        <option value="Directory">Directory</option>
        <option value="FileOrCreate">FileOrCreate</option>
        <option value="File">File</option>
        <option value="Socket">Socket</option>
        <option value="CharDevice">CharDevice</option>
        <option value="BlockDevice">BlockDevice</option>
      </select>
    </div>
    <div className="bg-amber-900/20 border border-amber-700/50 rounded-lg p-3 text-xs text-amber-200">
      <strong>Warning:</strong> HostPath volumes access the node's filesystem. Use with caution in production.
    </div>
  </div>
);

// NFS Volume Editor
const NFSVolumeEditor: React.FC<{ volume: V1Volume; onUpdate: (u: Partial<V1Volume>) => void }> = ({ volume, onUpdate }) => (
  <div className="space-y-4">
    <div className="grid grid-cols-2 gap-4">
      <div>
        <label className="text-xs text-slate-400 mb-1 block">Server *</label>
        <input
          type="text"
          value={volume.nfs?.server || ''}
          onChange={(e) => onUpdate({ nfs: { ...volume.nfs!, server: e.target.value } })}
          placeholder="nfs.example.com"
          className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
        />
      </div>
      <div>
        <label className="text-xs text-slate-400 mb-1 block">Path *</label>
        <input
          type="text"
          value={volume.nfs?.path || ''}
          onChange={(e) => onUpdate({ nfs: { ...volume.nfs!, path: e.target.value } })}
          placeholder="/exports/data"
          className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-blue-500"
        />
      </div>
    </div>
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={volume.nfs?.readOnly || false}
        onChange={(e) => onUpdate({ nfs: { ...volume.nfs!, readOnly: e.target.checked || undefined } })}
        className="w-4 h-4 rounded border-slate-600 bg-slate-800"
      />
      <span className="text-sm text-slate-300">Read Only</span>
    </label>
  </div>
);

// CSI Volume Editor
const CSIVolumeEditor: React.FC<{ volume: V1Volume; onUpdate: (u: Partial<V1Volume>) => void }> = ({ volume, onUpdate }) => (
  <div className="space-y-4">
    <div className="grid grid-cols-2 gap-4">
      <div>
        <label className="text-xs text-slate-400 mb-1 block">Driver *</label>
        <input
          type="text"
          value={volume.csi?.driver || ''}
          onChange={(e) => onUpdate({ csi: { ...volume.csi!, driver: e.target.value } })}
          placeholder="csi.example.com"
          className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
        />
      </div>
      <div>
        <label className="text-xs text-slate-400 mb-1 block">FS Type</label>
        <input
          type="text"
          value={volume.csi?.fsType || ''}
          onChange={(e) => onUpdate({ csi: { ...volume.csi!, fsType: e.target.value || undefined } })}
          placeholder="ext4"
          className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
        />
      </div>
    </div>
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={volume.csi?.readOnly || false}
        onChange={(e) => onUpdate({ csi: { ...volume.csi!, readOnly: e.target.checked || undefined } })}
        className="w-4 h-4 rounded border-slate-600 bg-slate-800"
      />
      <span className="text-sm text-slate-300">Read Only</span>
    </label>
  </div>
);
