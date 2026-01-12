import React from 'react';
import { Box } from 'lucide-react';
import type { V1Container, V1ContainerStatus } from '../../../api/k8s-types';
import { Card, CardHeader, CardBody } from './Card';
import { ContainerCard } from './ContainerCard';

interface ContainerListProps {
  containers: V1Container[] | undefined;
  initContainers?: V1Container[] | undefined;
  containerStatuses?: V1ContainerStatus[] | undefined;
  initContainerStatuses?: V1ContainerStatus[] | undefined;
  editable?: boolean;
  onUpdateContainer?: (index: number, updates: Partial<V1Container>, isInit: boolean) => void;
}

export const ContainerList: React.FC<ContainerListProps> = ({ 
  containers,
  initContainers,
  containerStatuses,
  initContainerStatuses,
  editable = false,
  onUpdateContainer
}) => {
  const getContainerStatus = (name: string, statuses: V1ContainerStatus[] | undefined): V1ContainerStatus | undefined => {
    return statuses?.find(s => s.name === name);
  };

  const totalContainers = (containers?.length || 0) + (initContainers?.length || 0);

  return (
    <Card>
      <CardHeader 
        icon={<Box size={16} />} 
        title="Containers"
        badge={
          <span className="text-xs text-slate-500 ml-2">
            ({totalContainers})
          </span>
        }
      />
      <CardBody className="space-y-3">
        {/* Init Containers */}
        {initContainers && initContainers.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs text-slate-500 uppercase font-bold">Init Containers</div>
            {initContainers.map((container, i) => (
              <ContainerCard
                key={container.name}
                container={container}
                status={getContainerStatus(container.name, initContainerStatuses)}
                isInit
                editable={editable}
                onUpdate={onUpdateContainer ? (updates) => onUpdateContainer(i, updates, true) : undefined}
              />
            ))}
          </div>
        )}

        {/* Regular Containers */}
        {containers && containers.length > 0 && (
          <div className="space-y-2">
            {initContainers && initContainers.length > 0 && (
              <div className="text-xs text-slate-500 uppercase font-bold">Containers</div>
            )}
            {containers.map((container, i) => (
              <ContainerCard
                key={container.name}
                container={container}
                status={getContainerStatus(container.name, containerStatuses)}
                defaultExpanded={i === 0 && containers.length === 1}
                editable={editable}
                onUpdate={onUpdateContainer ? (updates) => onUpdateContainer(i, updates, false) : undefined}
              />
            ))}
          </div>
        )}

        {(!containers || containers.length === 0) && (!initContainers || initContainers.length === 0) && (
          <div className="text-slate-500 text-sm text-center py-4">
            No containers defined
          </div>
        )}
      </CardBody>
    </Card>
  );
};
