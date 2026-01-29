import React, { useMemo, useState, useRef, useEffect } from 'react';
import type { ClusterResource } from '../../../api/types';
import type { V1Pod } from '../../../api/k8s-types';
import { useTerminalStore } from '../../../store/useTerminalStore';
import { PodOverview } from './tabs/PodOverview';
import { PodContainers } from './tabs/PodContainers';
import { PodVolumes } from './tabs/PodVolumes';
import { PodMetrics } from './tabs/PodMetrics';
import { useResourceView, ResourceViewLayout } from '../shared';
import { Terminal, FileText, ChevronDown, Box, Check } from 'lucide-react';
import { clsx } from 'clsx';

interface PodViewProps {
  resource: ClusterResource;
  activeTab: string;
}

export const podTabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'containers', label: 'Containers' },
  { id: 'volumes', label: 'Volumes' },
  { id: 'metrics', label: 'Metrics' },
  { id: 'yaml', label: 'YAML' },
];

// Container selector dropdown component
interface ContainerSelectorProps {
  containers: Array<{ name: string; isInit: boolean }>;
  selectedContainer: string;
  onSelect: (name: string) => void;
  disabled?: boolean;
}

const ContainerSelector: React.FC<ContainerSelectorProps> = ({
  containers,
  selectedContainer,
  onSelect,
  disabled
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selected = containers.find(c => c.name === selectedContainer);

  // Don't show selector if there's only one container
  if (containers.length <= 1) {
    return null;
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={clsx(
          "flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-slate-800/60 hover:bg-slate-700/60 rounded border border-slate-700 transition-colors",
          disabled && "opacity-50 cursor-not-allowed",
          isOpen && "border-slate-600"
        )}
      >
        <Box size={12} className={selected?.isInit ? "text-amber-400" : "text-blue-400"} />
        <span className="text-slate-300 max-w-[120px] truncate">{selectedContainer}</span>
        {selected?.isInit && (
          <span className="text-[10px] px-1 py-0.5 rounded bg-amber-900/30 text-amber-400 border border-amber-800/30">
            init
          </span>
        )}
        <ChevronDown size={12} className={clsx("text-slate-500 transition-transform", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <div className="absolute z-[300] top-full left-0 mt-1 min-w-[200px] bg-slate-800 border border-slate-700 rounded-lg shadow-xl overflow-hidden">
          <div className="p-1 max-h-60 overflow-y-auto custom-scrollbar">
            {/* Init containers section */}
            {containers.some(c => c.isInit) && (
              <>
                <div className="px-3 py-1.5 text-[10px] text-slate-500 uppercase font-bold">
                  Init Containers
                </div>
                {containers.filter(c => c.isInit).map(c => (
                  <button
                    key={c.name}
                    onClick={() => {
                      onSelect(c.name);
                      setIsOpen(false);
                    }}
                    className={clsx(
                      "w-full flex items-center gap-2 px-3 py-2 rounded text-left transition-colors",
                      c.name === selectedContainer
                        ? "bg-blue-600/20 text-blue-300"
                        : "hover:bg-slate-700/50 text-slate-200"
                    )}
                  >
                    <Box size={14} className="text-amber-400 shrink-0" />
                    <span className="flex-1 truncate text-xs">{c.name}</span>
                    {c.name === selectedContainer && <Check size={12} className="text-blue-400 shrink-0" />}
                  </button>
                ))}
              </>
            )}
            
            {/* Regular containers section */}
            {containers.some(c => !c.isInit) && (
              <>
                {containers.some(c => c.isInit) && (
                  <div className="px-3 py-1.5 text-[10px] text-slate-500 uppercase font-bold mt-1">
                    Containers
                  </div>
                )}
                {containers.filter(c => !c.isInit).map(c => (
                  <button
                    key={c.name}
                    onClick={() => {
                      onSelect(c.name);
                      setIsOpen(false);
                    }}
                    className={clsx(
                      "w-full flex items-center gap-2 px-3 py-2 rounded text-left transition-colors",
                      c.name === selectedContainer
                        ? "bg-blue-600/20 text-blue-300"
                        : "hover:bg-slate-700/50 text-slate-200"
                    )}
                  >
                    <Box size={14} className="text-blue-400 shrink-0" />
                    <span className="flex-1 truncate text-xs">{c.name}</span>
                    {c.name === selectedContainer && <Check size={12} className="text-blue-400 shrink-0" />}
                  </button>
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export const PodView: React.FC<PodViewProps> = ({ resource, activeTab }) => {
  const openTerminal = useTerminalStore(state => state.openTerminal);
  
  const {
    rawData,
    fullResource,
    resourceKey,
    isLoading,
    yamlContent,
    isYamlLoading,
    eventsRef,
    handleDelete,
    setYamlContent,
    scrollToEvents,
  } = useResourceView<V1Pod>({ resource, activeTab });

  const pod = rawData;

  // Build list of all containers (init + regular)
  const allContainers = useMemo(() => {
    const result: Array<{ name: string; isInit: boolean }> = [];
    
    // Add init containers first
    pod?.spec?.initContainers?.forEach(c => {
      if (c.name) {
        result.push({ name: c.name, isInit: true });
      }
    });
    
    // Add regular containers
    pod?.spec?.containers?.forEach(c => {
      if (c.name) {
        result.push({ name: c.name, isInit: false });
      }
    });
    
    return result;
  }, [pod?.spec?.initContainers, pod?.spec?.containers]);

  // Default to first regular container, or first init container if no regular ones
  const defaultContainer = allContainers.find(c => !c.isInit)?.name || allContainers[0]?.name || '';
  const [selectedContainer, setSelectedContainer] = useState<string>('');

  // Update selected container when pod data loads or changes
  useEffect(() => {
    if (defaultContainer && !selectedContainer) {
      setSelectedContainer(defaultContainer);
    }
  }, [defaultContainer, selectedContainer]);

  // Use selected container or fall back to default
  const activeContainer = selectedContainer || defaultContainer;

  // Handler for opening terminal/logs
  const handleOpenTerminal = (type: 'shell' | 'logs') => {
    openTerminal(
      resource.id,
      resource.name,
      resource.namespace || 'default',
      type,
      activeContainer
    );
  };

  // Quick action buttons for pods
  const quickActions = (
    <>
      {/* Container selector - only shown if multiple containers */}
      <ContainerSelector
        containers={allContainers}
        selectedContainer={activeContainer}
        onSelect={setSelectedContainer}
        disabled={!pod}
      />
      
      <button
        onClick={() => handleOpenTerminal('shell')}
        disabled={!pod || !activeContainer}
        className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-emerald-400 bg-emerald-900/30 hover:bg-emerald-900/50 rounded border border-emerald-800/50 transition-colors disabled:opacity-50"
      >
        <Terminal size={14} />
        Shell
      </button>
      <button
        onClick={() => handleOpenTerminal('logs')}
        disabled={!pod || !activeContainer}
        className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-blue-400 bg-blue-900/30 hover:bg-blue-900/50 rounded border border-blue-800/50 transition-colors disabled:opacity-50"
      >
        <FileText size={14} />
        Logs
      </button>
    </>
  );

  return (
    <ResourceViewLayout
      namespace={resource.namespace}
      resourceId={resource.id}
      resourceName={resource.name}
      resourceKind={resource.kind}
      isLoading={isLoading}
      loadingMessage="Loading pod details..."
      activeTab={activeTab}
      yamlContent={yamlContent}
      isYamlLoading={isYamlLoading}
      isYamlReadOnly={true}
      onYamlChange={setYamlContent}
      onDelete={handleDelete}
      onScrollToEvents={scrollToEvents}
      eventsRef={eventsRef}
      isReadOnly={true}
      leftActions={quickActions}
    >
      {activeTab === 'overview' && <PodOverview key={resourceKey} resource={fullResource} pod={pod!} />}
      {activeTab === 'containers' && <PodContainers key={resourceKey} resource={fullResource} pod={pod!} />}
      {activeTab === 'volumes' && <PodVolumes key={resourceKey} pod={pod!} />}
      {activeTab === 'metrics' && <PodMetrics key={resourceKey} pod={pod!} />}
    </ResourceViewLayout>
  );
};
