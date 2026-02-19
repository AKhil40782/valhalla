'use client';

import React, { useEffect, useRef, useState } from 'react';
import cytoscape from 'cytoscape';
// @ts-ignore
import cola from 'cytoscape-cola';
import { Download } from 'lucide-react';

cytoscape.use(cola);

interface FraudGraphProps {
    elements: any[];
    onNodeSelect?: (nodeData: any) => void;
}

export function FraudGraph({ elements, onNodeSelect }: FraudGraphProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [selectedNode, setSelectedNode] = useState<any>(null);
    const [tooltip, setTooltip] = useState<{ x: number; y: number; data: any } | null>(null);

    const cyRef = useRef<cytoscape.Core | null>(null);

    useEffect(() => {
        if (!containerRef.current) return;

        let cy = cyRef.current;

        if (!cy) {
            cy = cytoscape({
                container: containerRef.current,
                style: [
                    {
                        selector: 'node',
                        style: {
                            'background-color': '#1e293b',
                            'label': 'data(label)',
                            'color': '#e2e8f0',
                            'font-size': '12px',
                            'font-weight': '600',
                            'text-valign': 'bottom',
                            'text-margin-y': 6,
                            'width': 35,
                            'height': 35,
                            'border-width': 2,
                            'border-color': '#475569',
                            'text-wrap': 'ellipsis',
                            'text-max-width': '80px',
                        }
                    },
                    {
                        selector: 'node[type="account"]',
                        style: {
                            'background-color': '#0f172a',
                            'border-color': '#06b6d4',
                            'shape': 'ellipse',
                        }
                    },
                    {
                        selector: 'node.high-risk',
                        style: {
                            'background-color': '#7f1d1d',
                            'border-color': '#ef4444',
                            'color': '#fca5a5',
                            'width': 45,
                            'height': 45,
                            'border-width': 3,
                        }
                    },
                    {
                        selector: 'node.medium-risk',
                        style: {
                            'background-color': '#78350f',
                            'border-color': '#f59e0b',
                            'color': '#fcd34d',
                            'width': 40,
                            'height': 40,
                        }
                    },
                    {
                        selector: 'node.critical-risk',
                        style: {
                            'background-color': '#450a0a',
                            'border-color': '#ff0000',
                            'width': 55,
                            'height': 55,
                            'border-width': 4,
                        } as any
                    },
                    {
                        selector: 'edge',
                        style: {
                            'width': 2.5,
                            'line-color': '#475569',
                            'target-arrow-color': '#475569',
                            'target-arrow-shape': 'triangle',
                            'curve-style': 'bezier',
                            'opacity': 1,
                        }
                    },
                    {
                        selector: 'edge[type="transfer"]',
                        style: {
                            'line-color': '#22d3ee',
                            'target-arrow-color': '#22d3ee',
                            'width': 3.5,
                        }
                    },
                    {
                        selector: 'node.cluster-0',
                        style: {
                            'background-color': '#7f1d1d',
                            'border-color': '#ef4444',
                        }
                    },
                    {
                        selector: 'node.cluster-1',
                        style: {
                            'background-color': '#1e3a5f',
                            'border-color': '#3b82f6',
                        }
                    },
                    {
                        selector: 'node.cluster-2',
                        style: {
                            'background-color': '#14532d',
                            'border-color': '#22c55e',
                        }
                    },
                    {
                        selector: 'node.cluster-3',
                        style: {
                            'background-color': '#581c87',
                            'border-color': '#a855f7',
                        }
                    },
                    {
                        selector: 'node.cluster-4',
                        style: {
                            'background-color': '#78350f',
                            'border-color': '#f59e0b',
                        }
                    },
                    {
                        selector: 'node[type="device"]',
                        style: {
                            'background-color': '#4c1d95',
                            'border-color': '#a78bfa',
                            'shape': 'rectangle',
                            'width': 30,
                            'height': 30,
                        }
                    },
                    {
                        selector: 'node[type="ip"]',
                        style: {
                            'background-color': '#064e3b',
                            'border-color': '#34d399',
                            'shape': 'diamond',
                            'width': 28,
                            'height': 28,
                        }
                    },
                    {
                        selector: 'edge[type="device_link"]',
                        style: {
                            'line-color': '#a78bfa',
                            'line-style': 'dashed',
                            'width': 2,
                            'opacity': 0.8,
                            'target-arrow-shape': 'none'
                        }
                    },
                    {
                        selector: 'edge[type="network_link"]',
                        style: {
                            'line-color': '#34d399',
                            'line-style': 'dotted',
                            'width': 2,
                            'opacity': 0.8,
                            'target-arrow-shape': 'none'
                        }
                    },
                    {
                        selector: 'node.hacker-node',
                        style: {
                            'border-width': 6,
                            'border-color': '#ff0000',
                            'background-color': '#450a0a',
                            'width': 65,
                            'height': 65,
                            'font-size': '14px',
                            'font-weight': 'bold',
                            'color': '#ff4444',
                            'text-outline-width': 2,
                            'text-outline-color': '#000',
                            'shadow-blur': 15,
                            'shadow-color': '#ff0000',
                            'shadow-opacity': 0.5,
                        }
                    },
                    {
                        selector: 'node:selected',
                        style: {
                            'border-width': 4,
                            'border-color': '#22d3ee',
                            'overlay-color': '#22d3ee',
                            'overlay-opacity': 0.2,
                        } as any
                    }
                ],
                minZoom: 0.3,
                maxZoom: 2,
                wheelSensitivity: 0.2,
            });

            cyRef.current = cy;

            // Event handlers (only attach once)
            cy.on('tap', 'node', (e) => {
                const node = e.target;
                const data = node.data();
                setSelectedNode(data);
                onNodeSelect?.(data);
            });

            cy.on('mouseover', 'node', (e) => {
                const node = e.target;
                const pos = node.renderedPosition();
                setTooltip({
                    x: pos.x,
                    y: pos.y - 50,
                    data: node.data()
                });
            });

            cy.on('mouseout', 'node', () => {
                setTooltip(null);
            });

            cy.on('tap', (e) => {
                if (e.target === cy) {
                    setSelectedNode(null);
                }
            });
        }

        // 🛠 SYNC ELEMENTS WITHOUT LOSING CAM
        try {
            const isFirstLoad = cy.elements().empty();
            console.log(`[SalaarGraph] Syncing ${elements.length} elements. First load: ${isFirstLoad}`);

            // Deduplicate incoming elements just in case server-side failed
            const uniqueElements: any[] = [];
            const seenIds = new Set();

            elements.forEach(el => {
                if (el.data && el.data.id) {
                    if (!seenIds.has(el.data.id)) {
                        uniqueElements.push(el);
                        seenIds.add(el.data.id);
                    }
                } else if (el.data && el.data.source && el.data.target) {
                    // Edges without IDs are always added by Cytoscape with internal IDs
                    uniqueElements.push(el);
                }
            });

            cy.elements().remove();
            cy.add(uniqueElements);

            const layout = cy.layout({
                name: 'cola',
                animate: true,
                refresh: 2,
                maxSimulationTime: 2000,
                ungrabifyWhileSimulating: false,
                fit: isFirstLoad,
                padding: 40,
                randomize: false,
                nodeSpacing: function (node: any) { return 80; },
                edgeLength: 220,
            } as any);

            layout.run();

            return () => {
                layout.stop();
            };
        } catch (err) {
            console.error("[SalaarGraph] Critical rendering error:", err);
        }
    }, [elements, onNodeSelect]);

    const getRiskBadge = (risk: number) => {
        if (risk >= 80) return <span className="px-1.5 py-0.5 text-[10px] rounded bg-red-500/20 text-red-400">CRITICAL</span>;
        if (risk >= 50) return <span className="px-1.5 py-0.5 text-[10px] rounded bg-orange-500/20 text-orange-400">HIGH</span>;
        if (risk >= 25) return <span className="px-1.5 py-0.5 text-[10px] rounded bg-yellow-500/20 text-yellow-400">MEDIUM</span>;
        return <span className="px-1.5 py-0.5 text-[10px] rounded bg-green-500/20 text-green-400">LOW</span>;
    };

    const exportGraph = () => {
        if (!cyRef.current) return;
        const png64 = cyRef.current.png({
            bg: '#020617', // Match slate-950
            full: true,
            scale: 2
        });
        const link = document.createElement('a');
        link.href = png64;
        link.download = `SALAAR_FORENSIC_EXPORT_${new Date().getTime()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="w-full h-full min-h-[400px] bg-slate-950/50 rounded-xl border border-slate-800 overflow-hidden relative">
            {/* Export Button */}
            <button
                onClick={exportGraph}
                className="absolute top-3 right-3 z-10 p-2 bg-slate-900/90 hover:bg-slate-800 text-slate-300 rounded-lg border border-slate-700 transition-all flex items-center gap-2 group shadow-xl"
                title="Download Graph Evidence"
            >
                <Download size={16} className="group-hover:scale-110 transition-transform" />
                <span className="text-xs font-semibold">Export Image</span>
            </button>

            {/* Legend */}
            <div className="absolute top-3 left-3 z-10 bg-slate-900/90 backdrop-blur p-3 rounded-lg border border-slate-700 text-xs text-slate-400 space-y-2">
                <div className="font-bold text-slate-300 mb-2">Legend</div>
                <div className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full bg-cyan-900 border-2 border-cyan-500"></span>
                    Account
                </div>
                <div className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full bg-cyan-900 border-2 border-cyan-500"></span>
                    Account
                </div>
                <div className="border-t border-slate-700 pt-2 mt-2">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="w-4 h-4 rounded-full bg-red-900 border-2 border-red-500"></span>
                        High Risk
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="w-4 h-4 rounded-full bg-amber-900 border-2 border-amber-500"></span>
                        Medium Risk
                    </div>
                </div>
                <div className="border-t border-slate-700 pt-2 mt-2">
                    <div className="flex items-center gap-2 mb-1">
                        <div className="w-8 h-0.5 bg-cyan-500"></div>
                        <span className="text-[10px]">Money Transfer</span>
                    </div>
                </div>
                <div className="border-t border-slate-700 pt-2 mt-2">
                    <div className="text-[10px] text-slate-500 mb-1 uppercase tracking-wider">Clusters</div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className="w-3 h-3 rounded-full bg-red-900 border-2 border-red-500"></span>
                        <span className="text-[10px]">Cluster A (Fraud Ring)</span>
                    </div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className="w-3 h-3 rounded-full bg-blue-900 border-2 border-blue-500"></span>
                        <span className="text-[10px]">Cluster B</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-green-900 border-2 border-green-500"></span>
                        <span className="text-[10px]">Cluster C</span>
                    </div>
                </div>
            </div>

            {/* Node Tooltip */}
            {tooltip && (
                <div
                    className="absolute z-20 bg-slate-800 border border-slate-600 rounded-lg p-2 text-xs shadow-xl pointer-events-none"
                    style={{
                        left: tooltip.x,
                        top: tooltip.y,
                        transform: 'translate(-50%, -100%)'
                    }}
                >
                    <div className="font-bold text-slate-200 mb-1">{tooltip.data.label}</div>
                    <div className="text-slate-400">Type: {tooltip.data.type}</div>
                    {tooltip.data.risk !== undefined && (
                        <div className="flex items-center gap-1 mt-1">
                            Risk: {getRiskBadge(tooltip.data.risk)}
                        </div>
                    )}
                </div>
            )}

            {/* Selected Node Panel */}
            {selectedNode && (
                <div className="absolute bottom-3 right-3 z-10 bg-slate-900/95 backdrop-blur p-4 rounded-lg border border-cyan-800 text-xs min-w-[280px] shadow-2xl animate-in slide-in-from-bottom-5">
                    <div className="font-bold text-cyan-400 mb-2 flex items-center gap-2 border-b border-cyan-900/50 pb-2">
                        <span>Selected Entity Details</span>
                        <button
                            onClick={() => setSelectedNode(null)}
                            className="ml-auto text-slate-500 hover:text-slate-300 p-1 hover:bg-slate-800 rounded"
                        >
                            ✕
                        </button>
                    </div>
                    <div className="space-y-3 text-slate-300">
                        {/* Metrics Breakdown */}
                        {selectedNode.metrics && (
                            <div className="grid grid-cols-2 gap-x-4 gap-y-2 py-2 border-y border-slate-800/50 my-2">
                                <div>
                                    <span className="text-slate-500 block text-[9px] uppercase">Device Reuse</span>
                                    <span className={selectedNode.metrics.deviceReuse > 1 ? 'text-red-400 font-bold' : 'text-slate-300'}>
                                        {selectedNode.metrics.deviceReuse} Users
                                    </span>
                                </div>
                                <div>
                                    <span className="text-slate-500 block text-[9px] uppercase">IP Reuse</span>
                                    <span className={selectedNode.metrics.ipReuse > 1 ? 'text-orange-400 font-bold' : 'text-slate-300'}>
                                        {selectedNode.metrics.ipReuse} Users
                                    </span>
                                </div>
                                <div>
                                    <span className="text-slate-500 block text-[9px] uppercase">Sync Score</span>
                                    <span className={selectedNode.metrics.syncScore > 50 ? 'text-red-400 font-bold' : 'text-slate-300'}>
                                        {selectedNode.metrics.syncScore}%
                                    </span>
                                </div>
                                <div>
                                    <span className="text-slate-500 block text-[9px] uppercase">Node Degree</span>
                                    <span className="text-cyan-400 font-bold">{selectedNode.metrics.degree} Links</span>
                                </div>
                                {selectedNode.metrics.burst && (
                                    <div className="col-span-2">
                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-950/30 border border-red-900/50 text-red-500 text-[9px] font-bold uppercase">
                                            🔥 Burst Activity Detected
                                        </span>
                                    </div>
                                )}
                                {selectedNode.metrics.threshold && (
                                    <div className="col-span-2">
                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-950/30 border border-amber-900/50 text-amber-500 text-[9px] font-bold uppercase">
                                            ⚠️ Threshold Avoidance (9k-10k)
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Risk Section */}
                        {selectedNode.risk !== undefined && (
                            <div className="bg-slate-800/50 p-2 rounded border border-slate-700">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-slate-400">Risk Assessment</span>
                                    {getRiskBadge(selectedNode.risk)}
                                </div>
                                <div className="h-1.5 w-full bg-slate-700 rounded-full overflow-hidden mb-2">
                                    <div
                                        className={`h-full ${selectedNode.risk > 80 ? 'bg-red-500' : selectedNode.risk > 50 ? 'bg-orange-500' : selectedNode.risk > 25 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                        style={{ width: `${selectedNode.risk}%` }}
                                    ></div>
                                </div>

                                {/* Dynamic Detective Narrative */}
                                <div className="text-[11px] leading-relaxed text-slate-300 mt-3 border-t border-slate-700/50 pt-2">
                                    <strong className="text-cyan-400 block mb-1 flex items-center gap-1">
                                        <span className="text-lg">🕵️‍♂️</span> Investigator's Note
                                    </strong>

                                    {selectedNode.risk > 80 ? (
                                        <p>
                                            <strong>{selectedNode.label}</strong> is acting as a <strong className="text-red-400">High-Velocity Hub</strong>.
                                            This account is the <strong>common destination</strong> for funds from multiple unrelated sources.
                                            The graph shows a "Fan-In" pattern typical of <strong className="text-red-400">Money Laundering</strong>.
                                        </p>
                                    ) : selectedNode.risk > 50 ? (
                                        <p>
                                            This account is exhibiting <strong className="text-orange-400">Structuring Behavior</strong>.
                                            We detected multiple small deposits representing a possible coordinated mule effort.
                                        </p>
                                    ) : (
                                        <p>
                                            Currently behaves like a standard user. Monitoring for any sudden spikes in incoming volume from unknown sources.
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Graph Container */}
            <div ref={containerRef} className="w-full h-full" />

            {/* Controls hint */}
            <div className="absolute bottom-3 left-3 z-10 text-[10px] text-slate-600">
                Scroll to zoom • Drag to pan • Click node to select
            </div>
        </div>
    );
}
