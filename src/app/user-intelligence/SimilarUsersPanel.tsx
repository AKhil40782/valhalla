'use client';

import { useEffect, useState } from 'react';
import { X, Users, Shield, Globe, Monitor, Loader2 } from 'lucide-react';
import { findSimilarAccounts } from './actions';
import { RiskBadge } from './RiskBadge';
import { motion } from 'framer-motion';

interface SimilarUsersPanelProps {
    accountId: string;
    accountName: string;
    onClose: () => void;
}

export function SimilarUsersPanel({ accountId, accountName, onClose }: SimilarUsersPanelProps) {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            const result = await findSimilarAccounts(accountId, 15);
            setData(result);
            setLoading(false);
        })();
    }, [accountId]);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
            <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 30 }}
                className="bg-slate-950 border border-slate-700 rounded-2xl w-[95vw] max-w-[750px] max-h-[85vh] overflow-hidden shadow-2xl flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-600/20 to-cyan-600/20 border border-emerald-500/30">
                            <Users className="w-5 h-5 text-emerald-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-100">Similar Accounts</h2>
                            <p className="text-xs text-slate-500">Accounts matching the pattern of <span className="text-cyan-400 font-medium">{accountName}</span></p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg bg-red-950/50 hover:bg-red-900/50 text-red-400 transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4">
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <div className="flex flex-col items-center gap-3 text-slate-500">
                                <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                                <span className="text-sm">Analyzing similarity patterns…</span>
                                <span className="text-[10px] text-slate-600">Comparing risk scores, devices, IPs, and transaction patterns</span>
                            </div>
                        </div>
                    ) : data?.similar?.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-slate-500">
                            <Users className="w-10 h-10 mb-3 opacity-30" />
                            <p className="text-sm font-medium">No similar accounts found</p>
                            <p className="text-xs text-slate-600 mt-1">No accounts share enough common traits</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {data?.similar?.map((account: any, i: number) => (
                                <motion.div
                                    key={account.id}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: i * 0.05 }}
                                    className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-all"
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border ${account.risk_level === 'CRITICAL' ? 'bg-red-950/50 border-red-700 text-red-400' :
                                                    account.risk_level === 'HIGH' ? 'bg-orange-950/50 border-orange-700 text-orange-400' :
                                                        account.risk_level === 'MEDIUM' ? 'bg-yellow-950/50 border-yellow-700 text-yellow-400' :
                                                            'bg-emerald-950/50 border-emerald-700 text-emerald-400'
                                                }`}>
                                                {(account.virtual_name || account.account_number).charAt(0)}
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-slate-200">{account.virtual_name || account.account_number}</p>
                                                <p className="text-[10px] text-slate-600 font-mono">{account.account_number}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <RiskBadge level={account.risk_level} score={account.risk_score} size="sm" />
                                            <div className="text-right">
                                                <div className="flex items-center gap-1">
                                                    <span className="text-lg font-bold text-emerald-400">{account.similarity_score}</span>
                                                    <span className="text-[10px] text-slate-500">/ 100</span>
                                                </div>
                                                <p className="text-[10px] text-slate-500">Similarity</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Similarity bar */}
                                    <div className="w-full bg-slate-800 rounded-full h-1.5 mb-2">
                                        <div
                                            className="h-1.5 rounded-full bg-gradient-to-r from-emerald-600 to-cyan-500 transition-all duration-500"
                                            style={{ width: `${account.similarity_score}%` }}
                                        />
                                    </div>

                                    {/* Reasons */}
                                    <div className="flex flex-wrap gap-1.5">
                                        {account.reasons.map((reason: string, j: number) => (
                                            <span key={j} className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${reason.includes('device') ? 'bg-red-950/50 border border-red-800/50 text-red-400' :
                                                    reason.includes('IP') ? 'bg-yellow-950/50 border border-yellow-800/50 text-yellow-400' :
                                                        reason.includes('VPN') ? 'bg-purple-950/50 border border-purple-800/50 text-purple-400' :
                                                            reason.includes('risk') ? 'bg-cyan-950/50 border border-cyan-800/50 text-cyan-400' :
                                                                'bg-slate-800 border border-slate-700 text-slate-400'
                                                }`}>
                                                {reason}
                                            </span>
                                        ))}
                                        {account.tx_count > 0 && (
                                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-400">
                                                {account.tx_count} txns
                                            </span>
                                        )}
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
}
