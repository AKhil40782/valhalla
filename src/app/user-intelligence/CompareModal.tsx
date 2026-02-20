'use client';

import { useEffect, useState } from 'react';
import { X, Shield, Globe, Monitor, CreditCard, AlertTriangle, ArrowLeftRight, Check } from 'lucide-react';
import { compareAccounts } from './actions';
import { RiskBadge } from './RiskBadge';
import { motion } from 'framer-motion';

interface CompareModalProps {
    accountIdA: string;
    accountIdB: string;
    onClose: () => void;
}

export function CompareModal({ accountIdA, accountIdB, onClose }: CompareModalProps) {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            const result = await compareAccounts(accountIdA, accountIdB);
            setData(result);
            setLoading(false);
        })();
    }, [accountIdA, accountIdB]);

    const pA = data?.accountA?.profile;
    const pB = data?.accountB?.profile;
    const common = data?.commonalities;

    const MetricRow = ({ label, valA, valB, highlight }: { label: string; valA: any; valB: any; highlight?: boolean }) => {
        const isEqual = String(valA) === String(valB);
        return (
            <tr className={`border-b border-slate-800/50 ${highlight ? 'bg-red-950/10' : ''}`}>
                <td className="py-2.5 px-3 text-xs text-right font-mono text-slate-300 w-[38%]">
                    {valA}
                </td>
                <td className="py-2.5 px-3 text-xs text-center text-slate-500 font-semibold uppercase tracking-wider w-[24%] bg-slate-900/50">
                    <span className="flex items-center gap-1 justify-center">
                        {label}
                        {isEqual && <Check className="w-3 h-3 text-emerald-400" />}
                    </span>
                </td>
                <td className="py-2.5 px-3 text-xs font-mono text-slate-300 w-[38%]">
                    {valB}
                </td>
            </tr>
        );
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-slate-950 border border-slate-700 rounded-2xl w-[95vw] max-w-[900px] max-h-[85vh] overflow-y-auto shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 sticky top-0 bg-slate-950/95 backdrop-blur-sm z-10">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-gradient-to-br from-violet-600/20 to-cyan-600/20 border border-violet-500/30">
                            <ArrowLeftRight className="w-5 h-5 text-violet-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-100">Account Comparison</h2>
                            <p className="text-xs text-slate-500">Side-by-side intelligence analysis</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg bg-red-950/50 hover:bg-red-900/50 text-red-400 transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="flex flex-col items-center gap-3 text-slate-500">
                            <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                            <span className="text-sm">Analyzing accounts...</span>
                        </div>
                    </div>
                ) : pA && pB ? (
                    <div className="p-6 space-y-6">
                        {/* Account Headers */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-slate-900/60 rounded-xl border border-slate-800 p-4 text-center">
                                <div className="w-12 h-12 rounded-full bg-cyan-950/50 border-2 border-cyan-700 flex items-center justify-center text-lg font-bold text-cyan-400 mx-auto mb-2">
                                    {(pA.user_name || 'A').charAt(0)}
                                </div>
                                <p className="text-sm font-bold text-slate-100">{pA.user_name}</p>
                                <p className="text-[10px] text-slate-500 font-mono">{pA.account_number}</p>
                                <div className="mt-2 flex justify-center"><RiskBadge level={pA.risk_level} score={pA.risk_score} size="sm" /></div>
                            </div>
                            <div className="bg-slate-900/60 rounded-xl border border-slate-800 p-4 text-center">
                                <div className="w-12 h-12 rounded-full bg-violet-950/50 border-2 border-violet-700 flex items-center justify-center text-lg font-bold text-violet-400 mx-auto mb-2">
                                    {(pB.user_name || 'B').charAt(0)}
                                </div>
                                <p className="text-sm font-bold text-slate-100">{pB.user_name}</p>
                                <p className="text-[10px] text-slate-500 font-mono">{pB.account_number}</p>
                                <div className="mt-2 flex justify-center"><RiskBadge level={pB.risk_level} score={pB.risk_score} size="sm" /></div>
                            </div>
                        </div>

                        {/* Commonalities Banner */}
                        {common && (common.shared_ips.length > 0 || common.shared_devices.length > 0 || common.direct_transactions > 0) && (
                            <div className="bg-red-950/20 border border-red-800/50 rounded-xl p-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <AlertTriangle className="w-4 h-4 text-red-400" />
                                    <span className="text-sm font-bold text-red-400">Shared Attributes Detected</span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {common.shared_ips.length > 0 && (
                                        <span className="text-xs px-2 py-1 rounded-full bg-yellow-950/50 border border-yellow-800 text-yellow-400">
                                            <Globe className="w-3 h-3 inline mr-1" />{common.shared_ips.length} shared IP(s)
                                        </span>
                                    )}
                                    {common.shared_devices.length > 0 && (
                                        <span className="text-xs px-2 py-1 rounded-full bg-red-950/50 border border-red-800 text-red-400">
                                            <Monitor className="w-3 h-3 inline mr-1" />{common.shared_devices.length} shared device(s)
                                        </span>
                                    )}
                                    {common.direct_transactions > 0 && (
                                        <span className="text-xs px-2 py-1 rounded-full bg-purple-950/50 border border-purple-800 text-purple-400">
                                            <CreditCard className="w-3 h-3 inline mr-1" />{common.direct_transactions} direct transaction(s)
                                        </span>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Side-by-side Metrics Table */}
                        <div className="bg-slate-900/60 rounded-xl border border-slate-800 overflow-hidden">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-slate-700 bg-slate-900">
                                        <th className="py-2 px-3 text-xs text-right font-semibold text-cyan-400 w-[38%]">Account A</th>
                                        <th className="py-2 px-3 text-xs text-center font-semibold text-slate-400 w-[24%]">Metric</th>
                                        <th className="py-2 px-3 text-xs text-left font-semibold text-violet-400 w-[38%]">Account B</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <MetricRow label="Risk Score" valA={pA.risk_score} valB={pB.risk_score} />
                                    <MetricRow label="Risk Level" valA={pA.risk_level} valB={pB.risk_level} highlight={common?.same_risk_level} />
                                    <MetricRow label="Balance" valA={`₹${Number(pA.balance || 0).toLocaleString()}`} valB={`₹${Number(pB.balance || 0).toLocaleString()}`} />
                                    <MetricRow label="Total Sent" valA={`₹${pA.total_sent?.toLocaleString()}`} valB={`₹${pB.total_sent?.toLocaleString()}`} />
                                    <MetricRow label="Total Received" valA={`₹${pA.total_received?.toLocaleString()}`} valB={`₹${pB.total_received?.toLocaleString()}`} />
                                    <MetricRow label="Transactions" valA={pA.tx_count} valB={pB.tx_count} />
                                    <MetricRow label="VPN Txns" valA={pA.vpn_tx_count} valB={pB.vpn_tx_count} highlight={pA.vpn_tx_count > 0 && pB.vpn_tx_count > 0} />
                                    <MetricRow label="Unique IPs" valA={pA.unique_ips?.length || 0} valB={pB.unique_ips?.length || 0} />
                                    <MetricRow label="Unique Devices" valA={pA.unique_devices?.length || 0} valB={pB.unique_devices?.length || 0} />
                                    <MetricRow label="Frozen" valA={pA.is_frozen ? '❄️ Yes' : 'No'} valB={pB.is_frozen ? '❄️ Yes' : 'No'} />
                                    <MetricRow label="Simulated" valA={pA.is_simulated ? 'Yes' : 'No'} valB={pB.is_simulated ? 'Yes' : 'No'} />
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    <div className="p-6 text-center text-red-400">Failed to load account data</div>
                )}
            </motion.div>
        </div>
    );
}
