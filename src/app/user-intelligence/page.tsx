'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { AdminGuard } from '@/components/auth/AdminGuard';
import {
    Brain, Users, AlertTriangle, TrendingUp, Activity, Shield, Snowflake,
    Search, ChevronDown, ChevronUp, RefreshCw, Share2, Filter,
    ArrowUpDown, ChevronRight, X, CreditCard, Globe, Monitor,
    Download, ArrowLeftRight, UserSearch, CheckSquare, Square
} from 'lucide-react';
import { getUserActivityList, getUserProfile, getAccountExportData, type UserActivityParams, type UserIntelligenceRecord } from './actions';
import { RiskBadge } from './RiskBadge';
import { ActivityTimeline } from './ActivityTimeline';
import { NetworkGraphModal } from './NetworkGraphModal';
import { CompareModal } from './CompareModal';
import { SimilarUsersPanel } from './SimilarUsersPanel';
import { BehaviourRadarChart } from './BehaviourRadarChart';
import { motion, AnimatePresence } from 'framer-motion';

const RISK_LEVELS = ['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

const SORT_OPTIONS = [
    { value: 'risk_score', label: 'Risk Score' },
    { value: 'virtual_name', label: 'Name' },
    { value: 'tx_count', label: 'Transactions' },
    { value: 'total_amount', label: 'Total Amount' },
    { value: 'last_tx', label: 'Last Activity' },
];

export default function UserIntelligencePage() {
    const [data, setData] = useState<{ users: UserIntelligenceRecord[], totalCount: number, stats: any }>({
        users: [], totalCount: 0, stats: {}
    });
    const [loading, setLoading] = useState(true);
    const [params, setParams] = useState<UserActivityParams>({
        page: 1, pageSize: 20, sortBy: 'risk_score', sortOrder: 'desc', filterRiskLevel: 'ALL', search: '',
        includeSimulated: true,
    });

    // Expanded row
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [expandedData, setExpandedData] = useState<any>(null);
    const [expandedLoading, setExpandedLoading] = useState(false);

    // Network graph modal
    const [networkTarget, setNetworkTarget] = useState<{ id: string; name: string } | null>(null);

    // Selection state
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Compare modal
    const [compareIds, setCompareIds] = useState<[string, string] | null>(null);

    // Similar users panel
    const [similarTarget, setSimilarTarget] = useState<{ id: string; name: string } | null>(null);

    // Download state
    const [downloading, setDownloading] = useState(false);

    const fetchData = useCallback(async () => {
        setLoading(true);
        const result = await getUserActivityList(params);
        setData(result);
        setLoading(false);
    }, [params]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleExpand = async (accountId: string) => {
        if (expandedId === accountId) {
            setExpandedId(null);
            setExpandedData(null);
            return;
        }
        setExpandedId(accountId);
        setExpandedLoading(true);
        const result = await getUserProfile(accountId);
        setExpandedData(result);
        setExpandedLoading(false);
    };

    const handleSort = (field: string) => {
        setParams(p => ({
            ...p,
            sortBy: field as any,
            sortOrder: p.sortBy === field && p.sortOrder === 'desc' ? 'asc' : 'desc',
            page: 1,
        }));
    };

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === data.users.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(data.users.map(u => u.id)));
        }
    };

    const handleDownload = async () => {
        const ids = [...selectedIds];
        if (ids.length === 0) return;
        setDownloading(true);
        try {
            const result = await getAccountExportData(ids);
            const json = JSON.stringify(result.data, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `user_intelligence_${ids.length}_accounts_${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (e) {
            console.error('Download failed:', e);
        }
        setDownloading(false);
    };

    const handleCompare = () => {
        const ids = [...selectedIds];
        if (ids.length === 2) {
            setCompareIds([ids[0], ids[1]]);
        }
    };

    const handleFindSimilar = () => {
        const ids = [...selectedIds];
        if (ids.length === 1) {
            const account = data.users.find(u => u.id === ids[0]);
            setSimilarTarget({ id: ids[0], name: account?.virtual_name || account?.account_number || ids[0] });
        }
    };

    const SortIcon = ({ field }: { field: string }) => {
        if (params.sortBy !== field) return <ArrowUpDown className="w-3 h-3 opacity-30" />;
        return params.sortOrder === 'asc' ? <ChevronUp className="w-3 h-3 text-cyan-400" /> : <ChevronDown className="w-3 h-3 text-cyan-400" />;
    };

    const stats = data.stats || {};

    return (
        <AdminGuard>
            <div className="space-y-6 max-w-[1600px] mx-auto pb-10">
                {/* Page Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-600/20 to-cyan-600/20 border border-violet-500/30">
                                <Brain className="w-6 h-6 text-violet-400" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold bg-gradient-to-r from-violet-400 via-cyan-400 to-emerald-400 bg-clip-text text-transparent">
                                    User Activity Intelligence
                                </h1>
                                <p className="text-sm text-slate-500">Real-time account analytics derived from live transaction data</p>
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={fetchData}
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 hover:bg-slate-700 disabled:opacity-50 transition-colors"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                </div>

                {/* Stats Row */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3">
                    {[
                        { label: 'Total Accounts', value: stats.totalAccounts || 0, icon: Users, color: 'text-cyan-400', bg: 'from-cyan-500/10 to-cyan-500/5' },
                        { label: 'High Risk', value: stats.highRiskCount || 0, icon: AlertTriangle, color: 'text-orange-400', bg: 'from-orange-500/10 to-orange-500/5' },
                        { label: 'Critical', value: stats.criticalCount || 0, icon: Shield, color: 'text-red-400', bg: 'from-red-500/10 to-red-500/5' },
                        { label: 'Frozen', value: stats.frozenAccounts || 0, icon: Snowflake, color: 'text-blue-400', bg: 'from-blue-500/10 to-blue-500/5' },
                        { label: 'Avg Risk', value: stats.avgRisk || 0, icon: TrendingUp, color: 'text-yellow-400', bg: 'from-yellow-500/10 to-yellow-500/5' },
                        { label: 'Linked Groups', value: stats.linkedGroups || 0, icon: Share2, color: 'text-purple-400', bg: 'from-purple-500/10 to-purple-500/5' },
                        { label: 'Transactions', value: stats.totalTransactions || 0, icon: Activity, color: 'text-emerald-400', bg: 'from-emerald-500/10 to-emerald-500/5' },
                    ].map((stat, i) => (
                        <Card key={i} className="bg-slate-900/40 border-slate-800/60 backdrop-blur-sm overflow-hidden relative">
                            <div className={`absolute inset-0 bg-gradient-to-br ${stat.bg} pointer-events-none`} />
                            <CardContent className="p-3 flex items-center justify-between relative z-10">
                                <div>
                                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{stat.label}</p>
                                    <div className="text-xl font-bold text-slate-100 mt-0.5">{stat.value.toLocaleString()}</div>
                                </div>
                                <div className={`p-2 rounded-xl bg-slate-950/50 border border-slate-800 ${stat.color}`}>
                                    <stat.icon className="w-4 h-4" />
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* Filter / Search Bar */}
                <Card className="bg-slate-900/40 border-slate-800/60">
                    <CardContent className="p-4">
                        <div className="flex flex-wrap items-center gap-4">
                            {/* Search */}
                            <div className="relative flex-1 min-w-[200px]">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <input
                                    type="text"
                                    placeholder="Search by name or account number..."
                                    value={params.search || ''}
                                    onChange={(e) => setParams(p => ({ ...p, search: e.target.value, page: 1 }))}
                                    className="w-full pl-10 pr-4 py-2 bg-slate-800/60 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600/30 transition-all"
                                />
                                {params.search && (
                                    <button onClick={() => setParams(p => ({ ...p, search: '', page: 1 }))} className="absolute right-3 top-1/2 -translate-y-1/2">
                                        <X className="w-3.5 h-3.5 text-slate-500 hover:text-slate-300" />
                                    </button>
                                )}
                            </div>

                            {/* Risk Level Chips */}
                            <div className="flex items-center gap-1">
                                <Filter className="w-4 h-4 text-slate-500 mr-1" />
                                {RISK_LEVELS.map(level => (
                                    <button
                                        key={level}
                                        onClick={() => setParams(p => ({ ...p, filterRiskLevel: level, page: 1 }))}
                                        className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${params.filterRiskLevel === level
                                            ? level === 'CRITICAL' ? 'bg-red-600 text-white shadow-lg shadow-red-500/20'
                                                : level === 'HIGH' ? 'bg-orange-600 text-white shadow-lg shadow-orange-500/20'
                                                    : level === 'MEDIUM' ? 'bg-yellow-600 text-white shadow-lg shadow-yellow-500/20'
                                                        : level === 'LOW' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20'
                                                            : 'bg-cyan-600 text-white shadow-lg shadow-cyan-500/20'
                                            : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                                            }`}
                                    >
                                        {level}
                                    </button>
                                ))}
                            </div>

                            {/* Simulated toggle */}
                            <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={params.includeSimulated}
                                    onChange={(e) => setParams(p => ({ ...p, includeSimulated: e.target.checked, page: 1 }))}
                                    className="accent-cyan-500"
                                />
                                Include simulated
                            </label>

                            {/* Sort Dropdown */}
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-500">Sort:</span>
                                <select
                                    value={params.sortBy}
                                    onChange={(e) => setParams(p => ({ ...p, sortBy: e.target.value as any, page: 1 }))}
                                    className="bg-slate-800 border border-slate-700 text-sm text-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:border-cyan-600"
                                >
                                    {SORT_OPTIONS.map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>
                                <button
                                    onClick={() => setParams(p => ({ ...p, sortOrder: p.sortOrder === 'asc' ? 'desc' : 'asc' }))}
                                    className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-white transition-colors"
                                >
                                    {params.sortOrder === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                </button>
                            </div>

                            <span className="text-xs text-slate-600 ml-auto">{data.totalCount.toLocaleString()} accounts</span>
                        </div>
                    </CardContent>
                </Card>

                {/* ======== SELECTION TOOLBAR ======== */}
                <AnimatePresence>
                    {selectedIds.size > 0 && (
                        <motion.div
                            initial={{ opacity: 0, y: -10, height: 0 }}
                            animate={{ opacity: 1, y: 0, height: 'auto' }}
                            exit={{ opacity: 0, y: -10, height: 0 }}
                            transition={{ duration: 0.2 }}
                        >
                            <Card className="bg-gradient-to-r from-violet-950/40 via-slate-900/60 to-cyan-950/40 border-violet-700/50 overflow-hidden">
                                <CardContent className="p-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="flex items-center gap-2 px-3 py-1.5 bg-violet-900/40 rounded-lg border border-violet-700/50">
                                                <CheckSquare className="w-4 h-4 text-violet-400" />
                                                <span className="text-sm font-bold text-violet-300">{selectedIds.size} selected</span>
                                            </div>
                                            <button
                                                onClick={() => setSelectedIds(new Set())}
                                                className="text-xs text-slate-400 hover:text-slate-200 underline underline-offset-2 transition-colors"
                                            >
                                                Clear selection
                                            </button>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            {/* Download Button */}
                                            <button
                                                onClick={handleDownload}
                                                disabled={downloading}
                                                className="flex items-center gap-2 px-3.5 py-2 bg-emerald-900/50 border border-emerald-700/60 rounded-lg text-sm font-medium text-emerald-300 hover:bg-emerald-800/50 disabled:opacity-50 transition-all group"
                                            >
                                                <Download className={`w-4 h-4 ${downloading ? 'animate-bounce' : 'group-hover:translate-y-0.5 transition-transform'}`} />
                                                {downloading ? 'Exporting...' : `Download${selectedIds.size > 1 ? ` (${selectedIds.size})` : ''}`}
                                            </button>

                                            {/* Compare Button (exactly 2 selected) */}
                                            <button
                                                onClick={handleCompare}
                                                disabled={selectedIds.size !== 2}
                                                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all border ${selectedIds.size === 2
                                                    ? 'bg-violet-900/50 border-violet-700/60 text-violet-300 hover:bg-violet-800/50 cursor-pointer'
                                                    : 'bg-slate-800/50 border-slate-700/50 text-slate-600 cursor-not-allowed'
                                                    }`}
                                                title={selectedIds.size !== 2 ? 'Select exactly 2 accounts to compare' : 'Compare these accounts'}
                                            >
                                                <ArrowLeftRight className="w-4 h-4" />
                                                Compare
                                                {selectedIds.size !== 2 && <span className="text-[10px] opacity-60">(pick 2)</span>}
                                            </button>

                                            {/* Find Similar Button (exactly 1 selected) */}
                                            <button
                                                onClick={handleFindSimilar}
                                                disabled={selectedIds.size !== 1}
                                                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all border ${selectedIds.size === 1
                                                    ? 'bg-cyan-900/50 border-cyan-700/60 text-cyan-300 hover:bg-cyan-800/50 cursor-pointer'
                                                    : 'bg-slate-800/50 border-slate-700/50 text-slate-600 cursor-not-allowed'
                                                    }`}
                                                title={selectedIds.size !== 1 ? 'Select exactly 1 account to find similar' : 'Find similar accounts'}
                                            >
                                                <UserSearch className="w-4 h-4" />
                                                Find Similar
                                                {selectedIds.size !== 1 && <span className="text-[10px] opacity-60">(pick 1)</span>}
                                            </button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Account Table */}
                <Card className="bg-slate-900/40 border-slate-800/60 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-slate-800 bg-slate-900/60">
                                    {/* Select all checkbox */}
                                    <th className="px-3 py-3 w-10" onClick={(e) => e.stopPropagation()}>
                                        <button onClick={toggleSelectAll} className="p-0.5 rounded hover:bg-slate-700/50 transition-colors">
                                            {selectedIds.size === data.users.length && data.users.length > 0
                                                ? <CheckSquare className="w-4 h-4 text-violet-400" />
                                                : <Square className="w-4 h-4 text-slate-600" />
                                            }
                                        </button>
                                    </th>
                                    {[
                                        { key: 'virtual_name', label: 'Account' },
                                        { key: 'risk_score', label: 'Risk' },
                                        { key: 'tx_count', label: 'Txns' },
                                        { key: 'total_amount', label: 'Volume' },
                                        { key: 'last_tx', label: 'Last Activity' },
                                    ].map(col => (
                                        <th
                                            key={col.key}
                                            onClick={() => handleSort(col.key)}
                                            className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-200 transition-colors select-none"
                                        >
                                            <div className="flex items-center gap-1.5">
                                                {col.label}
                                                <SortIcon field={col.key} />
                                            </div>
                                        </th>
                                    ))}
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Intel</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/50">
                                {loading ? (
                                    <tr>
                                        <td colSpan={9} className="px-4 py-16 text-center text-slate-500">
                                            <div className="flex flex-col items-center gap-3">
                                                <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                                                <span className="text-sm">Loading account intelligence...</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : data.users.length === 0 ? (
                                    <tr>
                                        <td colSpan={9} className="px-4 py-16 text-center text-slate-500">
                                            <Brain className="w-8 h-8 mx-auto mb-3 opacity-40" />
                                            <p className="text-sm">No accounts found matching your criteria</p>
                                        </td>
                                    </tr>
                                ) : (
                                    <>
                                        {data.users.map((user) => (
                                            <AccountRow
                                                key={user.id}
                                                account={user}
                                                isExpanded={expandedId === user.id}
                                                expandedData={expandedId === user.id ? expandedData : null}
                                                expandedLoading={expandedId === user.id && expandedLoading}
                                                onExpand={() => handleExpand(user.id)}
                                                onShowNetwork={() => setNetworkTarget({ id: user.id, name: user.virtual_name || user.account_number })}
                                                isSelected={selectedIds.has(user.id)}
                                                onToggleSelect={() => toggleSelect(user.id)}
                                                onDownloadSingle={async () => {
                                                    setDownloading(true);
                                                    try {
                                                        const result = await getAccountExportData([user.id]);
                                                        const json = JSON.stringify(result.data, null, 2);
                                                        const blob = new Blob([json], { type: 'application/json' });
                                                        const url = URL.createObjectURL(blob);
                                                        const a = document.createElement('a');
                                                        a.href = url;
                                                        a.download = `user_intel_${user.account_number}_${new Date().toISOString().slice(0, 10)}.json`;
                                                        document.body.appendChild(a);
                                                        a.click();
                                                        document.body.removeChild(a);
                                                        URL.revokeObjectURL(url);
                                                    } catch (e) { console.error(e); }
                                                    setDownloading(false);
                                                }}
                                                onFindSimilar={() => setSimilarTarget({ id: user.id, name: user.virtual_name || user.account_number })}
                                            />
                                        ))}
                                    </>
                                )}
                            </tbody>
                        </table>
                    </div>
                </Card>

                {/* Network Graph Modal */}
                {networkTarget && (
                    <NetworkGraphModal
                        profileId={networkTarget.id}
                        userName={networkTarget.name}
                        onClose={() => setNetworkTarget(null)}
                    />
                )}

                {/* Compare Modal */}
                {compareIds && (
                    <CompareModal
                        accountIdA={compareIds[0]}
                        accountIdB={compareIds[1]}
                        onClose={() => setCompareIds(null)}
                    />
                )}

                {/* Similar Users Panel */}
                {similarTarget && (
                    <SimilarUsersPanel
                        accountId={similarTarget.id}
                        accountName={similarTarget.name}
                        onClose={() => setSimilarTarget(null)}
                    />
                )}
            </div>
        </AdminGuard>
    );
}

// ============================================================
// ACCOUNT ROW COMPONENT (with expandable detail + selection)
// ============================================================

function AccountRow({
    account,
    isExpanded,
    expandedData,
    expandedLoading,
    onExpand,
    onShowNetwork,
    isSelected,
    onToggleSelect,
    onDownloadSingle,
    onFindSimilar,
}: {
    account: UserIntelligenceRecord;
    isExpanded: boolean;
    expandedData: any;
    expandedLoading: boolean;
    onExpand: () => void;
    onShowNetwork: () => void;
    isSelected: boolean;
    onToggleSelect: () => void;
    onDownloadSingle: () => void;
    onFindSimilar: () => void;
}) {
    const timeAgo = (dateStr: string | null) => {
        if (!dateStr) return '—';
        const diff = Date.now() - new Date(dateStr).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 60) return `${mins}m ago`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours}h ago`;
        return `${Math.floor(hours / 24)}d ago`;
    };

    const profile = expandedData?.profile;

    return (
        <>
            {/* Main row */}
            <tr
                onClick={onExpand}
                className={`cursor-pointer transition-all hover:bg-slate-800/30 ${isExpanded ? 'bg-slate-800/40 border-l-2 border-l-cyan-500' : ''} ${isSelected ? 'bg-violet-950/20' : ''}`}
            >
                {/* Checkbox */}
                <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                    <button onClick={onToggleSelect} className="p-0.5 rounded hover:bg-slate-700/50 transition-colors">
                        {isSelected
                            ? <CheckSquare className="w-4 h-4 text-violet-400" />
                            : <Square className="w-4 h-4 text-slate-600 hover:text-slate-400" />
                        }
                    </button>
                </td>
                <td className="px-4 py-3">
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
                </td>
                <td className="px-4 py-3">
                    <RiskBadge level={account.risk_level} score={account.risk_score} size="sm" />
                </td>
                <td className="px-4 py-3 text-sm text-slate-300 font-mono">{account.tx_count}</td>
                <td className="px-4 py-3">
                    <span className={`text-sm font-mono ${account.total_amount > 10000 ? 'text-yellow-400' : 'text-slate-300'}`}>
                        ₹{account.total_amount.toLocaleString()}
                    </span>
                </td>
                <td className="px-4 py-3 text-sm text-slate-400">{timeAgo(account.last_tx)}</td>
                <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                        {account.vpn_usage > 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-950/50 border border-red-800/50 text-red-400 font-medium" title="VPN transactions">
                                VPN ×{account.vpn_usage}
                            </span>
                        )}
                        {account.unique_devices > 1 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-950/50 border border-purple-800/50 text-purple-400 font-medium" title="Multiple devices">
                                {account.unique_devices} dev
                            </span>
                        )}
                        {account.unique_ips > 1 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-cyan-950/50 border border-cyan-800/50 text-cyan-400 font-medium" title="Multiple IPs">
                                {account.unique_ips} IPs
                            </span>
                        )}
                        {account.link_count > 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-950/50 border border-orange-800/50 text-orange-400 font-medium" title="Linked accounts">
                                <Share2 className="w-2.5 h-2.5 inline" /> {account.link_count}
                            </span>
                        )}
                    </div>
                </td>
                <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                        {account.is_frozen && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-950/50 border border-blue-800/50 text-blue-400 font-bold">
                                ❄️ FROZEN
                            </span>
                        )}
                        {account.is_simulated && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-500">
                                SIM
                            </span>
                        )}
                    </div>
                </td>
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={onDownloadSingle}
                            className="p-1.5 rounded-md bg-slate-800 hover:bg-emerald-900/40 text-slate-400 hover:text-emerald-400 transition-colors border border-slate-700 hover:border-emerald-700"
                            title="Download Data"
                        >
                            <Download className="w-3.5 h-3.5" />
                        </button>
                        <button
                            onClick={onFindSimilar}
                            className="p-1.5 rounded-md bg-slate-800 hover:bg-cyan-900/40 text-slate-400 hover:text-cyan-400 transition-colors border border-slate-700 hover:border-cyan-700"
                            title="Find Similar"
                        >
                            <UserSearch className="w-3.5 h-3.5" />
                        </button>
                        <button
                            onClick={onShowNetwork}
                            className="p-1.5 rounded-md bg-slate-800 hover:bg-violet-900/40 text-slate-400 hover:text-violet-400 transition-colors border border-slate-700 hover:border-violet-700"
                            title="View Network"
                        >
                            <Share2 className="w-3.5 h-3.5" />
                        </button>
                        <ChevronRight className={`w-4 h-4 text-slate-600 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                    </div>
                </td>
            </tr>

            {/* Expanded detail */}
            <AnimatePresence>
                {isExpanded && (
                    <tr>
                        <td colSpan={9} className="p-0">
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.3 }}
                                className="overflow-hidden"
                            >
                                <div className="bg-slate-900/60 border-t border-b border-slate-700/50 p-6">
                                    {expandedLoading ? (
                                        <div className="flex items-center justify-center py-12 text-slate-500">
                                            <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                                        </div>
                                    ) : profile ? (
                                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                            {/* Left: Account Profile */}
                                            <div className="bg-slate-950/50 rounded-xl border border-slate-800 p-4 space-y-4">
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <h3 className="text-lg font-bold text-slate-100">{profile.user_name}</h3>
                                                        <p className="text-xs text-slate-500 font-mono">{profile.account_number}</p>
                                                    </div>
                                                    <RiskBadge level={profile.risk_level} score={profile.risk_score} size="lg" />
                                                </div>

                                                <div className="grid grid-cols-2 gap-2">
                                                    <div className="bg-slate-800/40 rounded-lg p-2.5 border border-slate-700/50">
                                                        <p className="text-[10px] text-slate-500 uppercase">Sent</p>
                                                        <p className="text-sm font-bold text-slate-100">₹{profile.total_sent?.toLocaleString()}</p>
                                                        <p className="text-[10px] text-slate-500">{profile.sent_count} txns</p>
                                                    </div>
                                                    <div className="bg-slate-800/40 rounded-lg p-2.5 border border-slate-700/50">
                                                        <p className="text-[10px] text-slate-500 uppercase">Received</p>
                                                        <p className="text-sm font-bold text-slate-100">₹{profile.total_received?.toLocaleString()}</p>
                                                        <p className="text-[10px] text-slate-500">{profile.received_count} txns</p>
                                                    </div>
                                                </div>

                                                <div className="space-y-1.5">
                                                    <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Intelligence</h4>
                                                    {[
                                                        { label: 'VPN Transactions', value: profile.vpn_tx_count, icon: Shield, color: profile.vpn_tx_count > 0 ? 'text-red-400' : 'text-slate-400' },
                                                        { label: 'Unique IPs', value: profile.unique_ips?.length || 0, icon: Globe, color: (profile.unique_ips?.length || 0) > 2 ? 'text-orange-400' : 'text-slate-400' },
                                                        { label: 'Unique Devices', value: profile.unique_devices?.length || 0, icon: Monitor, color: (profile.unique_devices?.length || 0) > 2 ? 'text-orange-400' : 'text-slate-400' },
                                                        { label: 'Balance', value: `₹${Number(profile.balance || 0).toLocaleString()}`, icon: CreditCard, color: 'text-slate-300' },
                                                    ].map((m) => (
                                                        <div key={m.label} className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-slate-800/30">
                                                            <div className="flex items-center gap-2 text-xs text-slate-400">
                                                                <m.icon className="w-3.5 h-3.5" />
                                                                {m.label}
                                                            </div>
                                                            <span className={`text-xs font-mono font-medium ${m.color}`}>{m.value}</span>
                                                        </div>
                                                    ))}
                                                </div>

                                                {/* IPs & Devices List */}
                                                {profile.unique_ips?.length > 0 && (
                                                    <div>
                                                        <h4 className="text-[10px] text-slate-500 uppercase mb-1">IP Addresses</h4>
                                                        <div className="flex flex-wrap gap-1">
                                                            {profile.unique_ips.map((ip: string) => (
                                                                <span key={ip} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">{ip}</span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Center: Stats + Behavioural Metrics */}
                                            <div className="bg-slate-950/50 rounded-xl border border-slate-800 p-4 space-y-4">
                                                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Account Overview</h4>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div className="bg-slate-800/40 rounded-lg p-3 border border-slate-700/50 text-center">
                                                        <p className="text-2xl font-bold text-cyan-400">{profile.tx_count}</p>
                                                        <p className="text-[10px] text-slate-500 uppercase mt-1">Total Transactions</p>
                                                    </div>
                                                    <div className="bg-slate-800/40 rounded-lg p-3 border border-slate-700/50 text-center">
                                                        <p className="text-2xl font-bold text-red-400">{profile.vpn_tx_count}</p>
                                                        <p className="text-[10px] text-slate-500 uppercase mt-1">VPN Transactions</p>
                                                    </div>
                                                    <div className="bg-slate-800/40 rounded-lg p-3 border border-slate-700/50 text-center">
                                                        <p className="text-2xl font-bold text-purple-400">{profile.unique_devices?.length || 0}</p>
                                                        <p className="text-[10px] text-slate-500 uppercase mt-1">Devices Used</p>
                                                    </div>
                                                    <div className="bg-slate-800/40 rounded-lg p-3 border border-slate-700/50 text-center">
                                                        <p className="text-2xl font-bold text-orange-400">{profile.unique_ips?.length || 0}</p>
                                                        <p className="text-[10px] text-slate-500 uppercase mt-1">Unique IPs</p>
                                                    </div>
                                                </div>

                                                {/* Behavioural Metrics — only real accounts */}
                                                {!profile.is_simulated ? (
                                                    <div className="space-y-2">
                                                        <h4 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                                                            <Activity className="w-3 h-3" /> Behavioural Metrics
                                                        </h4>
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <div className="bg-slate-800/40 rounded-lg p-2 border border-slate-700/50">
                                                                <p className="text-[10px] text-slate-500 uppercase">Avg Txn Time</p>
                                                                <p className="text-sm font-bold text-emerald-400">{(profile.avg_transaction_time_ms / 1000).toFixed(1)}s</p>
                                                            </div>
                                                            <div className="bg-slate-800/40 rounded-lg p-2 border border-slate-700/50">
                                                                <p className="text-[10px] text-slate-500 uppercase">Clicks / Session</p>
                                                                <p className="text-sm font-bold text-sky-400">{profile.avg_clicks_per_session}</p>
                                                            </div>
                                                            <div className="bg-slate-800/40 rounded-lg p-2 border border-slate-700/50">
                                                                <p className="text-[10px] text-slate-500 uppercase">Mouse Speed</p>
                                                                <p className="text-sm font-bold text-amber-400">{Math.round(profile.avg_mouse_speed || 0)} px/s</p>
                                                            </div>
                                                            <div className="bg-slate-800/40 rounded-lg p-2 border border-slate-700/50">
                                                                <p className="text-[10px] text-slate-500 uppercase">Sessions</p>
                                                                <p className="text-sm font-bold text-violet-400">{profile.total_sessions}</p>
                                                            </div>
                                                            <div className="bg-slate-800/40 rounded-lg p-2 border border-slate-700/50">
                                                                <p className="text-[10px] text-slate-500 uppercase">Login Hour</p>
                                                                <p className="text-sm font-bold text-pink-400">{profile.typical_login_hour != null ? `${profile.typical_login_hour}:00` : '—'}</p>
                                                            </div>
                                                            <div className="bg-slate-800/40 rounded-lg p-2 border border-slate-700/50">
                                                                <p className="text-[10px] text-slate-500 uppercase">Anomaly Flags</p>
                                                                <p className="text-sm font-bold text-red-400">{profile.anomaly_flags ? Object.values(profile.anomaly_flags).filter(Boolean).length : 0}</p>
                                                            </div>
                                                        </div>

                                                        {/* Anomaly Flag Badges */}
                                                        {profile.anomaly_flags && Object.keys(profile.anomaly_flags).length > 0 && (
                                                            <div className="flex flex-wrap gap-1">
                                                                {Object.entries(profile.anomaly_flags).filter(([, v]) => v).map(([flag]) => (
                                                                    <span key={flag} className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-950/60 border border-red-800/50 text-red-400 font-medium">
                                                                        {flag.replace(/_/g, ' ')}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}

                                                        {/* Radar Chart */}
                                                        <div className="h-[220px] mt-1">
                                                            <BehaviourRadarChart profile={profile} />
                                                        </div>
                                                    </div>
                                                ) : profile.is_simulated ? (
                                                    <div className="bg-slate-800/20 rounded-lg p-3 border border-slate-700/30 text-center">
                                                        <p className="text-xs text-slate-500 italic">Behavioural data not tracked for simulated accounts</p>
                                                    </div>
                                                ) : null}

                                                {profile.is_frozen && (
                                                    <div className="bg-blue-950/30 border border-blue-800 rounded-lg p-3 flex items-center gap-2">
                                                        <Snowflake className="w-5 h-5 text-blue-400" />
                                                        <div>
                                                            <p className="text-sm font-bold text-blue-400">Account Frozen</p>
                                                            <p className="text-[10px] text-blue-500">This account has been frozen by the fraud detection system</p>
                                                        </div>
                                                    </div>
                                                )}

                                                {expandedData?.relationships?.length > 0 && (
                                                    <div>
                                                        <h4 className="text-xs font-semibold text-purple-400 uppercase tracking-wider mb-2">
                                                            <Share2 className="w-3 h-3 inline mr-1" /> Linked Accounts ({expandedData.relationships.length})
                                                        </h4>
                                                        <div className="space-y-1">
                                                            {expandedData.relationships.slice(0, 5).map((rel: any) => {
                                                                const isA = rel.account_a_id === profile.id;
                                                                const other = isA ? rel.acc_b : rel.acc_a;
                                                                return (
                                                                    <div key={rel.id} className="flex items-center justify-between py-1 px-2 bg-slate-800/30 rounded text-xs">
                                                                        <span className="text-slate-300">{other?.virtual_name || other?.account_number}</span>
                                                                        <span className="text-purple-400 font-mono">{rel.link_type}</span>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Right: Activity Timeline */}
                                            <div className="bg-slate-950/50 rounded-xl border border-slate-800 p-4 max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700">
                                                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Transaction Timeline</h4>
                                                <ActivityTimeline events={expandedData.events || []} />
                                            </div>
                                        </div>
                                    ) : null}
                                </div>
                            </motion.div>
                        </td>
                    </tr>
                )}
            </AnimatePresence>
        </>
    );
}
