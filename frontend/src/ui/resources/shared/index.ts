/**
 * Shared components for Kubernetes resource visualization
 * 
 * These components are designed to be reusable across different resource types
 * (Deployment, Pod, StatefulSet, etc.) and use official Kubernetes types.
 */

// Layout components
export { Card, CardHeader, CardBody } from './Card';
export { MetaRow } from './MetaRow';
export { StatCard } from './StatCard';

// Metadata components
export { MetadataCard } from './MetadataCard';
export { LabelsCard } from './LabelsCard';
export { AnnotationsCard } from './AnnotationsCard';
export { ConditionsCard } from './ConditionsCard';

// Status components
export { StatusBanner } from './StatusBanner';
export type { HealthStatus } from './StatusBanner';

// Container components
export { ContainerCard } from './ContainerCard';
export { ContainerList } from './ContainerList';
export { ProbeDisplay } from './ProbeDisplay';
export { ResourcesDisplay } from './ResourcesDisplay';
export { EnvVarsDisplay } from './EnvVarsDisplay';

// Pod Template components
export { PodTemplateView } from './PodTemplateView';

// Form components
export { Combobox, MultiCombobox } from './Combobox';

// Hooks for fetching cluster resource names
export { 
  useClusterResourceNames, 
  useConfigMapNames, 
  useSecretNames, 
  usePVCNames, 
  useServiceAccountNames,
  useServiceNames,
  useNodeNames, 
  usePriorityClassNames 
} from './useClusterResources';

// Data display components
export { KeyValueDataCard } from './KeyValueDataCard';

// Events components
export { EventsCard, EventsIndicator } from './EventsCard';

// Resource top bar with delete and indicators
export { ResourceTopBar } from './ResourceTopBar';

// Resource view infrastructure (hook + layout)
export { useResourceView } from './useResourceView';
export { useResourceModel } from './useResourceModel';
export { ResourceViewLayout } from './ResourceViewLayout';
export { SaveBar } from './SaveBar';

// Error handling
export { ErrorBanner, FieldErrorIndicator, withFieldError } from './ErrorBanner';
export { 
  ValidationErrorProvider, 
  useValidationErrors, 
  useFieldError, 
  parseKubernetesError,
  fieldPath,
  type ValidationError,
  type KubernetesError,
} from './ValidationErrorContext';

// Owner/Owned resources components
export { OwnerReferencesCard } from './OwnerReferencesCard';
export { OwnedResourcesCard } from './OwnedResourcesCard';

// Utility formatters
export { formatDate, formatAge, formatBytes, formatMillicores, getContainerStateInfo, getHealthColorClasses, getPodPhaseColor } from './formatters';
