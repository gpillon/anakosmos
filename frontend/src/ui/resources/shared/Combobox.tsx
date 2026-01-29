import React, { useState, useRef, useEffect, useMemo, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search, X, Check } from 'lucide-react';
import { clsx } from 'clsx';

interface ComboboxProps {
  /** Current value */
  value: string;
  /** Callback when value changes */
  onChange: (value: string) => void;
  /** List of options */
  options: string[];
  /** Placeholder text */
  placeholder?: string;
  /** Allow custom values not in options */
  allowCustom?: boolean;
  /** Disabled state */
  disabled?: boolean;
  /** Size variant */
  size?: 'sm' | 'md';
  /** Optional icon to show before placeholder */
  icon?: React.ReactNode;
  /** Label for the dropdown header */
  label?: string;
  /** Show empty state message when no options */
  emptyMessage?: string;
}

/** Hook to get the position of a trigger element for portal-based dropdowns */
function useDropdownPosition(
  triggerRef: React.RefObject<HTMLElement | null>,
  isOpen: boolean
) {
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPosition({
      top: rect.bottom + window.scrollY + 4, // 4px gap
      left: rect.left + window.scrollX,
      width: rect.width,
    });
  }, [triggerRef]);

  useLayoutEffect(() => {
    if (!isOpen) return;
    updatePosition();

    // Update on scroll/resize
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isOpen, updatePosition]);

  return position;
}

export const Combobox: React.FC<ComboboxProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Select...',
  allowCustom = true,
  disabled = false,
  size = 'sm',
  icon,
  label,
  emptyMessage = 'No options available'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const position = useDropdownPosition(triggerRef, isOpen);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isOpen) return;
    
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        triggerRef.current && !triggerRef.current.contains(target) &&
        dropdownRef.current && !dropdownRef.current.contains(target)
      ) {
        setIsOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Focus input when opening
  useEffect(() => {
    if (isOpen && inputRef.current) {
      // Small delay to ensure portal is mounted
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [isOpen]);

  // Filter options based on search
  const filteredOptions = useMemo(() => {
    if (!search) return options;
    const lower = search.toLowerCase();
    return options.filter(opt => opt.toLowerCase().includes(lower));
  }, [options, search]);

  const handleSelect = (opt: string) => {
    onChange(opt);
    setIsOpen(false);
    setSearch('');
  };

  const handleCustomSubmit = () => {
    if (search.trim()) {
      onChange(search.trim());
    }
    setIsOpen(false);
    setSearch('');
  };

  const sizeClasses = {
    sm: 'px-2 py-1.5 text-xs',
    md: 'px-3 py-2 text-sm'
  };

  const dropdownSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm'
  };

  // Dropdown content rendered via portal
  const dropdownContent = isOpen && createPortal(
    <div
      ref={dropdownRef}
      style={{
        position: 'absolute',
        top: position.top,
        left: position.left,
        width: position.width,
        minWidth: 200,
      }}
      className={clsx(
        "z-[9999] bg-slate-800 border border-slate-700 rounded-lg shadow-2xl overflow-hidden",
        dropdownSizeClasses[size]
      )}
    >
      {/* Search / Custom Input */}
      <div className="p-2 border-b border-slate-700">
        <div className="relative">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                if (filteredOptions.length === 1) {
                  handleSelect(filteredOptions[0]);
                } else if (allowCustom && search.trim()) {
                  handleCustomSubmit();
                }
              }
              if (e.key === 'Escape') {
                setIsOpen(false);
                setSearch('');
              }
            }}
            placeholder={allowCustom ? "Search or type custom..." : "Search..."}
            className="w-full bg-slate-900 border border-slate-700 rounded pl-7 pr-2 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-blue-500"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Options List */}
      <div className="max-h-48 overflow-y-auto p-1 custom-scrollbar">
        {/* Custom value option */}
        {allowCustom && search.trim() && !options.includes(search.trim()) && (
          <button
            onClick={handleCustomSubmit}
            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-blue-600/20 rounded cursor-pointer text-left transition-colors text-blue-400"
          >
            <span className="text-xs bg-blue-900/30 px-1.5 py-0.5 rounded border border-blue-800/50">Custom</span>
            <span className="truncate font-mono">{search.trim()}</span>
          </button>
        )}

        {filteredOptions.length === 0 && !search.trim() ? (
          <div className="p-3 text-center text-slate-500">
            {emptyMessage}
          </div>
        ) : filteredOptions.length === 0 && search.trim() && !allowCustom ? (
          <div className="p-3 text-center text-slate-500">
            No matches found
          </div>
        ) : (
          filteredOptions.map(opt => (
            <button
              key={opt}
              onClick={() => handleSelect(opt)}
              className={clsx(
                "w-full flex items-center gap-2 px-3 py-2 rounded cursor-pointer text-left transition-colors",
                opt === value 
                  ? "bg-blue-600/20 text-blue-300" 
                  : "hover:bg-slate-700/50 text-slate-200"
              )}
            >
              <span className="flex-1 truncate font-mono">{opt}</span>
              {opt === value && <Check size={12} className="text-blue-400 shrink-0" />}
            </button>
          ))
        )}
      </div>

      {/* Footer hint */}
      {label && (
        <div className="px-3 py-2 border-t border-slate-700 text-[10px] text-slate-500">
          {label}
        </div>
      )}
    </div>,
    document.body
  );

  return (
    <div className="relative">
      {/* Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={clsx(
          "w-full flex items-center gap-2 bg-slate-800 border border-slate-700 rounded transition-colors text-left",
          sizeClasses[size],
          disabled 
            ? "opacity-50 cursor-not-allowed" 
            : "hover:border-slate-600 focus:outline-none focus:border-blue-500",
          isOpen && "border-blue-500"
        )}
      >
        {icon && <span className="text-slate-500 shrink-0">{icon}</span>}
        <span className={clsx("flex-1 truncate", value ? "text-white" : "text-slate-500")}>
          {value || placeholder}
        </span>
        <ChevronDown 
          size={size === 'sm' ? 12 : 14} 
          className={clsx(
            "text-slate-500 shrink-0 transition-transform",
            isOpen && "rotate-180"
          )} 
        />
      </button>

      {dropdownContent}
    </div>
  );
};

// Multi-select version
interface MultiComboboxProps {
  /** Current values */
  values: string[];
  /** Callback when values change */
  onChange: (values: string[]) => void;
  /** List of options */
  options: string[];
  /** Placeholder text */
  placeholder?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Size variant */
  size?: 'sm' | 'md';
  /** Label for the dropdown */
  label?: string;
}

export const MultiCombobox: React.FC<MultiComboboxProps> = ({
  values,
  onChange,
  options,
  placeholder = 'Select...',
  disabled = false,
  size = 'sm',
  label
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const position = useDropdownPosition(triggerRef, isOpen);

  useEffect(() => {
    if (!isOpen) return;
    
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        triggerRef.current && !triggerRef.current.contains(target) &&
        dropdownRef.current && !dropdownRef.current.contains(target)
      ) {
        setIsOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [isOpen]);

  const filteredOptions = useMemo(() => {
    if (!search) return options;
    const lower = search.toLowerCase();
    return options.filter(opt => opt.toLowerCase().includes(lower));
  }, [options, search]);

  const toggleOption = (opt: string) => {
    if (values.includes(opt)) {
      onChange(values.filter(v => v !== opt));
    } else {
      onChange([...values, opt]);
    }
  };

  const sizeClasses = {
    sm: 'px-2 py-1.5 text-xs',
    md: 'px-3 py-2 text-sm'
  };

  const dropdownContent = isOpen && createPortal(
    <div
      ref={dropdownRef}
      style={{
        position: 'absolute',
        top: position.top,
        left: position.left,
        width: position.width,
        minWidth: 200,
      }}
      className="z-[9999] bg-slate-800 border border-slate-700 rounded-lg shadow-2xl overflow-hidden"
    >
      <div className="p-2 border-b border-slate-700">
        <div className="relative">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setIsOpen(false);
                setSearch('');
              }
            }}
            placeholder="Search..."
            className="w-full bg-slate-900 border border-slate-700 rounded pl-7 pr-2 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      <div className="max-h-48 overflow-y-auto p-1 custom-scrollbar">
        {filteredOptions.length === 0 ? (
          <div className="p-3 text-center text-xs text-slate-500">No options</div>
        ) : (
          filteredOptions.map(opt => (
            <label key={opt} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-700/50 rounded cursor-pointer select-none transition-colors">
              <input
                type="checkbox"
                checked={values.includes(opt)}
                onChange={() => toggleOption(opt)}
                className="rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-offset-slate-800"
              />
              <span className="text-xs text-slate-200 truncate font-mono">{opt}</span>
            </label>
          ))
        )}
      </div>

      {label && (
        <div className="px-3 py-2 border-t border-slate-700 text-[10px] text-slate-500">{label}</div>
      )}
    </div>,
    document.body
  );

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={clsx(
          "w-full flex items-center gap-2 bg-slate-800 border border-slate-700 rounded transition-colors text-left",
          sizeClasses[size],
          disabled ? "opacity-50 cursor-not-allowed" : "hover:border-slate-600 focus:outline-none focus:border-blue-500",
          isOpen && "border-blue-500"
        )}
      >
        <span className={clsx("flex-1 truncate", values.length > 0 ? "text-white" : "text-slate-500")}>
          {values.length === 0 ? placeholder : `${values.length} selected`}
        </span>
        <ChevronDown size={size === 'sm' ? 12 : 14} className={clsx("text-slate-500 shrink-0 transition-transform", isOpen && "rotate-180")} />
      </button>

      {dropdownContent}
    </div>
  );
};
