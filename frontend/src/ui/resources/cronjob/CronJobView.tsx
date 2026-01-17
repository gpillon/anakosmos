import React from 'react';
import type { ClusterResource } from '../../../api/types';
import type { V1CronJob } from '../../../api/k8s-types';
import { CronJobOverview } from './tabs/CronJobOverview';
import { CronJobJobTemplate } from './tabs/CronJobJobTemplate';
import { useResourceModel, ResourceViewLayout } from '../shared';

interface CronJobViewProps {
  resource: ClusterResource;
  activeTab: string;
}

export const cronJobTabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'template', label: 'Job Template' },
  { id: 'yaml', label: 'YAML' },
];

export const CronJobView: React.FC<CronJobViewProps> = ({ resource, activeTab }) => {
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
  } = useResourceModel<V1CronJob>({ resource, activeTab });

  return (
    <ResourceViewLayout
      namespace={resource.namespace}
      resourceId={resource.id}
      resourceName={resource.name}
      resourceKind={resource.kind}
      isLoading={isLoading}
      loadingMessage="Loading CronJob details..."
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
        <CronJobOverview 
          resource={fullResource} 
          model={model}
          updateModel={updateModel}
        />
      )}
      {activeTab === 'template' && model && (
        <CronJobJobTemplate 
          model={model}
        />
      )}
    </ResourceViewLayout>
  );
};
