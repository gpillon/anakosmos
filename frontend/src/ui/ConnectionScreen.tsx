import React, { useState } from 'react';
import { useClusterStore } from '../store/useClusterStore';
import { useSettingsStore } from '../store/useSettingsStore';
import type { SavedConnection } from '../store/useSettingsStore';
import { Server, LayoutDashboard, Database, AlertCircle, ArrowRight, Key, CheckCircle2, History, Trash2, ShieldAlert } from 'lucide-react';

export const ConnectionScreen: React.FC = () => {
  const { connect, checkConnection, connectionError } = useClusterStore();
  const { savedConnections, addSavedConnection, removeSavedConnection } = useSettingsStore();
  
  const [customUrl, setCustomUrl] = useState('http://localhost:8080');
  const [token, setToken] = useState('');
  const [shouldSave, setShouldSave] = useState(false);
  const [connectionName, setConnectionName] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<'select' | 'auth'>('select');
  const [activeMode, setActiveMode] = useState<'proxy' | 'custom' | 'mock' | null>(null);

  const handleConnect = async (mode: 'mock' | 'proxy' | 'custom', url?: string) => {
    setActiveMode(mode);
    setIsLoading(true);
    const targetUrl = url || customUrl;

    try {
      if (mode === 'mock') {
        await connect('mock');
      } else if (mode === 'proxy') {
        await connect('proxy');
      } else if (mode === 'custom') {
        // Step 1: Verify Server
        const isReachable = await checkConnection(targetUrl);
        if (isReachable) {
          setCustomUrl(targetUrl); // Ensure state is updated if coming from saved
          setStep('auth');
        } else {
          throw new Error('Server unreachable');
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const loadSavedConnection = (conn: SavedConnection) => {
    setCustomUrl(conn.url);
    if (conn.token) setToken(conn.token);
    setConnectionName(conn.name);
    handleConnect('custom', conn.url);
  };

  const handleAuthSubmit = async () => {
    setIsLoading(true);
    try {
      await connect('custom', customUrl, token);
      
      if (shouldSave) {
        addSavedConnection({
          name: connectionName || customUrl,
          url: customUrl,
          mode: 'custom',
          token: token
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const resetFlow = () => {
    setStep('select');
    setActiveMode(null);
    setToken('');
    setShouldSave(false);
  };

  return (
    <div className="flex flex-col items-center justify-center w-screen h-screen bg-slate-900 text-white overflow-y-auto py-10">
      <div className="w-full max-w-md p-8 bg-slate-800 rounded-lg shadow-xl border border-slate-700">
        <h1 className="text-3xl font-bold mb-2 text-center bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">
          Kube3D
        </h1>
        <p className="text-slate-400 text-center mb-8">
          {step === 'auth' ? 'Authenticate' : 'Select a connection method'}
        </p>

        {connectionError && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/50 rounded flex items-center gap-3 text-red-200">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm">{connectionError}</span>
          </div>
        )}

        {step === 'select' && (
          <div className="space-y-4">
            {/* Option 1: Internal Cluster (Proxy) */}
            <button
              onClick={() => handleConnect('proxy')}
              disabled={isLoading}
              className="w-full p-4 flex items-center gap-4 bg-slate-700/50 hover:bg-slate-700 hover:border-blue-500 border border-transparent rounded-lg transition-all group text-left"
            >
              <div className="p-3 bg-blue-500/20 rounded-lg group-hover:bg-blue-500/30 text-blue-400">
                <Server className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-200">Internal Cluster</h3>
                <p className="text-sm text-slate-400">Connect via local proxy</p>
              </div>
            </button>

            {/* Option 2: Custom API Server */}
            <div className="space-y-2">
              <div className="w-full p-4 bg-slate-700/50 rounded-lg border border-transparent hover:border-purple-500 transition-all">
                <div className="flex items-center gap-4 mb-3">
                  <div className="p-3 bg-purple-500/20 rounded-lg text-purple-400">
                    <Database className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-slate-200">Custom API Server</h3>
                    <p className="text-sm text-slate-400">Connect to remote cluster</p>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customUrl}
                    onChange={(e) => setCustomUrl(e.target.value)}
                    placeholder="https://api.k8s.example.com"
                    className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded text-sm text-slate-300 focus:border-purple-500 focus:outline-none placeholder-slate-600"
                  />
                  <button
                    onClick={() => handleConnect('custom')}
                    disabled={isLoading}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    {isLoading && activeMode === 'custom' ? '...' : <ArrowRight className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Saved Connections */}
            {savedConnections.length > 0 && (
              <div className="pt-4 border-t border-slate-700">
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <History className="w-3 h-3" /> Recent Connections
                </h4>
                <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                  {savedConnections.sort((a,b) => b.lastUsed - a.lastUsed).map(conn => (
                    <div key={conn.id} className="group flex items-center justify-between p-3 bg-slate-700/30 hover:bg-slate-700/50 rounded-lg border border-transparent hover:border-slate-600 transition-all">
                      <button 
                        onClick={() => loadSavedConnection(conn)}
                        className="flex-1 text-left"
                      >
                        <div className="text-sm font-medium text-slate-200">{conn.name}</div>
                        <div className="text-xs text-slate-500 truncate max-w-[200px]">{conn.url}</div>
                      </button>
                      <button
                        onClick={() => removeSavedConnection(conn.id)}
                        className="p-2 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                        title="Remove"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Option 3: Mock Mode */}
            <button
              onClick={() => handleConnect('mock')}
              disabled={isLoading}
              className="w-full p-4 flex items-center gap-4 bg-slate-700/50 hover:bg-slate-700 hover:border-emerald-500 border border-transparent rounded-lg transition-all group text-left"
            >
              <div className="p-3 bg-emerald-500/20 rounded-lg group-hover:bg-emerald-500/30 text-emerald-400">
                <LayoutDashboard className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-200">Mock Mode</h3>
                <p className="text-sm text-slate-400">Use simulated data</p>
              </div>
            </button>
          </div>
        )}

        {step === 'auth' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
             <div className="flex items-center gap-3 p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-green-300">
               <CheckCircle2 className="w-5 h-5" />
               <span className="text-sm">Server verified: {customUrl}</span>
             </div>

             <div className="space-y-2">
               <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                 <Key className="w-4 h-4" />
                 Authentication Token
               </label>
               <textarea
                 value={token}
                 onChange={(e) => setToken(e.target.value)}
                 placeholder="eyJhbGciOiJSUzI1NiIsImtpZCI..."
                 className="w-full h-32 px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-300 focus:border-purple-500 focus:outline-none placeholder-slate-600 font-mono resize-none"
               />
               <p className="text-xs text-slate-500">
                 Paste your ServiceAccount token here.
               </p>
             </div>

             <div className="p-4 bg-slate-700/30 rounded-lg border border-slate-700 space-y-3">
               <div className="flex items-center gap-3">
                 <input 
                   type="checkbox" 
                   id="save-conn"
                   checked={shouldSave}
                   onChange={(e) => setShouldSave(e.target.checked)}
                   className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-purple-600 focus:ring-purple-500/50"
                 />
                 <label htmlFor="save-conn" className="text-sm text-slate-300 select-none cursor-pointer">
                   Remember this connection
                 </label>
               </div>
               
               {shouldSave && (
                 <div className="space-y-2 pt-2 animate-in slide-in-from-top-2">
                   <label className="text-xs text-slate-400 block">Connection Name (Optional)</label>
                   <input
                     type="text"
                     value={connectionName}
                     onChange={(e) => setConnectionName(e.target.value)}
                     placeholder={customUrl}
                     className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-sm text-slate-300 focus:border-purple-500 focus:outline-none"
                   />
                   <div className="flex gap-2 text-yellow-500/80 text-xs items-start mt-2">
                     <ShieldAlert className="w-3 h-3 mt-0.5 flex-shrink-0" />
                     <span>Token will be saved in your browser storage. Do not use on public computers.</span>
                   </div>
                 </div>
               )}
             </div>

             <div className="flex gap-3">
               <button
                 onClick={resetFlow}
                 className="flex-1 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors"
               >
                 Back
               </button>
               <button
                 onClick={handleAuthSubmit}
                 disabled={isLoading || !token}
                 className="flex-1 px-4 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex justify-center items-center gap-2"
               >
                 {isLoading ? (
                   <div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                 ) : (
                   'Connect'
                 )}
               </button>
             </div>
          </div>
        )}

        {isLoading && step === 'select' && activeMode !== 'custom' && (
          <div className="mt-6 flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        )}
      </div>
    </div>
  );
};
