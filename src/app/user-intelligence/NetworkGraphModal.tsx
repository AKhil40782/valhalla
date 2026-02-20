'use client';

import { useEffect, useRef, useState } from 'react';
import { X, Maximize2, ZoomIn, ZoomOut } from 'lucide-react';
import { getUserNetwork } from './actions';

interface NetworkGraphModalProps {
    profileId: string;
    userName: string;
    onClose: () => void;
}

export function NetworkGraphModal({ profileId, userName, onClose }: NetworkGraphModalProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const cyRef = useRef<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;

        async function loadGraph() {
            const { elements } = await getUserNetwork(profileId);
            if (!mounted || !containerRef.current) return;

            // Dynamically import cytoscape
            const cytoscape = (await import('cytoscape')).default;

            const cy = cytoscape({
                container: containerRef.current,
                elements: elements,
                style: [
                    {
                        selector: 'node',
                        style: {
                            'background-color': 'data(color)',
                            'label': 'data(label)',
                            'color': '#e2e8f0',
                            'font-size': '11px',
                            'text-valign': 'bottom',
                            'text-halign': 'center',
                            'text-margin-y': 8,
                            'width': 'mapData(risk_score, 0, 100, 25, 55)',
                            'height': 'mapData(risk_score, 0, 100, 25, 55)',
                            'border-width': 2,
                            'border-color': '#0f172a',
                            'text-outline-color': '#0f172a',
                            'text-outline-width': 2,
                        },
                    },
                    {
                        selector: 'node[?isCenter]',
                        style: {
                            'border-width': 3,
                            'border-color': '#06b6d4',
                            'font-size': '13px',
                            'font-weight': 'bold',
                            'text-outline-width': 3,
                        } as any,
                    },
                    {
                        selector: 'edge',
                        style: {
                            'width': 'data(width)',
                            'line-color': '#475569',
                            'curve-style': 'bezier',
                            'label': 'data(label)',
                            'font-size': '8px',
                            'color': '#64748b',
                            'text-rotation': 'autorotate',
                            'text-outline-color': '#0f172a',
                            'text-outline-width': 2,
                            'opacity': 0.7,
                        },
                    },
                    {
                        selector: 'edge[type = "shared_device"]',
                        style: { 'line-color': '#ef4444', 'line-style': 'solid' },
                    },
                    {
                        selector: 'edge[type = "shared_ip"]',
                        style: { 'line-color': '#f59e0b', 'line-style': 'dashed' },
                    },
                    {
                        selector: 'edge[type = "timing_correlation"]',
                        style: { 'line-color': '#8b5cf6', 'line-style': 'dotted' },
                    },
                    {
                        selector: 'edge[type = "transaction_pattern"]',
                        style: { 'line-color': '#06b6d4', 'line-style': 'solid' },
                    },
                ],
                layout: {
                    name: 'cose',
                    padding: 50,
                    nodeRepulsion: () => 8000,
                    idealEdgeLength: () => 120,
                    gravity: 0.25,
                    animate: true,
                    animationDuration: 800,
                } as any,
                minZoom: 0.3,
                maxZoom: 3,
            });

            cyRef.current = cy;
            setLoading(false);
        }

        loadGraph();
        return () => { mounted = false; cyRef.current?.destroy(); };
    }, [profileId]);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="bg-slate-950 border border-slate-700 rounded-2xl w-[90vw] h-[80vh] max-w-[1200px] flex flex-col shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
                    <div>
                        <h2 className="text-lg font-bold text-slate-100">🔗 Network Graph — {userName}</h2>
                        <p className="text-xs text-slate-500 mt-0.5">Relationship network with 2nd-degree connections</p>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* Legend */}
                        <div className="flex items-center gap-3 mr-4 text-[10px]">
                            <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-red-500 inline-block rounded" /> Shared Device</span>
                            <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-yellow-500 inline-block rounded border-dashed" /> Shared IP</span>
                            <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-purple-500 inline-block rounded" /> Timing</span>
                            <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-cyan-500 inline-block rounded" /> Transaction</span>
                        </div>
                        <button onClick={() => cyRef.current?.fit(undefined, 50)} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 transition-colors">
                            <Maximize2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => cyRef.current?.zoom(cyRef.current.zoom() * 1.3)} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 transition-colors">
                            <ZoomIn className="w-4 h-4" />
                        </button>
                        <button onClick={() => cyRef.current?.zoom(cyRef.current.zoom() * 0.7)} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 transition-colors">
                            <ZoomOut className="w-4 h-4" />
                        </button>
                        <button onClick={onClose} className="p-2 rounded-lg bg-red-950/50 hover:bg-red-900/50 text-red-400 transition-colors">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Graph container */}
                <div className="flex-1 relative bg-slate-900/30">
                    {loading && (
                        <div className="absolute inset-0 flex items-center justify-center text-slate-500 z-10">
                            <div className="flex flex-col items-center gap-3">
                                <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                                <span className="text-sm">Building network graph...</span>
                            </div>
                        </div>
                    )}
                    <div ref={containerRef} className="w-full h-full" />
                </div>
            </div>
        </div>
    );
}
