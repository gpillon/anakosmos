import React from 'react';
import type { ClusterResource } from '../../../api/types';
import type { V2HorizontalPodAutoscaler } from '../../../api/k8s-types';
import { HPAOverview } from './tabs/HPAOverview';
import { HPAMetrics } from './tabs/HPAMetrics';
import { HPABehavior } from './tabs/HPABehavior';
import { useResourceView, ResourceViewLayout } from '../shared';

interface HPAViewProps {
  resource: ClusterResource;
  activeTab: string;
}

export const hpaTabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'metrics', label: 'Metrics' },
  { id: 'behavior', label: 'Behavior' },
  { id: 'yaml', label: 'YAML' },
];

export const HPAView: React.FC<HPAViewProps> = ({ resource, activeTab }) => {
  const {
    rawData,
    fullResource,
    resourceKey,
    isLoading,
    yamlContent,
    isYamlLoading,
    eventsRef,
    handleDelete,
    applyChanges,
    handleSaveYaml,
    setYamlContent,
    scrollToEvents,
  } = useResourceView<V2HorizontalPodAutoscaler>({ resource, activeTab });

  return (
    <ResourceViewLayout
      namespace={resource.namespace}
      resourceId={resource.id}
      resourceName={resource.name}
      resourceKind={resource.kind}
      isLoading={isLoading}
      loadingMessage="Loading HPA details..."
      activeTab={activeTab}
      yamlContent={yamlContent}
      isYamlLoading={isYamlLoading}
      onYamlChange={setYamlContent}
      onYamlSave={handleSaveYaml}
      onDelete={handleDelete}
      onScrollToEvents={scrollToEvents}
      eventsRef={eventsRef}
    >
      {activeTab === 'overview' && <HPAOverview key={resourceKey} resource={fullResource} hpa={rawData!} onApply={applyChanges} />}
      {activeTab === 'metrics' && <HPAMetrics key={resourceKey} hpa={rawData!} onApply={applyChanges} />}
      {activeTab === 'behavior' && <HPABehavior key={resourceKey} hpa={rawData!} onApply={applyChanges} />}
    </ResourceViewLayout>
  );
};
