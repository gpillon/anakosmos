import React from 'react';
import type { V1ConfigMap } from '../../../../api/k8s-types';
import { KeyValueDataCard } from '../../shared';

interface Props {
  configMap: V1ConfigMap;
  onApply: (updatedRaw: V1ConfigMap) => Promise<void>;
}

export const ConfigMapData: React.FC<Props> = ({ configMap, onApply }) => {
  const handleDataUpdate = async (newData: Record<string, string>) => {
    const updated = JSON.parse(JSON.stringify(configMap)) as V1ConfigMap;
    updated.data = newData;
    await onApply(updated);
  };

  return (
    <div className="space-y-6">
      <KeyValueDataCard
        data={configMap.data}
        title="ConfigMap Data"
        isBase64={false}
        maskValues={false}
        editable={true}
        onUpdate={handleDataUpdate}
        emptyMessage="No data keys defined"
      />

      {configMap.binaryData && Object.keys(configMap.binaryData).length > 0 && (
        <KeyValueDataCard
          data={configMap.binaryData}
          title="Binary Data"
          isBase64={true}
          maskValues={true}
          editable={false}
          emptyMessage="No binary data"
        />
      )}
    </div>
  );
};
