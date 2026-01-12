import React from 'react';
import type { ClusterResource } from '../../../api/types';
import type { V1Secret } from '../../../api/k8s-types';
import { SecretOverview } from './tabs/SecretOverview';
import { SecretData } from './tabs/SecretData';
import { useResourceView, ResourceViewLayout } from '../shared';

interface SecretViewProps {
  resource: ClusterResource;
  activeTab: string;
}

export const secretTabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'data', label: 'Data' },
  { id: 'yaml', label: 'YAML' },
];

export const SecretView: React.FC<SecretViewProps> = ({ resource, activeTab }) => {
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
  } = useResourceView<V1Secret>({ resource, activeTab });

  return (
    <ResourceViewLayout
      namespace={resource.namespace}
      resourceId={resource.id}
      resourceName={resource.name}
      resourceKind={resource.kind}
      isLoading={isLoading}
      loadingMessage="Loading Secret details..."
      activeTab={activeTab}
      yamlContent={yamlContent}
      isYamlLoading={isYamlLoading}
      onYamlChange={setYamlContent}
      onYamlSave={handleSaveYaml}
      onDelete={handleDelete}
      onScrollToEvents={scrollToEvents}
      eventsRef={eventsRef}
    >
      {activeTab === 'overview' && <SecretOverview key={resourceKey} resource={fullResource} secret={rawData!} onApply={applyChanges} />}
      {activeTab === 'data' && <SecretData key={resourceKey} secret={rawData!} onApply={applyChanges} />}
    </ResourceViewLayout>
  );
};
