import React from 'react';
import type { ClusterResource } from '../../../api/types';
import type { V1Service } from '../../../api/k8s-types';
import { ServiceOverview } from './tabs/ServiceOverview';
import { ServicePorts } from './tabs/ServicePorts';
import { useResourceModel, ResourceViewLayout } from '../shared';

interface ServiceViewProps {
  resource: ClusterResource;
  activeTab: string;
}

export const serviceTabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'ports', label: 'Ports' },
  { id: 'yaml', label: 'YAML' },
];

export const ServiceView: React.FC<ServiceViewProps> = ({ resource, activeTab }) => {
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
  } = useResourceModel<V1Service>({ resource, activeTab });

  return (
    <ResourceViewLayout
      namespace={resource.namespace}
      resourceId={resource.id}
      resourceName={resource.name}
      resourceKind={resource.kind}
      isLoading={isLoading}
      loadingMessage="Loading service details..."
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
        <ServiceOverview 
          resource={fullResource} 
          model={model}
          updateModel={updateModel}
        />
      )}
      {activeTab === 'ports' && model && (
        <ServicePorts 
          model={model}
          updateModel={updateModel}
        />
      )}
    </ResourceViewLayout>
  );
};
