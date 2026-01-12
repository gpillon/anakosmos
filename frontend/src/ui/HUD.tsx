import React, { useMemo, useState, useRef, useEffect } from 'react';
import { useDisplayResources } from '../store/useClusterStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { Layers, Activity, Search, Filter, X, EyeOff, HelpCircle } from 'lucide-react';
import clsx from 'clsx';
import { useThree, useFrame } from '@react-three/fiber';

// Stats Component that can optionally hook into R3F if placed inside Canvas, 
// or accept stats props if placed outside. 
// Since HUD is outside Canvas usually, we can't use useThree directly here for render stats unless we pass them or use a global store.
// But user requested ALT+I to show stats IN HUD.

// Let's create a separate Stats listener that lives in Canvas and updates a store or state that HUD can read?
// Or simpler: We keep the Stats logic isolated but render it within the HUD structure IF it's active.

// Actually, to get GL stats (draw calls etc), we NEED to be inside Canvas context.
// But HUD is typically overlay HTML.
// Solution: Create a "StatsListener" component inside Canvas that writes to a shared store (e.g. zustand),
// and HUD reads from that store.

// For now, let's just add the simple logic: 
// 1. We'll use a local state in HUD for visibility.
// 2. But we can't get GL stats easily if HUD is outside Canvas.
//
// If HUD is outside Canvas (which it seems to be based on file structure implyng UI overlay), 
// we need a bridge.
//
// Let's define a tiny store for stats first.
import { create } from 'zustand';
import { useOnboardingStore } from '../store/useOnboardingStore';

interface StatsState {
    fps: number;
    frameTime: number;
    calls: number;
    triangles: number;
    points: number;
    lines: number;
    activeObjects: number;
    geometries: number;
    textures: number;
    setStats: (s: Partial<StatsState>) => void;
}

export const useStatsStore = create<StatsState>((set) => ({
    fps: 0, frameTime: 0, calls: 0, triangles: 0, points: 0, lines: 0, activeObjects: 0, geometries: 0, textures: 0,
    setStats: (s) => set(s)
}));

// Component to be placed INSIDE Canvas to report stats
export const SceneStatsReporter: React.FC = () => {
    const setStats = useStatsStore(state => state.setStats);
    const gl = useThree(state => state.gl);
    const scene = useThree(state => state.scene);
    const lastTimeRef = useRef(performance.now());
    const frameCountRef = useRef(0);

    // Disable autoReset to allow accumulating stats across multiple render passes (EffectComposer)
    useEffect(() => {
        const originalAutoReset = gl.info.autoReset;
        gl.info.autoReset = false;
        return () => { gl.info.autoReset = originalAutoReset; };
    }, [gl]);

    // Use high priority to run before render, allowing us to capture previous frame stats and reset
    useFrame(() => {
        const now = performance.now();
        frameCountRef.current++;
        
        // Update stats every 500ms
        if (now - lastTimeRef.current >= 500) {
            const delta = now - lastTimeRef.current;
            const fps = Math.round((frameCountRef.current * 1000) / delta);
            const frameTime = delta / frameCountRef.current;
            
            let objectCount = 0;
            scene.traverse(() => objectCount++);

            setStats({
                fps,
                frameTime: Number(frameTime.toFixed(2)),
                calls: gl.info.render.calls,
                triangles: gl.info.render.triangles,
                points: gl.info.render.points,
                lines: gl.info.render.lines,
                geometries: gl.info.memory.geometries,
                textures: gl.info.memory.textures,
                activeObjects: objectCount,
            });
            lastTimeRef.current = now;
            frameCountRef.current = 0;
        }

        // Manually reset stats at the beginning of each frame (after reading previous frame's stats)
        gl.info.reset();
    }, -1000);
    
    return null;
};

interface HUDProps {
  showFull?: boolean;
}

export const HUD: React.FC<HUDProps> = ({ showFull = true }) => {
  const isOnboardingActive = useOnboardingStore(state => state.isActive);
  const { resources } = useDisplayResources(isOnboardingActive);
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
  
  // Debug / Stats state
  const [showStats, setShowStats] = useState(false);
  const stats = useStatsStore();

  // Toggle Stats with ALT+I
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && (e.key.toLowerCase() === 'i' || e.code === 'KeyI')) {
        setShowStats(v => !v);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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
      return Object.values(resources);
  }, [resources]);

  const resourceCount = filteredResources.length;
  const nodeCount = filteredResources.filter(r => r.kind === 'Node').length;
  const podCount = filteredResources.filter(r => r.kind === 'Pod').length;

  // ... (existing namespaces logic) ...
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
      if (hideSystemNamespaces) filtered = filtered.filter(ns => !isSystemNamespace(ns));
      if (nsSearch) filtered = filtered.filter(ns => ns.toLowerCase().includes(nsSearch.toLowerCase()));
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
    <>
    {/* Debug Stats Overlay - Rendered as part of HUD now */}
    {showStats && (
        <div className="absolute top-20 right-4 w-64 bg-slate-900/95 border border-slate-700 p-4 rounded-lg shadow-2xl font-mono text-xs text-slate-200 backdrop-blur-md z-50 pointer-events-none">
            <div className="flex justify-between items-center mb-3 border-b border-slate-700 pb-2">
                <span className="font-bold text-slate-400">PERFORMANCE</span>
                <span className="text-[10px] text-slate-600">ALT+I to close</span>
            </div>
            <div className="space-y-2">
                <div className="flex justify-between"><span className="text-slate-500">FPS</span><span className={stats.fps < 30 ? "text-red-400" : "text-emerald-400"}>{stats.fps}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Frame Time</span><span>{stats.frameTime}ms</span></div>
                <div className="h-px bg-slate-800 my-2" />
                <div className="flex justify-between"><span className="text-slate-500">Draw Calls</span><span>{stats.calls}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Triangles</span><span>{stats.triangles > 1000 ? (stats.triangles / 1000).toFixed(1) + 'k' : stats.triangles}</span></div>
                <div className="h-px bg-slate-800 my-2" />
                <div className="flex justify-between"><span className="text-slate-500">Total Nodes</span><span>{stats.activeObjects}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Geometries</span><span>{stats.geometries}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Textures</span><span>{stats.textures}</span></div>
            </div>
        </div>
    )}

    <div className="absolute top-0 left-0 w-full p-4 pointer-events-none z-10 grid grid-cols-[1fr_auto_1fr] items-start gap-4">
      {/* Left: Branding & Stats */}
      <div className="pointer-events-auto flex flex-col gap-3 items-start">
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2 drop-shadow-md">
          <Layers className="text-blue-500" />
          Anakosmos
          {showFull && (
          <button 
            className="p-1 rounded-full hover:bg-slate-800 text-slate-400 hover:text-blue-400 transition-colors ml-1" 
            title="Toggle Performance Stats (Alt+I)"
            onClick={() => setShowStats(!showStats)}
          >
             <Activity size={16} /> 
          </button>
          )}
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

      {/* Center: Search & Filter - only shown when showFull is true */}
      {showFull ? (
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
      ) : (
        <div /> 
      )}

      {/* Right: Tutorial Button */}
      <div className="pointer-events-auto flex justify-end">
        {showFull && (
          <TutorialButton />
        )}
      </div>
    </div>
    </>
  );
};

// Separate component for tutorial button
const TutorialButton: React.FC = () => {
  const { isActive, resetOnboarding, startOnboarding } = useOnboardingStore();
  
  const handleStartTutorial = () => {
    // Clear localStorage to ensure clean state
    localStorage.removeItem('anakosmos-onboarding');
    resetOnboarding();
    // Small delay to ensure state is updated before starting
    setTimeout(() => startOnboarding(), 50);
  };

  if (isActive) return null; // Don't show when tutorial is already active

  return (
    <button
      onClick={handleStartTutorial}
      className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/80 hover:bg-slate-700 border border-slate-600/50 rounded-full text-sm text-slate-300 hover:text-white transition-all shadow-lg backdrop-blur"
      title="Start Tutorial (Alt+O)"
    >
      <HelpCircle size={16} className="text-blue-400" />
      <span className="hidden sm:inline">Tutorial</span>
    </button>
  );
};
