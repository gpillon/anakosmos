import React from 'react';
import type { ClusterResource } from '../../../api/types';
import type { V1Pod } from '../../../api/k8s-types';
import { useTerminalStore } from '../../../store/useTerminalStore';
import { PodOverview } from './tabs/PodOverview';
import { PodContainers } from './tabs/PodContainers';
import { PodVolumes } from './tabs/PodVolumes';
import { PodMetrics } from './tabs/PodMetrics';
import { useResourceView, ResourceViewLayout } from '../shared';
import { Terminal, FileText } from 'lucide-react';

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
  const defaultContainer = pod?.spec?.containers?.[0]?.name;

  // Handler for opening terminal/logs
  const handleOpenTerminal = (type: 'shell' | 'logs') => {
    openTerminal(
      resource.id,
      resource.name,
      resource.namespace || 'default',
      type,
      defaultContainer
    );
  };

  // Quick action buttons for pods
  const quickActions = (
    <>
      <button
        onClick={() => handleOpenTerminal('shell')}
        disabled={!pod}
        className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-emerald-400 bg-emerald-900/30 hover:bg-emerald-900/50 rounded border border-emerald-800/50 transition-colors disabled:opacity-50"
      >
        <Terminal size={14} />
        Shell
      </button>
      <button
        onClick={() => handleOpenTerminal('logs')}
        disabled={!pod}
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
