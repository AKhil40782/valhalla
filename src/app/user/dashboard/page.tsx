'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { Send, LogOut, RefreshCw, History, Wallet, Shield, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Account {
    id: string;
    account_number: string;
    balance: number;
}

interface Transaction {
    id: string;
    from_account_id: string;
    to_account_id?: string; // Added field
    to_account_number: string;
    amount: number;
    timestamp: string;
    status: string;
    // Client-side enriched fields
    from_name?: string;
    to_name?: string;
}

export default function UserDashboard() {
    const router = useRouter();
    const [account, setAccount] = useState<Account | null>(null);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [sendModal, setSendModal] = useState(false);
    const [sendData, setSendData] = useState({ recipient: '', amount: '' });
    const [sendLoading, setSendLoading] = useState(false);
    const [syncLoading, setSyncLoading] = useState(false);
    const [sendError, setSendError] = useState('');
    const [sendSuccess, setSendSuccess] = useState(false);

    const [userName, setUserName] = useState<string>('');

    const fetchData = async () => {
        // Get real authenticated user
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            router.push('/login');
            return;
        }

        const userId = user.id;
        setUserName(user.user_metadata?.full_name || user.email || 'User');

        // Fetch account
        const { data: accData } = await supabase
            .from('accounts')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (accData) setAccount(accData);

        // Fetch transactions
        if (accData) {
            const { data: tx } = await supabase
                .from('transactions')
                .select('*')
                .or(`from_account_id.eq.${accData.id},to_account_id.eq.${accData.id}`)
                .order('timestamp', { ascending: false })
                .limit(20);

            if (tx) {
                // 🚀 ENRICHMENT: Fetch Profile Names for Sender/Receiver
                const accountIds = new Set<string>();
                tx.forEach(t => {
                    if (t.from_account_id) accountIds.add(t.from_account_id);
                    if (t.to_account_id) accountIds.add(t.to_account_id);
                });

                const { data: accounts } = await supabase
                    .from('accounts')
                    .select('id, user_id')
                    .in('id', Array.from(accountIds));

                const accountMap = new Map(accounts?.map(a => [a.id, a.user_id]));
                const userIds = new Set(accounts?.map(a => a.user_id));

                const { data: profiles } = await supabase
                    .from('profiles')
                    .select('id, full_name')
                    .in('id', Array.from(userIds));

                const nameMap = new Map(profiles?.map(p => [p.id, p.full_name]));

                const enrichedTx = tx.map(t => {
                    const fromUserId = accountMap.get(t.from_account_id);
                    const toUserId = t.to_account_id ? accountMap.get(t.to_account_id) : null;

                    return {
                        ...t,
                        from_name: fromUserId ? nameMap.get(fromUserId) : null,
                        to_name: toUserId ? nameMap.get(toUserId) : null
                    };
                });

                setTransactions(enrichedTx);
            }
        } else {
            setTransactions([]);
        }

        setLoading(false);
    };

    useEffect(() => {
        fetchData();
    }, []);

    const [realForensics, setRealForensics] = useState<any>(null);

    const collectRealForensics = async () => {
        let location = "Unknown (Permission Denied)";
        let ip = "0.0.0.0";
        let ipv6 = "";

        // 1. Get IP Addresses (Parallel fetch)
        try {
            const [v4Res, v6Res] = await Promise.allSettled([
                fetch('https://api.ipify.org?format=json').then(r => r.json()),
                fetch('https://api64.ipify.org?format=json').then(r => r.json())
            ]);

            if (v4Res.status === 'fulfilled') ip = v4Res.value.ip;
            if (v6Res.status === 'fulfilled') ipv6 = v6Res.value.ip;
        } catch (e) { console.error("IP Fetch Failed", e); }

        // 2. Browser Fingerprinting
        const userAgent = navigator.userAgent;
        const screenRes = `${window.screen.width}x${window.screen.height}`;
        const language = navigator.language;

        // 3. Geolocation
        try {
            const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject);
            });
            location = `${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)}`;
        } catch (e) { console.log("GPS denied, using IP fallback later"); }

        return {
            ip,
            ipv6,
            userAgent,
            screenRes,
            language,
            location,
            device: /Mobile|Android|iPhone/i.test(userAgent) ? "Mobile Device" : "Desktop/Laptop",
            deviceId: btoa(`${userAgent}-${screenRes}-${language}`).replace(/=/g, '') // Simple client-side hash
        };
    };

    const handleSendMoney = async () => {
        if (!account) return;
        setSendLoading(true);
        setSendError('');

        try {
            const amount = parseFloat(sendData.amount);
            if (isNaN(amount) || amount <= 0) throw new Error('Invalid amount');
            if (amount > account.balance) throw new Error('Insufficient funds');
            if (!realForensics) throw new Error('Security check failed. Please sync device.');

            // Call Server Action
            const { processUserTransaction } = await import('@/app/actions');
            const result = await processUserTransaction({
                amount,
                recipient: sendData.recipient,
                fromAccountId: account.id,
                forensics: realForensics
            });

            if (result.success) {
                setSendSuccess(true);
                setAccount({ ...account, balance: account.balance - amount });
                // Re-fetch to update list
                setTimeout(fetchData, 2000);
            } else {
                setSendError(result.error || 'Transaction failed');
            }
        } catch (err: any) {
            setSendError(err.message);
        } finally {
            setSendLoading(false);
        }
    };

    const openModal = () => {
        setSendModal(true);
        setSendSuccess(false);
        setSendError('');
        setSendData({ recipient: '', amount: '' });
        setRealForensics(null); // Reset forensics on new open
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/login');
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-slate-950 text-white">
                <RefreshCw className="animate-spin text-cyan-500" size={32} />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
            {/* Header */}
            <header className="bg-slate-900 border-b border-slate-800 p-4 sticky top-0 z-10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold shadow-lg shadow-cyan-500/20">
                        {userName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <h1 className="font-bold text-white leading-tight">Hello, {userName.split(' ')[0]}</h1>
                        <p className="text-xs text-slate-400">Welcome back</p>
                    </div>
                </div>
                <button
                    onClick={async () => {
                        await supabase.auth.signOut();
                        router.push('/login');
                    }}
                    className="p-2 bg-slate-800 hover:bg-slate-700 rounded-full text-slate-400 transition-colors"
                >
                    <LogOut size={18} />
                </button>
            </header>

            <main className="p-4 max-w-lg mx-auto space-y-6">
                {/* Frozen Account Warning */}
                {(account as any)?.is_frozen && (
                    <div className="bg-red-900/30 border-2 border-red-500 rounded-xl p-6 mb-6 animate-pulse">
                        <div className="flex items-center gap-3 mb-2">
                            <span className="text-3xl">⛔</span>
                            <h2 className="text-xl font-bold text-red-400">ACCOUNT FROZEN</h2>
                        </div>
                        <p className="text-red-300 text-sm">
                            This account has been flagged for suspicious activity by our fraud detection system.
                            All transactions are currently blocked. Please contact customer support immediately.
                        </p>
                    </div>
                )}

                {/* Balance Card */}
                <div className="bg-gradient-to-r from-cyan-900/50 to-blue-900/50 border border-cyan-800/50 rounded-2xl p-6 mb-6">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <Wallet className="text-cyan-400" size={24} />
                            <span className="text-slate-400">Available Balance</span>
                        </div>
                        <button onClick={fetchData} className="text-slate-400 hover:text-white">
                            <RefreshCw size={18} />
                        </button>
                    </div>
                    <div className="text-4xl font-bold text-white mb-2">
                        ₹{account?.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                    <div className="text-slate-500 text-sm font-mono">
                        A/C: {account?.account_number}
                    </div>
                </div>

                {/* Action Button */}
                <button
                    onClick={openModal}
                    disabled={(account as any)?.is_frozen}
                    className={`w-full py-4 rounded-xl font-semibold flex items-center justify-center gap-3 mb-8 transition-all active:scale-[0.99] ${(account as any)?.is_frozen
                        ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                        : 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500'
                        }`}
                >
                    <Send size={20} /> {(account as any)?.is_frozen ? 'Account Frozen - Transactions Disabled' : 'Send Money'}
                </button>

                {/* Recent Transactions */}
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <History className="text-slate-400" size={20} />
                        <h2 className="text-lg font-semibold">Recent Transactions</h2>
                    </div>

                    {transactions.length === 0 ? (
                        <p className="text-slate-500 text-center py-8">No transactions yet</p>
                    ) : (
                        <div className="space-y-3">
                            {transactions.map(tx => {
                                const isDebit = tx.from_account_id === account?.id;
                                return (
                                    <div key={tx.id} className="flex items-center justify-between py-3 border-b border-slate-700/50 last:border-0">
                                        <div>
                                            <div className="text-white font-medium">
                                                {isDebit ? `To: ${tx.to_account_number || 'Unknown'}` : `From: ${tx.from_account_id ? 'Sender' : 'Unknown'}`}
                                                {/* Better: If I had sender account number, I'd show it. But I only have IDs usually, unless joined. 
                                                    Transaction table has to_account_number but maybe not from_account_number? 
                                                    Let's check interface: it has to_account_number. Does it have from_account_number?
                                                    I'll assume NO for now, but usually it should. 
                                                    Wait, if I don't have sender number, I'll just say "Received".
                                                */}
                                            </div>
                                            <div className="text-slate-500 text-xs">
                                                {new Date(tx.timestamp).toLocaleString()}
                                            </div>
                                        </div>
                                        <div className={`font-mono font-bold ${isDebit ? 'text-red-400' : 'text-green-400'}`}>
                                            {isDebit ? '-' : '+'}₹{tx.amount.toLocaleString()}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </main>

            {/* Send Money Modal */}
            {sendModal && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-md">
                        <h3 className="text-xl font-bold mb-6">Send Money</h3>

                        {sendSuccess ? (
                            <div className="text-center py-8">
                                <div className="text-5xl mb-4">✅</div>
                                <p className="text-green-400 font-bold">Transaction Successful!</p>
                            </div>
                        ) : !realForensics ? (
                            <div className="text-center py-6 space-y-4">
                                <div className="w-16 h-16 bg-cyan-500/10 border border-cyan-500/30 rounded-full flex items-center justify-center mx-auto">
                                    <Shield className="w-8 h-8 text-cyan-400" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-white">Secure Verification Required</h3>
                                    <p className="text-slate-400 text-xs mt-2 px-4">
                                        To ensure your protection, Salaar Bank requires a mandatory real-time location and device sync for this transaction.
                                    </p>
                                </div>
                                <Button
                                    onClick={async () => {
                                        setSyncLoading(true);
                                        try {
                                            const forensics = await collectRealForensics();
                                            setRealForensics(forensics);
                                        } finally {
                                            setSyncLoading(false);
                                        }
                                    }}
                                    disabled={syncLoading}
                                    className="w-full bg-cyan-600 hover:bg-cyan-500 text-white py-6 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {syncLoading ? (
                                        <div className="flex items-center gap-2">
                                            <RefreshCw className="w-5 h-5 animate-spin" />
                                            <span>Syncing Device...</span>
                                        </div>
                                    ) : (
                                        <>🔓 Allow Secure Sync</>
                                    )}
                                </Button>
                                <button
                                    onClick={() => setSendModal(false)}
                                    className="text-slate-500 text-xs hover:text-slate-300 underline"
                                >
                                    Cancel and Close
                                </button>
                            </div>
                        ) : (
                            <>
                                <div className="space-y-4">
                                    <div className="bg-emerald-950/20 border border-emerald-900/50 p-2 rounded flex items-center gap-2 text-[10px] text-emerald-400">
                                        <CheckCircle className="w-3 h-3" />
                                        Identity Verified: {realForensics.ip} | {realForensics.location}
                                    </div>
                                    <div>
                                        <label className="text-sm text-slate-400 block mb-1">Recipient Account Number</label>
                                        <input
                                            type="text"
                                            value={sendData.recipient}
                                            onChange={(e) => setSendData({ ...sendData, recipient: e.target.value })}
                                            className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono"
                                            placeholder="SAL1234567890"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm text-slate-400 block mb-1">Amount (₹)</label>
                                        <input
                                            type="number"
                                            value={sendData.amount}
                                            onChange={(e) => setSendData({ ...sendData, amount: e.target.value })}
                                            className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white text-xl"
                                            placeholder="0.00"
                                        />
                                    </div>

                                    {sendError && (
                                        <div className="bg-red-900/30 border border-red-800 text-red-400 px-4 py-2 rounded-lg text-sm">
                                            {sendError}
                                        </div>
                                    )}
                                </div>

                                <div className="flex gap-3 mt-6">
                                    <button
                                        onClick={() => {
                                            setSendModal(false);
                                            setRealForensics(null);
                                        }}
                                        className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg font-semibold"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleSendMoney}
                                        disabled={sendLoading}
                                        className="flex-1 py-3 bg-green-600 hover:bg-green-500 rounded-lg font-semibold disabled:opacity-50"
                                    >
                                        {sendLoading ? 'Sending...' : 'Confirm Transfer'}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
