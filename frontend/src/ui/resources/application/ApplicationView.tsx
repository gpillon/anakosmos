import React from 'react';
import type { ClusterResource } from '../../../api/types';
import { ApplicationOverview } from './tabs/ApplicationOverview';
import { ApplicationSource } from './tabs/ApplicationSource';
import { ApplicationResources } from './tabs/ApplicationResources';
import { ApplicationSyncHistory } from './tabs/ApplicationSyncHistory';
import { useResourceView, ResourceViewLayout } from '../shared';

interface ApplicationViewProps {
  resource: ClusterResource;
  activeTab: string;
}

export const applicationTabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'source', label: 'Source' },
  { id: 'resources', label: 'Resources' },
  { id: 'history', label: 'Sync History' },
  { id: 'yaml', label: 'YAML' },
];

export const ApplicationView: React.FC<ApplicationViewProps> = ({ resource, activeTab }) => {
  const {
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
  } = useResourceView({ resource, activeTab });

  return (
    <ResourceViewLayout
      namespace={resource.namespace}
      resourceId={resource.id}
      resourceName={resource.name}
      resourceKind={resource.kind}
      isLoading={isLoading}
      loadingMessage="Loading ArgoCD Application details..."
      activeTab={activeTab}
      yamlContent={yamlContent}
      isYamlLoading={isYamlLoading}
      onYamlChange={setYamlContent}
      onYamlSave={handleSaveYaml}
      onDelete={handleDelete}
      onScrollToEvents={scrollToEvents}
      eventsRef={eventsRef}
    >
      {activeTab === 'overview' && <ApplicationOverview key={resourceKey} resource={fullResource} onApply={applyChanges} />}
      {activeTab === 'source' && <ApplicationSource key={resourceKey} resource={fullResource} />}
      {activeTab === 'resources' && <ApplicationResources key={resourceKey} resource={fullResource} />}
      {activeTab === 'history' && <ApplicationSyncHistory key={resourceKey} resource={fullResource} />}
    </ResourceViewLayout>
  );
};
