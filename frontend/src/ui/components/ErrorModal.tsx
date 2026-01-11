import React from 'react';
import { X, AlertCircle, Info, Hash, AlertTriangle } from 'lucide-react';

interface ErrorModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  error: string;
}

const formatKey = (key: string) => {
  return key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1');
};

const ValueRenderer: React.FC<{ value: any }> = ({ value }) => {
  if (value === null || value === undefined) return <span className="text-slate-500 italic">null</span>;
  
  if (typeof value === 'object') {
    if (Array.isArray(value)) {
        if (value.length === 0) return <span className="text-slate-500 text-xs italic">[]</span>;
        return (
            <div className="pl-3 border-l-2 border-slate-800 mt-1 space-y-1">
                {value.map((item, idx) => (
                    <div key={idx} className="text-sm py-1">
                        <ValueRenderer value={item} />
                    </div>
                ))}
            </div>
        );
    }
    
    if (Object.keys(value).length === 0) return <span className="text-slate-500 text-xs italic">{"{}"}</span>;

    return (
      <div className="pl-3 border-l-2 border-slate-800 mt-1 space-y-1">
        {Object.entries(value).map(([k, v]) => (
          <div key={k} className="text-sm py-0.5">
            <span className="text-slate-400 font-medium mr-2">{formatKey(k)}:</span>
            <div className="inline-block align-top">
                <ValueRenderer value={v} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (typeof value === 'boolean') {
    return <span className={value ? 'text-emerald-400' : 'text-red-400'}>{value.toString()}</span>;
  }

  return <span className="text-slate-200 font-mono text-xs">{String(value)}</span>;
};

export const ErrorModal: React.FC<ErrorModalProps> = ({ isOpen, onClose, title = 'Error', error }) => {
  if (!isOpen) return null;

  let parsedError: any = null;
  try {
    parsedError = JSON.parse(error);
  } catch {
    // Keep as string if not JSON
  }

  const isStructured = parsedError && typeof parsedError === 'object';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-red-500/50 rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col animate-in zoom-in-95 duration-200 overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 bg-red-500/10 border-b border-red-500/20">
          <div className="flex items-center gap-3 text-red-400">
            <div className="p-2 bg-red-500/20 rounded-full">
                <AlertCircle className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold">{title}</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto custom-scrollbar bg-slate-900">
          
          {isStructured ? (
             <div className="space-y-6">
                
                {/* Primary Message */}
                {parsedError.message && (
                    <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-4">
                        <h3 className="text-xs font-bold text-red-500 uppercase tracking-widest mb-2">Message</h3>
                        <p className="text-red-100 text-lg font-medium leading-relaxed">
                            {parsedError.message}
                        </p>
                    </div>
                )}

                {/* Key Status Fields */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {parsedError.reason && (
                        <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
                             <div className="flex items-center gap-2 text-slate-400 text-xs uppercase font-bold mb-1">
                                <AlertTriangle size={14} /> Reason
                             </div>
                             <div className="text-white font-mono">{parsedError.reason}</div>
                        </div>
                    )}
                    {parsedError.code && (
                        <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
                             <div className="flex items-center gap-2 text-slate-400 text-xs uppercase font-bold mb-1">
                                <Hash size={14} /> Code
                             </div>
                             <div className="text-white font-mono">{parsedError.code}</div>
                        </div>
                    )}
                     {parsedError.status && (
                        <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
                             <div className="flex items-center gap-2 text-slate-400 text-xs uppercase font-bold mb-1">
                                <Info size={14} /> Status
                             </div>
                             <div className="text-white font-mono">{parsedError.status}</div>
                        </div>
                    )}
                </div>

                {/* Dynamic Remaining Fields */}
                <div className="space-y-3">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-800 pb-2">
                        Additional Details
                    </h3>
                    <div className="space-y-3">
                        {Object.entries(parsedError).map(([key, value]) => {
                            if (['message', 'reason', 'code', 'status', 'apiVersion', 'kind'].includes(key)) return null;
                            return (
                                <div key={key} className="group">
                                    <div className="flex items-start gap-4">
                                        <div className="w-1/3 shrink-0 pt-0.5">
                                            <span className="text-slate-400 text-sm font-medium">{formatKey(key)}</span>
                                        </div>
                                        <div className="flex-1 text-sm break-all">
                                            <ValueRenderer value={value} />
                                        </div>
                                    </div>
                                    <div className="h-px bg-slate-800/50 mt-2 group-last:hidden" />
                                </div>
                            );
                        })}
                    </div>
                </div>

             </div>
          ) : (
            <div className="bg-slate-950 rounded-lg p-4 font-mono text-sm text-red-200 whitespace-pre-wrap border border-slate-800">
                {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-white text-slate-900 hover:bg-slate-200 rounded-lg font-bold transition-colors shadow-lg shadow-white/5"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
