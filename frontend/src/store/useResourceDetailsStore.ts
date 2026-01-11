import { create } from 'zustand';

interface ResourceDetailsState {
  isOpen: boolean;
  resourceId: string | null; // Only store the ID, not the full resource
  activeTab: string;
  openDetails: (resourceId: string) => void;
  closeDetails: () => void;
  setActiveTab: (tabId: string) => void;
}

export const useResourceDetailsStore = create<ResourceDetailsState>((set) => ({
  isOpen: false,
  resourceId: null,
  activeTab: 'overview', // default tab
  openDetails: (resourceId) => set({ isOpen: true, resourceId, activeTab: 'overview' }),
  closeDetails: () => set({ isOpen: false, resourceId: null }),
  setActiveTab: (tabId) => set({ activeTab: tabId }),
}));
