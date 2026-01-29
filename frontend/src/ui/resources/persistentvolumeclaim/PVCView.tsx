import React from 'react';
import type { ClusterResource } from '../../../api/types';
import type { V1PersistentVolumeClaim } from '../../../api/k8s-types';
import { PVCOverview } from './tabs/PVCOverview';
import { useResourceModel, ResourceViewLayout } from '../shared';

interface PVCViewProps {
  resource: ClusterResource;
  activeTab: string;
}

export const pvcTabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'yaml', label: 'YAML' },
];

export const PVCView: React.FC<PVCViewProps> = ({ resource, activeTab }) => {
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
  } = useResourceModel<V1PersistentVolumeClaim>({ resource, activeTab });

  return (
    <ResourceViewLayout
      namespace={resource.namespace}
      resourceId={resource.id}
      resourceName={resource.name}
      resourceKind={resource.kind}
      isLoading={isLoading}
      loadingMessage="Loading PVC details..."
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
        <PVCOverview 
          model={model}
          updateModel={updateModel}
        />
      )}
    </ResourceViewLayout>
  );
};
