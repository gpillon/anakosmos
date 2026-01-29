import React, { useState } from 'react';
import type { V1PersistentVolumeClaim } from '../../../../api/k8s-types';
import { useClusterStore } from '../../../../store/useClusterStore';
import { useResourceDetailsStore } from '../../../../store/useResourceDetailsStore';
import { 
  HardDrive, 
  Database,
  CheckCircle,
  Clock,
  AlertTriangle,
  XCircle,
  Layers,
  Link2,
  Lock
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
  Combobox,
  type HealthStatus
} from '../../shared';
import { clsx } from 'clsx';

interface Props {
  model: V1PersistentVolumeClaim;
  updateModel: (updater: (current: V1PersistentVolumeClaim) => V1PersistentVolumeClaim) => void;
  /** When true, immutable fields (storageClassName, volumeMode) can be edited */
  isCreateMode?: boolean;
}

// Access modes display names
const ACCESS_MODE_LABELS: Record<string, string> = {
  'ReadWriteOnce': 'RWO - Read/Write by single node',
  'ReadOnlyMany': 'ROX - Read-only by many nodes',
  'ReadWriteMany': 'RWX - Read/Write by many nodes',
  'ReadWriteOncePod': 'RWOP - Read/Write by single pod',
};

const ACCESS_MODE_OPTIONS = [
  { value: 'ReadWriteOnce', label: 'ReadWriteOnce (RWO)' },
  { value: 'ReadOnlyMany', label: 'ReadOnlyMany (ROX)' },
  { value: 'ReadWriteMany', label: 'ReadWriteMany (RWX)' },
  { value: 'ReadWriteOncePod', label: 'ReadWriteOncePod (RWOP)' },
];

const VOLUME_MODE_OPTIONS = [
  { value: 'Filesystem', label: 'Filesystem' },
  { value: 'Block', label: 'Block' },
];

export const PVCOverview: React.FC<Props> = ({ model, updateModel, isCreateMode = false }) => {
  const allResources = useClusterStore(state => state.resources);
  const openDetails = useResourceDetailsStore(state => state.openDetails);
  
  const metadata = model.metadata;
  const spec = model.spec;
  const status = model.status;
  
  // State for editing
  const [isEditingStorage, setIsEditingStorage] = useState(false);
  const [storageValue, setStorageValue] = useState('');

  // Get storage class names from cluster
  const storageClasses = Object.values(allResources)
    .filter(r => r.kind === 'StorageClass')
    .map(r => r.name);

  // Get bound PV
  const boundPV = status?.phase === 'Bound' && spec?.volumeName
    ? Object.values(allResources).find(r => r.kind === 'PersistentVolume' && r.name === spec.volumeName)
    : null;

  // Determine health status
  const getHealthStatus = (): HealthStatus => {
    const phase = status?.phase;
    if (phase === 'Bound') return 'healthy';
    if (phase === 'Pending') return 'warning';
    if (phase === 'Lost') return 'error';
    return 'unknown';
  };

  const getStatusMessage = () => {
    const phase = status?.phase || 'Unknown';
    switch (phase) {
      case 'Bound':
        return `Bound to PV: ${spec?.volumeName || 'unknown'}`;
      case 'Pending':
        return 'Waiting for a matching PersistentVolume';
      case 'Lost':
        return 'The underlying PersistentVolume has been deleted';
      default:
        return `Status: ${phase}`;
    }
  };

  const getPhaseIcon = () => {
    const phase = status?.phase;
    switch (phase) {
      case 'Bound':
        return <CheckCircle size={16} className="text-emerald-400" />;
      case 'Pending':
        return <Clock size={16} className="text-amber-400" />;
      case 'Lost':
        return <XCircle size={16} className="text-red-400" />;
      default:
        return <AlertTriangle size={16} className="text-slate-400" />;
    }
  };

  // Parse storage size - handle both string and potential object formats
  const getStorageValue = (val: unknown): string => {
    if (!val) return '';
    if (typeof val === 'string') return val;
    if (typeof val === 'object' && val !== null) {
      return String((val as Record<string, unknown>)['amount'] || (val as Record<string, unknown>)['string'] || JSON.stringify(val));
    }
    return String(val);
  };
  
  const requestedStorage = getStorageValue(spec?.resources?.requests?.['storage']) || '1Gi';
  const actualCapacity = getStorageValue(status?.capacity?.['storage']);

  // Handle storage change
  const handleStorageEdit = () => {
    setStorageValue(requestedStorage);
    setIsEditingStorage(true);
  };

  const handleStorageSave = () => {
    updateModel(current => ({
      ...current,
      spec: {
        ...current.spec,
        resources: {
          ...current.spec?.resources,
          requests: {
            ...current.spec?.resources?.requests,
            storage: storageValue,
          },
        },
      },
    }));
    setIsEditingStorage(false);
  };

  // Handle storage class change
  const handleStorageClassChange = (value: string) => {
    updateModel(current => ({
      ...current,
      spec: {
        ...current.spec,
        storageClassName: value || undefined,
      },
    }));
  };

  // Handle access modes change
  const handleAccessModeToggle = (mode: string) => {
    const currentModes = spec?.accessModes || [];
    const newModes = currentModes.includes(mode)
      ? currentModes.filter(m => m !== mode)
      : [...currentModes, mode];
    
    updateModel(current => ({
      ...current,
      spec: {
        ...current.spec,
        accessModes: newModes.length > 0 ? newModes : ['ReadWriteOnce'],
      },
    }));
  };

  // Handle volume mode change
  const handleVolumeModeChange = (value: string) => {
    updateModel(current => ({
      ...current,
      spec: {
        ...current.spec,
        volumeMode: value as 'Filesystem' | 'Block',
      },
    }));
  };

  // Helper to render label with optional lock icon
  const renderImmutableLabel = (label: string) => (
    <span className="flex items-center gap-1.5">
      {label}
      {!isCreateMode && (
        <span title="Immutable after creation">
          <Lock size={12} className="text-slate-500" />
        </span>
      )}
    </span>
  );

  return (
    <div className="space-y-4">
      {/* Status Banner */}
      <StatusBanner 
        name={metadata?.name || 'Unnamed PVC'}
        namespace={metadata?.namespace}
        health={getHealthStatus()}
        statusText={getStatusMessage()}
      />

      {/* Main Info Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Storage Configuration */}
        <Card>
          <CardHeader icon={<HardDrive size={16} className="text-orange-400" />} title="Storage Configuration" />
          <CardBody>
            <div className="space-y-3">
              {/* Requested Storage */}
              <MetaRow 
                label="Requested Storage"
                value={
                  isEditingStorage ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={storageValue}
                        onChange={(e) => setStorageValue(e.target.value)}
                        className="w-24 px-2 py-1 text-sm bg-slate-800 border border-slate-600 rounded text-white focus:outline-none focus:border-purple-500"
                        placeholder="e.g. 10Gi"
                      />
                      <button
                        onClick={handleStorageSave}
                        className="px-2 py-1 text-xs bg-purple-600 hover:bg-purple-500 text-white rounded"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setIsEditingStorage(false)}
                        className="px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={handleStorageEdit}
                      className="text-orange-400 hover:text-orange-300 font-mono transition-colors"
                    >
                      {requestedStorage}
                    </button>
                  )
                }
              />

              {/* Actual Capacity (if bound) */}
              {actualCapacity && (
                <MetaRow 
                  label="Actual Capacity"
                  value={<span className="text-emerald-400 font-mono">{actualCapacity}</span>}
                />
              )}

              {/* Storage Class - immutable after creation */}
              <MetaRow 
                label={renderImmutableLabel("Storage Class")}
                value={
                  isCreateMode ? (
                    <Combobox
                      value={spec?.storageClassName || ''}
                      onChange={handleStorageClassChange}
                      options={storageClasses}
                      placeholder="Select storage class..."
                      allowCustom
                    />
                  ) : (
                    <span className="text-slate-300 font-mono">
                      {spec?.storageClassName || '(default)'}
                    </span>
                  )
                }
              />

              {/* Volume Mode - immutable after creation */}
              <MetaRow 
                label={renderImmutableLabel("Volume Mode")}
                value={
                  isCreateMode ? (
                    <div className="flex gap-2">
                      {VOLUME_MODE_OPTIONS.map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => handleVolumeModeChange(opt.value)}
                          className={clsx(
                            'px-3 py-1 text-xs rounded-lg transition-all',
                            (spec?.volumeMode || 'Filesystem') === opt.value
                              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                              : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                          )}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <span className="px-3 py-1 text-xs bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-lg">
                      {spec?.volumeMode || 'Filesystem'}
                    </span>
                  )
                }
              />

              {/* Volume Name (if bound) */}
              {spec?.volumeName && (
                <MetaRow 
                  label="Bound Volume"
                  value={
                    boundPV ? (
                      <button
                        onClick={() => openDetails(boundPV.id)}
                        className="text-cyan-400 hover:text-cyan-300 hover:underline transition-colors"
                      >
                        {spec.volumeName}
                      </button>
                    ) : (
                      <span className="text-slate-300">{spec.volumeName}</span>
                    )
                  }
                />
              )}
            </div>
          </CardBody>
        </Card>

        {/* Access Modes */}
        <Card>
          <CardHeader icon={<Layers size={16} className="text-blue-400" />} title="Access Modes" />
          <CardBody>
            <div className="space-y-2">
              {ACCESS_MODE_OPTIONS.map(mode => {
                const isSelected = spec?.accessModes?.includes(mode.value);
                return (
                  <button
                    key={mode.value}
                    onClick={() => handleAccessModeToggle(mode.value)}
                    className={clsx(
                      'w-full flex items-center gap-3 p-3 rounded-lg transition-all text-left',
                      isSelected
                        ? 'bg-blue-500/20 border border-blue-500/30'
                        : 'bg-slate-800/50 border border-transparent hover:bg-slate-800'
                    )}
                  >
                    <div className={clsx(
                      'w-5 h-5 rounded border-2 flex items-center justify-center transition-colors',
                      isSelected ? 'border-blue-400 bg-blue-500/30' : 'border-slate-600'
                    )}>
                      {isSelected && <CheckCircle size={12} className="text-blue-400" />}
                    </div>
                    <div>
                      <div className={clsx(
                        'text-sm font-medium',
                        isSelected ? 'text-blue-300' : 'text-slate-300'
                      )}>
                        {mode.value}
                      </div>
                      <div className="text-xs text-slate-500">
                        {ACCESS_MODE_LABELS[mode.value]}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Status Details */}
      <Card>
        <CardHeader icon={<Database size={16} className="text-emerald-400" />} title="Status Details" />
        <CardBody>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Phase */}
            <div className="p-3 bg-slate-800/50 rounded-lg">
              <div className="text-xs text-slate-500 mb-1">Phase</div>
              <div className="flex items-center gap-2">
                {getPhaseIcon()}
                <span className={clsx(
                  'text-sm font-medium',
                  status?.phase === 'Bound' ? 'text-emerald-400' :
                  status?.phase === 'Pending' ? 'text-amber-400' :
                  status?.phase === 'Lost' ? 'text-red-400' : 'text-slate-400'
                )}>
                  {status?.phase || 'Unknown'}
                </span>
              </div>
            </div>

            {/* Access Modes (actual) */}
            <div className="p-3 bg-slate-800/50 rounded-lg">
              <div className="text-xs text-slate-500 mb-1">Access Modes</div>
              <div className="flex flex-wrap gap-1">
                {(status?.accessModes || spec?.accessModes || []).map(mode => (
                  <span key={mode} className="px-2 py-0.5 text-xs bg-blue-500/20 text-blue-300 rounded">
                    {mode}
                  </span>
                ))}
              </div>
            </div>

            {/* Capacity */}
            <div className="p-3 bg-slate-800/50 rounded-lg">
              <div className="text-xs text-slate-500 mb-1">Capacity</div>
              <div className="text-sm font-mono text-orange-400">
                {status?.capacity?.storage || requestedStorage}
              </div>
            </div>

            {/* Storage Class */}
            <div className="p-3 bg-slate-800/50 rounded-lg">
              <div className="text-xs text-slate-500 mb-1">Storage Class</div>
              <div className="text-sm text-slate-300">
                {spec?.storageClassName || 'default'}
              </div>
            </div>
          </div>

          {/* Conditions */}
          {status?.conditions && status.conditions.length > 0 && (
            <div className="mt-4">
              <div className="text-xs text-slate-500 mb-2">Conditions</div>
              <div className="space-y-2">
                {status.conditions.map((condition, idx) => (
                  <div 
                    key={idx}
                    className={clsx(
                      'p-3 rounded-lg border',
                      condition.status === 'True' 
                        ? 'bg-emerald-500/10 border-emerald-500/20' 
                        : 'bg-slate-800/50 border-slate-700'
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={clsx(
                        'text-sm font-medium',
                        condition.status === 'True' ? 'text-emerald-400' : 'text-slate-400'
                      )}>
                        {condition.type}
                      </span>
                      <span className="text-xs text-slate-500">
                        {condition.status}
                      </span>
                    </div>
                    {condition.message && (
                      <p className="text-xs text-slate-400">{condition.message}</p>
                    )}
                    {condition.reason && (
                      <p className="text-xs text-slate-500 mt-1">Reason: {condition.reason}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Selector (if specified) */}
      {spec?.selector && (
        <Card>
          <CardHeader icon={<Link2 size={16} className="text-purple-400" />} title="Volume Selector" />
          <CardBody>
            {spec.selector.matchLabels && Object.keys(spec.selector.matchLabels).length > 0 && (
              <div className="mb-3">
                <div className="text-xs text-slate-500 mb-2">Match Labels</div>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(spec.selector.matchLabels).map(([key, value]) => (
                    <span 
                      key={key}
                      className="px-2 py-1 text-xs bg-purple-500/20 text-purple-300 rounded-lg"
                    >
                      {key}={value}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {spec.selector.matchExpressions && spec.selector.matchExpressions.length > 0 && (
              <div>
                <div className="text-xs text-slate-500 mb-2">Match Expressions</div>
                <div className="space-y-1">
                  {spec.selector.matchExpressions.map((expr, idx) => (
                    <div key={idx} className="text-xs text-slate-400 font-mono bg-slate-800 p-2 rounded">
                      {expr.key} {expr.operator} {expr.values?.join(', ') || ''}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {/* Metadata */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <MetadataCard metadata={metadata} />
        <LabelsCard labels={metadata?.labels} />
      </div>

      {/* Annotations */}
      <AnnotationsCard annotations={metadata?.annotations} />
    </div>
  );
};
