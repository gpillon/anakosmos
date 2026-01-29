import React from 'react';
import type { ClusterResource } from '../../../api/types';
import type { V1StorageClass } from '../../../api/k8s-types';
import { StorageClassOverview } from './tabs/StorageClassOverview';
import { StorageClassParameters } from './tabs/StorageClassParameters';
import { useResourceModel, ResourceViewLayout } from '../shared';

interface StorageClassViewProps {
  resource: ClusterResource;
  activeTab: string;
}

export const storageClassTabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'parameters', label: 'Parameters' },
  { id: 'yaml', label: 'YAML' },
];

export const StorageClassView: React.FC<StorageClassViewProps> = ({ resource, activeTab }) => {
  const {
    model,
    updateModel,
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
  } = useResourceModel<V1StorageClass>({ resource, activeTab });

  return (
    <ResourceViewLayout
      namespace="" // StorageClass is cluster-scoped
      resourceId={resource.id}
      resourceName={resource.name}
      resourceKind={resource.kind}
      isLoading={isLoading}
      loadingMessage="Loading StorageClass details..."
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
        <StorageClassOverview 
          model={model}
          updateModel={updateModel}
        />
      )}
      {activeTab === 'parameters' && model && (
        <StorageClassParameters 
          model={model}
          updateModel={updateModel}
        />
      )}
    </ResourceViewLayout>
  );
};
