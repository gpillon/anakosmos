import React, { useState, useMemo } from 'react';
import { useClusterStore } from '../store/useClusterStore';
import { useSettingsStore } from '../store/useSettingsStore';
import type { StatusFilterState } from '../store/useSettingsStore';
import { KIND_CONFIG } from '../config/resourceKinds';
import { 
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  Search,
  CheckSquare,
  Square,
  Crosshair,
  Activity,
  CloudOff,
  Zap,
  Network,
  Database,
  GitFork,
  Map as MapIcon
} from 'lucide-react';
import clsx from 'clsx';

export const ResourceLegend: React.FC = () => {
  const { resources } = useClusterStore();
  const { 
    hiddenResourceKinds, 
    toggleHiddenResourceKind, 
    setHiddenResourceKinds,
    hiddenLinkTypes,
    toggleHiddenLinkType,
    focusedResourceKind,
    setFocusedResourceKind,
    statusFilters,
    cycleStatusFilter,
    enableNamespaceProjection,
    setEnableNamespaceProjection
  } = useSettingsStore();
  const [isExpanded, setIsExpanded] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedKind, setExpandedKind] = useState<string | null>(null);

  const filteredConfig = useMemo(() => {
    if (!search) return KIND_CONFIG;
    return KIND_CONFIG.filter(item => item.label.toLowerCase().includes(search.toLowerCase()));
  }, [search]);

  // Count resources by kind
  const kindCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    Object.values(resources).forEach(r => {
      counts[r.kind] = (counts[r.kind] || 0) + 1;
    });
    return counts;
  }, [resources]);

  // Extract unique statuses per kind
  const kindStatuses = useMemo(() => {
    const map: Record<string, string[]> = {};
    Object.values(resources).forEach(r => {
        if (!map[r.kind]) map[r.kind] = [];
        if (!map[r.kind].includes(r.status)) map[r.kind].push(r.status);
    });
    // Sort statuses
    Object.keys(map).forEach(k => map[k].sort());
    return map;
  }, [resources]);

  const handleShowAll = () => setHiddenResourceKinds([]);
  const handleHideAll = () => setHiddenResourceKinds(KIND_CONFIG.map(k => k.kind));

  const getStatusIcon = (state: StatusFilterState) => {
      switch (state) {
          case 'hidden': return <EyeOff size={12} className="text-red-400" />;
          case 'grayed': return <CloudOff size={12} className="text-slate-400" />;
          case 'focused': return <Zap size={12} className="text-yellow-400" />;
          default: return <Activity size={12} className="text-blue-400" />;
      }
  };

  return (
    <div className="absolute bottom-14 left-4 z-40 flex flex-col items-start max-h-[60vh] transition-all duration-300">
      <div className={clsx(
        "bg-slate-900/95 backdrop-blur-md border border-slate-700/50 rounded-lg shadow-2xl overflow-hidden flex flex-col transition-all duration-300",
        isExpanded ? "w-80" : "w-10 h-10 rounded-full"
      )}>
        
        {/* Header (Always Visible or Collapsed Toggle) */}
        {isExpanded ? (
          <div className="p-3 border-b border-slate-700/50 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Legend & Filters
              </h3>
              <button 
                onClick={() => setIsExpanded(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <ChevronDown size={16} />
              </button>
            </div>

            {/* Search */}
            <div className="relative">
              <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500" />
              <input 
                type="text" 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter types..." 
                className="w-full bg-slate-800 border border-slate-700 rounded-md py-1 pl-7 pr-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 placeholder:text-slate-600"
              />
            </div>

            {/* Bulk Actions */}
            <div className="flex gap-2">
              <button 
                onClick={handleShowAll}
                className="flex-1 flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded py-1 text-[10px] text-slate-300 transition-colors"
                title="Show All"
              >
                <Eye size={10} /> Show All
              </button>
              <button 
                onClick={handleHideAll}
                className="flex-1 flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded py-1 text-[10px] text-slate-300 transition-colors"
                title="Hide All"
              >
                <EyeOff size={10} /> Hide All
              </button>
            </div>
          </div>
        ) : (
          <button 
            onClick={() => setIsExpanded(true)}
            className="w-full h-full flex items-center justify-center text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors"
            title="Expand Legend"
          >
            <ChevronUp size={20} />
          </button>
        )}
        
        {/* List Content */}
        {isExpanded && (
          <div className="overflow-y-auto custom-scrollbar flex-1 p-1 space-y-0.5">

            {/* ZONES SECTION */}
            <div className="px-2 py-1.5 mt-1 border-b border-slate-700/50">
               <h4 className="text-[10px] uppercase font-bold text-slate-500 mb-1">View Options</h4>
               <button 
                  onClick={() => setEnableNamespaceProjection(!enableNamespaceProjection)}
                  className={clsx(
                      "flex items-center gap-2 text-xs transition-colors w-full text-left",
                      enableNamespaceProjection ? "text-slate-200" : "text-slate-400 hover:text-slate-200"
                  )}
              >
                  <span className={clsx("w-3 h-0.5 rounded-full transition-colors", enableNamespaceProjection ? "bg-blue-500" : "bg-slate-700")}></span>
                  <MapIcon size={12} />
                  <span>Namespace Zones</span>
                  <div className="ml-auto opacity-0 group-hover:opacity-100">
                    {enableNamespaceProjection ? <CheckSquare size={10} className="text-blue-500" /> : <Square size={10} />}
                  </div>
              </button>
            </div>
            
            {/* LINK TYPES SECTION */}
            <div className="px-2 py-1.5 mt-1 border-b border-slate-700/50">
               <h4 className="text-[10px] uppercase font-bold text-slate-500 mb-1">Connections</h4>
               <div className="flex flex-col gap-1">
                  <button 
                    onClick={() => toggleHiddenLinkType('owner')}
                    className={clsx(
                        "flex items-center gap-2 text-xs transition-colors w-full text-left",
                        hiddenLinkTypes.includes('owner') ? "text-slate-600 line-through decoration-slate-600" : "text-slate-400 hover:text-slate-200"
                    )}
                  >
                    <span className={clsx("w-3 h-0.5 rounded-full transition-colors", hiddenLinkTypes.includes('owner') ? "bg-slate-700" : "bg-gray-600")}></span>
                    <GitFork size={12} />
                    <span>Ownership</span>
                    <div className="ml-auto opacity-0 group-hover:opacity-100">
                        {hiddenLinkTypes.includes('owner') ? <Square size={10} /> : <CheckSquare size={10} className="text-blue-500" />}
                    </div>
                  </button>

                  <button 
                    onClick={() => toggleHiddenLinkType('network')}
                    className={clsx(
                        "flex items-center gap-2 text-xs transition-colors w-full text-left",
                        hiddenLinkTypes.includes('network') ? "text-slate-600 line-through decoration-slate-600" : "text-slate-400 hover:text-slate-200"
                    )}
                  >
                    <span className={clsx("w-3 h-0.5 rounded-full shadow-[0_0_5px_#3b82f6] transition-colors", hiddenLinkTypes.includes('network') ? "bg-slate-700 shadow-none" : "bg-blue-500")}></span>
                    <Network size={12} />
                    <span>Network</span>
                  </button>

                  <button 
                    onClick={() => toggleHiddenLinkType('config')}
                    className={clsx(
                        "flex items-center gap-2 text-xs transition-colors w-full text-left",
                        hiddenLinkTypes.includes('config') ? "text-slate-600 line-through decoration-slate-600" : "text-slate-400 hover:text-slate-200"
                    )}
                  >
                    <span className={clsx("w-3 h-0.5 rounded-full transition-colors", hiddenLinkTypes.includes('config') ? "bg-slate-700" : "bg-purple-500")}></span>
                    <Database size={12} />
                    <span>Config</span>
                  </button>

                  <button 
                    onClick={() => toggleHiddenLinkType('storage')}
                    className={clsx(
                        "flex items-center gap-2 text-xs transition-colors w-full text-left",
                        hiddenLinkTypes.includes('storage') ? "text-slate-600 line-through decoration-slate-600" : "text-slate-400 hover:text-slate-200"
                    )}
                  >
                    <span className={clsx("w-3 h-0.5 rounded-full transition-colors", hiddenLinkTypes.includes('storage') ? "bg-slate-700" : "bg-amber-600")}></span>
                    <Database size={12} />
                    <span>Storage</span>
                  </button>
               </div>
            </div>

            {/* RESOURCE KINDS SECTION */}
            <div className="px-2 py-1.5">
               <h4 className="text-[10px] uppercase font-bold text-slate-500 mb-1">Resources</h4>
            </div>

            {filteredConfig.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-500">
                No types found
              </div>
            ) : (
              filteredConfig.map((item) => {
                const isHidden = hiddenResourceKinds.includes(item.kind);
                const isFocused = focusedResourceKind === item.kind;
                const hasStatuses = kindStatuses[item.kind] && kindStatuses[item.kind].length > 0;
                const isKindExpanded = expandedKind === item.kind;
                const hasActiveFilters = Object.values(statusFilters[item.kind] || {}).some(s => s !== 'default');
                
                return (
                  <div key={item.kind} className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-1 group">
                        <button
                        onClick={() => toggleHiddenResourceKind(item.kind)}
                        className={clsx(
                            "flex-1 flex items-center gap-3 px-2 py-1.5 rounded-md text-sm transition-all text-left relative",
                            isHidden 
                            ? "opacity-50 hover:opacity-80 bg-slate-800/30" 
                            : "hover:bg-slate-800"
                        )}
                        >
                        {hasActiveFilters && !isHidden && (
                            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-full bg-blue-500 rounded-l-md" />
                        )}

                        <div 
                            className="w-3 h-3 rounded-full flex-shrink-0 transition-transform group-hover:scale-110" 
                            style={{ backgroundColor: isHidden ? '#475569' : item.color }} 
                        />
                        
                        <item.icon 
                            size={14} 
                            className={isHidden ? "text-slate-500" : "text-slate-300"} 
                        />
                        
                        <span className={clsx("flex-1 text-xs font-medium truncate", isHidden ? "text-slate-500 line-through decoration-slate-600" : "text-slate-300")}>
                            {item.label}
                            {kindCounts[item.kind] > 0 && (
                              <span className="ml-1.5 text-slate-500 font-normal">
                                ({kindCounts[item.kind]})
                              </span>
                            )}
                        </span>

                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                            {isHidden ? <Square size={12} className="text-slate-600" /> : <CheckSquare size={12} className="text-blue-500" />}
                        </div>
                        </button>

                        {/* Status Toggle (Accordion) */}
                        {!isHidden && hasStatuses && (
                            <button
                                onClick={() => setExpandedKind(isKindExpanded ? null : item.kind)}
                                className={clsx(
                                "p-1.5 rounded-md transition-all",
                                isKindExpanded ? "text-blue-400 bg-blue-400/10" : "text-slate-600 hover:text-slate-300 hover:bg-slate-800"
                                )}
                                title="Filter by Status"
                            >
                                <Activity size={14} />
                            </button>
                        )}

                        {/* Focus Toggle */}
                        {!isHidden && (
                        <button
                            onClick={() => setFocusedResourceKind(item.kind)}
                            className={clsx(
                            "p-1.5 rounded-md transition-all",
                            isFocused ? "text-yellow-400 bg-yellow-400/10" : "text-slate-600 hover:text-slate-300 hover:bg-slate-800"
                            )}
                            title={isFocused ? "Unfocus" : "Focus"}
                        >
                            <Crosshair size={14} />
                        </button>
                        )}
                    </div>

                    {/* Status Sub-list */}
                    {isKindExpanded && !isHidden && (
                        <div className="pl-8 pr-2 py-1 space-y-1 bg-slate-800/30 rounded-b-md border-l-2 border-slate-700/50 ml-2 animate-in slide-in-from-top-1 fade-in duration-200">
                            {kindStatuses[item.kind].map(status => {
                                const currentFilter = statusFilters[item.kind]?.[status] || 'default';
                                
                                return (
                                    <button 
                                        key={status}
                                        onClick={() => cycleStatusFilter(item.kind, status)}
                                        className="w-full flex items-center justify-between px-2 py-1 rounded hover:bg-slate-700/50 text-xs transition-colors"
                                    >
                                        <span className={clsx(
                                            "truncate",
                                            currentFilter === 'hidden' ? "text-slate-500 line-through" : 
                                            currentFilter === 'grayed' ? "text-slate-500" :
                                            currentFilter === 'focused' ? "text-yellow-400 font-bold" :
                                            "text-slate-300"
                                        )}>
                                            {status}
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] text-slate-600 uppercase tracking-tighter">
                                                {currentFilter === 'default' ? '' : currentFilter}
                                            </span>
                                            {getStatusIcon(currentFilter)}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
};
