'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { getRealFraudData } from '@/app/actions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Globe, RefreshCw, Shield, AlertTriangle } from 'lucide-react';

// Dynamic import to avoid SSR issues with Leaflet
const LiveMap = dynamic(() => import('@/components/fraud/LiveMap'), {
    ssr: false,
    loading: () => (
        <div className="w-full h-[600px] bg-slate-900/50 border border-slate-800 rounded-xl flex items-center justify-center">
            <div className="text-cyan-400 animate-pulse flex items-center gap-3">
                <Globe className="w-6 h-6 animate-spin" />
                <span>Loading Global Map...</span>
            </div>
        </div>
    )
});

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

function parseCoords(location: string): { lat: number; lon: number } | null {
    if (!location || location === 'Unknown' || location === 'Unknown (Permission Denied)') return null;

    // Try to extract coords from format "City, State (lat, lon)"
    const parenMatch = location.match(/\(([^)]+)\)/);
    if (parenMatch) {
        const parts = parenMatch[1].split(',').map(s => parseFloat(s.trim()));
        if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1]) && parts[0] !== 0) {
            return { lat: parts[0], lon: parts[1] };
        }
    }

    // Try direct "lat, lon" format
    const parts = location.split(',').map(s => parseFloat(s.trim()));
    if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1]) && parts[0] !== 0) {
        return { lat: parts[0], lon: parts[1] };
    }

    return null;
}

export default function MapPage() {
    const [transactions, setTransactions] = useState<MapTransaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

    const loadMapData = async () => {
        setLoading(true);
        try {
            const data = await getRealFraudData();
            const events = data.timelineEvents || [];

            const mapTxs: MapTransaction[] = [];

            for (const event of events) {
                const details = event.details;
                if (!details) continue;

                const coords = parseCoords(details.location);
                if (!coords) continue;

                mapTxs.push({
                    id: event.id,
                    from: details.from || 'Unknown',
                    to: details.to || 'Unknown',
                    amount: details.amount || 0,
                    riskLevel: event.riskLevel || 'low',
                    isVpn: details.isVpn || false,
                    isp: details.isp || 'Unknown',
                    ip: details.ip || 'Unknown',
                    location: details.location || 'Unknown',
                    ipCity: details.ipCity || 'Unknown',
                    timestamp: event.timestamp,
                    lat: coords.lat,
                    lon: coords.lon,
                    ipLat: details.ipLat || null,
                    ipLon: details.ipLon || null
                });
            }

            setTransactions(mapTxs);
            setLastRefresh(new Date());
        } catch (e) {
            console.error('Failed to load map data:', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadMapData();
        const interval = setInterval(loadMapData, 15000); // Refresh every 15s
        return () => clearInterval(interval);
    }, []);

    const vpnCount = transactions.filter(t => t.isVpn).length;
    const criticalCount = transactions.filter(t => t.riskLevel === 'critical').length;
    const totalAmount = transactions.reduce((sum, t) => sum + t.amount, 0);

    return (
        <div className="space-y-6 max-w-[1400px] mx-auto pb-10">
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
                        <Globe className="w-8 h-8 text-cyan-400" />
                        Live Geo Map
                    </h1>
                    <p className="text-slate-400 text-sm">Real-time geographic visualization of fraud network activity</p>
                </div>
                <div className="flex items-center gap-4">
                    <span className="text-[10px] text-slate-500 font-mono">
                        Last Sync: {lastRefresh.toLocaleTimeString()}
                    </span>
                    <button
                        onClick={loadMapData}
                        className="p-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-400 hover:text-white transition-all"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </header>

            {/* Quick Stats Bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="border-slate-800 bg-slate-950/50">
                    <CardContent className="p-4">
                        <div className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Geo Nodes</div>
                        <div className="text-2xl font-bold text-cyan-400 mt-1">{transactions.length}</div>
                    </CardContent>
                </Card>
                <Card className="border-slate-800 bg-slate-950/50">
                    <CardContent className="p-4">
                        <div className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Total Flow</div>
                        <div className="text-2xl font-bold text-white mt-1">₹{totalAmount.toLocaleString()}</div>
                    </CardContent>
                </Card>
                <Card className={`border-slate-800 ${vpnCount > 0 ? 'bg-purple-950/30 border-purple-800/50' : 'bg-slate-950/50'}`}>
                    <CardContent className="p-4">
                        <div className="text-[10px] text-slate-500 uppercase font-bold tracking-widest flex items-center gap-1">
                            <Shield className="w-3 h-3" /> VPN Hits
                        </div>
                        <div className={`text-2xl font-bold mt-1 ${vpnCount > 0 ? 'text-purple-400' : 'text-slate-600'}`}>{vpnCount}</div>
                    </CardContent>
                </Card>
                <Card className={`border-slate-800 ${criticalCount > 0 ? 'bg-red-950/30 border-red-800/50' : 'bg-slate-950/50'}`}>
                    <CardContent className="p-4">
                        <div className="text-[10px] text-slate-500 uppercase font-bold tracking-widest flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> Critical
                        </div>
                        <div className={`text-2xl font-bold mt-1 ${criticalCount > 0 ? 'text-red-400' : 'text-slate-600'}`}>{criticalCount}</div>
                    </CardContent>
                </Card>
            </div>

            {/* Map */}
            <Card className="border-slate-800 bg-slate-950/50 overflow-hidden">
                <CardHeader className="pb-3 border-b border-slate-800/50">
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                        Live Network Map
                        <span className="text-[10px] text-slate-500 font-normal ml-auto">OpenStreetMap | Leaflet</span>
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="h-[650px]">
                        {transactions.length > 0 ? (
                            <LiveMap transactions={transactions} />
                        ) : loading ? (
                            <div className="w-full h-full flex items-center justify-center bg-slate-900/50">
                                <div className="text-cyan-400 animate-pulse flex items-center gap-3">
                                    <Globe className="w-6 h-6 animate-spin" />
                                    <span>Scanning global network...</span>
                                </div>
                            </div>
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900/50 text-slate-500">
                                <Globe className="w-16 h-16 mb-4 opacity-20" />
                                <p className="text-sm">No geo-tagged transactions found</p>
                                <p className="text-[10px] mt-1">Transactions need GPS location data to appear on the map</p>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
