import React from 'react';
import type { ClusterResource } from '../../../api/types';
import type { V2HorizontalPodAutoscaler } from '../../../api/k8s-types';
import { HPAOverview } from './tabs/HPAOverview';
import { HPAMetrics } from './tabs/HPAMetrics';
import { HPABehavior } from './tabs/HPABehavior';
import { useResourceModel, ResourceViewLayout } from '../shared';

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
    model,
    updateModel,
    fullResource,
    isLoading,
    hasChanges,
    saveModel,
    discardChanges,
    isSaving,
    yamlContent,
    isYamlLoading,
    eventsRef,
    handleDelete,
    handleSaveYaml,
    setYamlContent,
    scrollToEvents,
    hasServerUpdate,
    serverResourceVersion,
    reloadFromServer,
    dismissServerUpdate,
    saveError,
    clearSaveError,
  } = useResourceModel<V2HorizontalPodAutoscaler>({ resource, activeTab });

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
      hasChanges={hasChanges}
      isSaving={isSaving}
      onSave={saveModel}
      onDiscard={discardChanges}
      hasServerUpdate={hasServerUpdate}
      serverResourceVersion={serverResourceVersion}
      onReloadFromServer={reloadFromServer}
      onDismissServerUpdate={dismissServerUpdate}
      saveError={saveError}
      onClearError={clearSaveError}
    >
      {activeTab === 'overview' && model && (
        <HPAOverview 
          resource={fullResource} 
          model={model}
          updateModel={updateModel}
        />
      )}
      {activeTab === 'metrics' && model && (
        <HPAMetrics 
          model={model}
          updateModel={updateModel}
        />
      )}
      {activeTab === 'behavior' && model && (
        <HPABehavior 
          model={model}
          updateModel={updateModel}
        />
      )}
    </ResourceViewLayout>
  );
};
