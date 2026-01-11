import { ClusterScene } from './scene/ClusterScene';
import { HUD } from './ui/HUD';
import { Sidebar } from './ui/Sidebar';
import { Onboarding } from './ui/Onboarding';
import { ViewSelector } from './ui/ViewSelector';
import { ConnectionScreen } from './ui/ConnectionScreen';
import { ResourceLegend } from './ui/ResourceLegend';
import { useKeyboardShortcuts } from './store/useKeyboardShortcuts';
import { useClusterStore } from './store/useClusterStore';

import { TerminalWindow } from './ui/TerminalWindow';
import { ResourceDetailsWindow } from './ui/ResourceDetailsWindow';

function App() {
  useKeyboardShortcuts();
  const { isConnected } = useClusterStore();

  if (!isConnected) {
    return <ConnectionScreen />;
  }

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-900 text-white font-sans selection:bg-blue-500/30">
      <ClusterScene />
      <HUD />
      <ViewSelector />
      <ResourceLegend />
      <Sidebar />
      <TerminalWindow />
      <ResourceDetailsWindow />
      <Onboarding />
    </div>
  );
}

export default App;
