import React, { useEffect, useRef, useState } from 'react';
import { useTerminalStore } from '../store/useTerminalStore';
import type { TerminalSession } from '../store/useTerminalStore';
import { useClusterStore } from '../store/useClusterStore';
import { X, Terminal as TerminalIcon, FileText, Maximize2, Minimize2, AlertTriangle } from 'lucide-react';
import { clsx } from 'clsx';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

export const TerminalWindow: React.FC = () => {
  const { 
    isOpen, 
    sessions, 
    activeSessionId, 
    closeTerminal, 
    closeSession, 
    setActiveSession,
  } = useTerminalStore();

  const [isMinimized, setIsMinimized] = React.useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  const handleCloseRequest = () => {
    if (sessions.length > 0 && isMinimized) {
        setShowCloseConfirm(true);
    } else {
        closeTerminal();
    }
  };

  const confirmClose = () => {
    setShowCloseConfirm(false);
    closeTerminal();
  };

  if (!isOpen) return null;

  return (
    <>
        <div className={clsx(
        "fixed z-50 bg-slate-950 border border-slate-700 shadow-2xl transition-all duration-300 flex flex-col font-mono text-sm",
        isMinimized 
            ? "bottom-0 right-0 w-96 h-12 rounded-t-lg overflow-hidden" 
            : "inset-x-10 bottom-10 top-20 rounded-lg"
        )}>
        {/* Header / Tab Bar */}
        <div className="flex items-center bg-slate-900 border-b border-slate-800 h-12 shrink-0">
            <div className="flex-1 flex overflow-x-auto h-full">
            {sessions.map(session => (
                <div 
                key={session.id}
                onClick={() => setActiveSession(session.id)}
                className={clsx(
                    "flex items-center gap-2 px-4 cursor-pointer border-r border-slate-800 min-w-[150px] max-w-[200px] hover:bg-slate-800 transition-colors group h-full relative",
                    activeSessionId === session.id ? "bg-slate-950 text-blue-400 border-t-2 border-t-blue-500" : "text-slate-500 border-t-2 border-t-transparent bg-slate-900"
                )}
                >
                {session.type === 'shell' ? <TerminalIcon size={14} /> : <FileText size={14} />}
                <span className="truncate text-xs font-medium flex-1">{session.podName}</span>
                <button 
                    onClick={(e) => { e.stopPropagation(); closeSession(session.id); }}
                    className="opacity-0 group-hover:opacity-100 hover:text-red-400 p-1 rounded hover:bg-slate-700 transition-all"
                >
                    <X size={12} />
                </button>
                </div>
            ))}
            </div>
            
            <div className="flex items-center gap-1 px-2 border-l border-slate-800 bg-slate-900 h-full">
            <button 
                onClick={() => setIsMinimized(!isMinimized)}
                className="p-2 hover:bg-slate-800 text-slate-400 rounded"
            >
                {isMinimized ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
            </button>
            <button 
                onClick={handleCloseRequest}
                className="p-2 hover:bg-red-900/50 text-slate-400 hover:text-red-400 rounded"
            >
                <X size={16} />
            </button>
            </div>
        </div>

        {/* Content */}
        <div className={clsx("flex-1 relative bg-black", isMinimized ? "hidden" : "block")}>
            {sessions.map(session => (
                <div 
                    key={session.id} 
                    className={clsx("absolute inset-0", activeSessionId === session.id ? "z-10 visible" : "z-0 invisible")}
                >
                    <SessionContent session={session} isActive={activeSessionId === session.id} isMinimized={isMinimized} />
                </div>
            ))}
        </div>
        </div>

        {/* Confirmation Modal */}
        {showCloseConfirm && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm">
                <div className="bg-slate-900 border border-slate-700 rounded-lg p-6 shadow-2xl max-w-sm w-full mx-4">
                    <div className="flex items-center gap-3 text-amber-500 mb-4">
                        <AlertTriangle size={24} />
                        <h3 className="text-lg font-bold text-white">Close all terminals?</h3>
                    </div>
                    <p className="text-slate-400 text-sm mb-6 leading-relaxed">
                        You have {sessions.length} active terminal session{sessions.length > 1 ? 's' : ''}. 
                        Closing the window will terminate all connections.
                    </p>
                    <div className="flex justify-end gap-3">
                        <button 
                            onClick={() => setShowCloseConfirm(false)}
                            className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 rounded transition-colors"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={confirmClose}
                            className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-500 text-white rounded transition-colors shadow-lg shadow-red-900/20"
                        >
                            Close All
                        </button>
                    </div>
                </div>
            </div>
        )}
    </>
  );
};

const SessionContent: React.FC<{ session: TerminalSession, isActive: boolean, isMinimized: boolean }> = ({ session, isActive, isMinimized }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader | null>(null);
  const { client } = useClusterStore();

  useEffect(() => {
    if (!containerRef.current) return;

    // Initialize Terminal
    const term = new Terminal({
      cursorBlink: session.type === 'shell',
      fontSize: 12,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#000000',
        foreground: '#e2e8f0',
        cursor: '#3b82f6',
        selectionBackground: 'rgba(59, 130, 246, 0.3)',
      },
      convertEol: session.type === 'logs', // Logs need this for proper newlines
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);
    fitAddon.fit();

    terminalRef.current = term;
    fitAddonRef.current = fitAddon;

    term.writeln(`\x1b[34m→\x1b[0m Connecting to ${session.podName} (${session.type})...`);

    // Connect
    if (session.type === 'shell') {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host; // e.g. localhost:5173 or proxy
        
        // Pass target connection info if available
        const params = new URLSearchParams();
        params.append('namespace', session.namespace || 'default');
        params.append('pod', session.podName);
        params.append('container', session.containerName || '');
        
        // If we have a custom connection, pass it to the backend so it can connect to the right cluster
        // The backend exec handler needs to know WHERE to connect if it's not the default local kubeconfig
        if (client?.mode === 'custom' || client?.mode === 'proxy') {
            if (client.baseUrl) params.append('target', client.baseUrl);
            if (client.token) params.append('token', client.token);
        }

        const url = `${protocol}//${host}/api/sock/exec?${params.toString()}`;
        
        const ws = new WebSocket(url);
        wsRef.current = ws;

        ws.onopen = () => {
            term.writeln("\r\n\x1b[32m✔ Connected\x1b[0m\r\n");
            term.focus(); 
        };

        ws.onmessage = (ev) => {
            term.write(ev.data);
        };

        ws.onclose = () => {
            term.writeln("\r\n\x1b[31m✖ Connection closed\x1b[0m");
        };

        ws.onerror = () => {
            term.writeln("\r\n\x1b[31m✖ Connection error\x1b[0m");
        };

        term.onData(data => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(data);
            }
        });

    } else if (session.type === 'logs') {
        // HTTP Streaming for logs
        // We use the client to construct the URL, which handles proxy headers
        // But for fetch streaming here, we need to manually replicate what KubeClient does
        
        let url = `/api/api/v1/namespaces/${session.namespace}/pods/${session.podName}/log?follow=true&tailLines=100`;
        const headers: Record<string, string> = {};

        if (client?.mode === 'proxy' || client?.mode === 'custom') {
            url = `/proxy/api/v1/namespaces/${session.namespace}/pods/${session.podName}/log?follow=true&tailLines=100`;
            if (client.baseUrl) headers['X-Kube-Target'] = client.baseUrl;
            if (client.token) headers['Authorization'] = `Bearer ${client.token}`;
        }
        
        const abortController = new AbortController();
        
        fetch(url, { 
            signal: abortController.signal,
            headers
        })
            .then(async (response) => {
                if (!response.ok || !response.body) {
                    term.writeln(`\r\n\x1b[31m✖ Failed to fetch logs: ${response.statusText}\x1b[0m`);
                    return;
                }
                term.writeln("\r\n\x1b[32m✔ Connected to log stream\x1b[0m\r\n");

                const reader = response.body.getReader();
                readerRef.current = reader;
                const decoder = new TextDecoder();

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    // Fix line endings for xterm if needed, but convertEol handles \n -> \r\n
                    term.write(decoder.decode(value));
                }
                term.writeln("\r\n\x1b[33m⚠ Log stream ended\x1b[0m");
            })
            .catch(err => {
                if (err.name !== 'AbortError') {
                    term.writeln(`\r\n\x1b[31m✖ Log stream error: ${err}\x1b[0m`);
                }
            });
    }

    // Resize observer
    const resizeObserver = new ResizeObserver(() => {
        fitAddon.fit();
    });
    resizeObserver.observe(containerRef.current);

    return () => {
        // Cleanup
        resizeObserver.disconnect();
        term.dispose();
        if (wsRef.current) {
            wsRef.current.close();
        }
        if (readerRef.current) {
            readerRef.current.cancel();
        }
    };
  }, []); // Only on mount

  // Refit when active/visible
  useEffect(() => {
    if (isActive && fitAddonRef.current) {
        requestAnimationFrame(() => {
            fitAddonRef.current?.fit();
            terminalRef.current?.focus();
        });
    }
  }, [isActive, isMinimized]); // Also when restoring from minimized

  return <div ref={containerRef} className="w-full h-full" />;
};
