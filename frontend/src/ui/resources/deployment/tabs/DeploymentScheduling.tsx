import React, { useState } from 'react';
import type { ClusterResource } from '../../../../api/types';
import { 
  Server, 
  Plus, 
  Trash2, 
  ChevronDown, 
  ChevronRight,
  Target,
  Magnet,
  Shield,
  Save,
  RefreshCw,
  AlertCircle,
  Grid3X3,
  Layers
} from 'lucide-react';

interface Props {
  resource: ClusterResource;
  onApply: (updatedRaw: any) => Promise<void>;
}

export const DeploymentScheduling: React.FC<Props> = ({ resource, onApply }) => {
  const raw = resource.raw;
  const template = raw?.spec?.template?.spec || {};
  
  const [nodeSelector, setNodeSelector] = useState<Record<string, string>>(template.nodeSelector || {});
  const [nodeName, setNodeName] = useState<string>(template.nodeName || '');
  const [affinity, setAffinity] = useState<any>(template.affinity || {});
  const [tolerations, setTolerations] = useState<any[]>(template.tolerations || []);
  const [topologySpreadConstraints, setTopologySpreadConstraints] = useState<any[]>(template.topologySpreadConstraints || []);
  const [priorityClassName, setPriorityClassName] = useState<string>(template.priorityClassName || '');
  
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string>('nodeSelector');

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = JSON.parse(JSON.stringify(raw));
      const spec = updated.spec.template.spec;
      
      spec.nodeSelector = Object.keys(nodeSelector).length > 0 ? nodeSelector : undefined;
      spec.nodeName = nodeName || undefined;
      spec.affinity = Object.keys(affinity).length > 0 ? affinity : undefined;
      spec.tolerations = tolerations.length > 0 ? tolerations : undefined;
      spec.topologySpreadConstraints = topologySpreadConstraints.length > 0 ? topologySpreadConstraints : undefined;
      spec.priorityClassName = priorityClassName || undefined;
      
      await onApply(updated);
      setHasChanges(false);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const markChanged = () => setHasChanges(true);

  return (
    <div className="space-y-6">
      {/* Save Banner */}
      {hasChanges && (
        <div className="sticky top-0 z-10 bg-amber-900/80 backdrop-blur-sm border border-amber-700 rounded-lg p-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-amber-200">
            <AlertCircle size={16} />
            <span className="text-sm font-medium">You have unsaved changes</span>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-1.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-sm font-bold rounded transition-colors"
          >
            {saving ? <RefreshCw className="animate-spin" size={14} /> : <Save size={14} />}
            Save Changes
          </button>
        </div>
      )}

      {/* Node Name (Direct Assignment) */}
      <div className="bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden">
        <div className="px-4 py-3 bg-slate-800/50 border-b border-slate-700 flex items-center gap-2">
          <Server size={16} className="text-purple-400" />
          <span className="font-semibold text-slate-200">Direct Node Assignment</span>
        </div>
        <div className="p-4">
          <div className="mb-2">
            <label className="text-xs text-slate-400 mb-1 block">Node Name</label>
            <input
              type="text"
              value={nodeName}
              onChange={(e) => { setNodeName(e.target.value); markChanged(); }}
              placeholder="Leave empty for scheduler to decide"
              className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
            />
          </div>
          <p className="text-xs text-slate-500">
            Directly assign pods to a specific node by name. Usually you should use nodeSelector or affinity instead.
          </p>
        </div>
      </div>

      {/* Node Selector */}
      <CollapsibleSection
        title="Node Selector"
        subtitle="Simple label-based node selection"
        icon={<Target size={16} className="text-blue-400" />}
        isExpanded={expandedSection === 'nodeSelector'}
        onToggle={() => setExpandedSection(expandedSection === 'nodeSelector' ? '' : 'nodeSelector')}
        count={Object.keys(nodeSelector).length}
      >
        <div className="space-y-3">
          {Object.entries(nodeSelector).map(([key, value]) => (
            <div key={key} className="flex gap-2 items-center">
              <input
                type="text"
                value={key}
                onChange={(e) => {
                  const newSelector = { ...nodeSelector };
                  delete newSelector[key];
                  newSelector[e.target.value] = value;
                  setNodeSelector(newSelector);
                  markChanged();
                }}
                placeholder="Key"
                className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-white font-mono"
              />
              <span className="text-slate-500">=</span>
              <input
                type="text"
                value={value}
                onChange={(e) => {
                  setNodeSelector({ ...nodeSelector, [key]: e.target.value });
                  markChanged();
                }}
                placeholder="Value"
                className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-white font-mono"
              />
              <button
                onClick={() => {
                  const newSelector = { ...nodeSelector };
                  delete newSelector[key];
                  setNodeSelector(newSelector);
                  markChanged();
                }}
                className="text-red-400 hover:text-red-300"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          <button
            onClick={() => {
              setNodeSelector({ ...nodeSelector, '': '' });
              markChanged();
            }}
            className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
          >
            <Plus size={14} /> Add Selector
          </button>
        </div>
      </CollapsibleSection>

      {/* Node Affinity */}
      <CollapsibleSection
        title="Node Affinity"
        subtitle="Advanced node selection with operators"
        icon={<Magnet size={16} className="text-emerald-400" />}
        isExpanded={expandedSection === 'nodeAffinity'}
        onToggle={() => setExpandedSection(expandedSection === 'nodeAffinity' ? '' : 'nodeAffinity')}
      >
        <NodeAffinityEditor
          affinity={affinity.nodeAffinity}
          onUpdate={(nodeAffinity) => {
            setAffinity({ ...affinity, nodeAffinity: nodeAffinity || undefined });
            markChanged();
          }}
        />
      </CollapsibleSection>

      {/* Pod Affinity */}
      <CollapsibleSection
        title="Pod Affinity"
        subtitle="Co-locate pods with other pods"
        icon={<Layers size={16} className="text-cyan-400" />}
        isExpanded={expandedSection === 'podAffinity'}
        onToggle={() => setExpandedSection(expandedSection === 'podAffinity' ? '' : 'podAffinity')}
      >
        <PodAffinityEditor
          affinity={affinity.podAffinity}
          onUpdate={(podAffinity) => {
            setAffinity({ ...affinity, podAffinity: podAffinity || undefined });
            markChanged();
          }}
          type="affinity"
        />
      </CollapsibleSection>

      {/* Pod Anti-Affinity */}
      <CollapsibleSection
        title="Pod Anti-Affinity"
        subtitle="Spread pods away from other pods"
        icon={<Grid3X3 size={16} className="text-orange-400" />}
        isExpanded={expandedSection === 'podAntiAffinity'}
        onToggle={() => setExpandedSection(expandedSection === 'podAntiAffinity' ? '' : 'podAntiAffinity')}
      >
        <PodAffinityEditor
          affinity={affinity.podAntiAffinity}
          onUpdate={(podAntiAffinity) => {
            setAffinity({ ...affinity, podAntiAffinity: podAntiAffinity || undefined });
            markChanged();
          }}
          type="antiAffinity"
        />
      </CollapsibleSection>

      {/* Tolerations */}
      <CollapsibleSection
        title="Tolerations"
        subtitle="Allow scheduling on tainted nodes"
        icon={<Shield size={16} className="text-amber-400" />}
        isExpanded={expandedSection === 'tolerations'}
        onToggle={() => setExpandedSection(expandedSection === 'tolerations' ? '' : 'tolerations')}
        count={tolerations.length}
      >
        <TolerationsEditor
          tolerations={tolerations}
          onUpdate={(t) => { setTolerations(t); markChanged(); }}
        />
      </CollapsibleSection>

      {/* Topology Spread Constraints */}
      <CollapsibleSection
        title="Topology Spread Constraints"
        subtitle="Distribute pods across topology domains"
        icon={<Grid3X3 size={16} className="text-pink-400" />}
        isExpanded={expandedSection === 'topology'}
        onToggle={() => setExpandedSection(expandedSection === 'topology' ? '' : 'topology')}
        count={topologySpreadConstraints.length}
      >
        <TopologySpreadEditor
          constraints={topologySpreadConstraints}
          onUpdate={(c) => { setTopologySpreadConstraints(c); markChanged(); }}
        />
      </CollapsibleSection>

      {/* Priority Class */}
      <div className="bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden">
        <div className="px-4 py-3 bg-slate-800/50 border-b border-slate-700 flex items-center gap-2">
          <Target size={16} className="text-red-400" />
          <span className="font-semibold text-slate-200">Priority Class</span>
        </div>
        <div className="p-4">
          <input
            type="text"
            value={priorityClassName}
            onChange={(e) => { setPriorityClassName(e.target.value); markChanged(); }}
            placeholder="e.g., high-priority, system-cluster-critical"
            className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500 mt-2">
            PriorityClass determines the scheduling priority and preemption behavior.
          </p>
        </div>
      </div>
    </div>
  );
};

// Collapsible Section Component
const CollapsibleSection: React.FC<{
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  isExpanded: boolean;
  onToggle: () => void;
  count?: number;
  children: React.ReactNode;
}> = ({ title, subtitle, icon, isExpanded, onToggle, count, children }) => (
  <div className="bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden">
    <div 
      className="px-4 py-3 bg-slate-800/50 border-b border-slate-700 flex items-center gap-3 cursor-pointer hover:bg-slate-800/70 transition-colors"
      onClick={onToggle}
    >
      {isExpanded ? <ChevronDown size={16} className="text-slate-500" /> : <ChevronRight size={16} className="text-slate-500" />}
      {icon}
      <div className="flex-1">
        <span className="font-semibold text-slate-200">{title}</span>
        {count !== undefined && count > 0 && (
          <span className="ml-2 text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">{count}</span>
        )}
        <p className="text-xs text-slate-500">{subtitle}</p>
      </div>
    </div>
    {isExpanded && <div className="p-4">{children}</div>}
  </div>
);

// Node Affinity Editor
const NodeAffinityEditor: React.FC<{
  affinity?: any;
  onUpdate: (affinity: any) => void;
}> = ({ affinity = {}, onUpdate }) => {
  const required = affinity?.requiredDuringSchedulingIgnoredDuringExecution?.nodeSelectorTerms || [];
  const preferred = affinity?.preferredDuringSchedulingIgnoredDuringExecution || [];

  const addRequiredTerm = () => {
    const newTerms = [...required, { matchExpressions: [{ key: '', operator: 'In', values: [] }] }];
    onUpdate({
      ...affinity,
      requiredDuringSchedulingIgnoredDuringExecution: { nodeSelectorTerms: newTerms }
    });
  };

  const addPreferredTerm = () => {
    const newPreferred = [...preferred, { weight: 1, preference: { matchExpressions: [{ key: '', operator: 'In', values: [] }] } }];
    onUpdate({
      ...affinity,
      preferredDuringSchedulingIgnoredDuringExecution: newPreferred
    });
  };

  return (
    <div className="space-y-6">
      {/* Required */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h4 className="text-sm font-semibold text-slate-300">Required (Hard)</h4>
            <p className="text-xs text-slate-500">Pod won't schedule if requirements aren't met</p>
          </div>
          <button onClick={addRequiredTerm} className="text-xs text-blue-400 hover:text-blue-300">
            <Plus size={12} className="inline mr-1" /> Add Term
          </button>
        </div>
        {required.length === 0 ? (
          <div className="text-xs text-slate-500 py-2">No required terms</div>
        ) : (
          <div className="space-y-3">
            {required.map((term: any, i: number) => (
              <NodeSelectorTermEditor
                key={i}
                term={term}
                onUpdate={(t) => {
                  const newTerms = [...required];
                  newTerms[i] = t;
                  onUpdate({
                    ...affinity,
                    requiredDuringSchedulingIgnoredDuringExecution: { nodeSelectorTerms: newTerms }
                  });
                }}
                onRemove={() => {
                  const newTerms = required.filter((_: any, idx: number) => idx !== i);
                  onUpdate({
                    ...affinity,
                    requiredDuringSchedulingIgnoredDuringExecution: newTerms.length > 0 ? { nodeSelectorTerms: newTerms } : undefined
                  });
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Preferred */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h4 className="text-sm font-semibold text-slate-300">Preferred (Soft)</h4>
            <p className="text-xs text-slate-500">Scheduler will try to honor, but not required</p>
          </div>
          <button onClick={addPreferredTerm} className="text-xs text-emerald-400 hover:text-emerald-300">
            <Plus size={12} className="inline mr-1" /> Add Preference
          </button>
        </div>
        {preferred.length === 0 ? (
          <div className="text-xs text-slate-500 py-2">No preferred terms</div>
        ) : (
          <div className="space-y-3">
            {preferred.map((pref: any, i: number) => (
              <div key={i} className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
                <div className="flex items-center gap-3 mb-3">
                  <label className="text-xs text-slate-400">Weight:</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={pref.weight}
                    onChange={(e) => {
                      const newPreferred = [...preferred];
                      newPreferred[i] = { ...pref, weight: parseInt(e.target.value) || 1 };
                      onUpdate({
                        ...affinity,
                        preferredDuringSchedulingIgnoredDuringExecution: newPreferred
                      });
                    }}
                    className="w-20 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-white"
                  />
                  <button
                    onClick={() => {
                      const newPreferred = preferred.filter((_: any, idx: number) => idx !== i);
                      onUpdate({
                        ...affinity,
                        preferredDuringSchedulingIgnoredDuringExecution: newPreferred.length > 0 ? newPreferred : undefined
                      });
                    }}
                    className="ml-auto text-red-400 hover:text-red-300"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <NodeSelectorTermEditor
                  term={pref.preference}
                  onUpdate={(t) => {
                    const newPreferred = [...preferred];
                    newPreferred[i] = { ...pref, preference: t };
                    onUpdate({
                      ...affinity,
                      preferredDuringSchedulingIgnoredDuringExecution: newPreferred
                    });
                  }}
                  onRemove={() => {}}
                  hideRemove
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// Node Selector Term Editor
const NodeSelectorTermEditor: React.FC<{
  term: any;
  onUpdate: (term: any) => void;
  onRemove: () => void;
  hideRemove?: boolean;
}> = ({ term, onUpdate, onRemove, hideRemove }) => {
  const expressions = term.matchExpressions || [];

  return (
    <div className="bg-slate-800/30 rounded-lg p-3 border border-slate-700/50">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-slate-500 uppercase">Match Expressions</span>
        {!hideRemove && (
          <button onClick={onRemove} className="text-xs text-red-400 hover:text-red-300">Remove Term</button>
        )}
      </div>
      
      {expressions.map((expr: any, i: number) => (
        <div key={i} className="flex gap-2 items-center mb-2">
          <input
            type="text"
            value={expr.key}
            onChange={(e) => {
              const newExpr = [...expressions];
              newExpr[i] = { ...expr, key: e.target.value };
              onUpdate({ ...term, matchExpressions: newExpr });
            }}
            placeholder="Key"
            className="w-1/4 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-white font-mono"
          />
          <select
            value={expr.operator}
            onChange={(e) => {
              const newExpr = [...expressions];
              newExpr[i] = { ...expr, operator: e.target.value };
              onUpdate({ ...term, matchExpressions: newExpr });
            }}
            className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-white"
          >
            <option value="In">In</option>
            <option value="NotIn">NotIn</option>
            <option value="Exists">Exists</option>
            <option value="DoesNotExist">DoesNotExist</option>
            <option value="Gt">Gt</option>
            <option value="Lt">Lt</option>
          </select>
          {!['Exists', 'DoesNotExist'].includes(expr.operator) && (
            <input
              type="text"
              value={expr.values?.join(', ') || ''}
              onChange={(e) => {
                const newExpr = [...expressions];
                newExpr[i] = { ...expr, values: e.target.value.split(',').map((v: string) => v.trim()).filter(Boolean) };
                onUpdate({ ...term, matchExpressions: newExpr });
              }}
              placeholder="Values (comma separated)"
              className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-white"
            />
          )}
          <button
            onClick={() => {
              const newExpr = expressions.filter((_: any, idx: number) => idx !== i);
              onUpdate({ ...term, matchExpressions: newExpr.length > 0 ? newExpr : undefined });
            }}
            className="text-red-400 hover:text-red-300"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <button
        onClick={() => {
          onUpdate({ ...term, matchExpressions: [...expressions, { key: '', operator: 'In', values: [] }] });
        }}
        className="text-xs text-blue-400 hover:text-blue-300"
      >
        <Plus size={12} className="inline mr-1" /> Add Expression
      </button>
    </div>
  );
};

// Pod Affinity/Anti-Affinity Editor
const PodAffinityEditor: React.FC<{
  affinity?: any;
  onUpdate: (affinity: any) => void;
  type: 'affinity' | 'antiAffinity';
}> = ({ affinity = {}, onUpdate }) => {
  const required = affinity?.requiredDuringSchedulingIgnoredDuringExecution || [];
  const preferred = affinity?.preferredDuringSchedulingIgnoredDuringExecution || [];

  const addRequired = () => {
    onUpdate({
      ...affinity,
      requiredDuringSchedulingIgnoredDuringExecution: [
        ...required,
        { labelSelector: { matchLabels: {} }, topologyKey: 'kubernetes.io/hostname' }
      ]
    });
  };

  const addPreferred = () => {
    onUpdate({
      ...affinity,
      preferredDuringSchedulingIgnoredDuringExecution: [
        ...preferred,
        { weight: 1, podAffinityTerm: { labelSelector: { matchLabels: {} }, topologyKey: 'kubernetes.io/hostname' } }
      ]
    });
  };

  return (
    <div className="space-y-6">
      {/* Required */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-slate-300">Required (Hard)</h4>
          <button onClick={addRequired} className="text-xs text-blue-400 hover:text-blue-300">
            <Plus size={12} className="inline mr-1" /> Add Rule
          </button>
        </div>
        {required.length === 0 ? (
          <div className="text-xs text-slate-500 py-2">No required rules</div>
        ) : (
          <div className="space-y-3">
            {required.map((term: any, i: number) => (
              <PodAffinityTermEditor
                key={i}
                term={term}
                onUpdate={(t) => {
                  const newTerms = [...required];
                  newTerms[i] = t;
                  onUpdate({ ...affinity, requiredDuringSchedulingIgnoredDuringExecution: newTerms });
                }}
                onRemove={() => {
                  const newTerms = required.filter((_: any, idx: number) => idx !== i);
                  onUpdate({
                    ...affinity,
                    requiredDuringSchedulingIgnoredDuringExecution: newTerms.length > 0 ? newTerms : undefined
                  });
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Preferred */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-slate-300">Preferred (Soft)</h4>
          <button onClick={addPreferred} className="text-xs text-emerald-400 hover:text-emerald-300">
            <Plus size={12} className="inline mr-1" /> Add Preference
          </button>
        </div>
        {preferred.length === 0 ? (
          <div className="text-xs text-slate-500 py-2">No preferred rules</div>
        ) : (
          <div className="space-y-3">
            {preferred.map((pref: any, i: number) => (
              <div key={i} className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
                <div className="flex items-center gap-3 mb-3">
                  <label className="text-xs text-slate-400">Weight:</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={pref.weight}
                    onChange={(e) => {
                      const newPreferred = [...preferred];
                      newPreferred[i] = { ...pref, weight: parseInt(e.target.value) || 1 };
                      onUpdate({ ...affinity, preferredDuringSchedulingIgnoredDuringExecution: newPreferred });
                    }}
                    className="w-20 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-white"
                  />
                  <button
                    onClick={() => {
                      const newPreferred = preferred.filter((_: any, idx: number) => idx !== i);
                      onUpdate({
                        ...affinity,
                        preferredDuringSchedulingIgnoredDuringExecution: newPreferred.length > 0 ? newPreferred : undefined
                      });
                    }}
                    className="ml-auto text-red-400 hover:text-red-300"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <PodAffinityTermEditor
                  term={pref.podAffinityTerm}
                  onUpdate={(t) => {
                    const newPreferred = [...preferred];
                    newPreferred[i] = { ...pref, podAffinityTerm: t };
                    onUpdate({ ...affinity, preferredDuringSchedulingIgnoredDuringExecution: newPreferred });
                  }}
                  onRemove={() => {}}
                  hideRemove
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// Pod Affinity Term Editor
const PodAffinityTermEditor: React.FC<{
  term: any;
  onUpdate: (term: any) => void;
  onRemove: () => void;
  hideRemove?: boolean;
}> = ({ term, onUpdate, onRemove, hideRemove }) => {
  const labels = term.labelSelector?.matchLabels || {};

  return (
    <div className="bg-slate-800/30 rounded-lg p-3 border border-slate-700/50 space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs text-slate-400">Topology Key</label>
        {!hideRemove && (
          <button onClick={onRemove} className="text-xs text-red-400 hover:text-red-300">Remove</button>
        )}
      </div>
      <input
        type="text"
        value={term.topologyKey || ''}
        onChange={(e) => onUpdate({ ...term, topologyKey: e.target.value })}
        placeholder="kubernetes.io/hostname"
        className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-white font-mono"
      />

      <div>
        <label className="text-xs text-slate-400 mb-2 block">Match Labels</label>
        {Object.entries(labels).map(([key, value]) => (
          <div key={key} className="flex gap-2 items-center mb-2">
            <input
              type="text"
              value={key}
              onChange={(e) => {
                const newLabels = { ...labels };
                delete newLabels[key];
                newLabels[e.target.value] = value;
                onUpdate({ ...term, labelSelector: { ...term.labelSelector, matchLabels: newLabels } });
              }}
              placeholder="Key"
              className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-white font-mono"
            />
            <span className="text-slate-500">=</span>
            <input
              type="text"
              value={String(value)}
              onChange={(e) => {
                onUpdate({ ...term, labelSelector: { ...term.labelSelector, matchLabels: { ...labels, [key]: e.target.value } } });
              }}
              placeholder="Value"
              className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-white font-mono"
            />
            <button
              onClick={() => {
                const newLabels = { ...labels };
                delete newLabels[key];
                onUpdate({ ...term, labelSelector: { ...term.labelSelector, matchLabels: newLabels } });
              }}
              className="text-red-400 hover:text-red-300"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        <button
          onClick={() => {
            onUpdate({ ...term, labelSelector: { ...term.labelSelector, matchLabels: { ...labels, '': '' } } });
          }}
          className="text-xs text-blue-400 hover:text-blue-300"
        >
          <Plus size={12} className="inline mr-1" /> Add Label
        </button>
      </div>

      {term.namespaces !== undefined && (
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Namespaces</label>
          <input
            type="text"
            value={term.namespaces?.join(', ') || ''}
            onChange={(e) => onUpdate({ ...term, namespaces: e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean) })}
            placeholder="Comma separated namespaces"
            className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-white"
          />
        </div>
      )}
    </div>
  );
};

// Tolerations Editor
const TolerationsEditor: React.FC<{
  tolerations: any[];
  onUpdate: (tolerations: any[]) => void;
}> = ({ tolerations, onUpdate }) => {
  const addToleration = () => {
    onUpdate([...tolerations, { key: '', operator: 'Equal', value: '', effect: 'NoSchedule' }]);
  };

  return (
    <div className="space-y-3">
      {tolerations.length === 0 ? (
        <div className="text-center py-4 text-slate-500">
          <Shield size={24} className="mx-auto mb-2 opacity-50" />
          <p className="text-sm">No tolerations defined</p>
        </div>
      ) : (
        tolerations.map((tol, i) => (
          <div key={i} className="flex flex-wrap gap-2 items-center bg-slate-800/50 p-3 rounded-lg border border-slate-700">
            <input
              type="text"
              value={tol.key || ''}
              onChange={(e) => {
                const newTol = [...tolerations];
                newTol[i] = { ...tol, key: e.target.value };
                onUpdate(newTol);
              }}
              placeholder="Key"
              className="w-32 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-white font-mono"
            />
            <select
              value={tol.operator || 'Equal'}
              onChange={(e) => {
                const newTol = [...tolerations];
                newTol[i] = { ...tol, operator: e.target.value };
                onUpdate(newTol);
              }}
              className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-white"
            >
              <option value="Equal">Equal</option>
              <option value="Exists">Exists</option>
            </select>
            {tol.operator !== 'Exists' && (
              <input
                type="text"
                value={tol.value || ''}
                onChange={(e) => {
                  const newTol = [...tolerations];
                  newTol[i] = { ...tol, value: e.target.value };
                  onUpdate(newTol);
                }}
                placeholder="Value"
                className="w-32 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-white font-mono"
              />
            )}
            <select
              value={tol.effect || ''}
              onChange={(e) => {
                const newTol = [...tolerations];
                newTol[i] = { ...tol, effect: e.target.value || undefined };
                onUpdate(newTol);
              }}
              className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-white"
            >
              <option value="">All Effects</option>
              <option value="NoSchedule">NoSchedule</option>
              <option value="PreferNoSchedule">PreferNoSchedule</option>
              <option value="NoExecute">NoExecute</option>
            </select>
            {tol.effect === 'NoExecute' && (
              <input
                type="number"
                value={tol.tolerationSeconds || ''}
                onChange={(e) => {
                  const newTol = [...tolerations];
                  newTol[i] = { ...tol, tolerationSeconds: e.target.value ? parseInt(e.target.value) : undefined };
                  onUpdate(newTol);
                }}
                placeholder="Seconds"
                className="w-20 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-white"
              />
            )}
            <button
              onClick={() => onUpdate(tolerations.filter((_, idx) => idx !== i))}
              className="ml-auto text-red-400 hover:text-red-300"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))
      )}
      <button
        onClick={addToleration}
        className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300"
      >
        <Plus size={14} /> Add Toleration
      </button>
    </div>
  );
};

// Topology Spread Constraints Editor
const TopologySpreadEditor: React.FC<{
  constraints: any[];
  onUpdate: (constraints: any[]) => void;
}> = ({ constraints, onUpdate }) => {
  const addConstraint = () => {
    onUpdate([...constraints, {
      maxSkew: 1,
      topologyKey: 'kubernetes.io/hostname',
      whenUnsatisfiable: 'DoNotSchedule',
      labelSelector: { matchLabels: {} }
    }]);
  };

  return (
    <div className="space-y-3">
      {constraints.length === 0 ? (
        <div className="text-center py-4 text-slate-500">
          <Grid3X3 size={24} className="mx-auto mb-2 opacity-50" />
          <p className="text-sm">No topology spread constraints</p>
        </div>
      ) : (
        constraints.map((constraint, i) => (
          <div key={i} className="bg-slate-800/50 rounded-lg p-4 border border-slate-700 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-300">Constraint {i + 1}</span>
              <button
                onClick={() => onUpdate(constraints.filter((_, idx) => idx !== i))}
                className="text-red-400 hover:text-red-300"
              >
                <Trash2 size={14} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Topology Key</label>
                <input
                  type="text"
                  value={constraint.topologyKey || ''}
                  onChange={(e) => {
                    const newC = [...constraints];
                    newC[i] = { ...constraint, topologyKey: e.target.value };
                    onUpdate(newC);
                  }}
                  placeholder="kubernetes.io/hostname"
                  className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-white font-mono"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Max Skew</label>
                <input
                  type="number"
                  min="1"
                  value={constraint.maxSkew || 1}
                  onChange={(e) => {
                    const newC = [...constraints];
                    newC[i] = { ...constraint, maxSkew: parseInt(e.target.value) || 1 };
                    onUpdate(newC);
                  }}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-white"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">When Unsatisfiable</label>
              <select
                value={constraint.whenUnsatisfiable || 'DoNotSchedule'}
                onChange={(e) => {
                  const newC = [...constraints];
                  newC[i] = { ...constraint, whenUnsatisfiable: e.target.value };
                  onUpdate(newC);
                }}
                className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-white"
              >
                <option value="DoNotSchedule">DoNotSchedule</option>
                <option value="ScheduleAnyway">ScheduleAnyway</option>
              </select>
            </div>
          </div>
        ))
      )}
      <button
        onClick={addConstraint}
        className="flex items-center gap-1 text-xs text-pink-400 hover:text-pink-300"
      >
        <Plus size={14} /> Add Constraint
      </button>
    </div>
  );
};
