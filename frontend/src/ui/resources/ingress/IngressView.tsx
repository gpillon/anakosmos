import React from 'react';
import type { ClusterResource } from '../../../api/types';
import type { V1Ingress } from '../../../api/k8s-types';
import { IngressOverview } from './tabs/IngressOverview';
import { IngressRules } from './tabs/IngressRules';
import { IngressTLS } from './tabs/IngressTLS';
import { useResourceView, ResourceViewLayout } from '../shared';

interface IngressViewProps {
  resource: ClusterResource;
  activeTab: string;
}

export const ingressTabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'rules', label: 'Routing Rules' },
  { id: 'tls', label: 'TLS' },
  { id: 'yaml', label: 'YAML' },
];

export const IngressView: React.FC<IngressViewProps> = ({ resource, activeTab }) => {
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
  } = useResourceView<V1Ingress>({ resource, activeTab });

  return (
    <ResourceViewLayout
      namespace={resource.namespace}
      resourceId={resource.id}
      resourceName={resource.name}
      resourceKind={resource.kind}
      isLoading={isLoading}
      loadingMessage="Loading ingress details..."
      activeTab={activeTab}
      yamlContent={yamlContent}
      isYamlLoading={isYamlLoading}
      onYamlChange={setYamlContent}
      onYamlSave={handleSaveYaml}
      onDelete={handleDelete}
      onScrollToEvents={scrollToEvents}
      eventsRef={eventsRef}
    >
      {activeTab === 'overview' && <IngressOverview key={resourceKey} resource={fullResource} ingress={rawData!} onApply={applyChanges} />}
      {activeTab === 'rules' && <IngressRules key={resourceKey} ingress={rawData!} onApply={applyChanges} />}
      {activeTab === 'tls' && <IngressTLS key={resourceKey} ingress={rawData!} onApply={applyChanges} />}
    </ResourceViewLayout>
  );
};
