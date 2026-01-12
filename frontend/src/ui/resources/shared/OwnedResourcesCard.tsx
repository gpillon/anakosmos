import React, { useMemo } from 'react';
import { useClusterStore } from '../../../store/useClusterStore';
import { useResourceDetailsStore } from '../../../store/useResourceDetailsStore';
import { Card, CardHeader, CardBody } from './Card';
import { KIND_CONFIG } from '../../../config/resourceKinds';
import { Layers, Box } from 'lucide-react';
import { clsx } from 'clsx';

interface OwnedResourcesCardProps {
  /** The UID of the current resource */
  resourceUid?: string;
  /** Filter by specific kinds (e.g., ['Pod', 'ReplicaSet']) */
  filterKinds?: string[];
  /** Group by kind (default: true) */
  groupByKind?: boolean;
  /** Maximum items to show per kind when grouped (default: 10) */
  maxPerKind?: number;
  /** Custom title */
  title?: string;
}

// Get icon for a resource kind
const getKindIcon = (kind: string) => {
  const config = KIND_CONFIG.find(k => k.kind === kind);
  return config?.icon || Box;
};

// Get color for a resource kind  
const getKindColor = (kind: string) => {
  const config = KIND_CONFIG.find(k => k.kind === kind);
  return config?.color || '#64748b';
};

// Determine if status is healthy
const isHealthyStatus = (status: string) => {
  return ['Running', 'Ready', 'Active', 'Available', 'Succeeded', 'Complete', 'Bound', 'Healthy'].includes(status);
};

const isErrorStatus = (status: string) => {
  return ['Failed', 'Error', 'CrashLoopBackOff', 'ImagePullBackOff', 'ErrImagePull', 'Evicted'].includes(status);
};

/**
 * Displays resources that are owned by the current resource.
 * Groups by kind and shows status indicators.
 */
export const OwnedResourcesCard: React.FC<OwnedResourcesCardProps> = ({
  resourceUid,
  filterKinds,
  groupByKind = true,
  maxPerKind = 10,
  title = 'Owns',
}) => {
  const resources = useClusterStore(state => state.resources);
  const openDetails = useResourceDetailsStore(state => state.openDetails);

  // Find all resources that have this resource as owner
  const ownedResources = useMemo(() => {
    if (!resourceUid) return [];
    
    let owned = Object.values(resources).filter(r => 
      r.ownerRefs?.includes(resourceUid)
    );

    // Filter by kinds if specified
    if (filterKinds && filterKinds.length > 0) {
      owned = owned.filter(r => filterKinds.includes(r.kind));
    }

    // Sort by kind, then by name
    owned.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind.localeCompare(b.kind);
      return a.name.localeCompare(b.name);
    });

    return owned;
  }, [resources, resourceUid, filterKinds]);

  // Group by kind
  const groupedByKind = useMemo(() => {
    if (!groupByKind) return null;
    
    const groups: Record<string, typeof ownedResources> = {};
    ownedResources.forEach(r => {
      if (!groups[r.kind]) groups[r.kind] = [];
      groups[r.kind].push(r);
    });
    return groups;
  }, [ownedResources, groupByKind]);

  if (ownedResources.length === 0) return null;

  const totalCount = ownedResources.length;

  return (
    <Card>
      <CardHeader title={`${title} (${totalCount})`} icon={<Layers size={16} />} />
      <CardBody>
        {groupByKind && groupedByKind ? (
          <div className="space-y-4">
            {Object.entries(groupedByKind).map(([kind, items]) => {
              const Icon = getKindIcon(kind);
              const color = getKindColor(kind);
              const displayItems = items.slice(0, maxPerKind);
              const remaining = items.length - maxPerKind;

              return (
                <div key={kind}>
                  {/* Kind header */}
                  <div className="flex items-center gap-2 mb-2">
                    <Icon size={14} style={{ color }} />
                    <span className="text-xs font-medium text-slate-400">
                      {kind}s ({items.length})
                    </span>
                  </div>
                  
                  {/* Items */}
                  <div className="flex flex-wrap gap-1.5 pl-5">
                    {displayItems.map(item => {
                      const isHealthy = isHealthyStatus(item.status);
                      const isError = isErrorStatus(item.status);

                      return (
                        <button
                          key={item.id}
                          onClick={() => openDetails(item.id)}
                          className={clsx(
                            "flex items-center gap-1.5 px-2 py-1 rounded border transition-colors text-[11px]",
                            "bg-slate-800/50 hover:bg-slate-700/50 border-slate-700/50 hover:border-slate-600"
                          )}
                          title={`${item.name} (${item.status})`}
                        >
                          <span className={clsx(
                            "w-1.5 h-1.5 rounded-full flex-shrink-0",
                            isHealthy ? "bg-emerald-500" : isError ? "bg-red-500" : "bg-amber-500"
                          )} />
                          <span className="text-slate-300 truncate max-w-[120px]">{item.name}</span>
                        </button>
                      );
                    })}
                    {remaining > 0 && (
                      <span className="flex items-center px-2 py-1 text-[11px] text-slate-500">
                        +{remaining} more
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto">
            {ownedResources.map(item => {
              const Icon = getKindIcon(item.kind);
              const isHealthy = isHealthyStatus(item.status);
              const isError = isErrorStatus(item.status);

              return (
                <button
                  key={item.id}
                  onClick={() => openDetails(item.id)}
                  className={clsx(
                    "flex items-center gap-1.5 px-2 py-1 rounded border transition-colors text-[11px]",
                    "bg-slate-800/50 hover:bg-slate-700/50 border-slate-700/50 hover:border-slate-600"
                  )}
                >
                  <span className={clsx(
                    "w-1.5 h-1.5 rounded-full",
                    isHealthy ? "bg-emerald-500" : isError ? "bg-red-500" : "bg-amber-500"
                  )} />
                  <Icon size={11} className="text-slate-400" />
                  <span className="text-slate-300 truncate max-w-[120px]">{item.name}</span>
                </button>
              );
            })}
          </div>
        )}
      </CardBody>
    </Card>
  );
};
