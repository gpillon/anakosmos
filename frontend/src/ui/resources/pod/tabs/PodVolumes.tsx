import React, { useState } from 'react';
import type { V1Pod, V1Volume } from '../../../../api/k8s-types';
import { HardDrive, ChevronDown, ChevronRight, Key, Lock, Database, Folder, Cloud } from 'lucide-react';
import { clsx } from 'clsx';
import { Card, CardHeader, CardBody } from '../../shared';

interface Props {
  pod: V1Pod;
}

export const PodVolumes: React.FC<Props> = ({ pod }) => {
  const volumes = pod.spec?.volumes || [];
  const [expandedVolumes, setExpandedVolumes] = useState<Set<string>>(new Set());

  const toggleExpanded = (name: string) => {
    const next = new Set(expandedVolumes);
    if (next.has(name)) {
      next.delete(name);
    } else {
      next.add(name);
    }
    setExpandedVolumes(next);
  };

  const getVolumeTypeInfo = (volume: V1Volume): { type: string; icon: React.ReactNode; color: string; details: Record<string, string> } => {
    if (volume.configMap) {
      return {
        type: 'ConfigMap',
        icon: <Key size={14} />,
        color: 'text-amber-400',
        details: {
          'Name': volume.configMap.name || '-',
          'Optional': volume.configMap.optional ? 'Yes' : 'No'
        }
      };
    }
    if (volume.secret) {
      return {
        type: 'Secret',
        icon: <Lock size={14} />,
        color: 'text-red-400',
        details: {
          'Name': volume.secret.secretName || '-',
          'Optional': volume.secret.optional ? 'Yes' : 'No'
        }
      };
    }
    if (volume.persistentVolumeClaim) {
      return {
        type: 'PVC',
        icon: <Database size={14} />,
        color: 'text-blue-400',
        details: {
          'Claim': volume.persistentVolumeClaim.claimName || '-',
          'Read Only': volume.persistentVolumeClaim.readOnly ? 'Yes' : 'No'
        }
      };
    }
    if (volume.emptyDir) {
      return {
        type: 'EmptyDir',
        icon: <Folder size={14} />,
        color: 'text-slate-400',
        details: {
          'Medium': volume.emptyDir.medium || 'default',
          'Size Limit': volume.emptyDir.sizeLimit || '-'
        }
      };
    }
    if (volume.hostPath) {
      return {
        type: 'HostPath',
        icon: <HardDrive size={14} />,
        color: 'text-purple-400',
        details: {
          'Path': volume.hostPath.path || '-',
          'Type': volume.hostPath.type || 'Unset'
        }
      };
    }
    if (volume.downwardAPI) {
      return {
        type: 'Downward API',
        icon: <Cloud size={14} />,
        color: 'text-cyan-400',
        details: {
          'Items': String(volume.downwardAPI.items?.length || 0)
        }
      };
    }
    if (volume.projected) {
      return {
        type: 'Projected',
        icon: <Folder size={14} />,
        color: 'text-emerald-400',
        details: {
          'Sources': String(volume.projected.sources?.length || 0)
        }
      };
    }
    if (volume.nfs) {
      return {
        type: 'NFS',
        icon: <Cloud size={14} />,
        color: 'text-orange-400',
        details: {
          'Server': volume.nfs.server || '-',
          'Path': volume.nfs.path || '-',
          'Read Only': volume.nfs.readOnly ? 'Yes' : 'No'
        }
      };
    }
    if (volume.csi) {
      return {
        type: 'CSI',
        icon: <Database size={14} />,
        color: 'text-indigo-400',
        details: {
          'Driver': volume.csi.driver || '-',
          'Read Only': volume.csi.readOnly ? 'Yes' : 'No'
        }
      };
    }
    
    return {
      type: 'Unknown',
      icon: <HardDrive size={14} />,
      color: 'text-slate-400',
      details: {}
    };
  };

  // Get volume mounts for each container
  const getVolumeMounts = (volumeName: string) => {
    const mounts: { container: string; mountPath: string; readOnly: boolean; subPath?: string }[] = [];
    
    pod.spec?.containers?.forEach(container => {
      container.volumeMounts?.forEach(mount => {
        if (mount.name === volumeName) {
          mounts.push({
            container: container.name,
            mountPath: mount.mountPath,
            readOnly: mount.readOnly || false,
            subPath: mount.subPath
          });
        }
      });
    });
    
    pod.spec?.initContainers?.forEach(container => {
      container.volumeMounts?.forEach(mount => {
        if (mount.name === volumeName) {
          mounts.push({
            container: `${container.name} (init)`,
            mountPath: mount.mountPath,
            readOnly: mount.readOnly || false,
            subPath: mount.subPath
          });
        }
      });
    });
    
    return mounts;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader 
          icon={<HardDrive size={16} />} 
          title="Volumes"
          badge={<span className="text-xs text-slate-500 ml-2">({volumes.length})</span>}
        />
        <CardBody className="space-y-3" noPadding={volumes.length > 0}>
          {volumes.length > 0 ? (
            <div className="divide-y divide-slate-800">
              {volumes.map((volume) => {
                const typeInfo = getVolumeTypeInfo(volume);
                const mounts = getVolumeMounts(volume.name);
                const isExpanded = expandedVolumes.has(volume.name);

                return (
                  <div key={volume.name} className="bg-slate-800/20">
                    <button
                      onClick={() => toggleExpanded(volume.name)}
                      className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-700/20 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {isExpanded ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
                        <span className={typeInfo.color}>{typeInfo.icon}</span>
                        <div className="text-left">
                          <span className="font-medium text-slate-200">{volume.name}</span>
                          <span className={clsx("ml-2 text-xs", typeInfo.color)}>{typeInfo.type}</span>
                        </div>
                      </div>
                      <div className="text-xs text-slate-500">
                        {mounts.length} mount{mounts.length !== 1 ? 's' : ''}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="px-4 pb-4 space-y-3">
                        {/* Volume Details */}
                        <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
                          <div className="text-xs text-slate-500 uppercase font-bold mb-2">Volume Details</div>
                          <div className="space-y-1 text-xs">
                            {Object.entries(typeInfo.details).map(([key, value]) => (
                              <div key={key} className="flex justify-between">
                                <span className="text-slate-500">{key}</span>
                                <span className="text-slate-300 font-mono">{value}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Mounts */}
                        {mounts.length > 0 && (
                          <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
                            <div className="text-xs text-slate-500 uppercase font-bold mb-2">Mounted In</div>
                            <div className="space-y-2">
                              {mounts.map((mount, i) => (
                                <div key={i} className="flex items-center gap-2 text-xs">
                                  <span className="text-blue-400">{mount.container}</span>
                                  <span className="text-slate-600">→</span>
                                  <span className="text-slate-300 font-mono">{mount.mountPath}</span>
                                  {mount.readOnly && (
                                    <span className="text-amber-400">(ro)</span>
                                  )}
                                  {mount.subPath && (
                                    <span className="text-slate-500">subPath: {mount.subPath}</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-4 text-center text-slate-500 text-sm">
              No volumes defined
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
};
