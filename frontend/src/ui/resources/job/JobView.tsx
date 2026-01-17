import React from 'react';
import type { ClusterResource } from '../../../api/types';
import type { V1Job } from '../../../api/k8s-types';
import { JobOverview } from './tabs/JobOverview';
import { JobPodTemplate } from './tabs/JobPodTemplate';
import { useResourceModel, ResourceViewLayout } from '../shared';

interface JobViewProps {
  resource: ClusterResource;
  activeTab: string;
}

export const jobTabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'template', label: 'Pod Template' },
  { id: 'yaml', label: 'YAML' },
];

export const JobView: React.FC<JobViewProps> = ({ resource, activeTab }) => {
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
  } = useResourceModel<V1Job>({ resource, activeTab });

  return (
    <ResourceViewLayout
      namespace={resource.namespace}
      resourceId={resource.id}
      resourceName={resource.name}
      resourceKind={resource.kind}
      isLoading={isLoading}
      loadingMessage="Loading Job details..."
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
        <JobOverview 
          resource={fullResource} 
          model={model}
          updateModel={updateModel}
        />
      )}
      {activeTab === 'template' && model && (
        <JobPodTemplate 
          model={model}
        />
      )}
    </ResourceViewLayout>
  );
};
