import React from 'react';
import type { ClusterResource } from '../../../api/types';
import type { V1Service } from '../../../api/k8s-types';
import { ServiceOverview } from './tabs/ServiceOverview';
import { ServicePorts } from './tabs/ServicePorts';
import { useResourceView, ResourceViewLayout } from '../shared';

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
  } = useResourceView<V1Service>({ resource, activeTab });

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
    >
      {activeTab === 'overview' && <ServiceOverview key={resourceKey} resource={fullResource} service={rawData!} onApply={applyChanges} />}
      {activeTab === 'ports' && <ServicePorts key={resourceKey} service={rawData!} onApply={applyChanges} />}
    </ResourceViewLayout>
  );
};
