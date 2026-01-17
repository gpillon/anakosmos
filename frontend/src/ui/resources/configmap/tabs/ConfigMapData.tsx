import React from 'react';
import type { V1ConfigMap } from '../../../../api/k8s-types';
import { KeyValueDataCard } from '../../shared';

interface Props {
  model: V1ConfigMap;
  updateModel: (updater: (current: V1ConfigMap) => V1ConfigMap) => void;
}

export const ConfigMapData: React.FC<Props> = ({ model, updateModel }) => {
  const handleDataUpdate = (newData: Record<string, string>) => {
    updateModel(current => ({
      ...current,
      data: Object.keys(newData).length > 0 ? newData : undefined
    }));
  };

  return (
    <div className="space-y-6">
      <KeyValueDataCard
        data={model.data}
        title="ConfigMap Data"
        isBase64={false}
        maskValues={false}
        editable={true}
        onUpdate={handleDataUpdate}
        emptyMessage="No data keys defined"
      />

      {model.binaryData && Object.keys(model.binaryData).length > 0 && (
        <KeyValueDataCard
          data={model.binaryData}
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
