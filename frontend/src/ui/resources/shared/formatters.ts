/**
 * Utility functions for formatting Kubernetes resource data
 */

/**
 * Format a date string to locale string
 */
export function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleString();
  } catch {
    return dateStr;
  }
}

/**
 * Format a date to relative age (e.g., "5d", "2h", "30m")
 */
export function formatAge(dateStr: string | undefined): string {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    
    const seconds = Math.floor(diffMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d`;
    if (hours > 0) return `${hours}h`;
    if (minutes > 0) return `${minutes}m`;
    return `${seconds}s`;
  } catch {
    return dateStr;
  }
}

/**
 * Format bytes to human readable (e.g., "128Mi", "1Gi")
 */
export function formatBytes(bytes: number | string | undefined): string {
  if (bytes === undefined || bytes === null) return '-';
  
  // If it's already a K8s format string (e.g., "128Mi"), return as is
  if (typeof bytes === 'string') {
    if (/^\d+[KMGTPE]i?$/.test(bytes) || /^\d+$/.test(bytes)) {
      return bytes;
    }
    const num = parseInt(bytes, 10);
    if (isNaN(num)) return bytes;
    bytes = num;
  }
  
  const units = ['B', 'Ki', 'Mi', 'Gi', 'Ti', 'Pi'];
  let unitIndex = 0;
  let value = bytes as number;
  
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  
  return `${value.toFixed(value < 10 ? 1 : 0)}${units[unitIndex]}`;
}

/**
 * Format millicores to human readable (e.g., "100m", "1.5")
 */
export function formatMillicores(cpu: number | string | undefined): string {
  if (cpu === undefined || cpu === null) return '-';
  
  // If it's already a K8s format string (e.g., "100m", "1"), return as is
  if (typeof cpu === 'string') {
    return cpu;
  }
  
  if (cpu >= 1000) {
    return `${(cpu / 1000).toFixed(1)}`;
  }
  return `${cpu}m`;
}

/**
 * Parse K8s CPU string to millicores
 */
export function parseCpuToMillicores(cpu: string | undefined): number {
  if (!cpu) return 0;
  if (cpu.endsWith('m')) {
    return parseInt(cpu.slice(0, -1), 10);
  }
  return parseFloat(cpu) * 1000;
}

/**
 * Parse K8s memory string to bytes
 */
export function parseMemoryToBytes(memory: string | undefined): number {
  if (!memory) return 0;
  
  const units: Record<string, number> = {
    'Ki': 1024,
    'Mi': 1024 * 1024,
    'Gi': 1024 * 1024 * 1024,
    'Ti': 1024 * 1024 * 1024 * 1024,
    'K': 1000,
    'M': 1000 * 1000,
    'G': 1000 * 1000 * 1000,
    'T': 1000 * 1000 * 1000 * 1000,
  };
  
  for (const [unit, multiplier] of Object.entries(units)) {
    if (memory.endsWith(unit)) {
      return parseFloat(memory.slice(0, -unit.length)) * multiplier;
    }
  }
  
  return parseFloat(memory) || 0;
}

/**
 * Get health status color classes
 */
export function getHealthColorClasses(health: 'healthy' | 'warning' | 'error' | 'unknown'): {
  bg: string;
  border: string;
  text: string;
  icon: string;
} {
  switch (health) {
    case 'healthy':
      return {
        bg: 'bg-emerald-950/30',
        border: 'border-emerald-800/50',
        text: 'text-emerald-400',
        icon: 'bg-emerald-500/20 text-emerald-400'
      };
    case 'warning':
      return {
        bg: 'bg-amber-950/30',
        border: 'border-amber-800/50',
        text: 'text-amber-400',
        icon: 'bg-amber-500/20 text-amber-400'
      };
    case 'error':
      return {
        bg: 'bg-red-950/30',
        border: 'border-red-800/50',
        text: 'text-red-400',
        icon: 'bg-red-500/20 text-red-400'
      };
    default:
      return {
        bg: 'bg-slate-950/30',
        border: 'border-slate-800/50',
        text: 'text-slate-400',
        icon: 'bg-slate-500/20 text-slate-400'
      };
  }
}

/**
 * Get pod phase color
 */
export function getPodPhaseColor(phase: string | undefined): string {
  switch (phase) {
    case 'Running':
      return 'text-emerald-400';
    case 'Succeeded':
      return 'text-blue-400';
    case 'Pending':
      return 'text-amber-400';
    case 'Failed':
      return 'text-red-400';
    case 'Unknown':
    default:
      return 'text-slate-400';
  }
}

/**
 * Get container state info
 */
export function getContainerStateInfo(status: { running?: object; waiting?: { reason?: string }; terminated?: { reason?: string; exitCode?: number } } | undefined): {
  state: string;
  color: string;
  detail?: string;
} {
  if (!status) return { state: 'Unknown', color: 'text-slate-400' };
  
  if (status.running) {
    return { state: 'Running', color: 'text-emerald-400' };
  }
  if (status.waiting) {
    return { 
      state: 'Waiting', 
      color: 'text-amber-400',
      detail: status.waiting.reason 
    };
  }
  if (status.terminated) {
    const isSuccess = status.terminated.exitCode === 0;
    return {
      state: 'Terminated',
      color: isSuccess ? 'text-blue-400' : 'text-red-400',
      detail: status.terminated.reason || `Exit: ${status.terminated.exitCode}`
    };
  }
  
  return { state: 'Unknown', color: 'text-slate-400' };
}
