import React from 'react';
import type { V2HorizontalPodAutoscaler, V2HPAScalingRules, V2HPAScalingPolicy } from '../../../../api/k8s-types';
import { Card, CardHeader, CardBody, MetaRow } from '../../shared';
import { TrendingUp, TrendingDown, Clock, Settings, ArrowUp, ArrowDown } from 'lucide-react';
import { clsx } from 'clsx';

interface HPABehaviorProps {
  model: V2HorizontalPodAutoscaler;
  updateModel: (updater: (current: V2HorizontalPodAutoscaler) => V2HorizontalPodAutoscaler) => void;
}

const PolicyCard: React.FC<{ policy: V2HPAScalingPolicy; direction: 'up' | 'down' }> = ({ policy, direction }) => {
  const isUp = direction === 'up';
  
  return (
    <div className={clsx(
      "flex items-center gap-3 p-3 rounded-lg border",
      isUp 
        ? "bg-emerald-900/20 border-emerald-700/50" 
        : "bg-blue-900/20 border-blue-700/50"
    )}>
      {isUp ? (
        <ArrowUp size={16} className="text-emerald-400" />
      ) : (
        <ArrowDown size={16} className="text-blue-400" />
      )}
      <div className="flex-1">
        <div className="text-sm text-slate-200">
          {policy.type === 'Pods' && (
            <><span className="font-bold">{policy.value}</span> pod{(policy.value || 0) > 1 ? 's' : ''}</>
          )}
          {policy.type === 'Percent' && (
            <><span className="font-bold">{policy.value}%</span> of current</>
          )}
        </div>
        <div className="text-xs text-slate-500">
          every {policy.periodSeconds}s
        </div>
      </div>
    </div>
  );
};

const ScalingRulesSection: React.FC<{ 
  rules?: V2HPAScalingRules; 
  direction: 'up' | 'down';
  title: string;
}> = ({ rules, direction, title }) => {
  const isUp = direction === 'up';
  const Icon = isUp ? TrendingUp : TrendingDown;
  const policies = rules?.policies || [];
  const selectPolicy = rules?.selectPolicy || 'Max';
  const stabilizationWindowSeconds = rules?.stabilizationWindowSeconds;

  return (
    <Card>
      <CardHeader 
        title={title} 
        icon={<Icon size={16} className={isUp ? "text-emerald-400" : "text-blue-400"} />}
      />
      <CardBody>
        {policies.length === 0 ? (
          <div className="text-center text-slate-500 py-4">
            <Settings size={24} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">Using default behavior</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <MetaRow label="Selection Policy" value={selectPolicy} />
              <MetaRow 
                label="Stabilization Window" 
                value={stabilizationWindowSeconds !== undefined ? `${stabilizationWindowSeconds}s` : 'Default'} 
              />
            </div>
            
            <div className="space-y-2">
              <div className="text-xs font-medium text-slate-400 mb-2">Policies</div>
              {policies.map((policy, idx) => (
                <PolicyCard key={idx} policy={policy} direction={direction} />
              ))}
            </div>
          </>
        )}
      </CardBody>
    </Card>
  );
};

export const HPABehavior: React.FC<HPABehaviorProps> = ({ model }) => {
  const behavior = model.spec?.behavior;

  if (!behavior) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader title="Scaling Behavior" icon={<Settings size={16} />} />
          <CardBody>
            <div className="text-center text-slate-500 py-8">
              <Settings size={32} className="mx-auto mb-3 opacity-50" />
              <p>No custom behavior configured</p>
              <p className="text-xs mt-2">
                Using default Kubernetes HPA behavior
              </p>
            </div>
          </CardBody>
        </Card>

        {/* Default Behavior Reference */}
        <Card>
          <CardHeader title="Default Behavior Reference" />
          <CardBody>
            <div className="space-y-4 text-sm">
              <div className="flex items-start gap-3">
                <TrendingUp size={16} className="text-emerald-400 mt-0.5" />
                <div>
                  <div className="font-medium text-slate-300">Scale Up</div>
                  <p className="text-xs text-slate-500">
                    Up to 4 pods or 100% of current replicas (whichever is higher) every 15s. 
                    0s stabilization window.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <TrendingDown size={16} className="text-blue-400 mt-0.5" />
                <div>
                  <div className="font-medium text-slate-300">Scale Down</div>
                  <p className="text-xs text-slate-500">
                    Down to 100% of current replicas every 15s. 
                    300s (5min) stabilization window to prevent flapping.
                  </p>
                </div>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ScalingRulesSection 
        rules={behavior.scaleUp} 
        direction="up" 
        title="Scale Up Behavior"
      />
      
      <ScalingRulesSection 
        rules={behavior.scaleDown} 
        direction="down" 
        title="Scale Down Behavior"
      />

      {/* Behavior Explanation */}
      <Card>
        <CardHeader title="How Policies Work" />
        <CardBody>
          <div className="space-y-3 text-xs text-slate-400">
            <div className="flex items-start gap-2">
              <span className="bg-slate-700 px-2 py-0.5 rounded text-slate-300 font-mono">Max</span>
              <span>Select the policy allowing the most change</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="bg-slate-700 px-2 py-0.5 rounded text-slate-300 font-mono">Min</span>
              <span>Select the policy allowing the least change</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="bg-slate-700 px-2 py-0.5 rounded text-slate-300 font-mono">Disabled</span>
              <span>Disable scaling in this direction</span>
            </div>
            <div className="mt-4 p-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
              <div className="flex items-center gap-2 mb-2">
                <Clock size={14} />
                <span className="font-medium text-slate-300">Stabilization Window</span>
              </div>
              <p>
                Period to look back when deciding to scale. Prevents rapid fluctuations 
                ("flapping") by considering recent replica recommendations.
              </p>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
};
