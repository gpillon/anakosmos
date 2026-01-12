import React, { useState } from 'react';
import { useClusterStore } from '../store/useClusterStore';
import { X, MousePointer } from 'lucide-react';

export const Onboarding: React.FC = () => {
  const [visible, setVisible] = useState(true);
  const isSceneReady = useClusterStore(state => state.isSceneReady);

  if (!visible || !isSceneReady) return null;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-lg w-full p-6 relative">
        <button 
          onClick={() => setVisible(false)}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
        >
          <X size={20} />
        </button>

        <h2 className="text-2xl font-bold text-white mb-4">Welcome to Anakosmos</h2>
        <p className="text-slate-300 mb-6 leading-relaxed">
          A new way to visualize your Kubernetes cluster. Explore resources in a 3D space, understand relationships, and monitor health in real-time.
        </p>

        <div className="space-y-4 mb-8">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-blue-500/10 rounded-lg text-blue-400">
              <MousePointer size={24} />
            </div>
            <div>
              <h3 className="font-semibold text-slate-200">Interactive Navigation</h3>
              <p className="text-sm text-slate-400">
                Left click to select resources. Right click to pan. Scroll to zoom.
              </p>
            </div>
          </div>
          
          <div className="flex items-start gap-4">
            <div className="p-3 bg-emerald-500/10 rounded-lg text-emerald-400">
              <Layers size={24} />
            </div>
            <div>
              <h3 className="font-semibold text-slate-200">Live Relationships</h3>
              <p className="text-sm text-slate-400">
                See how Pods, Services, and Nodes connect. Lines indicate ownership or network traffic.
              </p>
            </div>
          </div>
        </div>

        <button 
          onClick={() => setVisible(false)}
          className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg transition-colors"
        >
          Start Exploring
        </button>
      </div>
    </div>
  );
};

// Icon helper
import { Layers } from 'lucide-react';
