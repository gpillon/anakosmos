import React from 'react';
import type { ClusterResource } from '../../../api/types';
import { GenericOverview } from './tabs/GenericOverview';
import { GenericSpec } from './tabs/GenericSpec';
import { useResourceView, ResourceViewLayout } from '../shared';

interface GenericViewProps {
  resource: ClusterResource;
  activeTab: string;
}

export const genericTabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'spec', label: 'Spec & Status' },
  { id: 'yaml', label: 'YAML' },
];

export const GenericView: React.FC<GenericViewProps> = ({ resource, activeTab }) => {
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
  } = useResourceView({ resource, activeTab });

  return (
    <ResourceViewLayout
      namespace={resource.namespace}
      resourceId={resource.id}
      resourceName={resource.name}
      resourceKind={resource.kind}
      isLoading={isLoading}
      loadingMessage={`Loading ${resource.kind} details...`}
      activeTab={activeTab}
      yamlContent={yamlContent}
      isYamlLoading={isYamlLoading}
      onYamlChange={setYamlContent}
      onYamlSave={handleSaveYaml}
      onDelete={handleDelete}
      onScrollToEvents={scrollToEvents}
      eventsRef={eventsRef}
    >
      {activeTab === 'overview' && <GenericOverview key={resourceKey} resource={fullResource} rawData={rawData} onApply={applyChanges} />}
      {activeTab === 'spec' && <GenericSpec key={resourceKey} rawData={rawData} />}
    </ResourceViewLayout>
  );
};
