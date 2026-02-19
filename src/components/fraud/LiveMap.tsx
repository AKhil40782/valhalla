'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker, useMap } from 'react-leaflet';

import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default icon issue in Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Custom marker icons
const createIcon = (color: string, size: number = 12) => L.divIcon({
    className: 'custom-marker',
    html: `<div style="
        width: ${size}px; height: ${size}px; 
        background: ${color}; 
        border: 2px solid rgba(255,255,255,0.8); 
        border-radius: 50%; 
        box-shadow: 0 0 ${size}px ${color}, 0 0 ${size * 2}px ${color}40;
    "></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
});

const ICONS = {
    critical: createIcon('#ef4444', 16),
    high: createIcon('#f97316', 14),
    medium: createIcon('#eab308', 12),
    low: createIcon('#10b981', 10),
    vpn: createIcon('#a855f7', 16),
};

interface MapTransaction {
    id: string;
    from: string;
    to: string;
    amount: number;
    riskLevel: string;
    isVpn: boolean;
    isp: string;
    ip: string;
    location: string;
    ipCity: string;
    timestamp: string;
    lat: number;
    lon: number;
    ipLat: number | null;
    ipLon: number | null;
}

// Clickable VPN button that flies map to VPN IP location
function VpnFlyButton({ ipLat, ipLon, ipCity }: { ipLat: number; ipLon: number; ipCity: string }) {
    const map = useMap();
    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        map.closePopup();
        // Fly to VPN IP location
        map.flyTo([ipLat, ipLon], 10, { duration: 2 });
    };
    return (
        <div
            onClick={handleClick}
            style={{
                color: '#a855f7',
                fontSize: '10px',
                fontWeight: 'bold',
                cursor: 'pointer',
                padding: '4px 8px',
                marginTop: '2px',
                background: 'rgba(168, 85, 247, 0.1)',
                border: '1px solid rgba(168, 85, 247, 0.3)',
                borderRadius: '6px',
                textAlign: 'center',
                transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
                (e.target as HTMLElement).style.background = 'rgba(168, 85, 247, 0.25)';
            }}
            onMouseLeave={(e) => {
                (e.target as HTMLElement).style.background = 'rgba(168, 85, 247, 0.1)';
            }}
        >
            🛡️ VPN DETECTED — Click to fly to {ipCity} ✈️
        </div>
    );
}

interface LiveMapProps {
    transactions: MapTransaction[];
}

// Auto-fit map bounds to markers
function FitBounds({ positions }: { positions: [number, number][] }) {
    const map = useMap();
    useEffect(() => {
        if (positions.length > 0) {
            const bounds = L.latLngBounds(positions.map(p => L.latLng(p[0], p[1])));
            map.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
        }
    }, [positions, map]);
    return null;
}

export default function LiveMap({ transactions }: LiveMapProps) {
    // Deduplicate by location (cluster transactions at same coords)
    const locationMap = useMemo(() => {
        const map = new Map<string, { lat: number; lon: number; txs: MapTransaction[] }>();
        transactions.forEach(tx => {
            const key = `${tx.lat.toFixed(2)},${tx.lon.toFixed(2)}`;
            if (!map.has(key)) {
                map.set(key, { lat: tx.lat, lon: tx.lon, txs: [] });
            }
            map.get(key)!.txs.push(tx);
        });
        return Array.from(map.values());
    }, [transactions]);

    // Build flow lines between sender/receiver locations
    const flowLines = useMemo(() => {
        const lines: { from: [number, number]; to: [number, number]; risk: string; isVpn: boolean }[] = [];
        // Group transactions and try to find pairs
        const txById = new Map<string, MapTransaction>();
        transactions.forEach(tx => txById.set(tx.id, tx));

        // For each unique location pair, draw a line
        const seenPairs = new Set<string>();
        for (let i = 0; i < transactions.length; i++) {
            for (let j = i + 1; j < transactions.length; j++) {
                const a = transactions[i];
                const b = transactions[j];
                if (a.lat === b.lat && a.lon === b.lon) continue;
                const pairKey = `${Math.min(a.lat, b.lat)},${Math.min(a.lon, b.lon)}-${Math.max(a.lat, b.lat)},${Math.max(a.lon, b.lon)}`;
                if (seenPairs.has(pairKey)) continue;
                seenPairs.add(pairKey);
                // Only connect if they share from/to relationship
                if (a.from === b.to || a.to === b.from || a.from === b.from) {
                    lines.push({
                        from: [a.lat, a.lon],
                        to: [b.lat, b.lon],
                        risk: a.riskLevel === 'critical' || b.riskLevel === 'critical' ? 'critical' : a.riskLevel,
                        isVpn: a.isVpn || b.isVpn
                    });
                }
            }
        }
        return lines;
    }, [transactions]);

    const allPositions: [number, number][] = locationMap.map(loc => [loc.lat, loc.lon]);

    const getLineColor = (risk: string, isVpn: boolean) => {
        if (isVpn) return '#a855f7';
        switch (risk) {
            case 'critical': return '#ef4444';
            case 'high': return '#f97316';
            case 'medium': return '#eab308';
            default: return '#22d3ee80';
        }
    };

    const getMarkerIcon = (txs: MapTransaction[]) => {
        const hasVpn = txs.some(t => t.isVpn);
        if (hasVpn) return ICONS.vpn;
        const maxRisk = txs.reduce((max, t) => {
            const order = { critical: 4, high: 3, medium: 2, low: 1 };
            return (order[t.riskLevel as keyof typeof order] || 0) > (order[max as keyof typeof order] || 0) ? t.riskLevel : max;
        }, 'low');
        return ICONS[maxRisk as keyof typeof ICONS] || ICONS.low;
    };

    return (
        <div className="w-full h-full relative rounded-xl overflow-hidden border border-slate-800">
            {/* Custom CSS for dark map theme */}
            <style jsx global>{`
                .leaflet-container {
                    background: #0f172a !important;
                }
                .leaflet-tile-pane {
                    filter: invert(1) hue-rotate(180deg) brightness(0.95) contrast(0.9);
                }
                .leaflet-control-zoom a {
                    background: #1e293b !important;
                    color: #94a3b8 !important;
                    border-color: #334155 !important;
                }
                .leaflet-popup-content-wrapper {
                    background: #1e293b !important;
                    color: #e2e8f0 !important;
                    border: 1px solid #334155 !important;
                    border-radius: 12px !important;
                    box-shadow: 0 0 20px rgba(0,0,0,0.5) !important;
                }
                .leaflet-popup-tip {
                    background: #1e293b !important;
                }
                .leaflet-popup-close-button {
                    color: #94a3b8 !important;
                }
                .custom-marker {
                    background: transparent !important;
                    border: none !important;
                }
            `}</style>

            <MapContainer
                center={[20.5937, 78.9629]} // India center
                zoom={5}
                style={{ width: '100%', height: '100%', minHeight: '600px' }}
                zoomControl={true}
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                <FitBounds positions={allPositions} />

                {/* Flow Lines */}
                {flowLines.map((line, idx) => (
                    <Polyline
                        key={`line-${idx}`}
                        positions={[line.from, line.to]}
                        pathOptions={{
                            color: getLineColor(line.risk, line.isVpn),
                            weight: 2,
                            opacity: 0.6,
                            dashArray: line.isVpn ? '8, 4' : undefined
                        }}
                    />
                ))}

                {/* Location Markers */}
                {locationMap.map((loc, idx) => (
                    <Marker
                        key={`marker-${idx}`}
                        position={[loc.lat, loc.lon]}
                        icon={getMarkerIcon(loc.txs)}
                    >
                        <Popup maxWidth={320}>
                            <div style={{ fontFamily: 'monospace', fontSize: '11px', lineHeight: '1.6' }}>
                                <div style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '8px', color: '#22d3ee' }}>
                                    📍 {loc.txs[0]?.ipCity || 'Unknown Location'}
                                </div>
                                <div style={{ color: '#94a3b8', marginBottom: '6px' }}>
                                    {loc.lat.toFixed(4)}, {loc.lon.toFixed(4)}
                                </div>
                                <div style={{ borderTop: '1px solid #334155', paddingTop: '6px' }}>
                                    <strong style={{ color: '#e2e8f0' }}>{loc.txs.length} Transaction{loc.txs.length > 1 ? 's' : ''}</strong>
                                </div>
                                {loc.txs.slice(0, 5).map((tx, i) => (
                                    <div key={i} style={{
                                        borderTop: '1px solid #1e293b',
                                        paddingTop: '4px',
                                        marginTop: '4px',
                                        color: '#cbd5e1'
                                    }}>
                                        <div>
                                            <span style={{ color: tx.riskLevel === 'critical' ? '#ef4444' : tx.riskLevel === 'high' ? '#f97316' : '#22d3ee' }}>
                                                ₹{tx.amount.toLocaleString()}
                                            </span>
                                            {' '}{tx.from} → {tx.to}
                                        </div>
                                        <div style={{ color: '#64748b', fontSize: '10px' }}>
                                            IP: {tx.ip} | ISP: {tx.isp}
                                        </div>
                                        {tx.isVpn && tx.ipLat && tx.ipLon && (
                                            <VpnFlyButton ipLat={tx.ipLat} ipLon={tx.ipLon} ipCity={tx.ipCity} />
                                        )}
                                        {tx.isVpn && (!tx.ipLat || !tx.ipLon) && (
                                            <div style={{ color: '#a855f7', fontSize: '10px', fontWeight: 'bold' }}>
                                                🛡️ VPN DETECTED
                                            </div>
                                        )}
                                    </div>
                                ))}
                                {loc.txs.length > 5 && (
                                    <div style={{ color: '#64748b', marginTop: '4px' }}>
                                        +{loc.txs.length - 5} more...
                                    </div>
                                )}
                            </div>
                        </Popup>
                    </Marker>
                ))}

                {/* VPN Ghost Markers — show where VPN IPs actually resolve to */}
                {transactions.filter(tx => tx.isVpn && tx.ipLat && tx.ipLon).map((tx, idx) => (
                    <CircleMarker
                        key={`vpn-ghost-${idx}`}
                        center={[tx.ipLat!, tx.ipLon!]}
                        pathOptions={{
                            color: '#a855f7',
                            fillColor: '#a855f7',
                            fillOpacity: 0.2,
                            weight: 2,
                            dashArray: '4, 4'
                        }}
                        radius={20}
                    >
                        <Popup maxWidth={250}>
                            <div style={{ fontFamily: 'monospace', fontSize: '11px' }}>
                                <div style={{ color: '#a855f7', fontWeight: 'bold', marginBottom: '4px' }}>
                                    🛡️ VPN Exit Point: {tx.ipCity}
                                </div>
                                <div style={{ color: '#94a3b8', fontSize: '10px' }}>
                                    IP: {tx.ip} | ISP: {tx.isp}
                                </div>
                                <div style={{ color: '#64748b', fontSize: '10px', marginTop: '4px' }}>
                                    Real user location: {tx.lat.toFixed(4)}, {tx.lon.toFixed(4)}
                                </div>
                            </div>
                        </Popup>
                    </CircleMarker>
                ))}

                {/* Dashed lines from real location to VPN exit point */}
                {transactions.filter(tx => tx.isVpn && tx.ipLat && tx.ipLon).map((tx, idx) => (
                    <Polyline
                        key={`vpn-trace-${idx}`}
                        positions={[[tx.lat, tx.lon], [tx.ipLat!, tx.ipLon!]]}
                        pathOptions={{
                            color: '#a855f7',
                            weight: 1.5,
                            opacity: 0.5,
                            dashArray: '6, 6'
                        }}
                    />
                ))}
            </MapContainer>

            {/* Legend Overlay */}
            <div className="absolute bottom-4 left-4 z-[1000] bg-slate-900/90 backdrop-blur-sm border border-slate-700 rounded-xl p-4 text-[10px] space-y-2">
                <div className="text-slate-400 uppercase font-bold tracking-widest mb-2">Legend</div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500 shadow-[0_0_6px_#ef4444]" />
                    <span className="text-slate-300">Critical Risk</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-orange-500 shadow-[0_0_6px_#f97316]" />
                    <span className="text-slate-300">High Risk</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-yellow-500 shadow-[0_0_6px_#eab308]" />
                    <span className="text-slate-300">Medium Risk</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_6px_#10b981]" />
                    <span className="text-slate-300">Secure</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-purple-500 shadow-[0_0_6px_#a855f7]" />
                    <span className="text-slate-300">VPN / Proxy</span>
                </div>
                <div className="flex items-center gap-2 pt-1 border-t border-slate-700">
                    <div className="w-6 border-t-2 border-dashed border-purple-500" />
                    <span className="text-slate-300">VPN Flow</span>
                </div>
            </div>

            {/* Stats Overlay */}
            <div className="absolute top-4 right-4 z-[1000] bg-slate-900/90 backdrop-blur-sm border border-slate-700 rounded-xl p-4 text-xs">
                <div className="text-slate-400 uppercase font-bold tracking-widest text-[10px] mb-2">Live Stats</div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                    <span className="text-slate-500">Nodes</span>
                    <span className="text-cyan-400 font-bold text-right">{locationMap.length}</span>
                    <span className="text-slate-500">Transactions</span>
                    <span className="text-cyan-400 font-bold text-right">{transactions.length}</span>
                    <span className="text-slate-500">VPN Hits</span>
                    <span className="text-purple-400 font-bold text-right">{transactions.filter(t => t.isVpn).length}</span>
                    <span className="text-slate-500">Flows</span>
                    <span className="text-cyan-400 font-bold text-right">{flowLines.length}</span>
                </div>
            </div>
        </div>
    );
}
