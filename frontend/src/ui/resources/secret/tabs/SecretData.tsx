import React from 'react';
import type { V1Secret } from '../../../../api/k8s-types';
import { KeyValueDataCard } from '../../shared';
import { AlertTriangle } from 'lucide-react';

interface Props {
  secret: V1Secret;
  onApply: (updatedRaw: V1Secret) => Promise<void>;
}

export const SecretData: React.FC<Props> = ({ secret, onApply }) => {
  const handleDataUpdate = async (newData: Record<string, string>) => {
    const updated = JSON.parse(JSON.stringify(secret)) as V1Secret;
    updated.data = newData;
    await onApply(updated);
  };

  return (
    <div className="space-y-6">
      {/* Security Warning */}
      <div className="bg-amber-900/20 border border-amber-800/50 rounded-lg p-4 flex items-start gap-3">
        <AlertTriangle size={20} className="text-amber-400 shrink-0 mt-0.5" />
        <div>
          <div className="font-medium text-amber-300 text-sm">Sensitive Data</div>
          <div className="text-xs text-amber-200/70 mt-1">
            Secret values are base64 encoded. Click the eye icon to reveal decoded values. 
            Be careful when copying or displaying sensitive information.
          </div>
        </div>
      </div>

      <KeyValueDataCard
        data={secret.data}
        title="Secret Data"
        isBase64={true}
        maskValues={true}
        editable={true}
        onUpdate={handleDataUpdate}
        emptyMessage="No secret data"
      />

      {secret.stringData && Object.keys(secret.stringData).length > 0 && (
        <KeyValueDataCard
          data={secret.stringData}
          title="String Data (unencoded)"
          isBase64={false}
          maskValues={true}
          editable={false}
          emptyMessage="No string data"
        />
      )}
    </div>
  );
};
