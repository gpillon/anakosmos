import React from 'react';
import type { ClusterResource } from '../../../api/types';
import type { V1ConfigMap } from '../../../api/k8s-types';
import { ConfigMapOverview } from './tabs/ConfigMapOverview';
import { ConfigMapData } from './tabs/ConfigMapData';
import { useResourceModel, ResourceViewLayout } from '../shared';

interface ConfigMapViewProps {
  resource: ClusterResource;
  activeTab: string;
}

export const configMapTabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'data', label: 'Data' },
  { id: 'yaml', label: 'YAML' },
];

export const ConfigMapView: React.FC<ConfigMapViewProps> = ({ resource, activeTab }) => {
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
  } = useResourceModel<V1ConfigMap>({ resource, activeTab });

  return (
    <ResourceViewLayout
      namespace={resource.namespace}
      resourceId={resource.id}
      resourceName={resource.name}
      resourceKind={resource.kind}
      isLoading={isLoading}
      loadingMessage="Loading ConfigMap details..."
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
        <ConfigMapOverview 
          resource={fullResource} 
          model={model}
          updateModel={updateModel}
        />
      )}
      {activeTab === 'data' && model && (
        <ConfigMapData 
          model={model}
          updateModel={updateModel}
        />
      )}
    </ResourceViewLayout>
  );
};
