import { create } from 'zustand';

export interface TerminalSession {
  id: string;
  type: 'shell' | 'logs';
  podId: string;
  podName: string;
  namespace?: string;
  containerName?: string;
}

interface TerminalStore {
  isOpen: boolean;
  sessions: TerminalSession[];
  activeSessionId: string | null;
  
  openTerminal: (podId: string, podName: string, namespace: string, type: 'shell' | 'logs') => void;
  closeTerminal: () => void;
  closeSession: (id: string) => void;
  setActiveSession: (id: string) => void;
}

export const useTerminalStore = create<TerminalStore>((set) => ({
  isOpen: false,
  sessions: [],
  activeSessionId: null,

  openTerminal: (podId, podName, namespace, type) => set((state) => {
    // Check if session already exists
    const existingSession = state.sessions.find(
      s => s.podId === podId && s.type === type
    );

    if (existingSession) {
      return {
        isOpen: true,
        activeSessionId: existingSession.id
      };
    }

    const newSession: TerminalSession = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      podId,
      podName,
      namespace
    };

    return {
      isOpen: true,
      sessions: [...state.sessions, newSession],
      activeSessionId: newSession.id
    };
  }),

  closeTerminal: () => set({ isOpen: false }),

  closeSession: (id) => set((state) => {
    const newSessions = state.sessions.filter(s => s.id !== id);
    let newActiveId = state.activeSessionId;

    if (state.activeSessionId === id) {
      newActiveId = newSessions.length > 0 ? newSessions[newSessions.length - 1].id : null;
    }

    return {
      sessions: newSessions,
      activeSessionId: newActiveId,
      isOpen: newSessions.length > 0
    };
  }),

  setActiveSession: (id) => set({ activeSessionId: id }),
}));
