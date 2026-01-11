import React, { useState } from 'react';
import type { ClusterResource } from '../../../../api/types';
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
  Save,
  RefreshCw,
  AlertCircle,
  Settings
} from 'lucide-react';

interface Props {
  resource: ClusterResource;
  onApply: (updatedRaw: any) => Promise<void>;
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

interface VolumeSpec {
  name: string;
  emptyDir?: { medium?: string; sizeLimit?: string };
  configMap?: { name: string; items?: Array<{ key: string; path: string; mode?: number }>; defaultMode?: number; optional?: boolean };
  secret?: { secretName: string; items?: Array<{ key: string; path: string; mode?: number }>; defaultMode?: number; optional?: boolean };
  persistentVolumeClaim?: { claimName: string; readOnly?: boolean };
  hostPath?: { path: string; type?: string };
  projected?: { sources: Array<any>; defaultMode?: number };
  downwardAPI?: { items: Array<{ path: string; fieldRef?: { fieldPath: string }; resourceFieldRef?: { resource: string; containerName?: string } }> };
  nfs?: { server: string; path: string; readOnly?: boolean };
  csi?: { driver: string; readOnly?: boolean; fsType?: string; volumeAttributes?: Record<string, string> };
}

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

export const DeploymentVolumes: React.FC<Props> = ({ resource, onApply }) => {
  const raw = resource.raw;
  const template = raw?.spec?.template?.spec || {};
  const [volumes, setVolumes] = useState<VolumeSpec[]>(template.volumes || []);
  const [expandedVolumes, setExpandedVolumes] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = JSON.parse(JSON.stringify(raw));
      updated.spec.template.spec.volumes = volumes.length > 0 ? volumes : undefined;
      await onApply(updated);
      setHasChanges(false);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const toggleExpanded = (name: string) => {
    const next = new Set(expandedVolumes);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    setExpandedVolumes(next);
  };

  const addVolume = (type: VolumeType) => {
    const baseName = `volume-${Date.now()}`;
    let newVolume: VolumeSpec = { name: baseName };

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

    setVolumes([...volumes, newVolume]);
    setExpandedVolumes(new Set([...expandedVolumes, baseName]));
    setHasChanges(true);
    setShowAddModal(false);
  };

  const updateVolume = (index: number, updates: Partial<VolumeSpec>) => {
    const newVolumes = [...volumes];
    newVolumes[index] = { ...newVolumes[index], ...updates };
    setVolumes(newVolumes);
    setHasChanges(true);
  };

  const removeVolume = (index: number) => {
    setVolumes(volumes.filter((_, i) => i !== index));
    setHasChanges(true);
  };

  const getVolumeType = (volume: VolumeSpec): VolumeType => {
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
    const containers = [...(template.containers || []), ...(template.initContainers || [])];
    return containers
      .filter((c: any) => c.volumeMounts?.some((m: any) => m.name === volumeName))
      .map((c: any) => ({
        name: c.name,
        mount: c.volumeMounts.find((m: any) => m.name === volumeName)
      }));
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

      {/* Volumes Section */}
      <div className="bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden">
        <div className="px-4 py-3 bg-slate-800/50 border-b border-slate-700 flex items-center justify-between">
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
              const mounts = containerMounts(volume.name);
              const isExpanded = expandedVolumes.has(volume.name);

              return (
                <div key={volume.name} className="bg-slate-900/30">
                  {/* Volume Header */}
                  <div 
                    className="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-slate-800/30 transition-colors"
                    onClick={() => toggleExpanded(volume.name)}
                  >
                    {isExpanded ? <ChevronDown size={16} className="text-slate-500" /> : <ChevronRight size={16} className="text-slate-500" />}
                    {volumeTypeIcons[type]}
                    <div className="flex-1">
                      <span className="font-mono font-medium text-slate-200">{volume.name}</span>
                      <span className="ml-3 text-xs px-2 py-0.5 bg-slate-800 text-slate-400 rounded">{volumeTypeLabels[type]}</span>
                      {mounts.length > 0 && (
                        <span className="ml-2 text-xs text-slate-500">
                          → {mounts.map(m => m.mount.mountPath).join(', ')}
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
  volume: VolumeSpec;
  type: VolumeType;
  onUpdate: (updates: Partial<VolumeSpec>) => void;
  mounts: Array<{ name: string; mount: any }>;
}

const VolumeEditor: React.FC<VolumeEditorProps> = ({ volume, type, onUpdate, mounts }) => {
  return (
    <div className="space-y-4">
      {/* Name field */}
      <div>
        <label className="text-xs text-slate-400 mb-1 block">Volume Name</label>
        <input
          type="text"
          value={volume.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-blue-500"
        />
      </div>

      {/* Type-specific editors */}
      {type === 'emptyDir' && <EmptyDirEditor volume={volume} onUpdate={onUpdate} />}
      {type === 'configMap' && <ConfigMapVolumeEditor volume={volume} onUpdate={onUpdate} />}
      {type === 'secret' && <SecretVolumeEditor volume={volume} onUpdate={onUpdate} />}
      {type === 'persistentVolumeClaim' && <PVCVolumeEditor volume={volume} onUpdate={onUpdate} />}
      {type === 'hostPath' && <HostPathVolumeEditor volume={volume} onUpdate={onUpdate} />}
      {type === 'projected' && <ProjectedVolumeEditor volume={volume} onUpdate={onUpdate} />}
      {type === 'downwardAPI' && <DownwardAPIVolumeEditor volume={volume} onUpdate={onUpdate} />}
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
                <span className="text-slate-300 font-mono">{m.mount.mountPath}</span>
                {m.mount.readOnly && <span className="text-amber-500">(RO)</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Empty Dir Editor
const EmptyDirEditor: React.FC<{ volume: VolumeSpec; onUpdate: (u: Partial<VolumeSpec>) => void }> = ({ volume, onUpdate }) => (
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
const ConfigMapVolumeEditor: React.FC<{ volume: VolumeSpec; onUpdate: (u: Partial<VolumeSpec>) => void }> = ({ volume, onUpdate }) => (
  <div className="space-y-4">
    <div className="grid grid-cols-2 gap-4">
      <div>
        <label className="text-xs text-slate-400 mb-1 block">ConfigMap Name *</label>
        <input
          type="text"
          value={volume.configMap?.name || ''}
          onChange={(e) => onUpdate({ configMap: { ...volume.configMap!, name: e.target.value } })}
          placeholder="my-configmap"
          className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
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
    <ItemsEditor
      items={volume.configMap?.items}
      onUpdate={(items) => onUpdate({ configMap: { ...volume.configMap!, items: items.length > 0 ? items : undefined } })}
    />
  </div>
);

// Secret Volume Editor
const SecretVolumeEditor: React.FC<{ volume: VolumeSpec; onUpdate: (u: Partial<VolumeSpec>) => void }> = ({ volume, onUpdate }) => (
  <div className="space-y-4">
    <div className="grid grid-cols-2 gap-4">
      <div>
        <label className="text-xs text-slate-400 mb-1 block">Secret Name *</label>
        <input
          type="text"
          value={volume.secret?.secretName || ''}
          onChange={(e) => onUpdate({ secret: { ...volume.secret!, secretName: e.target.value } })}
          placeholder="my-secret"
          className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
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
    <ItemsEditor
      items={volume.secret?.items}
      onUpdate={(items) => onUpdate({ secret: { ...volume.secret!, items: items.length > 0 ? items : undefined } })}
    />
  </div>
);

// PVC Volume Editor
const PVCVolumeEditor: React.FC<{ volume: VolumeSpec; onUpdate: (u: Partial<VolumeSpec>) => void }> = ({ volume, onUpdate }) => (
  <div className="space-y-4">
    <div>
      <label className="text-xs text-slate-400 mb-1 block">Claim Name *</label>
      <input
        type="text"
        value={volume.persistentVolumeClaim?.claimName || ''}
        onChange={(e) => onUpdate({ persistentVolumeClaim: { ...volume.persistentVolumeClaim!, claimName: e.target.value } })}
        placeholder="my-pvc"
        className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
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

// Host Path Volume Editor
const HostPathVolumeEditor: React.FC<{ volume: VolumeSpec; onUpdate: (u: Partial<VolumeSpec>) => void }> = ({ volume, onUpdate }) => (
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

// Projected Volume Editor
const ProjectedVolumeEditor: React.FC<{ volume: VolumeSpec; onUpdate: (u: Partial<VolumeSpec>) => void }> = ({ volume, onUpdate }) => {
  const sources = volume.projected?.sources || [];

  const addSource = (type: 'configMap' | 'secret' | 'serviceAccountToken' | 'downwardAPI') => {
    const newSource: any = {};
    if (type === 'configMap') newSource.configMap = { name: '' };
    else if (type === 'secret') newSource.secret = { name: '' };
    else if (type === 'serviceAccountToken') newSource.serviceAccountToken = { path: 'token', expirationSeconds: 3600 };
    else if (type === 'downwardAPI') newSource.downwardAPI = { items: [] };
    
    onUpdate({ projected: { ...volume.projected!, sources: [...sources, newSource] } });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs text-slate-400 mb-1 block">Default Mode</label>
        <input
          type="text"
          value={volume.projected?.defaultMode !== undefined ? volume.projected.defaultMode.toString(8) : ''}
          onChange={(e) => {
            const mode = parseInt(e.target.value, 8);
            onUpdate({ projected: { ...volume.projected!, defaultMode: isNaN(mode) ? undefined : mode } });
          }}
          placeholder="0644"
          className="w-48 bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-blue-500"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-bold text-slate-500 uppercase">Sources</label>
          <div className="flex gap-2">
            <button onClick={() => addSource('configMap')} className="text-xs text-blue-400 hover:text-blue-300">+ ConfigMap</button>
            <button onClick={() => addSource('secret')} className="text-xs text-amber-400 hover:text-amber-300">+ Secret</button>
            <button onClick={() => addSource('serviceAccountToken')} className="text-xs text-emerald-400 hover:text-emerald-300">+ Token</button>
          </div>
        </div>

        {sources.length === 0 ? (
          <div className="text-xs text-slate-500 py-2">No sources added</div>
        ) : (
          <div className="space-y-2">
            {sources.map((source: any, i: number) => (
              <div key={i} className="flex gap-2 items-center bg-slate-800/50 p-2 rounded border border-slate-700">
                <span className="text-xs text-slate-400 w-24">
                  {source.configMap ? 'ConfigMap' : source.secret ? 'Secret' : source.serviceAccountToken ? 'SA Token' : 'DownwardAPI'}
                </span>
                <input
                  type="text"
                  value={source.configMap?.name || source.secret?.name || source.serviceAccountToken?.path || ''}
                  onChange={(e) => {
                    const newSources = [...sources];
                    if (source.configMap) newSources[i] = { configMap: { ...source.configMap, name: e.target.value } };
                    else if (source.secret) newSources[i] = { secret: { ...source.secret, name: e.target.value } };
                    else if (source.serviceAccountToken) newSources[i] = { serviceAccountToken: { ...source.serviceAccountToken, path: e.target.value } };
                    onUpdate({ projected: { ...volume.projected!, sources: newSources } });
                  }}
                  placeholder={source.configMap || source.secret ? 'Name' : 'Path'}
                  className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-white"
                />
                <button
                  onClick={() => {
                    onUpdate({ projected: { ...volume.projected!, sources: sources.filter((_: any, idx: number) => idx !== i) } });
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
  );
};

// Downward API Volume Editor
const DownwardAPIVolumeEditor: React.FC<{ volume: VolumeSpec; onUpdate: (u: Partial<VolumeSpec>) => void }> = ({ volume, onUpdate }) => {
  const items = volume.downwardAPI?.items || [];

  const addItem = () => {
    onUpdate({
      downwardAPI: {
        ...volume.downwardAPI!,
        items: [...items, { path: '', fieldRef: { fieldPath: 'metadata.name' } }]
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-slate-500 uppercase">Items</label>
        <button onClick={addItem} className="text-xs text-blue-400 hover:text-blue-300">
          <Plus size={12} className="inline mr-1" /> Add Item
        </button>
      </div>

      {items.length === 0 ? (
        <div className="text-xs text-slate-500 py-2">No items defined</div>
      ) : (
        <div className="space-y-2">
          {items.map((item: any, i: number) => (
            <div key={i} className="flex gap-2 items-center bg-slate-800/50 p-2 rounded border border-slate-700">
              <select
                value={item.fieldRef?.fieldPath || item.resourceFieldRef?.resource || ''}
                onChange={(e) => {
                  const newItems = [...items];
                  const val = e.target.value;
                  if (val.startsWith('limits.') || val.startsWith('requests.')) {
                    newItems[i] = { ...item, fieldRef: undefined, resourceFieldRef: { resource: val } };
                  } else {
                    newItems[i] = { ...item, resourceFieldRef: undefined, fieldRef: { fieldPath: val } };
                  }
                  onUpdate({ downwardAPI: { ...volume.downwardAPI!, items: newItems } });
                }}
                className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-white"
              >
                <optgroup label="Metadata">
                  <option value="metadata.name">Pod Name</option>
                  <option value="metadata.namespace">Namespace</option>
                  <option value="metadata.uid">UID</option>
                  <option value="metadata.labels">Labels</option>
                  <option value="metadata.annotations">Annotations</option>
                </optgroup>
                <optgroup label="Spec">
                  <option value="spec.nodeName">Node Name</option>
                  <option value="spec.serviceAccountName">Service Account</option>
                </optgroup>
                <optgroup label="Status">
                  <option value="status.podIP">Pod IP</option>
                  <option value="status.hostIP">Host IP</option>
                </optgroup>
                <optgroup label="Resources">
                  <option value="limits.cpu">CPU Limits</option>
                  <option value="limits.memory">Memory Limits</option>
                  <option value="requests.cpu">CPU Requests</option>
                  <option value="requests.memory">Memory Requests</option>
                </optgroup>
              </select>
              <input
                type="text"
                value={item.path}
                onChange={(e) => {
                  const newItems = [...items];
                  newItems[i] = { ...item, path: e.target.value };
                  onUpdate({ downwardAPI: { ...volume.downwardAPI!, items: newItems } });
                }}
                placeholder="Path (e.g., labels)"
                className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-white font-mono"
              />
              <button
                onClick={() => {
                  onUpdate({ downwardAPI: { ...volume.downwardAPI!, items: items.filter((_: any, idx: number) => idx !== i) } });
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
  );
};

// NFS Volume Editor
const NFSVolumeEditor: React.FC<{ volume: VolumeSpec; onUpdate: (u: Partial<VolumeSpec>) => void }> = ({ volume, onUpdate }) => (
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
const CSIVolumeEditor: React.FC<{ volume: VolumeSpec; onUpdate: (u: Partial<VolumeSpec>) => void }> = ({ volume, onUpdate }) => (
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

// Items Editor (for ConfigMap/Secret)
const ItemsEditor: React.FC<{
  items?: Array<{ key: string; path: string; mode?: number }>;
  onUpdate: (items: Array<{ key: string; path: string; mode?: number }>) => void;
}> = ({ items = [], onUpdate }) => (
  <div>
    <div className="flex items-center justify-between mb-2">
      <label className="text-xs font-bold text-slate-500 uppercase">Specific Keys (optional)</label>
      <button
        onClick={() => onUpdate([...items, { key: '', path: '' }])}
        className="text-xs text-blue-400 hover:text-blue-300"
      >
        <Plus size={12} className="inline mr-1" /> Add Key
      </button>
    </div>
    {items.length === 0 ? (
      <div className="text-xs text-slate-500 py-1">All keys will be mounted</div>
    ) : (
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex gap-2 items-center">
            <input
              type="text"
              value={item.key}
              onChange={(e) => {
                const newItems = [...items];
                newItems[i] = { ...item, key: e.target.value };
                onUpdate(newItems);
              }}
              placeholder="Key"
              className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-white"
            />
            <input
              type="text"
              value={item.path}
              onChange={(e) => {
                const newItems = [...items];
                newItems[i] = { ...item, path: e.target.value };
                onUpdate(newItems);
              }}
              placeholder="Path"
              className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-white font-mono"
            />
            <button
              onClick={() => onUpdate(items.filter((_, idx) => idx !== i))}
              className="text-red-400 hover:text-red-300"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    )}
  </div>
);
