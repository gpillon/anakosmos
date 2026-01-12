import React, { useMemo } from 'react';
import { useClusterStore } from '../../../store/useClusterStore';
import { useResourceDetailsStore } from '../../../store/useResourceDetailsStore';
import { Card, CardHeader, CardBody } from './Card';
import { KIND_CONFIG } from '../../../config/resourceKinds';
import { GitFork, Box, ChevronRight } from 'lucide-react';
import { clsx } from 'clsx';

interface OwnerReferencesCardProps {
  /** Direct owner references from metadata.ownerReferences */
  ownerReferences?: Array<{
    apiVersion?: string;
    kind?: string;
    name?: string;
    uid?: string;
    controller?: boolean;
  }>;
  /** Show only the controller owner (default: false - shows all) */
  controllerOnly?: boolean;
  /** Show the full ownership chain (default: true) */
  showFullChain?: boolean;
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

interface OwnerChainItem {
  uid: string;
  name: string;
  kind: string;
  resourceId?: string; // ID in our store, if found
  isController?: boolean;
}

/**
 * Displays owner references with full ownership chain.
 * Recursively traces the ownership hierarchy up to the root.
 */
export const OwnerReferencesCard: React.FC<OwnerReferencesCardProps> = ({
  ownerReferences = [],
  controllerOnly = false,
  showFullChain = true,
}) => {
  const resources = useClusterStore(state => state.resources);
  const openDetails = useResourceDetailsStore(state => state.openDetails);

  // Build the full ownership chain
  const ownerChains = useMemo(() => {
    if (!ownerReferences || ownerReferences.length === 0) return [];

    const refs = controllerOnly 
      ? ownerReferences.filter(r => r.controller) 
      : ownerReferences;

    // For each direct owner, build the chain up to root
    const chains: OwnerChainItem[][] = [];

    const buildChain = (ownerRef: typeof refs[0]): OwnerChainItem[] => {
      const chain: OwnerChainItem[] = [];
      
      // Find the owner in our resources
      const ownerResource = Object.values(resources).find(
        r => r.raw?.metadata?.uid === ownerRef.uid
      );

      const item: OwnerChainItem = {
        uid: ownerRef.uid || '',
        name: ownerRef.name || '',
        kind: ownerRef.kind || '',
        resourceId: ownerResource?.id,
        isController: ownerRef.controller,
      };
      chain.push(item);

      // If we found the owner and want full chain, recurse
      if (showFullChain && ownerResource?.raw?.metadata?.ownerReferences) {
        const parentRefs = ownerResource.raw.metadata.ownerReferences;
        // Follow the controller owner (or first if none marked as controller)
        const controllerRef = parentRefs.find((r: any) => r.controller) || parentRefs[0];
        if (controllerRef) {
          const parentChain = buildChain(controllerRef);
          chain.push(...parentChain);
        }
      }

      return chain;
    };

    refs.forEach(ref => {
      const chain = buildChain(ref);
      if (chain.length > 0) {
        chains.push(chain);
      }
    });

    return chains;
  }, [ownerReferences, resources, controllerOnly, showFullChain]);

  if (ownerChains.length === 0) return null;

  return (
    <Card>
      <CardHeader title="Controlled By" icon={<GitFork size={16} />} />
      <CardBody>
        <div className="space-y-3">
          {ownerChains.map((chain, chainIdx) => (
            <div key={chainIdx} className="flex items-center flex-wrap gap-1">
              {/* Render chain in reverse (root -> leaf) */}
              {[...chain].reverse().map((item, idx) => {
                const Icon = getKindIcon(item.kind);
                const color = getKindColor(item.kind);
                const isLast = idx === chain.length - 1;

                return (
                  <React.Fragment key={item.uid}>
                    {item.resourceId ? (
                      <button
                        onClick={() => openDetails(item.resourceId!)}
                        className={clsx(
                          "flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-colors",
                          "hover:bg-opacity-70"
                        )}
                        style={{
                          backgroundColor: `${color}20`,
                          borderColor: `${color}50`,
                        }}
                      >
                        <Icon size={14} style={{ color }} />
                        <div className="text-left">
                          <div className="text-xs font-medium text-slate-200">{item.name}</div>
                          <div className="text-[10px] text-slate-500">{item.kind}</div>
                        </div>
                      </button>
                    ) : (
                      <div
                        className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/50 border border-slate-700/50 rounded-lg"
                      >
                        <Icon size={14} className="text-slate-400" />
                        <div className="text-left">
                          <div className="text-xs font-medium text-slate-400">{item.name}</div>
                          <div className="text-[10px] text-slate-500">{item.kind}</div>
                        </div>
                      </div>
                    )}
                    {!isLast && (
                      <ChevronRight size={14} className="text-slate-600 mx-1" />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  );
};
