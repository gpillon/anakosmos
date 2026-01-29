import React, { useState } from 'react';
import type { V1StorageClass } from '../../../../api/k8s-types';
import { 
  Settings,
  Plus,
  Trash2,
  Edit3,
  Save,
  X,
  AlertCircle,
  Info,
  Copy,
  Check
} from 'lucide-react';
import {
  Card,
  CardHeader,
  CardBody,
} from '../../shared';
import { clsx } from 'clsx';

interface Props {
  model: V1StorageClass;
  updateModel: (updater: (current: V1StorageClass) => V1StorageClass) => void;
}

// Common parameter hints by provisioner
const PARAMETER_HINTS: Record<string, { key: string; description: string; example?: string }[]> = {
  'kubernetes.io/aws-ebs': [
    { key: 'type', description: 'EBS volume type', example: 'gp3, io1, st1, sc1' },
    { key: 'iopsPerGB', description: 'IOPS per GiB for io1 volumes', example: '10' },
    { key: 'fsType', description: 'Filesystem type', example: 'ext4, xfs' },
    { key: 'encrypted', description: 'Enable encryption', example: 'true' },
    { key: 'kmsKeyId', description: 'KMS key for encryption', example: 'arn:aws:kms:...' },
  ],
  'kubernetes.io/gce-pd': [
    { key: 'type', description: 'Disk type', example: 'pd-standard, pd-ssd, pd-balanced' },
    { key: 'fsType', description: 'Filesystem type', example: 'ext4, xfs' },
    { key: 'replication-type', description: 'Replication type', example: 'none, regional-pd' },
  ],
  'kubernetes.io/azure-disk': [
    { key: 'skuName', description: 'Storage account type', example: 'Standard_LRS, Premium_LRS' },
    { key: 'kind', description: 'Disk kind', example: 'Managed, Dedicated' },
    { key: 'fsType', description: 'Filesystem type', example: 'ext4, xfs' },
    { key: 'cachingMode', description: 'Disk caching mode', example: 'None, ReadOnly, ReadWrite' },
  ],
  'csi.longhorn.io': [
    { key: 'numberOfReplicas', description: 'Number of replicas', example: '3' },
    { key: 'staleReplicaTimeout', description: 'Timeout for stale replicas', example: '2880' },
    { key: 'fromBackup', description: 'Restore from backup URL', example: '' },
    { key: 'diskSelector', description: 'Disk selector for scheduling', example: 'ssd' },
    { key: 'nodeSelector', description: 'Node selector for scheduling', example: 'storage' },
  ],
  'rancher.io/local-path': [
    { key: 'nodePath', description: 'Path on node for storage', example: '/opt/local-path-provisioner' },
  ],
  'rook-ceph.rbd.csi.ceph.com': [
    { key: 'clusterID', description: 'Ceph cluster ID', example: 'rook-ceph' },
    { key: 'pool', description: 'Ceph pool name', example: 'replicapool' },
    { key: 'imageFormat', description: 'RBD image format', example: '2' },
    { key: 'imageFeatures', description: 'RBD image features', example: 'layering' },
    { key: 'csi.storage.k8s.io/fstype', description: 'Filesystem type', example: 'ext4' },
  ],
  'nfs.csi.k8s.io': [
    { key: 'server', description: 'NFS server address', example: '192.168.1.100' },
    { key: 'share', description: 'NFS share path', example: '/exports/data' },
  ],
};

export const StorageClassParameters: React.FC<Props> = ({ model, updateModel }) => {
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const parameters = model.parameters || {};
  const provisioner = model.provisioner || '';
  const hints = PARAMETER_HINTS[provisioner] || [];

  // Handle parameter update
  const handleUpdateParameter = (key: string, value: string) => {
    updateModel(current => ({
      ...current,
      parameters: {
        ...current.parameters,
        [key]: value,
      },
    }));
    setEditingKey(null);
  };

  // Handle parameter delete
  const handleDeleteParameter = (key: string) => {
    updateModel(current => {
      const newParams = { ...current.parameters };
      delete newParams[key];
      return {
        ...current,
        parameters: Object.keys(newParams).length > 0 ? newParams : undefined,
      };
    });
  };

  // Handle add new parameter
  const handleAddParameter = () => {
    if (!newKey.trim()) return;
    
    updateModel(current => ({
      ...current,
      parameters: {
        ...current.parameters,
        [newKey.trim()]: newValue,
      },
    }));
    
    setNewKey('');
    setNewValue('');
    setShowAdd(false);
  };

  // Start editing
  const startEdit = (key: string, value: string) => {
    setEditingKey(key);
    setEditValue(value);
  };

  // Copy to clipboard
  const copyToClipboard = async (key: string, value: string) => {
    await navigator.clipboard.writeText(`${key}: ${value}`);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Add hint as parameter
  const addHintAsParameter = (hint: { key: string; example?: string }) => {
    setNewKey(hint.key);
    setNewValue(hint.example || '');
    setShowAdd(true);
  };

  return (
    <div className="space-y-4">
      {/* Parameters Card */}
      <Card>
        <CardHeader 
          icon={<Settings size={16} className="text-purple-400" />} 
          title="Provisioner Parameters" 
          action={
            !showAdd && (
              <button
                onClick={() => setShowAdd(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 rounded-lg transition-colors"
              >
                <Plus size={14} />
                Add Parameter
              </button>
            )
          }
        />
        <CardBody>
          {/* Info about parameters */}
          <div className="flex items-start gap-2 p-3 mb-4 bg-slate-800/50 rounded-lg text-xs text-slate-400">
            <Info size={14} className="text-slate-500 mt-0.5 shrink-0" />
            <div>
              Parameters are passed to the provisioner ({provisioner || 'not set'}) when creating volumes. 
              Each provisioner supports different parameters.
            </div>
          </div>

          {/* Add new parameter form */}
          {showAdd && (
            <div className="mb-4 p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl">
              <div className="text-sm font-medium text-purple-300 mb-3">Add New Parameter</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Key</label>
                  <input
                    type="text"
                    value={newKey}
                    onChange={(e) => setNewKey(e.target.value)}
                    placeholder="parameter-name"
                    className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-600 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:border-purple-500"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Value</label>
                  <input
                    type="text"
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value)}
                    placeholder="value"
                    className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-600 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:border-purple-500"
                    onKeyDown={(e) => e.key === 'Enter' && handleAddParameter()}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => { setShowAdd(false); setNewKey(''); setNewValue(''); }}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddParameter}
                  disabled={!newKey.trim()}
                  className={clsx(
                    'flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-colors',
                    newKey.trim()
                      ? 'bg-purple-600 hover:bg-purple-500 text-white'
                      : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                  )}
                >
                  <Plus size={14} />
                  Add
                </button>
              </div>
            </div>
          )}

          {/* Parameters list */}
          {Object.keys(parameters).length === 0 ? (
            <div className="text-center py-8">
              <Settings size={32} className="mx-auto text-slate-600 mb-3" />
              <p className="text-slate-400 text-sm mb-1">No parameters configured</p>
              <p className="text-slate-500 text-xs">
                Parameters are provisioner-specific key-value pairs
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {Object.entries(parameters).map(([key, value]) => (
                <div 
                  key={key}
                  className="group flex items-center gap-3 p-3 bg-slate-800/50 hover:bg-slate-800 rounded-lg transition-colors"
                >
                  {editingKey === key ? (
                    // Edit mode
                    <>
                      <div className="flex-1 flex items-center gap-2">
                        <span className="text-sm text-purple-300 font-mono shrink-0">{key}:</span>
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="flex-1 px-2 py-1 text-sm bg-slate-900 border border-slate-600 rounded text-white focus:outline-none focus:border-purple-500 font-mono"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleUpdateParameter(key, editValue);
                            if (e.key === 'Escape') setEditingKey(null);
                          }}
                        />
                      </div>
                      <button
                        onClick={() => handleUpdateParameter(key, editValue)}
                        className="p-1.5 text-emerald-400 hover:bg-emerald-500/20 rounded transition-colors"
                      >
                        <Save size={14} />
                      </button>
                      <button
                        onClick={() => setEditingKey(null)}
                        className="p-1.5 text-slate-400 hover:bg-slate-700 rounded transition-colors"
                      >
                        <X size={14} />
                      </button>
                    </>
                  ) : (
                    // View mode
                    <>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2">
                          <span className="text-sm text-purple-300 font-mono">{key}</span>
                          <span className="text-slate-600">=</span>
                          <span className="text-sm text-slate-300 font-mono truncate">{value}</span>
                        </div>
                        {/* Show hint if available */}
                        {hints.find(h => h.key === key)?.description && (
                          <div className="text-xs text-slate-500 mt-1">
                            {hints.find(h => h.key === key)?.description}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => copyToClipboard(key, value)}
                          className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded transition-colors"
                          title="Copy"
                        >
                          {copiedKey === key ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                        </button>
                        <button
                          onClick={() => startEdit(key, value)}
                          className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-blue-500/20 rounded transition-colors"
                          title="Edit"
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteParameter(key)}
                          className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/20 rounded transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Parameter Hints by Provisioner */}
      {hints.length > 0 && (
      <Card>
        <CardHeader 
          icon={<Info size={16} className="text-cyan-400" />} 
          title={`Common Parameters for ${provisioner}`}
        />
          <CardBody>
            <div className="text-xs text-slate-500 mb-3">
              Click on a parameter to add it to your configuration
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {hints.map(hint => {
                const isAlreadySet = hint.key in parameters;
                return (
                  <button
                    key={hint.key}
                    onClick={() => !isAlreadySet && addHintAsParameter(hint)}
                    disabled={isAlreadySet}
                    className={clsx(
                      'p-3 rounded-lg text-left transition-all border',
                      isAlreadySet
                        ? 'bg-slate-800/30 border-transparent opacity-50 cursor-not-allowed'
                        : 'bg-slate-800/50 border-transparent hover:bg-cyan-500/10 hover:border-cyan-500/20'
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={clsx(
                        'text-sm font-mono',
                        isAlreadySet ? 'text-slate-500' : 'text-cyan-300'
                      )}>
                        {hint.key}
                      </span>
                      {isAlreadySet && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-slate-700 text-slate-400 rounded">
                          already set
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500">{hint.description}</div>
                    {hint.example && (
                      <div className="text-xs text-slate-600 mt-1 font-mono">
                        e.g. {hint.example}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Raw parameters preview */}
      <Card>
        <CardHeader icon={<AlertCircle size={16} className="text-slate-400" />} title="Parameters Preview (YAML)" />
        <CardBody>
          <pre className="p-3 bg-slate-950 rounded-lg text-xs font-mono text-slate-400 overflow-x-auto">
            {Object.keys(parameters).length === 0 
              ? '# No parameters set'
              : Object.entries(parameters)
                  .map(([k, v]) => `${k}: "${v}"`)
                  .join('\n')
            }
          </pre>
        </CardBody>
      </Card>
    </div>
  );
};
