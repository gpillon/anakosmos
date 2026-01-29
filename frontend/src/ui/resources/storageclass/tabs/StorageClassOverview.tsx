import React from 'react';
import type { V1StorageClass } from '../../../../api/k8s-types';
import { useClusterStore } from '../../../../store/useClusterStore';
import { useResourceDetailsStore } from '../../../../store/useResourceDetailsStore';
import { 
  HardDrive, 
  Settings,
  Star,
  Server,
  Shield,
  Volume2,
  ChevronRight,
  Database,
  Layers,
} from 'lucide-react';
import {
  MetadataCard,
  LabelsCard,
  AnnotationsCard,
  Card,
  CardHeader,
  CardBody,
  MetaRow,
  Combobox,
} from '../../shared';
import { clsx } from 'clsx';

interface Props {
  model: V1StorageClass;
  updateModel: (updater: (current: V1StorageClass) => V1StorageClass) => void;
  /** When true, immutable fields (provisioner, reclaimPolicy, volumeBindingMode) can be edited */
  isCreateMode?: boolean;
}

// Common reclaim policies
const RECLAIM_POLICY_OPTIONS = [
  { value: 'Delete', label: 'Delete', description: 'Volumes are deleted when PVC is deleted' },
  { value: 'Retain', label: 'Retain', description: 'Volumes are retained for manual cleanup' },
  { value: 'Recycle', label: 'Recycle', description: 'Basic scrub (rm -rf) - deprecated' },
];

// Volume binding modes
const BINDING_MODE_OPTIONS = [
  { value: 'Immediate', label: 'Immediate', description: 'Volume binds immediately on PVC creation' },
  { value: 'WaitForFirstConsumer', label: 'WaitForFirstConsumer', description: 'Delays binding until Pod using PVC is scheduled' },
];

// Common provisioners
const COMMON_PROVISIONERS = [
  'kubernetes.io/aws-ebs',
  'kubernetes.io/azure-disk',
  'kubernetes.io/azure-file',
  'kubernetes.io/gce-pd',
  'kubernetes.io/cinder',
  'kubernetes.io/vsphere-volume',
  'kubernetes.io/no-provisioner',
  'rancher.io/local-path',
  'csi.longhorn.io',
  'rook-ceph.rbd.csi.ceph.com',
  'rook-ceph.cephfs.csi.ceph.com',
  'nfs.csi.k8s.io',
];

export const StorageClassOverview: React.FC<Props> = ({ model, updateModel, isCreateMode = false }) => {
  const allResources = useClusterStore(state => state.resources);
  const openDetails = useResourceDetailsStore(state => state.openDetails);
  
  const metadata = model.metadata;
  const provisioner = model.provisioner || '';
  
  // Check if this is the default storage class
  const isDefault = metadata?.annotations?.['storageclass.kubernetes.io/is-default-class'] === 'true';
  
  // Get PVCs using this storage class
  const pvcsUsingThis = Object.values(allResources).filter(
    r => r.kind === 'PersistentVolumeClaim' && r.raw?.spec?.storageClassName === metadata?.name
  );

  // Handle provisioner change
  const handleProvisionerChange = (value: string) => {
    updateModel(current => ({
      ...current,
      provisioner: value,
    }));
  };

  // Handle reclaim policy change
  const handleReclaimPolicyChange = (value: string) => {
    updateModel(current => ({
      ...current,
      reclaimPolicy: value as 'Delete' | 'Retain' | 'Recycle',
    }));
  };

  // Handle binding mode change
  const handleBindingModeChange = (value: string) => {
    updateModel(current => ({
      ...current,
      volumeBindingMode: value as 'Immediate' | 'WaitForFirstConsumer',
    }));
  };

  // Handle allow volume expansion toggle
  const handleExpansionToggle = () => {
    updateModel(current => ({
      ...current,
      allowVolumeExpansion: !current.allowVolumeExpansion,
    }));
  };

  // Handle default annotation toggle
  const handleDefaultToggle = () => {
    updateModel(current => ({
      ...current,
      metadata: {
        ...current.metadata,
        annotations: {
          ...current.metadata?.annotations,
          'storageclass.kubernetes.io/is-default-class': isDefault ? 'false' : 'true',
        },
      },
    }));
  };

  // Mounted topology keys
  const allowedTopologies = model.allowedTopologies || [];

  // Immutable field indicator
  const immutableSuffix = !isCreateMode ? ' 🔒' : '';

  return (
    <div className="space-y-4">
      {/* Default Badge */}
      {isDefault && (
        <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
          <Star size={18} className="text-amber-400 fill-amber-400" />
          <span className="text-amber-300 text-sm font-medium">
            This is the default StorageClass for the cluster
          </span>
        </div>
      )}

      {/* Main Configuration */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Provisioner Card - immutable after creation */}
        <Card>
          <CardHeader 
            icon={<Server size={16} className="text-purple-400" />} 
            title={`Provisioner${immutableSuffix}`}
          />
          <CardBody>
            <div className="space-y-3">
              <MetaRow 
                label="Provisioner"
                value={
                  isCreateMode ? (
                    <Combobox
                      value={provisioner}
                      onChange={handleProvisionerChange}
                      options={COMMON_PROVISIONERS}
                      placeholder="Select or enter provisioner..."
                      allowCustom
                    />
                  ) : (
                    <span className="text-purple-300 font-mono text-sm">
                      {provisioner || 'Not set'}
                    </span>
                  )
                }
              />
              
              <div className="text-xs text-slate-500 bg-slate-800/50 p-3 rounded-lg">
                <p className="mb-1 font-medium text-slate-400">About Provisioners:</p>
                <p>The provisioner determines which volume plugin is used to provision PersistentVolumes. 
                   Different cloud providers and storage systems have their own provisioners.</p>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Volume Settings - some fields immutable after creation */}
        <Card>
          <CardHeader 
            icon={<Settings size={16} className="text-blue-400" />} 
            title={`Volume Settings${immutableSuffix}`}
          />
          <CardBody>
            <div className="space-y-4">
              {/* Reclaim Policy - immutable */}
              <div>
                <div className="text-xs text-slate-500 mb-2">Reclaim Policy</div>
                {isCreateMode ? (
                  <div className="grid grid-cols-3 gap-2">
                    {RECLAIM_POLICY_OPTIONS.map(policy => (
                      <button
                        key={policy.value}
                        onClick={() => handleReclaimPolicyChange(policy.value)}
                        className={clsx(
                          'p-3 rounded-lg text-left transition-all border',
                          model.reclaimPolicy === policy.value
                            ? 'bg-blue-500/20 border-blue-500/30'
                            : 'bg-slate-800/50 border-transparent hover:bg-slate-800'
                        )}
                      >
                        <div className={clsx(
                          'text-sm font-medium mb-1',
                          model.reclaimPolicy === policy.value ? 'text-blue-300' : 'text-slate-300'
                        )}>
                          {policy.label}
                        </div>
                        <div className="text-[10px] text-slate-500 leading-tight">
                          {policy.description}
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 bg-blue-500/20 border border-blue-500/30 rounded-lg">
                    <div className="text-sm font-medium text-blue-300">
                      {model.reclaimPolicy || 'Delete'}
                    </div>
                    <div className="text-[10px] text-slate-500 leading-tight mt-1">
                      {RECLAIM_POLICY_OPTIONS.find(p => p.value === model.reclaimPolicy)?.description || ''}
                    </div>
                  </div>
                )}
              </div>

              {/* Binding Mode - immutable */}
              <div>
                <div className="text-xs text-slate-500 mb-2">Volume Binding Mode</div>
                {isCreateMode ? (
                  <div className="grid grid-cols-2 gap-2">
                    {BINDING_MODE_OPTIONS.map(mode => (
                      <button
                        key={mode.value}
                        onClick={() => handleBindingModeChange(mode.value)}
                        className={clsx(
                          'p-3 rounded-lg text-left transition-all border',
                          model.volumeBindingMode === mode.value
                            ? 'bg-purple-500/20 border-purple-500/30'
                            : 'bg-slate-800/50 border-transparent hover:bg-slate-800'
                        )}
                      >
                        <div className={clsx(
                          'text-sm font-medium mb-1',
                          model.volumeBindingMode === mode.value ? 'text-purple-300' : 'text-slate-300'
                        )}>
                          {mode.label}
                        </div>
                        <div className="text-[10px] text-slate-500 leading-tight">
                          {mode.description}
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 bg-purple-500/20 border border-purple-500/30 rounded-lg">
                    <div className="text-sm font-medium text-purple-300">
                      {model.volumeBindingMode || 'Immediate'}
                    </div>
                    <div className="text-[10px] text-slate-500 leading-tight mt-1">
                      {BINDING_MODE_OPTIONS.find(m => m.value === model.volumeBindingMode)?.description || ''}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Feature Toggles */}
      <Card>
        <CardHeader icon={<Shield size={16} className="text-emerald-400" />} title="Features" />
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Allow Volume Expansion */}
            <button
              onClick={handleExpansionToggle}
              className={clsx(
                'flex items-center gap-4 p-4 rounded-xl transition-all border text-left',
                model.allowVolumeExpansion
                  ? 'bg-emerald-500/10 border-emerald-500/20'
                  : 'bg-slate-800/50 border-transparent hover:bg-slate-800'
              )}
            >
              <div className={clsx(
                'w-12 h-7 rounded-full relative transition-colors',
                model.allowVolumeExpansion ? 'bg-emerald-500' : 'bg-slate-600'
              )}>
                <div className={clsx(
                  'absolute top-1 w-5 h-5 bg-white rounded-full transition-transform',
                  model.allowVolumeExpansion ? 'translate-x-6' : 'translate-x-1'
                )} />
              </div>
              <div>
                <div className={clsx(
                  'text-sm font-medium',
                  model.allowVolumeExpansion ? 'text-emerald-300' : 'text-slate-300'
                )}>
                  Allow Volume Expansion
                </div>
                <div className="text-xs text-slate-500">
                  Enable resizing of volumes created with this class
                </div>
              </div>
            </button>

            {/* Default Storage Class */}
            <button
              onClick={handleDefaultToggle}
              className={clsx(
                'flex items-center gap-4 p-4 rounded-xl transition-all border text-left',
                isDefault
                  ? 'bg-amber-500/10 border-amber-500/20'
                  : 'bg-slate-800/50 border-transparent hover:bg-slate-800'
              )}
            >
              <div className={clsx(
                'w-12 h-7 rounded-full relative transition-colors',
                isDefault ? 'bg-amber-500' : 'bg-slate-600'
              )}>
                <div className={clsx(
                  'absolute top-1 w-5 h-5 bg-white rounded-full transition-transform',
                  isDefault ? 'translate-x-6' : 'translate-x-1'
                )} />
              </div>
              <div>
                <div className={clsx(
                  'text-sm font-medium',
                  isDefault ? 'text-amber-300' : 'text-slate-300'
                )}>
                  Default Storage Class
                </div>
                <div className="text-xs text-slate-500">
                  Use when PVC doesn't specify a storage class
                </div>
              </div>
            </button>
          </div>
        </CardBody>
      </Card>

      {/* Mount Options (if any) */}
      {model.mountOptions && model.mountOptions.length > 0 && (
        <Card>
          <CardHeader icon={<Volume2 size={16} className="text-cyan-400" />} title="Mount Options" />
          <CardBody>
            <div className="flex flex-wrap gap-2">
              {model.mountOptions.map((opt, idx) => (
                <span 
                  key={idx}
                  className="px-3 py-1.5 bg-cyan-500/20 text-cyan-300 rounded-lg text-sm font-mono"
                >
                  {opt}
                </span>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Allowed Topologies */}
      {allowedTopologies.length > 0 && (
        <Card>
          <CardHeader icon={<Layers size={16} className="text-indigo-400" />} title="Allowed Topologies" />
          <CardBody>
            <div className="space-y-3">
              {allowedTopologies.map((topology, idx) => (
                <div key={idx} className="p-3 bg-slate-800/50 rounded-lg">
                  <div className="text-xs text-slate-500 mb-2">Match Label Expressions</div>
                  {topology.matchLabelExpressions?.map((expr, exprIdx) => (
                    <div key={exprIdx} className="flex items-center gap-2 text-sm">
                      <span className="text-indigo-300 font-medium">{expr.key}</span>
                      <span className="text-slate-500">in</span>
                      <div className="flex flex-wrap gap-1">
                        {expr.values?.map((v, vIdx) => (
                          <span key={vIdx} className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 rounded text-xs">
                            {v}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      {/* PVCs using this StorageClass */}
      {pvcsUsingThis.length > 0 && (
        <Card>
          <CardHeader icon={<Database size={16} className="text-orange-400" />} title={`PVCs Using This Class (${pvcsUsingThis.length})`} />
          <CardBody>
            <div className="space-y-2">
              {pvcsUsingThis.slice(0, 10).map(pvc => (
                <button
                  key={pvc.id}
                  onClick={() => openDetails(pvc.id)}
                  className="w-full flex items-center justify-between p-3 bg-slate-800/50 hover:bg-slate-800 rounded-lg transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <HardDrive size={16} className="text-orange-400" />
                    <div>
                      <div className="text-sm text-slate-200">{pvc.name}</div>
                      <div className="text-xs text-slate-500">{pvc.namespace}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={clsx(
                      'px-2 py-0.5 text-xs rounded',
                      pvc.raw?.status?.phase === 'Bound' 
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-amber-500/20 text-amber-400'
                    )}>
                      {pvc.raw?.status?.phase || 'Unknown'}
                    </span>
                    <ChevronRight size={14} className="text-slate-500" />
                  </div>
                </button>
              ))}
              {pvcsUsingThis.length > 10 && (
                <div className="text-xs text-slate-500 text-center py-2">
                  +{pvcsUsingThis.length - 10} more PVCs
                </div>
              )}
            </div>
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
