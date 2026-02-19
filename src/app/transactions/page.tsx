'use client';

import React, { useState, useEffect } from 'react';
import { getRealFraudData } from '@/app/actions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Search, Info, MapPin, Monitor, Smartphone, Globe, Hash } from 'lucide-react';

export default function TransactionsPage() {
    const [transactions, setTransactions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedTx, setSelectedTx] = useState<any>(null);

    const loadTransactions = async () => {
        const data = await getRealFraudData();
        // The getRealFraudData returns timelineEvents which have the details
        setTransactions(data.timelineEvents || []);
        setLoading(false);
    };

    useEffect(() => {
        loadTransactions();
        const interval = setInterval(loadTransactions, 5000); // Polling for live data
        return () => clearInterval(interval);
    }, []);

    const filteredTx = transactions.filter(tx =>
        tx.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tx.id.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6 max-w-[1200px] mx-auto pb-10">
            <header>
                <h1 className="text-3xl font-bold text-white mb-2">Transactions Ledger</h1>
                <p className="text-slate-400 text-sm">Real-time forensic monitoring of all banking traffic</p>
            </header>

            <div className="flex flex-col lg:flex-row gap-6">
                {/* Transaction List */}
                <Card className="flex-1 border-slate-800 bg-slate-950/50">
                    <CardHeader className="pb-3 border-b border-slate-800/50">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                            <input
                                type="text"
                                placeholder="Search by User, ID or Description..."
                                className="w-full bg-slate-900 border border-slate-800 rounded-lg py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="text-[10px] uppercase text-slate-500 bg-slate-900/50 tracking-widest border-b border-slate-800">
                                    <tr>
                                        <th className="px-6 py-4 font-bold">Transaction ID</th>
                                        <th className="px-6 py-4 font-bold">Flow</th>
                                        <th className="px-6 py-4 font-bold">Timestamp</th>
                                        <th className="px-6 py-4 font-bold">Status</th>
                                        <th className="px-6 py-4 font-bold text-right font-mono">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/50">
                                    {loading ? (
                                        <tr><td colSpan={5} className="px-6 py-10 text-center text-slate-500">Loading live data...</td></tr>
                                    ) : filteredTx.length === 0 ? (
                                        <tr><td colSpan={5} className="px-6 py-10 text-center text-slate-500">No transactions found</td></tr>
                                    ) : (
                                        filteredTx.map((tx) => (
                                            <tr
                                                key={tx.id}
                                                className={`hover:bg-slate-900/50 transition-colors cursor-pointer ${selectedTx?.id === tx.id ? 'bg-cyan-950/20' : ''}`}
                                                onClick={() => setSelectedTx(tx)}
                                            >
                                                <td className="px-6 py-4 font-mono text-[10px] text-slate-400">{tx.id.substring(0, 13)}...</td>
                                                <td className="px-6 py-4 font-medium text-slate-200">{tx.description}</td>
                                                <td className="px-6 py-4 text-slate-500 text-[11px] font-mono">
                                                    {new Date(tx.timestamp).toLocaleString()}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-tight ${tx.riskLevel === 'critical' ? 'bg-red-500/10 text-red-500 border border-red-500/20' :
                                                        tx.riskLevel === 'high' ? 'bg-orange-500/10 text-orange-500 border border-orange-500/20' :
                                                            tx.riskLevel === 'medium' ? 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20' :
                                                                'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                                                        }`}>
                                                        {tx.riskLevel === 'critical' ? 'Alert' : tx.riskLevel === 'high' ? 'Caution' : tx.riskLevel === 'medium' ? 'Caution' : 'Secure'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <button className="text-cyan-400 hover:text-cyan-300 font-bold text-xs">VIEW PACKET</button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>

                {/* Forensics Detail Sidebar */}
                <div className="w-full lg:w-96 flex flex-col gap-6">
                    <Card className="border-slate-800 bg-slate-950/50 h-full">
                        <CardHeader className="pb-3 border-b border-slate-800/50">
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <Info className="w-5 h-5 text-cyan-400" />
                                Forensics Packet
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-6">
                            {selectedTx ? (
                                <div className="space-y-6 animate-in fade-in duration-500">
                                    <div className="bg-slate-900 p-4 rounded-lg border border-slate-800">
                                        <div className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-1">Transaction ID</div>
                                        <div className="text-sm font-mono text-cyan-400 break-all">{selectedTx.id}</div>
                                    </div>

                                    <div className="grid grid-cols-1 gap-4">
                                        <div className="flex items-start gap-3">
                                            <div className="p-2 bg-slate-900 rounded-lg text-slate-400">
                                                <Globe className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <div className="text-[10px] text-slate-500 uppercase font-bold">IP Address</div>
                                                <div className="text-sm font-mono text-slate-200">{selectedTx.details?.ip}</div>
                                                <div className="text-[10px] text-slate-600 font-mono">Subnet: {selectedTx.details?.subnet}</div>
                                            </div>
                                        </div>

                                        {/* VPN Status */}
                                        {selectedTx.details?.isVpn && (
                                            <div className="bg-orange-950/20 border border-orange-800/50 rounded-lg p-3 animate-pulse">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-lg">🛡️</span>
                                                    <div>
                                                        <div className="text-[10px] text-orange-400 uppercase font-bold">VPN / Proxy Detected</div>
                                                        <div className="text-[10px] text-orange-300/70">Network appears to be routed through a proxy or VPN service</div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* ISP Info */}
                                        <div className="flex items-start gap-3">
                                            <div className="p-2 bg-slate-900 rounded-lg text-slate-400">
                                                <Globe className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <div className="text-[10px] text-slate-500 uppercase font-bold">ISP / Network Provider</div>
                                                <div className={`text-sm font-mono ${selectedTx.details?.isVpn ? 'text-orange-400' : 'text-slate-200'}`}>{selectedTx.details?.isp || 'Unknown'}</div>
                                                <div className="text-[10px] text-slate-600">IP City: {selectedTx.details?.ipCity || 'Unknown'}</div>
                                            </div>
                                        </div>

                                        {/* MAC Address */}
                                        <div className="flex items-start gap-3">
                                            <div className="p-2 bg-slate-900 rounded-lg text-slate-400">
                                                <Hash className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <div className="text-[10px] text-slate-500 uppercase font-bold">MAC Address</div>
                                                <div className="text-sm font-mono text-emerald-400">{selectedTx.details?.macAddress || 'N/A'}</div>
                                            </div>
                                        </div>

                                        <div className="flex items-start gap-3">
                                            <div className="p-2 bg-slate-900 rounded-lg text-slate-400">
                                                <Smartphone className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <div className="text-[10px] text-slate-500 uppercase font-bold">Hardware Signature</div>
                                                <div className="text-sm font-mono text-purple-400">{selectedTx.details?.imei}</div>
                                                <div className="text-[10px] text-slate-600">Platform: {selectedTx.details?.device}</div>
                                            </div>
                                        </div>

                                        <div className="flex items-start gap-3">
                                            <div className="p-2 bg-slate-900 rounded-lg text-slate-400">
                                                <MapPin className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <div className="text-[10px] text-slate-500 uppercase font-bold">Geo Location</div>
                                                <div className="text-sm text-slate-200">{selectedTx.details?.location}</div>
                                            </div>
                                        </div>

                                        <div className="flex items-start gap-3">
                                            <div className="p-2 bg-slate-900 rounded-lg text-slate-400">
                                                <Monitor className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <div className="text-[10px] text-slate-500 uppercase font-bold">Device Profile</div>
                                                <div className="text-sm text-slate-200">{selectedTx.details?.device}</div>
                                                <div className="text-[10px] text-slate-600 font-mono">ID: {selectedTx.details?.id?.substring(0, 8)}...</div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="pt-6 border-t border-slate-800">
                                        <div className="text-[10px] text-slate-500 uppercase font-bold text-center mb-4">Risk Evaluation</div>
                                        <div className={`p-4 rounded-xl text-center border ${selectedTx.riskLevel === 'critical' ? 'bg-red-950/20 border-red-900/50 text-red-500' :
                                            selectedTx.riskLevel === 'high' ? 'bg-orange-950/20 border-orange-900/50 text-orange-500' :
                                                selectedTx.riskLevel === 'medium' ? 'bg-yellow-950/20 border-yellow-900/50 text-yellow-500' :
                                                    'bg-emerald-950/20 border-emerald-900/50 text-emerald-500'
                                            }`}>
                                            <div className="text-2xl font-bold mb-1">
                                                {selectedTx.riskLevel === 'critical' ? 'CRITICAL' : selectedTx.riskLevel === 'high' ? 'HIGH' : selectedTx.riskLevel === 'medium' ? 'MEDIUM' : 'SECURE'}
                                            </div>
                                            <div className="text-[10px] opacity-70">Automated Policy Check</div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-slate-600 text-center py-20">
                                    <Hash className="w-12 h-12 mb-4 opacity-10" />
                                    <p className="text-sm px-10 italic">Select a transaction from the ledger to decrypt forensic data packets</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
