import React, { useState } from 'react';
import { X, Plus, Search } from 'lucide-react';
import { clsx } from 'clsx';
import { 
  CREATABLE_KINDS, 
  CREATABLE_KINDS_BY_CATEGORY,
  CATEGORY_CONFIG,
  type CreatableKindConfig 
} from '../../../config/resourceKinds';

interface AddResourceDialogProps {
  onAdd: (kind: string, spec: Record<string, unknown>) => void;
  onClose: () => void;
}

export const AddResourceDialog: React.FC<AddResourceDialogProps> = ({
  onAdd,
  onClose,
}) => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  
  // Filter kinds based on search
  const filteredKinds = search.trim()
    ? CREATABLE_KINDS.filter(k => 
        k.kind.toLowerCase().includes(search.toLowerCase()) ||
        k.label.toLowerCase().includes(search.toLowerCase()) ||
        k.description.toLowerCase().includes(search.toLowerCase())
      )
    : selectedCategory
      ? CREATABLE_KINDS_BY_CATEGORY[selectedCategory as keyof typeof CREATABLE_KINDS_BY_CATEGORY] || []
      : CREATABLE_KINDS;
  
  const handleSelect = (kind: CreatableKindConfig) => {
    const defaultSpec = kind.defaultTemplate();
    onAdd(kind.kind, defaultSpec);
    onClose();
  };
  
  // Handle escape key
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);
  
  // Get categories that have creatable kinds
  const availableCategories = CATEGORY_CONFIG.filter(cat => 
    CREATABLE_KINDS_BY_CATEGORY[cat.id]?.length > 0
  );
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Dialog */}
      <div className="relative w-full max-w-lg mx-4 flex flex-col bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Plus size={18} className="text-purple-400" />
            <h2 className="text-base font-semibold text-white">
              Add Resource
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        
        {/* Search */}
        <div className="px-4 py-3 border-b border-slate-800/50">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search resources..."
              autoFocus
              className="w-full pl-9 pr-4 py-2 text-sm bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:border-purple-500"
            />
          </div>
        </div>
        
        {/* Category tabs */}
        {!search && (
          <div className="flex items-center gap-1 px-4 py-2 border-b border-slate-800/50 overflow-x-auto">
            <button
              onClick={() => setSelectedCategory(null)}
              className={clsx(
                'px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap',
                !selectedCategory
                  ? 'bg-purple-500/20 text-purple-300'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              )}
            >
              All
            </button>
            {availableCategories.map((cat) => {
              const Icon = cat.icon;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={clsx(
                    'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap',
                    selectedCategory === cat.id
                      ? 'bg-purple-500/20 text-purple-300'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  )}
                >
                  <Icon size={12} />
                  {cat.label}
                </button>
              );
            })}
          </div>
        )}
        
        {/* Resource list */}
        <div className="flex-1 overflow-y-auto max-h-[50vh] p-3">
          {filteredKinds.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Search size={24} className="text-slate-600 mb-2" />
              <p className="text-sm text-slate-400">No resources found</p>
              <p className="text-xs text-slate-500">Try a different search term</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2">
              {filteredKinds.map((kind) => {
                const Icon = kind.icon;
                return (
                  <button
                    key={kind.kind}
                    onClick={() => handleSelect(kind)}
                    className={clsx(
                      'flex items-center gap-3 p-3 rounded-xl text-left transition-all',
                      'bg-slate-800/30 border border-transparent',
                      'hover:bg-slate-800/70 hover:border-slate-700'
                    )}
                  >
                    <div 
                      className="p-2 rounded-lg shrink-0"
                      style={{ backgroundColor: `${kind.color}20` }}
                    >
                      <span style={{ color: kind.color }}>
                        <Icon size={18} />
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-200">
                          {kind.kind}
                        </span>
                        <span 
                          className="text-[10px] px-1.5 py-0.5 rounded"
                          style={{ backgroundColor: `${kind.color}20`, color: kind.color }}
                        >
                          {kind.category}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 truncate">
                        {kind.description}
                      </p>
                    </div>
                    <Plus size={16} className="text-slate-500" />
                  </button>
                );
              })}
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="px-4 py-3 border-t border-slate-800 bg-slate-900/80 text-xs text-slate-500">
          Select a resource type to add it to your application
        </div>
      </div>
    </div>
  );
};
