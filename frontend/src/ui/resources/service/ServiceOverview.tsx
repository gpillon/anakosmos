import React from 'react';
import type { ClusterResource } from '../../../api/types';
import { Network, Globe, Shield, ArrowRight } from 'lucide-react';

export const ServiceOverview: React.FC<{ resource: ClusterResource }> = ({ resource }) => {
  const spec = resource.raw?.spec;
  const status = resource.raw?.status;

  if (!spec) return <div className="p-4 text-slate-400">Loading details...</div>;

  return (
    <div className="space-y-6">
       {/* Info Cards */}
       <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
                <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-2">
                    <Network size={14} /> Type
                </div>
                <div className="text-xl font-mono text-white">
                    {spec.type}
                </div>
            </div>

            <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
                <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-2">
                    <Shield size={14} /> Cluster IP
                </div>
                <div className="text-sm font-mono text-emerald-400">
                    {spec.clusterIP}
                </div>
            </div>

            <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
                <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-2">
                    <Globe size={14} /> External IP
                </div>
                <div className="text-sm font-mono text-blue-400">
                    {status?.loadBalancer?.ingress?.[0]?.ip || spec.externalIPs?.[0] || 'None'}
                </div>
            </div>
       </div>

       {/* Ports Table */}
       <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Ports Mapping</h3>
            <div className="bg-slate-800/30 rounded-lg border border-slate-700/50 overflow-hidden">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-800/80 text-slate-400 text-xs uppercase">
                        <tr>
                            <th className="px-4 py-3 font-semibold">Name</th>
                            <th className="px-4 py-3 font-semibold">Protocol</th>
                            <th className="px-4 py-3 font-semibold">Port</th>
                            <th className="px-4 py-3 font-semibold">Target Port</th>
                            <th className="px-4 py-3 font-semibold">Node Port</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/50">
                        {spec.ports?.map((port: any, i: number) => (
                            <tr key={i} className="hover:bg-slate-800/50 transition-colors">
                                <td className="px-4 py-3 text-slate-300">{port.name || '-'}</td>
                                <td className="px-4 py-3 text-slate-400">{port.protocol}</td>
                                <td className="px-4 py-3 font-mono text-emerald-400">{port.port}</td>
                                <td className="px-4 py-3 font-mono text-slate-300">
                                    <div className="flex items-center gap-2">
                                        <ArrowRight size={12} className="text-slate-600" />
                                        {port.targetPort}
                                    </div>
                                </td>
                                <td className="px-4 py-3 font-mono text-slate-400">{port.nodePort || '-'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
       </div>

       {/* Selector */}
       {spec.selector && (
           <div className="bg-slate-900/50 p-4 rounded border border-slate-700">
               <h3 className="font-bold text-slate-400 mb-3 text-xs uppercase">Selector</h3>
               <div className="flex flex-wrap gap-2">
                   {Object.entries(spec.selector).map(([k, v]) => (
                       <div key={k} className="flex text-xs font-mono border border-slate-700 rounded overflow-hidden">
                           <span className="bg-slate-800 px-2 py-1 text-slate-400 border-r border-slate-700">{k}</span>
                           <span className="bg-slate-900 px-2 py-1 text-slate-300">{String(v)}</span>
                       </div>
                   ))}
               </div>
           </div>
       )}
    </div>
  );
};
