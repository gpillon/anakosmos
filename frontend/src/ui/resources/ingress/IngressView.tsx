import React from 'react';
import type { ClusterResource } from '../../../api/types';
import type { V1Ingress } from '../../../api/k8s-types';
import { IngressOverview } from './tabs/IngressOverview';
import { IngressRules } from './tabs/IngressRules';
import { IngressTLS } from './tabs/IngressTLS';
import { useResourceModel, ResourceViewLayout } from '../shared';

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
  } = useResourceModel<V1Ingress>({ resource, activeTab });

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
        <IngressOverview 
          resource={fullResource} 
          model={model}
          updateModel={updateModel}
        />
      )}
      {activeTab === 'rules' && model && (
        <IngressRules 
          model={model}
          updateModel={updateModel}
        />
      )}
      {activeTab === 'tls' && model && (
        <IngressTLS 
          model={model}
          updateModel={updateModel}
        />
      )}
    </ResourceViewLayout>
  );
};
