'use client';

import { useEffect, useState } from 'react';
import { FraudGraph } from "@/components/fraud/FraudGraph";
import { getRealFraudData } from "@/app/actions";
import { Card } from "@/components/ui/card";
import { RefreshCw, Wifi, WifiOff } from "lucide-react";
import { supabase } from '@/lib/supabase';

export default function NetworkPage() {
    const [data, setData] = useState<any>({ graphElements: [] });
    const [loading, setLoading] = useState(true);
    const [liveMode, setLiveMode] = useState(true);
    const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
    const [hackerInfo, setHackerInfo] = useState<any>(null);
    const [actionLoading, setActionLoading] = useState(false);
    const [isUnmasked, setIsUnmasked] = useState(false);
    const [justification, setJustification] = useState('');

    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    const fetchData = async (forceUnmask?: boolean) => {
        // Get authenticated user if exists
        const { data: { user } } = await supabase.auth.getUser();
        const userId = user?.id || undefined;

        const result = await getRealFraudData(userId, forceUnmask ?? isUnmasked);
        setData(result);
        setHackerInfo(result.hackerInfo);
        setLastUpdate(new Date());
        setLoading(false);
    };

    const handleUnmaskRequest = async () => {
        if (isUnmasked) {
            setIsUnmasked(false);
            fetchData(false);
            return;
        }

        const reason = prompt("🔐 SECURITY CLEARANCE REQUIRED\nPlease provide a justification for viewing unmasked PII (Account Numbers):");
        if (reason && reason.length > 5) {
            setJustification(reason);
            setIsUnmasked(true);
            setLoading(true);
            fetchData(true);
        } else if (reason !== null) {
            alert("❌ Access Denied: Justification too short.");
        }
    };

    const handleFreeze = async () => {
        if (!hackerInfo?.id) return;
        if (!confirm(`Confirm: Freeze account ${hackerInfo.name}?`)) return;

        setActionLoading(true);
        try {
            const { freezeAccount } = await import('@/app/actions');
            const result = await freezeAccount(hackerInfo.id);
            if (result.success) {
                alert(`SUCCESS: Account ${hackerInfo.name} frozen.`);
                fetchData();
            } else {
                alert(`ERROR: ${result.error}`);
            }
        } catch (err) {
            alert("Freeze action failed.");
        } finally {
            setActionLoading(false);
        }
    };

    const handleUnfreeze = async () => {
        if (!hackerInfo?.id) return;
        if (!confirm(`Confirm: Unfreeze account ${hackerInfo.name}? This will restore transaction capabilities.`)) return;

        setActionLoading(true);
        try {
            const { unfreezeAccount } = await import('@/app/actions');
            const result = await unfreezeAccount(hackerInfo.id);
            if (result.success) {
                alert(`SUCCESS: Account ${hackerInfo.name} unfrozen.`);
                fetchData();
            } else {
                alert(`ERROR: ${result.error}`);
            }
        } catch (err) {
            alert("Unfreeze action failed.");
        } finally {
            setActionLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Auto-refresh every 5 seconds when live mode is on
    useEffect(() => {
        if (!liveMode) return;

        const interval = setInterval(() => {
            fetchData();
        }, 5000);

        return () => clearInterval(interval);
    }, [liveMode]);

    return (
        <div className="h-[calc(100vh-140px)] flex flex-col space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-100">🔍 Live Fraud Monitor</h1>
                    <p className="text-slate-400 text-sm">
                        Real-time visualization from Supabase • {data.graphElements?.length || 0} nodes
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    {/* Live Mode Toggle */}
                    <button
                        onClick={() => setLiveMode(!liveMode)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all ${liveMode
                            ? 'bg-green-900/30 border-green-700 text-green-400'
                            : 'bg-slate-800 border-slate-700 text-slate-400'
                            }`}
                    >
                        {liveMode ? <Wifi size={16} className="animate-pulse" /> : <WifiOff size={16} />}
                        {liveMode ? 'LIVE' : 'Paused'}
                    </button>

                    {/* PII Unmasking Toggle */}
                    <button
                        onClick={handleUnmaskRequest}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all ${isUnmasked
                            ? 'bg-blue-900/40 border-blue-500 text-blue-300 shadow-[0_0_15px_rgba(59,130,246,0.5)]'
                            : 'bg-slate-800 border-slate-700 text-slate-400'
                            }`}
                    >
                        <span className="text-xs font-bold">{isUnmasked ? '🔓 UNMASKED' : '🔒 MASKED'}</span>
                    </button>

                    {/* Manual Refresh */}
                    <button
                        onClick={() => fetchData()}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 hover:bg-slate-700"
                    >
                        <RefreshCw size={16} /> Refresh
                    </button>

                    {/* Reset Simulation */}
                    <button
                        onClick={async () => {
                            if (confirm("⚠️ RESET SIMULATION?\n\nThis will delete all transactions and reset account risk scores. This action cannot be undone.")) {
                                setLoading(true);
                                try {
                                    const { resetSimulationData } = await import('@/app/actions');
                                    await resetSimulationData();
                                    alert("✅ Simulation reset successfully.");
                                    fetchData();
                                } catch (e) {
                                    alert("❌ Reset failed");
                                } finally {
                                    setLoading(false);
                                }
                            }
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-800 border-l border-slate-700 hover:bg-red-900/20 hover:text-red-400 text-slate-400 transition-colors"
                        title="Reset Graph & Data"
                    >
                        <RefreshCw size={16} className="rotate-180" /> Reset
                    </button>
                </div>

            </div>

            {/* Hacker Detection Alert */}
            {hackerInfo && (
                <div className={`border rounded-xl p-4 flex items-center justify-between ${(hackerInfo as any)?.is_frozen
                    ? 'bg-slate-800/50 border-slate-600'
                    : 'bg-red-900/30 border-red-700 animate-pulse'
                    }`}>
                    <div>
                        <div className={`font-bold text-lg flex items-center gap-2 ${(hackerInfo as any)?.is_frozen ? 'text-slate-400' : 'text-red-400'
                            }`}>
                            {(hackerInfo as any)?.is_frozen ? '⛔ ACCOUNT FROZEN' : '🚨 FRAUD DETECTED!'}
                        </div>
                        <div className={`text-sm ${(hackerInfo as any)?.is_frozen ? 'text-slate-400' : 'text-red-300'
                            }`}>
                            Account <strong>"{hackerInfo.name}"</strong> is receiving funds from {hackerInfo.inDegree} different sources.
                            <span className={`ml-2 ${(hackerInfo as any)?.is_frozen ? 'text-slate-500' : 'text-red-500'
                                }`}>
                                {(hackerInfo as any)?.is_frozen ? 'Transactions Blocked' : 'Fan-In Attack Identified'}
                            </span>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        {(hackerInfo as any)?.is_frozen ? (
                            <button
                                onClick={handleUnfreeze}
                                disabled={actionLoading}
                                className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg font-semibold disabled:opacity-50 flex items-center gap-2"
                            >
                                {actionLoading ? 'Processing...' : '🔓 Unfreeze Account'}
                            </button>
                        ) : (
                            <button
                                onClick={handleFreeze}
                                disabled={actionLoading}
                                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg font-semibold disabled:opacity-50"
                            >
                                {actionLoading ? 'Processing...' : 'Freeze Account'}
                            </button>
                        )}
                    </div>
                </div>
            )}

            <Card className="flex-1 border-slate-800 bg-slate-950/50 flex flex-col overflow-hidden relative">
                <div className={`absolute top-0 left-0 w-full h-1 z-20 ${hackerInfo ? 'bg-red-500 animate-pulse' : 'bg-gradient-to-r from-cyan-500 to-blue-500'}`}></div>

                {/* Last Update Indicator */}
                <div className="absolute top-3 right-3 z-30 text-xs text-slate-500 bg-slate-900/80 px-2 py-1 rounded">
                    {isMounted && lastUpdate ? `Updated: ${lastUpdate.toLocaleTimeString()}` : 'Loading...'}
                </div>

                <div className="flex-1 relative bg-slate-900/20">
                    {loading ? (
                        <div className="flex items-center justify-center h-full text-slate-500">
                            Loading graph...
                        </div>
                    ) : data.graphElements?.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-slate-500">
                            <div className="text-4xl mb-4">📊</div>
                            <div>No transactions yet. Start sending money from user accounts!</div>
                        </div>
                    ) : (
                        <FraudGraph elements={data.graphElements} />
                    )}
                </div>
            </Card>
        </div>
    );
}
