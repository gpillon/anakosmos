import React from 'react';
import { Calendar } from 'lucide-react';
import type { V1ObjectMeta } from '../../../api/k8s-types';
import { Card, CardHeader, CardBody } from './Card';
import { MetaRow } from './MetaRow';
import { formatDate } from './formatters';

interface MetadataCardProps {
  metadata: V1ObjectMeta | undefined;
  showUid?: boolean;
  showGeneration?: boolean;
  showResourceVersion?: boolean;
}

export const MetadataCard: React.FC<MetadataCardProps> = ({ 
  metadata,
  showUid = true,
  showGeneration = true,
  showResourceVersion = true
}) => {
  if (!metadata) return null;

  return (
    <Card>
      <CardHeader icon={<Calendar size={16} />} title="Metadata" />
      <CardBody className="space-y-3 text-sm">
        <MetaRow label="Namespace" value={metadata.namespace || 'default'} />
        <MetaRow label="Created" value={formatDate(metadata.creationTimestamp?.toString())} />
        {showGeneration && metadata.generation !== undefined && (
          <MetaRow label="Generation" value={metadata.generation} />
        )}
        {showResourceVersion && (
          <MetaRow label="Resource Version" value={metadata.resourceVersion} />
        )}
        {showUid && (
          <MetaRow label="UID" value={metadata.uid} mono />
        )}
      </CardBody>
    </Card>
  );
};
