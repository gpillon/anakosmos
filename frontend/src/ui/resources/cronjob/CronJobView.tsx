import React from 'react';
import type { ClusterResource } from '../../../api/types';
import type { V1CronJob } from '../../../api/k8s-types';
import { CronJobOverview } from './tabs/CronJobOverview';
import { CronJobJobTemplate } from './tabs/CronJobJobTemplate';
import { useResourceView, ResourceViewLayout } from '../shared';

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
  } = useResourceView<V1CronJob>({ resource, activeTab });

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
    >
      {activeTab === 'overview' && <CronJobOverview key={resourceKey} resource={fullResource} cronJob={rawData!} onApply={applyChanges} />}
      {activeTab === 'template' && <CronJobJobTemplate key={resourceKey} cronJob={rawData!} />}
    </ResourceViewLayout>
  );
};
