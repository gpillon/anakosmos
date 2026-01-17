import React from 'react';
import type { ClusterResource } from '../../../api/types';
import type { V1Deployment } from '../../../api/k8s-types';
import { DeploymentOverview } from './tabs/DeploymentOverview';
import { DeploymentContainers } from './tabs/DeploymentContainers';
import { DeploymentVolumes } from './tabs/DeploymentVolumes';
import { DeploymentScheduling } from './tabs/DeploymentScheduling';
import { DeploymentSecurity } from './tabs/DeploymentSecurity';
import { DeploymentNetwork } from './tabs/DeploymentNetwork';
import { useResourceModel, ResourceViewLayout } from '../shared';

interface DeploymentViewProps {
  resource: ClusterResource;
  activeTab: string;
}

export const deploymentTabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'containers', label: 'Containers' },
  { id: 'volumes', label: 'Volumes' },
  { id: 'scheduling', label: 'Scheduling' },
  { id: 'security', label: 'Security' },
  { id: 'network', label: 'Network' },
  { id: 'yaml', label: 'YAML' },
];

export const DeploymentView: React.FC<DeploymentViewProps> = ({ resource, activeTab }) => {
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
  } = useResourceModel<V1Deployment>({ resource, activeTab });

  return (
    <ResourceViewLayout
      namespace={resource.namespace}
      resourceId={resource.id}
      resourceName={resource.name}
      resourceKind={resource.kind}
      isLoading={isLoading}
      loadingMessage="Loading deployment details..."
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
        <DeploymentOverview 
          resource={fullResource} 
          model={model}
          updateModel={updateModel}
        />
      )}
      {activeTab === 'containers' && model && (
        <DeploymentContainers 
          resource={fullResource} 
          model={model}
          updateModel={updateModel}
        />
      )}
      {activeTab === 'volumes' && model && (
        <DeploymentVolumes 
          resource={fullResource} 
          model={model}
          updateModel={updateModel}
        />
      )}
      {activeTab === 'scheduling' && model && (
        <DeploymentScheduling 
          resource={fullResource} 
          model={model}
          updateModel={updateModel}
        />
      )}
      {activeTab === 'security' && model && (
        <DeploymentSecurity 
          resource={fullResource} 
          model={model}
          updateModel={updateModel}
        />
      )}
      {activeTab === 'network' && model && (
        <DeploymentNetwork 
          resource={fullResource} 
          model={model}
          updateModel={updateModel}
        />
      )}
    </ResourceViewLayout>
  );
};
