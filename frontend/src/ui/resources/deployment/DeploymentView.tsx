import React from 'react';
import type { ClusterResource } from '../../../api/types';
import { DeploymentOverview } from './tabs/DeploymentOverview';
import { DeploymentContainers } from './tabs/DeploymentContainers';
import { DeploymentVolumes } from './tabs/DeploymentVolumes';
import { DeploymentScheduling } from './tabs/DeploymentScheduling';
import { DeploymentSecurity } from './tabs/DeploymentSecurity';
import { DeploymentNetwork } from './tabs/DeploymentNetwork';
import { useResourceView, ResourceViewLayout } from '../shared';

interface DeploymentViewProps {
  resource: ClusterResource;
  activeTab: string;
}

export const deploymentTabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'containers', label: 'Containers' },
  { id: 'volumes', label: 'Volumes' },
  { id: 'scheduling', label: 'Scheduling' },
  { id: 'security', label: 'Security' },
  { id: 'network', label: 'Network' },
  { id: 'yaml', label: 'YAML' },
];

export const DeploymentView: React.FC<DeploymentViewProps> = ({ resource, activeTab }) => {
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
      loadingMessage="Loading deployment details..."
      activeTab={activeTab}
      yamlContent={yamlContent}
      isYamlLoading={isYamlLoading}
      onYamlChange={setYamlContent}
      onYamlSave={handleSaveYaml}
      onDelete={handleDelete}
      onScrollToEvents={scrollToEvents}
      eventsRef={eventsRef}
    >
      {activeTab === 'overview' && <DeploymentOverview key={resourceKey} resource={fullResource} onApply={applyChanges} />}
      {activeTab === 'containers' && <DeploymentContainers key={resourceKey} resource={fullResource} onApply={applyChanges} />}
      {activeTab === 'volumes' && <DeploymentVolumes key={resourceKey} resource={fullResource} onApply={applyChanges} />}
      {activeTab === 'scheduling' && <DeploymentScheduling key={resourceKey} resource={fullResource} onApply={applyChanges} />}
      {activeTab === 'security' && <DeploymentSecurity key={resourceKey} resource={fullResource} onApply={applyChanges} />}
      {activeTab === 'network' && <DeploymentNetwork key={resourceKey} resource={fullResource} onApply={applyChanges} />}
    </ResourceViewLayout>
  );
};
