'use client';

import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
    GoogleMap,
    useJsApiLoader,
    MarkerF,
    InfoWindowF,
    PolylineF,
    CircleF,
} from '@react-google-maps/api';

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

interface LiveMapProps {
    transactions: MapTransaction[];
}

// Dark map style for the fraud dashboard aesthetic
const DARK_MAP_STYLE: google.maps.MapTypeStyle[] = [
    { elementType: 'geometry', stylers: [{ color: '#0f172a' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#0f172a' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#64748b' }] },
    { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#1e293b' }] },
    { featureType: 'administrative.land_parcel', elementType: 'labels.text.fill', stylers: [{ color: '#475569' }] },
    { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#1e293b' }] },
    { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#1e293b' }] },
    { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#64748b' }] },
    { featureType: 'poi.park', elementType: 'geometry.fill', stylers: [{ color: '#0f2027' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#334155' }] },
    { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#1e293b' }] },
    { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#475569' }] },
    { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#334155' }] },
    { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#1e293b' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0c1425' }] },
    { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#334155' }] },
];

// SVG pin marker URLs — data URIs with risk-based colors
function createPinSvg(color: string): string {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="44" viewBox="0 0 32 44">
        <defs>
            <filter id="glow"><feGaussianBlur stdDeviation="2" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>
        <path d="M16 0C7.16 0 0 7.16 0 16c0 12 16 28 16 28s16-16 16-28C32 7.16 24.84 0 16 0z" fill="${color}" stroke="rgba(255,255,255,0.7)" stroke-width="1.5" filter="url(%23glow)"/>
        <circle cx="16" cy="16" r="6" fill="white" opacity="0.9"/>
        <circle cx="16" cy="16" r="3" fill="${color}"/>
    </svg>`;
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

const PIN_URLS = {
    critical: createPinSvg('#ef4444'),
    high: createPinSvg('#f97316'),
    medium: createPinSvg('#eab308'),
    low: createPinSvg('#10b981'),
    vpn: createPinSvg('#a855f7'),
};

const containerStyle = { width: '100%', height: '100%', minHeight: '600px' };

export default function LiveMap({ transactions }: LiveMapProps) {
    const mapRef = useRef<google.maps.Map | null>(null);
    const [selectedCluster, setSelectedCluster] = useState<{ lat: number; lon: number; txs: MapTransaction[] } | null>(null);
    const [selectedVpn, setSelectedVpn] = useState<MapTransaction | null>(null);

    const { isLoaded } = useJsApiLoader({
        googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    });

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
        const lines: { from: { lat: number; lng: number }; to: { lat: number; lng: number }; risk: string; isVpn: boolean }[] = [];
        const seenPairs = new Set<string>();
        for (let i = 0; i < transactions.length; i++) {
            for (let j = i + 1; j < transactions.length; j++) {
                const a = transactions[i];
                const b = transactions[j];
                if (a.lat === b.lat && a.lon === b.lon) continue;
                const pairKey = `${Math.min(a.lat, b.lat)},${Math.min(a.lon, b.lon)}-${Math.max(a.lat, b.lat)},${Math.max(a.lon, b.lon)}`;
                if (seenPairs.has(pairKey)) continue;
                seenPairs.add(pairKey);
                if (a.from === b.to || a.to === b.from || a.from === b.from) {
                    lines.push({
                        from: { lat: a.lat, lng: a.lon },
                        to: { lat: b.lat, lng: b.lon },
                        risk: a.riskLevel === 'critical' || b.riskLevel === 'critical' ? 'critical' : a.riskLevel,
                        isVpn: a.isVpn || b.isVpn,
                    });
                }
            }
        }
        return lines;
    }, [transactions]);

    // VPN trace lines
    const vpnTraces = useMemo(() => {
        return transactions
            .filter(tx => tx.isVpn && tx.ipLat && tx.ipLon)
            .map(tx => ({
                path: [
                    { lat: tx.lat, lng: tx.lon },
                    { lat: tx.ipLat!, lng: tx.ipLon! },
                ],
                tx,
            }));
    }, [transactions]);

    const getLineColor = (risk: string, isVpn: boolean) => {
        if (isVpn) return '#a855f7';
        switch (risk) {
            case 'critical': return '#ef4444';
            case 'high': return '#f97316';
            case 'medium': return '#eab308';
            default: return '#22d3ee';
        }
    };

    const getPinUrl = (txs: MapTransaction[]) => {
        const hasVpn = txs.some(t => t.isVpn);
        if (hasVpn) return PIN_URLS.vpn;
        const maxRisk = txs.reduce((max, t) => {
            const order: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
            return (order[t.riskLevel] || 0) > (order[max] || 0) ? t.riskLevel : max;
        }, 'low');
        return PIN_URLS[maxRisk as keyof typeof PIN_URLS] || PIN_URLS.low;
    };

    const onMapLoad = useCallback((map: google.maps.Map) => {
        mapRef.current = map;
        if (transactions.length > 0) {
            const bounds = new google.maps.LatLngBounds();
            transactions.forEach(tx => bounds.extend({ lat: tx.lat, lng: tx.lon }));
            // Also include VPN exit points
            transactions.filter(tx => tx.isVpn && tx.ipLat && tx.ipLon)
                .forEach(tx => bounds.extend({ lat: tx.ipLat!, lng: tx.ipLon! }));
            map.fitBounds(bounds, { top: 50, bottom: 50, left: 50, right: 50 });
        }
    }, [transactions]);

    const flyToVpn = (tx: MapTransaction) => {
        if (mapRef.current && tx.ipLat && tx.ipLon) {
            setSelectedCluster(null);
            mapRef.current.panTo({ lat: tx.ipLat, lng: tx.ipLon });
            mapRef.current.setZoom(10);
            // Find and select the VPN ghost marker
            setSelectedVpn(tx);
        }
    };

    if (!isLoaded) {
        return (
            <div className="w-full h-full flex items-center justify-center bg-slate-900/50" style={{ minHeight: '600px' }}>
                <div className="text-cyan-400 animate-pulse flex items-center gap-3">
                    <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span>Loading Google Maps...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full h-full relative rounded-xl overflow-hidden border border-slate-800">
            <GoogleMap
                mapContainerStyle={containerStyle}
                center={{ lat: 20.5937, lng: 78.9629 }}
                zoom={5}
                onLoad={onMapLoad}
                options={{
                    styles: DARK_MAP_STYLE,
                    disableDefaultUI: false,
                    zoomControl: true,
                    mapTypeControl: false,
                    streetViewControl: false,
                    fullscreenControl: true,
                    backgroundColor: '#0f172a',
                }}
            >
                {/* Flow Lines */}
                {flowLines.map((line, idx) => (
                    <PolylineF
                        key={`line-${idx}`}
                        path={[line.from, line.to]}
                        options={{
                            strokeColor: getLineColor(line.risk, line.isVpn),
                            strokeWeight: 2,
                            strokeOpacity: 0.6,
                            ...(line.isVpn ? {
                                icons: [{
                                    icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, scale: 3 },
                                    offset: '0',
                                    repeat: '15px',
                                }],
                                strokeOpacity: 0,
                            } : {}),
                        }}
                    />
                ))}

                {/* VPN Trace Lines (dashed from real location to VPN exit) */}
                {vpnTraces.map((trace, idx) => (
                    <PolylineF
                        key={`vpn-trace-${idx}`}
                        path={trace.path}
                        options={{
                            strokeColor: '#a855f7',
                            strokeOpacity: 0,
                            icons: [{
                                icon: { path: 'M 0,-1 0,1', strokeOpacity: 0.5, strokeColor: '#a855f7', scale: 2 },
                                offset: '0',
                                repeat: '12px',
                            }],
                        }}
                    />
                ))}

                {/* VPN Ghost Circles — where VPN IPs resolve to */}
                {transactions.filter(tx => tx.isVpn && tx.ipLat && tx.ipLon).map((tx, idx) => (
                    <React.Fragment key={`vpn-ghost-${idx}`}>
                        <CircleF
                            center={{ lat: tx.ipLat!, lng: tx.ipLon! }}
                            radius={15000}
                            options={{
                                strokeColor: '#a855f7',
                                strokeWeight: 2,
                                strokeOpacity: 0.5,
                                fillColor: '#a855f7',
                                fillOpacity: 0.08,
                            }}
                            onClick={() => setSelectedVpn(tx)}
                        />
                        <MarkerF
                            position={{ lat: tx.ipLat!, lng: tx.ipLon! }}
                            icon={{
                                url: PIN_URLS.vpn,
                                scaledSize: new google.maps.Size(24, 34),
                                anchor: new google.maps.Point(12, 34),
                            }}
                            opacity={0.6}
                            onClick={() => setSelectedVpn(tx)}
                        />
                    </React.Fragment>
                ))}

                {/* VPN Ghost InfoWindow */}
                {selectedVpn && selectedVpn.ipLat && selectedVpn.ipLon && (
                    <InfoWindowF
                        position={{ lat: selectedVpn.ipLat, lng: selectedVpn.ipLon }}
                        onCloseClick={() => setSelectedVpn(null)}
                    >
                        <div style={{ fontFamily: 'monospace', fontSize: '11px', background: '#1e293b', color: '#e2e8f0', padding: '8px', borderRadius: '8px', minWidth: '200px' }}>
                            <div style={{ color: '#a855f7', fontWeight: 'bold', marginBottom: '4px', fontSize: '12px' }}>
                                🛡️ VPN Exit Point: {selectedVpn.ipCity}
                            </div>
                            <div style={{ color: '#94a3b8', fontSize: '10px' }}>
                                IP: {selectedVpn.ip} | ISP: {selectedVpn.isp}
                            </div>
                            <div style={{ color: '#64748b', fontSize: '10px', marginTop: '4px' }}>
                                Real user GPS: {selectedVpn.lat.toFixed(4)}, {selectedVpn.lon.toFixed(4)}
                            </div>
                            <div style={{ color: '#cbd5e1', fontSize: '10px', marginTop: '4px' }}>
                                ₹{selectedVpn.amount.toLocaleString()} {selectedVpn.from} → {selectedVpn.to}
                            </div>
                        </div>
                    </InfoWindowF>
                )}

                {/* Location Pin Markers */}
                {locationMap.map((loc, idx) => (
                    <MarkerF
                        key={`marker-${idx}`}
                        position={{ lat: loc.lat, lng: loc.lon }}
                        icon={{
                            url: getPinUrl(loc.txs),
                            scaledSize: new google.maps.Size(32, 44),
                            anchor: new google.maps.Point(16, 44),
                        }}
                        onClick={() => { setSelectedCluster(loc); setSelectedVpn(null); }}
                    />
                ))}

                {/* Cluster InfoWindow */}
                {selectedCluster && (
                    <InfoWindowF
                        position={{ lat: selectedCluster.lat, lng: selectedCluster.lon }}
                        onCloseClick={() => setSelectedCluster(null)}
                    >
                        <div style={{ fontFamily: 'monospace', fontSize: '11px', lineHeight: '1.6', background: '#1e293b', color: '#e2e8f0', padding: '10px', borderRadius: '10px', minWidth: '260px', maxWidth: '320px', maxHeight: '300px', overflowY: 'auto' }}>
                            <div style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '6px', color: '#22d3ee' }}>
                                📍 {selectedCluster.txs[0]?.ipCity || 'Unknown Location'}
                            </div>
                            <div style={{ color: '#94a3b8', marginBottom: '6px', fontSize: '10px' }}>
                                {selectedCluster.lat.toFixed(4)}, {selectedCluster.lon.toFixed(4)}
                            </div>
                            <div style={{ borderTop: '1px solid #334155', paddingTop: '6px' }}>
                                <strong>{selectedCluster.txs.length} Transaction{selectedCluster.txs.length > 1 ? 's' : ''}</strong>
                            </div>
                            {selectedCluster.txs.slice(0, 5).map((tx, i) => (
                                <div key={i} style={{ borderTop: '1px solid #334155', paddingTop: '4px', marginTop: '4px', color: '#cbd5e1' }}>
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
                                        <div
                                            onClick={() => flyToVpn(tx)}
                                            style={{
                                                color: '#a855f7', fontSize: '10px', fontWeight: 'bold',
                                                cursor: 'pointer', padding: '3px 6px', marginTop: '2px',
                                                background: 'rgba(168, 85, 247, 0.15)', border: '1px solid rgba(168, 85, 247, 0.3)',
                                                borderRadius: '6px', textAlign: 'center',
                                            }}
                                        >
                                            🛡️ VPN DETECTED — Fly to {tx.ipCity} ✈️
                                        </div>
                                    )}
                                    {tx.isVpn && (!tx.ipLat || !tx.ipLon) && (
                                        <div style={{ color: '#a855f7', fontSize: '10px', fontWeight: 'bold' }}>
                                            🛡️ VPN DETECTED
                                        </div>
                                    )}
                                </div>
                            ))}
                            {selectedCluster.txs.length > 5 && (
                                <div style={{ color: '#64748b', marginTop: '4px' }}>
                                    +{selectedCluster.txs.length - 5} more...
                                </div>
                            )}
                        </div>
                    </InfoWindowF>
                )}
            </GoogleMap>

            {/* Legend Overlay */}
            <div className="absolute bottom-4 left-4 z-[10] bg-slate-900/90 backdrop-blur-sm border border-slate-700 rounded-xl p-4 text-[10px] space-y-2">
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
            <div className="absolute top-4 right-4 z-[10] bg-slate-900/90 backdrop-blur-sm border border-slate-700 rounded-xl p-4 text-xs">
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
