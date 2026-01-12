import React from 'react';
import type { ClusterResource } from '../../../api/types';
import type { V1Job } from '../../../api/k8s-types';
import { JobOverview } from './tabs/JobOverview';
import { JobPodTemplate } from './tabs/JobPodTemplate';
import { useResourceView, ResourceViewLayout } from '../shared';

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
  } = useResourceView<V1Job>({ resource, activeTab });

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
    >
      {activeTab === 'overview' && <JobOverview key={resourceKey} resource={fullResource} job={rawData!} onApply={applyChanges} />}
      {activeTab === 'template' && <JobPodTemplate key={resourceKey} job={rawData!} />}
    </ResourceViewLayout>
  );
};
