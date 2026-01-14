import React from 'react';
import type { ClusterResource } from '../../../api/types';
import { DeploymentOverview } from './DeploymentOverview';
import { PodOverview } from './PodOverview';
import { ServiceOverview } from './ServiceOverview';
import { IngressOverview } from './IngressOverview';
import { RouteOverview } from './RouteOverview';
import { StatefulSetOverview } from './StatefulSetOverview';
import { DaemonSetOverview } from './DaemonSetOverview';
import { ReplicaSetOverview } from './ReplicaSetOverview';
import { JobOverview } from './JobOverview';
import { CronJobOverview } from './CronJobOverview';
import { HpaOverview } from './HpaOverview';
import { ConfigMapOverview } from './ConfigMapOverview';
import { SecretOverview } from './SecretOverview';
import { PvcOverview } from './PvcOverview';
import { PvOverview } from './PvOverview';
import { StorageClassOverview } from './StorageClassOverview';
import { NodeOverview } from './NodeOverview';
import { ApplicationOverview } from './ApplicationOverview';
import { HelmReleaseOverview } from './HelmReleaseOverview';
import { NetworkAttachmentDefinitionOverview } from './NetworkAttachmentDefinitionOverview';
import { NodeNetworkConfigurationPolicyOverview } from './NodeNetworkConfigurationPolicyOverview';
import { GenericOverview } from './GenericOverview';

export interface OverviewContext {
  resource: ClusterResource;
  raw?: any;
  onOpenDetails?: () => void;
  onOpenTerminal?: (mode: 'shell' | 'logs') => void;
  onScale?: (replicas: number) => void;
  scaleInProgress?: boolean;
}

export const ResourceOverview: React.FC<OverviewContext> = (props) => {
  switch (props.resource.kind) {
    case 'Deployment':
      return <DeploymentOverview {...props} />;
    case 'Pod':
      return <PodOverview {...props} />;
    case 'Service':
      return <ServiceOverview {...props} />;
    case 'Ingress':
      return <IngressOverview {...props} />;
    case 'Route':
      return <RouteOverview {...props} />;
    case 'StatefulSet':
      return <StatefulSetOverview {...props} />;
    case 'DaemonSet':
      return <DaemonSetOverview {...props} />;
    case 'ReplicaSet':
      return <ReplicaSetOverview {...props} />;
    case 'Job':
      return <JobOverview {...props} />;
    case 'CronJob':
      return <CronJobOverview {...props} />;
    case 'HorizontalPodAutoscaler':
      return <HpaOverview {...props} />;
    case 'ConfigMap':
      return <ConfigMapOverview {...props} />;
    case 'Secret':
      return <SecretOverview {...props} />;
    case 'PersistentVolumeClaim':
      return <PvcOverview {...props} />;
    case 'PersistentVolume':
      return <PvOverview {...props} />;
    case 'StorageClass':
      return <StorageClassOverview {...props} />;
    case 'Node':
      return <NodeOverview {...props} />;
    case 'Application':
      return <ApplicationOverview {...props} />;
    case 'HelmRelease':
      return <HelmReleaseOverview {...props} />;
    case 'NetworkAttachmentDefinition':
      return <NetworkAttachmentDefinitionOverview {...props} />;
    case 'NodeNetworkConfigurationPolicy':
      return <NodeNetworkConfigurationPolicyOverview {...props} />;
    default:
      return <GenericOverview {...props} />;
  }
};
