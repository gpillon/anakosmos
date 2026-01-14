import React from 'react';
import type { ClusterResource } from '../../../api/types';
import { HelmReleaseOverview } from './tabs/HelmReleaseOverview';
import { HelmReleaseValues } from './tabs/HelmReleaseValues';
import { HelmReleaseResources } from './tabs/HelmReleaseResources';
import { HelmReleaseHistory } from './tabs/HelmReleaseHistory';
import { useResourceView, ResourceViewLayout } from '../shared';

interface HelmReleaseViewProps {
  resource: ClusterResource;
  activeTab: string;
}

export const helmReleaseTabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'values', label: 'Values' },
  { id: 'resources', label: 'Resources' },
  { id: 'history', label: 'History' },
  { id: 'yaml', label: 'YAML' },
];

export const HelmReleaseView: React.FC<HelmReleaseViewProps> = ({ resource, activeTab }) => {
  const {
    fullResource,
    resourceKey,
    isLoading,
    yamlContent,
    isYamlLoading,
    eventsRef,
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
      loadingMessage="Loading Helm Release details..."
      activeTab={activeTab}
      yamlContent={yamlContent}
      isYamlLoading={isYamlLoading}
      onYamlChange={setYamlContent}
      onYamlSave={handleSaveYaml}
      // Helm releases are synthetic, don't show delete button
      // onDelete={handleDelete}
      onScrollToEvents={scrollToEvents}
      eventsRef={eventsRef}
    >
      {activeTab === 'overview' && <HelmReleaseOverview key={resourceKey} resource={fullResource} onApply={applyChanges} />}
      {activeTab === 'values' && <HelmReleaseValues key={resourceKey} resource={fullResource} />}
      {activeTab === 'resources' && <HelmReleaseResources key={resourceKey} resource={fullResource} />}
      {activeTab === 'history' && <HelmReleaseHistory key={resourceKey} resource={fullResource} />}
    </ResourceViewLayout>
  );
};
