'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import cytoscape from 'cytoscape';
// @ts-ignore
import cola from 'cytoscape-cola';
import { Download, Maximize2, Minimize2 } from 'lucide-react';

cytoscape.use(cola);

interface FraudGraphProps {
    elements: any[];
    onNodeSelect?: (nodeData: any) => void;
}

export function FraudGraph({ elements, onNodeSelect }: FraudGraphProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [selectedNode, setSelectedNode] = useState<any>(null);
    const [tooltip, setTooltip] = useState<{ x: number; y: number; data: any } | null>(null);
    const [maxNodes, setMaxNodes] = useState(50);
    const [riskFilter, setRiskFilter] = useState<'all' | 'high' | 'critical'>('all');
    const [layoutMode, setLayoutMode] = useState<'force' | 'circle' | 'grid'>('force');
    const [isFullscreen, setIsFullscreen] = useState(false);

    const filteredElements = useMemo(() => {
        let nodes = elements.filter(e => !e.data.source); // Nodes
        let edges = elements.filter(e => e.data.source);  // Edges

        // 1. Risk Filter
        if (riskFilter !== 'all') {
            nodes = nodes.filter(n => {
                const risk = n.data.riskScore || 0;
                if (riskFilter === 'critical') return risk >= 80;
                if (riskFilter === 'high') return risk >= 50;
                return true;
            });
        }

        // 2. Max Nodes (Top Risk)
        // Sort by risk (desc) then by amount (desc)
        nodes.sort((a, b) => {
            const riskDiff = (b.data.riskScore || 0) - (a.data.riskScore || 0);
            if (riskDiff !== 0) return riskDiff;
            return (b.data.amount || 0) - (a.data.amount || 0);
        });
        nodes = nodes.slice(0, maxNodes);

        const nodeIds = new Set(nodes.map(n => n.data.id));

        // 3. Filter edges
        edges = edges.filter(e => nodeIds.has(e.data.source) && nodeIds.has(e.data.target));

        return [...nodes, ...edges];
    }, [elements, maxNodes, riskFilter]);

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
                            'width': (ele: any) => Math.min(6, 2 + (Math.log10(ele.data('amount') || 1) * 0.5)),
                            'label': (ele: any) => {
                                const count = ele.data('count');
                                const amount = ele.data('amount');
                                if (!amount) return '';
                                const amtStr = amount >= 1000 ? `₹${(amount / 1000).toFixed(0)}k` : `₹${amount}`;
                                return count > 1 ? `${count}x (${amtStr})` : amtStr;
                            },
                            'font-size': '9px',
                            'color': '#94a3b8',
                            'text-background-color': '#0f172a',
                            'text-background-opacity': 0.7,
                            'text-background-padding': '2px',
                            'text-rotation': 'autorotate',
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
                        selector: 'node.vpn-node',
                        style: {
                            'border-style': 'dashed',
                            'border-color': '#f97316', // Orange-500
                            'border-width': 4,
                            'background-color': '#431407', // Brown-950
                            'text-outline-color': '#f97316',
                            'text-outline-width': 1,
                        }
                    },
                    {
                        selector: 'node:selected',
                        style: {
                            'border-width': 4,
                            'border-color': '#22d3ee',
                            'overlay-color': '#22d3ee',
                            'overlay-opacity': 0.2,
                            'label': 'data(label)',
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
            console.log(`[SalaarGraph] Syncing ${filteredElements.length} elements. First load: ${isFirstLoad}`);

            // Deduplicate incoming elements just in case server-side failed
            const uniqueElements: any[] = [];
            const seenIds = new Set();

            filteredElements.forEach(el => {
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
                name: layoutMode === 'force' ? 'cola' : layoutMode,
                animate: true,
                refresh: 2,
                maxSimulationTime: 1500,
                ungrabifyWhileSimulating: false,
                fit: isFirstLoad,
                padding: 40,
                randomize: false,
                nodeSpacing: function (node: any) { return layoutMode === 'grid' ? 100 : 100; },
                edgeLength: 250,
            } as any);

            layout.run();

            return () => {
                layout.stop();
            };
        } catch (err) {
            console.error("[SalaarGraph] Critical rendering error:", err);
        }
    }, [filteredElements, onNodeSelect, layoutMode]);

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
        <div className={`${isFullscreen ? '!fixed !inset-0 !z-[99999] !w-screen !h-screen bg-slate-950' : 'w-full h-full min-h-[400px] bg-slate-950/50 rounded-xl border border-slate-800 relative'} overflow-hidden transition-all duration-300`}>
            {/* Export Button */}
            <button
                onClick={exportGraph}
                className="absolute top-3 right-3 z-10 p-2 bg-slate-900/90 hover:bg-slate-800 text-slate-300 rounded-lg border border-slate-700 transition-all flex items-center gap-2 group shadow-xl"
                title="Download Graph Evidence"
            >
                <Download size={16} className="group-hover:scale-110 transition-transform" />
                <span className="text-xs font-semibold">Export</span>
            </button>

            {/* View Controls */}
            <div className="absolute top-3 right-32 z-10 flex gap-2">
                <select
                    value={maxNodes}
                    onChange={(e) => setMaxNodes(Number(e.target.value))}
                    className="h-9 px-2 bg-slate-900/90 border border-slate-700 rounded text-xs text-slate-300 outline-none focus:border-cyan-500"
                >
                    <option value={20}>20 Nodes</option>
                    <option value={50}>50 Nodes</option>
                    <option value={100}>100 Nodes</option>
                    <option value={200}>200 Nodes</option>
                    <option value={500}>500 Nodes</option>
                </select>

                <select
                    value={riskFilter}
                    onChange={(e) => setRiskFilter(e.target.value as any)}
                    className="h-9 px-2 bg-slate-900/90 border border-slate-700 rounded text-xs text-slate-300 outline-none focus:border-cyan-500"
                >
                    <option value="all">All Risks</option>
                    <option value="high">High & Crit</option>
                    <option value="critical">Critical Only</option>
                </select>

                <select
                    value={layoutMode}
                    onChange={(e) => setLayoutMode(e.target.value as any)}
                    className="h-9 px-2 bg-slate-900/90 border border-slate-700 rounded text-xs text-slate-300 outline-none focus:border-cyan-500"
                >
                    <option value="force">Physics</option>
                    <option value="circle">Circle</option>
                    <option value="grid">Grid</option>
                </select>

                <button
                    onClick={() => setIsFullscreen(!isFullscreen)}
                    className="p-2 bg-slate-900/90 hover:bg-slate-800 text-cyan-400 rounded border border-slate-700 transition-all shadow-[0_0_10px_rgba(34,211,238,0.2)] h-9 w-9 flex items-center justify-center"
                    title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
                >
                    {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                </button>
            </div>

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
                        left: tooltip?.x,
                        top: tooltip?.y,
                        transform: 'translate(-50%, -100%)'
                    }}
                >
                    <div className="font-bold text-slate-200 mb-1">{tooltip?.data?.label}</div>
                    <div className="text-slate-400">Type: {tooltip?.data?.type}</div>
                    {tooltip?.data?.risk !== undefined && (
                        <div className="flex items-center gap-1 mt-1">
                            Risk: {getRiskBadge(tooltip.data.risk)}
                        </div>
                    )}
                    {tooltip.data.isVpn && (
                        <div className="flex items-center gap-1 mt-1 text-orange-400 font-bold">
                            ⚠️ VPN DETECTED
                        </div>
                    )}
                    {tooltip?.data?.ips && tooltip.data.ips.length > 0 && (
                        <div className="mt-1 pt-1 border-t border-slate-700 text-[10px] text-slate-400">
                            <span className="font-semibold text-slate-300">IPs:</span> {tooltip.data.ips.join(', ')}
                        </div>
                    )}
                </div>
            )}

            {/* Selected Node Panel */}
            {/* Selected Node Panel */}
            {selectedNode && (
                <div className="absolute bottom-3 right-3 z-10 bg-slate-900/95 backdrop-blur p-4 rounded-lg border border-cyan-800 text-xs min-w-[300px] max-w-[340px] max-h-[85vh] overflow-y-auto shadow-2xl animate-in slide-in-from-bottom-5">
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

                        {/* Cluster Badge */}
                        {selectedNode.clusterLabel && (
                            <div className={`flex items-center gap-2 px-2 py-1.5 rounded border ${selectedNode.clusterRiskLevel === 'high' ? 'bg-red-950/30 border-red-800 text-red-400' :
                                selectedNode.clusterRiskLevel === 'medium' ? 'bg-amber-950/30 border-amber-800 text-amber-400' :
                                    'bg-slate-800/50 border-slate-700 text-slate-400'
                                }`}>
                                <span className="text-lg">🔗</span>
                                <div>
                                    <div className="font-bold text-[10px] uppercase tracking-wider">{selectedNode.clusterLabel}</div>
                                    <div className="text-[9px] opacity-80">
                                        Risk Level: <span className="font-bold uppercase">{selectedNode.clusterRiskLevel}</span>
                                        {selectedNode.metrics?.engineRiskScore && ` (${selectedNode.metrics.engineRiskScore}%)`}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Engine Metrics Breakdown */}
                        {selectedNode.metrics && (
                            <div className="space-y-2 py-2 border-y border-slate-800/50 my-2">
                                <div className="text-[9px] text-slate-500 uppercase tracking-wider font-bold mb-1">Identity Linking Scores</div>

                                {/* Fingerprint Reuse */}
                                <div>
                                    <div className="flex justify-between mb-0.5">
                                        <span className="text-slate-400 text-[9px]">🔑 Fingerprint Reuse</span>
                                        <span className={`font-bold ${parseInt(selectedNode.metrics.fingerprintReuse) > 50 ? 'text-red-400' : 'text-slate-300'}`}>
                                            {selectedNode.metrics.fingerprintReuse}%
                                        </span>
                                    </div>
                                    <div className="h-1 w-full bg-slate-700 rounded-full overflow-hidden">
                                        <div className="h-full bg-red-500 rounded-full transition-all" style={{ width: `${selectedNode.metrics.fingerprintReuse}%` }} />
                                    </div>
                                </div>

                                {/* Time Sync */}
                                <div>
                                    <div className="flex justify-between mb-0.5">
                                        <span className="text-slate-400 text-[9px]">⏱️ Time Synchronization</span>
                                        <span className={`font-bold ${parseInt(selectedNode.metrics.timeSyncEngine) > 50 ? 'text-red-400' : 'text-slate-300'}`}>
                                            {selectedNode.metrics.timeSyncEngine}%
                                        </span>
                                    </div>
                                    <div className="h-1 w-full bg-slate-700 rounded-full overflow-hidden">
                                        <div className="h-full bg-orange-500 rounded-full transition-all" style={{ width: `${selectedNode.metrics.timeSyncEngine}%` }} />
                                    </div>
                                </div>

                                {/* Network Reuse */}
                                <div>
                                    <div className="flex justify-between mb-0.5">
                                        <span className="text-slate-400 text-[9px]">🌐 IP/Subnet/ASN Reuse</span>
                                        <span className={`font-bold ${parseInt(selectedNode.metrics.networkReuse) > 50 ? 'text-orange-400' : 'text-slate-300'}`}>
                                            {selectedNode.metrics.networkReuse}%
                                        </span>
                                    </div>
                                    <div className="h-1 w-full bg-slate-700 rounded-full overflow-hidden">
                                        <div className="h-full bg-amber-500 rounded-full transition-all" style={{ width: `${selectedNode.metrics.networkReuse}%` }} />
                                    </div>
                                </div>

                                {/* Graph Density */}
                                <div>
                                    <div className="flex justify-between mb-0.5">
                                        <span className="text-slate-400 text-[9px]">📊 Graph Density</span>
                                        <span className="text-slate-300 font-bold">{selectedNode.metrics.graphDensityEngine}%</span>
                                    </div>
                                    <div className="h-1 w-full bg-slate-700 rounded-full overflow-hidden">
                                        <div className="h-full bg-cyan-500 rounded-full transition-all" style={{ width: `${selectedNode.metrics.graphDensityEngine}%` }} />
                                    </div>
                                </div>

                                {/* VPN Presence */}
                                <div>
                                    <div className="flex justify-between mb-0.5">
                                        <span className="text-slate-400 text-[9px]">🛡️ VPN Presence</span>
                                        <span className={`font-bold ${parseInt(selectedNode.metrics.vpnPresence) > 0 ? 'text-orange-400' : 'text-slate-300'}`}>
                                            {selectedNode.metrics.vpnPresence}%
                                        </span>
                                    </div>
                                    <div className="h-1 w-full bg-slate-700 rounded-full overflow-hidden">
                                        <div className="h-full bg-violet-500 rounded-full transition-all" style={{ width: `${selectedNode.metrics.vpnPresence}%` }} />
                                    </div>
                                </div>

                                {/* ML & Anomaly Scores */}
                                <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2 pt-2 border-t border-slate-800/50">
                                    <div>
                                        <span className="text-slate-500 block text-[9px] uppercase">🤖 ML Probability</span>
                                        <span className={`font-bold ${(selectedNode.metrics.ml_score || 0) > 0.5 ? 'text-red-400' : 'text-slate-300'}`}>
                                            {((selectedNode.metrics.ml_score || 0) * 100).toFixed(0)}%
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-slate-500 block text-[9px] uppercase">👽 Anomaly Score</span>
                                        <span className={`font-bold ${(selectedNode.metrics.anomaly_score || 0) > 0.6 ? 'text-orange-400' : 'text-slate-300'}`}>
                                            {((selectedNode.metrics.anomaly_score || 0) * 100).toFixed(0)}%
                                        </span>
                                    </div>
                                </div>

                                {/* Legacy Metrics Row */}
                                <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2 pt-2 border-t border-slate-800/50">
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
                                        <span className="text-slate-500 block text-[9px] uppercase">Node Degree</span>
                                        <span className="text-cyan-400 font-bold">{selectedNode.metrics.degree} Links</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-500 block text-[9px] uppercase">Engine Risk</span>
                                        <span className="text-cyan-400 font-bold">{selectedNode.metrics.engineRiskScore}%</span>
                                    </div>
                                </div>

                                {selectedNode.metrics.burstMode && (
                                    <div className="col-span-2">
                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-950/30 border border-red-900/50 text-red-500 text-[9px] font-bold uppercase">
                                            🔥 Burst Activity Detected
                                        </span>
                                    </div>
                                )}
                                {selectedNode.metrics.thresholdDodging && (
                                    <div className="col-span-2">
                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-950/30 border border-amber-900/50 text-amber-500 text-[9px] font-bold uppercase">
                                            ⚠️ Threshold Avoidance (9k-10k)
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}

                        {selectedNode.isVpn && (
                            <div className="mb-2">
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-orange-950/30 border border-orange-900/50 text-orange-500 text-[10px] font-bold uppercase w-full justify-center shadow-[0_0_10px_rgba(249,115,22,0.2)] animate-pulse">
                                    🛡️ SUSPICIOUS MARK: VPN / PROXY USE
                                </span>
                            </div>
                        )}

                        {/* Risk Section */}
                        {selectedNode.risk !== undefined && (
                            <div className="bg-slate-800/50 p-2 rounded border border-slate-700">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-slate-400">Composite Risk Score</span>
                                    {getRiskBadge(selectedNode.risk)}
                                </div>
                                <div className="h-1.5 w-full bg-slate-700 rounded-full overflow-hidden mb-2">
                                    <div
                                        className={`h-full ${selectedNode.risk > 80 ? 'bg-red-500' : selectedNode.risk > 50 ? 'bg-orange-500' : selectedNode.risk > 25 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                        style={{ width: `${selectedNode.risk}%` }}
                                    ></div>
                                </div>

                                {/* Engine Explainability */}
                                {selectedNode.clusterExplanation && (
                                    <div className="text-[11px] leading-relaxed text-slate-300 mt-3 border-t border-slate-700/50 pt-2">
                                        <strong className="text-cyan-400 block mb-1 flex items-center gap-1">
                                            <span className="text-lg">🧠</span> Engine Analysis
                                        </strong>
                                        <p className="text-slate-400 leading-relaxed">{selectedNode.clusterExplanation}</p>
                                    </div>
                                )}

                                {/* Dynamic Detective Narrative */}
                                <div className="text-[11px] leading-relaxed text-slate-300 mt-3 border-t border-slate-700/50 pt-2">
                                    <strong className="text-cyan-400 block mb-1 flex items-center gap-1">
                                        <span className="text-lg">🕵️‍♂️</span> Investigator&apos;s Note
                                    </strong>

                                    {selectedNode.risk > 80 ? (
                                        <p>
                                            <strong>{selectedNode.label}</strong> is acting as a <strong className="text-red-400">High-Velocity Hub</strong>.
                                            This account is the <strong>common destination</strong> for funds from multiple unrelated sources.
                                            The graph shows a &quot;Fan-In&quot; pattern typical of <strong className="text-red-400">Money Laundering</strong>.
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
        </div >
    );
}
