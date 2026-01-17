import React from 'react';
import type { V1Service, V1ServicePort } from '../../../../api/k8s-types';
import { 
  Network, 
  Plus, 
  Trash2, 
  ArrowRight
} from 'lucide-react';
import { clsx } from 'clsx';
import { Card, CardHeader, CardBody } from '../../shared';

interface Props {
  model: V1Service;
  updateModel: (updater: (current: V1Service) => V1Service) => void;
}

export const ServicePorts: React.FC<Props> = ({ model, updateModel }) => {
  const spec = model.spec;
  const ports = spec?.ports || [];
  const showNodePort = spec?.type === 'NodePort' || spec?.type === 'LoadBalancer';

  const updatePort = (index: number, updates: Partial<V1ServicePort>) => {
    updateModel(current => {
      const currentPorts = [...(current.spec?.ports || [])];
      currentPorts[index] = { ...currentPorts[index], ...updates };
      return {
        ...current,
        spec: {
          ...current.spec,
          ports: currentPorts
        }
      };
    });
  };

  const addPort = () => {
    updateModel(current => ({
      ...current,
      spec: {
        ...current.spec,
        ports: [
          ...(current.spec?.ports || []),
          {
            name: `port-${(current.spec?.ports || []).length + 1}`,
            protocol: 'TCP',
            port: 80,
            targetPort: 80
          }
        ]
      }
    }));
  };

  const removePort = (index: number) => {
    if (ports.length <= 1) return; // Must have at least one port
    updateModel(current => ({
      ...current,
      spec: {
        ...current.spec,
        ports: (current.spec?.ports || []).filter((_, i) => i !== index)
      }
    }));
  };

  return (
    <div className="space-y-6">
      {/* Ports Card */}
      <Card>
        <CardHeader 
          icon={<Network size={16} />} 
          title="Port Mappings"
          badge={<span className="text-xs text-slate-500 ml-2">({ports.length})</span>}
          action={
            <button
              onClick={addPort}
              className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
            >
              <Plus size={12} />
              Add Port
            </button>
          }
        />
        <CardBody noPadding>
          <div className="divide-y divide-slate-800">
            {ports.map((port, index) => (
              <div key={index} className="p-4 hover:bg-slate-800/20 transition-colors">
                <div className="grid grid-cols-12 gap-4 items-end">
                  {/* Name */}
                  <div className="col-span-3">
                    <label className="text-xs text-slate-500 uppercase font-bold block mb-1">Name</label>
                    <input
                      type="text"
                      value={port.name || ''}
                      onChange={(e) => updatePort(index, { name: e.target.value || undefined })}
                      placeholder="http"
                      className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  {/* Protocol */}
                  <div className="col-span-2">
                    <label className="text-xs text-slate-500 uppercase font-bold block mb-1">Protocol</label>
                    <select
                      value={port.protocol || 'TCP'}
                      onChange={(e) => updatePort(index, { protocol: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="TCP">TCP</option>
                      <option value="UDP">UDP</option>
                      <option value="SCTP">SCTP</option>
                    </select>
                  </div>

                  {/* Port */}
                  <div className="col-span-2">
                    <label className="text-xs text-slate-500 uppercase font-bold block mb-1">Port</label>
                    <input
                      type="number"
                      value={port.port || 0}
                      onChange={(e) => updatePort(index, { port: parseInt(e.target.value) || 0 })}
                      className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  {/* Arrow */}
                  <div className="col-span-1 flex justify-center pb-2">
                    <ArrowRight size={16} className="text-slate-600" />
                  </div>

                  {/* Target Port */}
                  <div className="col-span-2">
                    <label className="text-xs text-slate-500 uppercase font-bold block mb-1">Target Port</label>
                    <input
                      type="text"
                      value={port.targetPort ?? ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        const numVal = Number(val);
                        updatePort(index, { 
                          targetPort: isNaN(numVal) || val === '' ? val : numVal 
                        });
                      }}
                      placeholder="8080 or name"
                      className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  {/* Node Port (if applicable) */}
                  {showNodePort && (
                    <div className="col-span-1">
                      <label className="text-xs text-slate-500 uppercase font-bold block mb-1">Node</label>
                      <input
                        type="number"
                        value={port.nodePort || ''}
                        onChange={(e) => updatePort(index, { 
                          nodePort: e.target.value ? parseInt(e.target.value) : undefined 
                        })}
                        placeholder="Auto"
                        className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  )}

                  {/* Delete */}
                  <div className={clsx("flex justify-end pb-2", showNodePort ? "col-span-1" : "col-span-2")}>
                    <button
                      onClick={() => removePort(index)}
                      disabled={ports.length <= 1}
                      className="p-2 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* Ports Summary */}
      <Card>
        <CardHeader icon={<Network size={16} />} title="Ports Summary" />
        <CardBody noPadding>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-800/50 text-slate-400 text-xs uppercase">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Name</th>
                  <th className="px-4 py-3 text-left font-semibold">Protocol</th>
                  <th className="px-4 py-3 text-left font-semibold">Port</th>
                  <th className="px-4 py-3 text-left font-semibold">Target Port</th>
                  {showNodePort && <th className="px-4 py-3 text-left font-semibold">Node Port</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {ports.map((port, i) => (
                  <tr key={i} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3 text-slate-300">{port.name || '-'}</td>
                    <td className="px-4 py-3 text-slate-400">{port.protocol || 'TCP'}</td>
                    <td className="px-4 py-3 font-mono text-emerald-400">{port.port}</td>
                    <td className="px-4 py-3 font-mono text-slate-300">
                      <div className="flex items-center gap-2">
                        <ArrowRight size={12} className="text-slate-600" />
                        {port.targetPort ?? port.port}
                      </div>
                    </td>
                    {showNodePort && (
                      <td className="px-4 py-3 font-mono text-amber-400">{port.nodePort || 'Auto'}</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </div>
  );
};
