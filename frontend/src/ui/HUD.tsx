import React, { useMemo, useState, useRef, useEffect } from 'react';
import { useClusterStore } from '../store/useClusterStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { Layers, Activity, Search, Filter, X, EyeOff } from 'lucide-react';
import clsx from 'clsx';

export const HUD: React.FC = () => {
  const resources = useClusterStore(state => state.resources);
  const { 
    searchQuery, 
    setSearchQuery, 
    filterNamespaces, 
    setFilterNamespaces,
    hideSystemNamespaces,
    setHideSystemNamespaces
  } = useSettingsStore();

  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [nsSearch, setNsSearch] = useState(''); // Local state for namespace filter
  const filterRef = useRef<HTMLDivElement>(null);

  // Close filter dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setIsFilterOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Calculate filtered stats
  const filteredResources = useMemo(() => {
      // Logic duplicated here for stats, but actual filtering happens in ClusterScene/Layout
      // We'll just show total raw counts here for now or update to reflect filtered view?
      // Let's show Global Counts vs Filtered Counts could be nice, but for now stick to simple Global
      return Object.values(resources);
  }, [resources]);

  const resourceCount = filteredResources.length;
  const nodeCount = filteredResources.filter(r => r.kind === 'Node').length;
  const podCount = filteredResources.filter(r => r.kind === 'Pod').length;

  // Extract unique namespaces
  const namespaces = useMemo(() => {
    const ns = new Set<string>();
    Object.values(resources).forEach(r => {
      if (r.namespace) ns.add(r.namespace);
    });
    return Array.from(ns).sort();
  }, [resources]);

  const isSystemNamespace = (ns: string) => {
      return ns.startsWith('kube-') || ns.endsWith('-system') || ns.startsWith('openshift-');
  };

  const visibleNamespaces = useMemo(() => {
      let filtered = namespaces;
      
      if (hideSystemNamespaces) {
          filtered = filtered.filter(ns => !isSystemNamespace(ns));
      }
      
      if (nsSearch) {
          filtered = filtered.filter(ns => ns.toLowerCase().includes(nsSearch.toLowerCase()));
      }
      
      return filtered;
  }, [namespaces, hideSystemNamespaces, nsSearch]);

  const toggleNamespace = (ns: string) => {
    if (filterNamespaces.includes(ns)) {
        setFilterNamespaces(filterNamespaces.filter(n => n !== ns));
    } else {
        setFilterNamespaces([...filterNamespaces, ns]);
    }
  };

  const clearFilters = () => {
      setFilterNamespaces([]);
  };

  return (
    <div className="absolute top-0 left-0 w-full p-4 pointer-events-none z-10 grid grid-cols-[1fr_auto_1fr] items-start gap-4">
      {/* Left: Branding & Stats */}
      <div className="pointer-events-auto flex flex-col gap-3 items-start">
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2 drop-shadow-md">
          <Layers className="text-blue-500" />
          Kube3D
          <button className="p-1 rounded-full hover:bg-slate-800 text-slate-400 hover:text-blue-400 transition-colors ml-1" title="Info">
             <Activity size={16} /> 
          </button>
        </h1>
        
        <div className="flex flex-wrap gap-2 text-sm text-slate-400 bg-slate-900/60 backdrop-blur px-3 py-1.5 rounded-full border border-slate-700/50 shadow-lg">
          <span className="flex items-center gap-1.5">
            <Activity size={14} className="text-emerald-400" />
            Connected
          </span>
          <span className="w-px h-4 bg-slate-700 mx-1 self-center" />
          <span>{nodeCount} Nodes</span>
          <span className="w-px h-4 bg-slate-700 mx-1 self-center" />
          <span>{podCount} Pods</span>
          <span className="w-px h-4 bg-slate-700 mx-1 self-center" />
          <span>{resourceCount} Objects</span>
        </div>
      </div>

      {/* Center: Search & Filter */}
      <div className="pointer-events-auto flex items-center gap-2 bg-slate-900/80 backdrop-blur border border-slate-700/50 p-1.5 rounded-full shadow-2xl mt-1">
        
        {/* Namespace Filter Dropdown */}
        <div className="relative" ref={filterRef}>
          <button
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            className={clsx(
                "flex items-center gap-2 px-3 py-1.5 rounded-full transition-colors text-sm font-medium",
                filterNamespaces.length > 0 || hideSystemNamespaces ? "bg-blue-500/20 text-blue-300" : "hover:bg-slate-800 text-slate-300"
            )}
          >
            <Filter size={14} />
            <span>
                {filterNamespaces.length === 0 
                    ? 'All Namespaces' 
                    : `${filterNamespaces.length} Selected`}
            </span>
          </button>

          {isFilterOpen && (
            <div className="absolute top-full left-0 mt-2 w-64 bg-slate-800 border border-slate-700 rounded-lg shadow-xl overflow-hidden flex flex-col max-h-[400px]">
                {/* Header Actions */}
                <div className="p-2 border-b border-slate-700 flex flex-col gap-2">
                    {/* Namespace Search */}
                    <div className="px-2 pb-1">
                        <input
                            type="text"
                            value={nsSearch}
                            onChange={(e) => setNsSearch(e.target.value)}
                            placeholder="Filter namespaces..."
                            className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-300 focus:outline-none focus:border-blue-500"
                            onClick={(e) => e.stopPropagation()} 
                        />
                    </div>

                    <label className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-700/50 rounded cursor-pointer select-none">
                        <input 
                            type="checkbox"
                            checked={hideSystemNamespaces}
                            onChange={(e) => setHideSystemNamespaces(e.target.checked)}
                            className="rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-offset-slate-800"
                        />
                        <span className="text-sm text-slate-200 flex items-center gap-1.5">
                            <EyeOff size={13} className="text-slate-400" /> Hide System
                        </span>
                    </label>
                    
                    {filterNamespaces.length > 0 && (
                        <button 
                            onClick={clearFilters}
                            className="text-xs text-red-400 hover:text-red-300 px-2 py-1 text-left"
                        >
                            Clear Selection
                        </button>
                    )}
                </div>

                {/* Namespace List */}
                <div className="overflow-y-auto p-1 custom-scrollbar">
                    {visibleNamespaces.length === 0 ? (
                        <div className="p-3 text-center text-sm text-slate-500">
                            No namespaces found
                        </div>
                    ) : (
                        visibleNamespaces.map(ns => (
                            <label key={ns} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-700/50 rounded cursor-pointer select-none transition-colors">
                                <input 
                                    type="checkbox"
                                    checked={filterNamespaces.includes(ns)}
                                    onChange={() => toggleNamespace(ns)}
                                    className="rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-offset-slate-800"
                                />
                                <span className={clsx(
                                    "text-sm truncate", 
                                    isSystemNamespace(ns) ? "text-slate-400 italic" : "text-slate-200"
                                )}>
                                    {ns}
                                </span>
                            </label>
                        ))
                    )}
                </div>
            </div>
          )}
        </div>

        <div className="w-px h-6 bg-slate-700 mx-1" />

        {/* Search Input */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={14} className="text-slate-500" />
          </div>
          <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search resources..." 
            className="bg-transparent text-slate-200 text-sm rounded-full pl-9 pr-4 py-1.5 w-64 focus:outline-none placeholder:text-slate-600 focus:placeholder:text-slate-500"
          />
          {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-white"
              >
                  <X size={14} />
              </button>
          )}
        </div>
      </div>

      {/* Right: Empty (for balance) */}
      <div></div>
    </div>
  );
};
