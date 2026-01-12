import React from 'react';
import type { ClusterResource } from '../../../api/types';
import type { V1ConfigMap } from '../../../api/k8s-types';
import { ConfigMapOverview } from './tabs/ConfigMapOverview';
import { ConfigMapData } from './tabs/ConfigMapData';
import { useResourceView, ResourceViewLayout } from '../shared';

interface ConfigMapViewProps {
  resource: ClusterResource;
  activeTab: string;
}

export const configMapTabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'data', label: 'Data' },
  { id: 'yaml', label: 'YAML' },
];

export const ConfigMapView: React.FC<ConfigMapViewProps> = ({ resource, activeTab }) => {
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
  } = useResourceView<V1ConfigMap>({ resource, activeTab });

  return (
    <ResourceViewLayout
      namespace={resource.namespace}
      resourceId={resource.id}
      resourceName={resource.name}
      resourceKind={resource.kind}
      isLoading={isLoading}
      loadingMessage="Loading ConfigMap details..."
      activeTab={activeTab}
      yamlContent={yamlContent}
      isYamlLoading={isYamlLoading}
      onYamlChange={setYamlContent}
      onYamlSave={handleSaveYaml}
      onDelete={handleDelete}
      onScrollToEvents={scrollToEvents}
      eventsRef={eventsRef}
    >
      {activeTab === 'overview' && <ConfigMapOverview key={resourceKey} resource={fullResource} configMap={rawData!} onApply={applyChanges} />}
      {activeTab === 'data' && <ConfigMapData key={resourceKey} configMap={rawData!} onApply={applyChanges} />}
    </ResourceViewLayout>
  );
};
