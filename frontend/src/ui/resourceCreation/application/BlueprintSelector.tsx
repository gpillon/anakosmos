import React, { useState } from 'react';
import { 
  Globe, 
  Server, 
  Database, 
  Clock, 
  Box,
  Check,
  Sparkles,
  ChevronDown,
  ChevronRight,
  Pencil
} from 'lucide-react';
import { clsx } from 'clsx';
import type { Blueprint } from '../../../store/useApplicationDraftStore';
import { BLUEPRINTS } from './blueprints';

// Map icon names to components
const ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  Globe,
  Server,
  Database,
  Clock,
  Box,
  Pencil,
};

interface BlueprintSelectorProps {
  selectedId: string | null;
  isCustomized: boolean;
  onSelect: (blueprint: Blueprint) => void;
}

export const BlueprintSelector: React.FC<BlueprintSelectorProps> = ({
  selectedId,
  isCustomized,
  onSelect,
}) => {
  // Start collapsed if a blueprint is already selected
  const [isExpanded, setIsExpanded] = useState(!selectedId);
  
  // Get selected blueprint info
  const selectedBlueprint = selectedId ? BLUEPRINTS.find(b => b.id === selectedId) : null;
  const SelectedIcon = selectedBlueprint ? (ICON_MAP[selectedBlueprint.icon] || Box) : null;
  
  return (
    <div className="space-y-2">
      {/* Header - always visible, clickable to expand/collapse */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between text-left group"
      >
        <div className="flex items-center gap-2 text-sm">
          <Sparkles size={16} className="text-amber-400" />
          <span className="font-medium text-slate-300">Blueprint</span>
          
          {/* Current selection badge */}
          {(selectedId || isCustomized) && (
            <span className={clsx(
              'flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs',
              isCustomized
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
            )}>
              {isCustomized ? (
                <>
                  <Pencil size={10} />
                  Custom
                </>
              ) : (
                <>
                  {SelectedIcon && <SelectedIcon size={10} />}
                  {selectedBlueprint?.name}
                </>
              )}
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {!isExpanded && (
            <span className="text-xs text-slate-500 group-hover:text-slate-400 transition-colors">
              Click to change
            </span>
          )}
          {isExpanded ? (
            <ChevronDown size={16} className="text-slate-500" />
          ) : (
            <ChevronRight size={16} className="text-slate-500" />
          )}
        </div>
      </button>
      
      {/* Blueprint grid - collapsible */}
      {isExpanded && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-2">
          {/* Custom blueprint (only visible when customized) */}
          {isCustomized && (
            <div
              className={clsx(
                'relative flex flex-col items-center p-3 rounded-xl border text-center',
                'bg-amber-500/10 border-amber-500/30 cursor-default'
              )}
            >
              <div className="absolute top-1.5 right-1.5 p-0.5 rounded-full bg-amber-500 text-white">
                <Check size={8} />
              </div>
              <div className="p-2 rounded-lg mb-2 bg-amber-500/20 text-amber-400">
                <Pencil size={16} />
              </div>
              <h4 className="font-medium text-xs text-amber-200">Custom</h4>
              <p className="text-[10px] text-slate-500 mt-0.5">Modified</p>
            </div>
          )}
          
          {/* Standard blueprints */}
          {BLUEPRINTS.map((blueprint) => {
            const Icon = ICON_MAP[blueprint.icon] || Box;
            const isSelected = selectedId === blueprint.id && !isCustomized;
            
            return (
              <button
                key={blueprint.id}
                onClick={() => {
                  onSelect(blueprint);
                  setIsExpanded(false); // Collapse after selection
                }}
                className={clsx(
                  'relative flex flex-col items-center p-3 rounded-xl border text-center transition-all',
                  'hover:scale-[1.02] active:scale-[0.98]',
                  isSelected
                    ? 'bg-purple-500/10 border-purple-500/50'
                    : 'bg-slate-900/50 border-slate-700/50 hover:border-slate-600 hover:bg-slate-800/50'
                )}
              >
                {isSelected && (
                  <div className="absolute top-1.5 right-1.5 p-0.5 rounded-full bg-purple-500 text-white">
                    <Check size={8} />
                  </div>
                )}
                
                <div className={clsx(
                  'p-2 rounded-lg mb-2',
                  isSelected
                    ? 'bg-purple-500/20 text-purple-400'
                    : 'bg-slate-800 text-slate-400'
                )}>
                  <Icon size={16} />
                </div>
                
                <h4 className={clsx(
                  'font-medium text-xs',
                  isSelected ? 'text-purple-200' : 'text-slate-200'
                )}>
                  {blueprint.name}
                </h4>
                <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">
                  {blueprint.description}
                </p>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
