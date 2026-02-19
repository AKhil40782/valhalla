'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { unfreezeAccount, freezeAccount } from '@/app/actions';
import { RefreshCw, Snowflake, Unlock, User, ArrowDownLeft, ArrowUpRight } from 'lucide-react';

interface AccountWithDetails {
    id: string;
    account_number: string;
    balance: number;
    calculated_balance: number;
    is_frozen: boolean;
    risk_score: number;
    user_id: string;
    owner_name: string;
    outgoing_count: number;
    outgoing_total: number;
    incoming_count: number;
    incoming_total: number;
}

export default function AdminAccountsPage() {
    const [accounts, setAccounts] = useState<AccountWithDetails[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    const fetchAccounts = async () => {
        setLoading(true);

        // Fetch accounts
        const { data: accountsData } = await supabase
            .from('accounts')
            .select('*')
            .order('risk_score', { ascending: false });

        // Fetch profiles for owner names
        const { data: profiles } = await supabase
            .from('profiles')
            .select('*');

        // Fetch all transactions for balance calculation
        const { data: transactions } = await supabase
            .from('transactions')
            .select('*');

        const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
        const accountByNumber = new Map(accountsData?.map(a => [a.account_number, a]) || []);

        // Calculate accurate balances
        const accountsWithDetails: AccountWithDetails[] = (accountsData || []).map(account => {
            const profile = profileMap.get(account.user_id);

            // Calculate outgoing transactions (from this account)
            const outgoingTxs = transactions?.filter(tx => tx.from_account_id === account.id) || [];
            const outgoingTotal = outgoingTxs.reduce((sum, tx) => sum + tx.amount, 0);

            // Calculate incoming transactions (to this account number)
            const incomingTxs = transactions?.filter(tx => tx.to_account_number === account.account_number) || [];
            const incomingTotal = incomingTxs.reduce((sum, tx) => sum + tx.amount, 0);

            // Calculated balance = stored balance (since we update it on each transaction)
            // But we show the breakdown for transparency
            const calculatedBalance = account.balance;

            return {
                ...account,
                calculated_balance: calculatedBalance,
                owner_name: profile?.full_name || 'Unknown',
                outgoing_count: outgoingTxs.length,
                outgoing_total: outgoingTotal,
                incoming_count: incomingTxs.length,
                incoming_total: incomingTotal
            };
        });

        setAccounts(accountsWithDetails);
        setLoading(false);
    };

    useEffect(() => {
        fetchAccounts();

        // Auto-refresh every 10 seconds
        const interval = setInterval(() => {
            fetchAccounts();
        }, 10000);

        return () => clearInterval(interval);
    }, []);

    const handleToggleFreeze = async (account: AccountWithDetails) => {
        setActionLoading(account.id);

        try {
            if (account.is_frozen) {
                const result = await unfreezeAccount(account.id);
                if (result.success) {
                    alert(`✅ Account ${account.account_number} unfrozen`);
                } else {
                    alert(`❌ Error: ${result.error}`);
                }
            } else {
                const result = await freezeAccount(account.id);
                if (result.success) {
                    alert(`✅ Account ${account.account_number} frozen`);
                } else {
                    alert(`❌ Error: ${result.error}`);
                }
            }
            fetchAccounts();
        } catch (err) {
            alert('Action failed');
        } finally {
            setActionLoading(null);
        }
    };

    // Calculate totals
    const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);
    const frozenCount = accounts.filter(acc => acc.is_frozen).length;

    return (
        <div className="min-h-screen bg-slate-950 text-white p-8">
            <div className="max-w-7xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-cyan-400">🔧 Admin: Account Management</h1>
                        <p className="text-slate-400 mt-2">Full access to freeze/unfreeze accounts and view accurate balances</p>
                    </div>
                    <button
                        onClick={fetchAccounts}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700"
                    >
                        <RefreshCw size={16} />
                        Refresh
                    </button>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-4 gap-4 mb-8">
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                        <div className="text-slate-400 text-sm">Total Accounts</div>
                        <div className="text-2xl font-bold text-white">{accounts.length}</div>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                        <div className="text-slate-400 text-sm">Frozen Accounts</div>
                        <div className="text-2xl font-bold text-red-400">{frozenCount}</div>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                        <div className="text-slate-400 text-sm">Active Accounts</div>
                        <div className="text-2xl font-bold text-green-400">{accounts.length - frozenCount}</div>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                        <div className="text-slate-400 text-sm">Total Balance</div>
                        <div className="text-2xl font-bold text-cyan-400">₹{totalBalance.toLocaleString('en-IN')}</div>
                    </div>
                </div>

                {loading ? (
                    <div className="text-center py-12 text-slate-500">Loading accounts...</div>
                ) : (
                    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                        <table className="w-full">
                            <thead className="bg-slate-800/50">
                                <tr>
                                    <th className="text-left p-4 text-slate-400 font-semibold">Owner</th>
                                    <th className="text-left p-4 text-slate-400 font-semibold">Account Number</th>
                                    <th className="text-left p-4 text-slate-400 font-semibold">Balance</th>
                                    <th className="text-left p-4 text-slate-400 font-semibold">Transactions</th>
                                    <th className="text-left p-4 text-slate-400 font-semibold">Risk</th>
                                    <th className="text-left p-4 text-slate-400 font-semibold">Status</th>
                                    <th className="text-left p-4 text-slate-400 font-semibold">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {accounts.map((account) => (
                                    <tr key={account.id} className="border-t border-slate-800 hover:bg-slate-800/30">
                                        <td className="p-4">
                                            <div className="flex items-center gap-2">
                                                <User size={16} className="text-slate-500" />
                                                <span className="text-white">{account.owner_name}</span>
                                            </div>
                                        </td>
                                        <td className="p-4 font-mono text-cyan-400">{account.account_number}</td>
                                        <td className="p-4">
                                            <div className="text-lg font-semibold text-white">
                                                ₹{account.balance.toLocaleString('en-IN')}
                                            </div>
                                            <div className="text-xs text-slate-500 mt-1">
                                                <span className="text-green-400">+₹{account.incoming_total.toLocaleString('en-IN')}</span>
                                                {' / '}
                                                <span className="text-red-400">-₹{account.outgoing_total.toLocaleString('en-IN')}</span>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-4 text-sm">
                                                <span className="flex items-center gap-1 text-green-400">
                                                    <ArrowDownLeft size={14} />
                                                    {account.incoming_count} in
                                                </span>
                                                <span className="flex items-center gap-1 text-red-400">
                                                    <ArrowUpRight size={14} />
                                                    {account.outgoing_count} out
                                                </span>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <span className={`px-2 py-1 rounded text-xs font-semibold ${account.risk_score >= 80 ? 'bg-red-900/30 text-red-400' :
                                                account.risk_score >= 50 ? 'bg-yellow-900/30 text-yellow-400' :
                                                    'bg-green-900/30 text-green-400'
                                                }`}>
                                                {account.risk_score || 0}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            {account.is_frozen ? (
                                                <span className="flex items-center gap-2 text-red-400">
                                                    <Snowflake size={16} />
                                                    FROZEN
                                                </span>
                                            ) : (
                                                <span className="text-green-400">Active</span>
                                            )}
                                        </td>
                                        <td className="p-4">
                                            <button
                                                onClick={() => handleToggleFreeze(account)}
                                                disabled={actionLoading === account.id}
                                                className={`px-4 py-2 rounded-lg font-semibold flex items-center gap-2 ${account.is_frozen
                                                    ? 'bg-green-600 hover:bg-green-500 text-white'
                                                    : 'bg-red-600 hover:bg-red-500 text-white'
                                                    } disabled:opacity-50`}
                                            >
                                                {actionLoading === account.id ? (
                                                    'Processing...'
                                                ) : account.is_frozen ? (
                                                    <>
                                                        <Unlock size={16} />
                                                        Unfreeze
                                                    </>
                                                ) : (
                                                    <>
                                                        <Snowflake size={16} />
                                                        Freeze
                                                    </>
                                                )}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {accounts.length === 0 && (
                            <div className="text-center py-12 text-slate-500">
                                No accounts found
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

