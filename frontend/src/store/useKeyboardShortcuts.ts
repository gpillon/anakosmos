import { useEffect } from 'react';
import { useSettingsStore } from './useSettingsStore';

export const useKeyboardShortcuts = () => {
  const setSelectedResourceId = useSettingsStore(state => state.setSelectedResourceId);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.key) {
        case 'Escape':
          setSelectedResourceId(null);
          break;
        case '/': {
          e.preventDefault();
          const searchInput = document.querySelector('input[type="text"]') as HTMLInputElement;
          searchInput?.focus();
          break;
        }
        // View modes removed from shortcuts as they are now filter presets
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setSelectedResourceId]);
};
