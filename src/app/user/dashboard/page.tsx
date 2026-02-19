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
    from_account_id: string; // Added field
    to_account_number: string;
    amount: number;
    timestamp: string;
    status: string;
}

export default function UserDashboard() {
    const router = useRouter();
    const [account, setAccount] = useState<Account | null>(null);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [sendModal, setSendModal] = useState(false);
    const [sendData, setSendData] = useState({ recipient: '', amount: '' });
    const [sendLoading, setSendLoading] = useState(false);
    const [syncLoading, setSyncLoading] = useState(false); // New loading state for secure sync
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
        // The original fetch below might fail if accData isn't set yet (async issue)
        // It's better to fetch transactions only if accData is confirmed to exist.
        // The subsequent block handles this more robustly.
        const { data: txData } = await supabase
            .from('transactions')
            .select('*')
            .eq('from_account_id', accData?.id)
            .order('timestamp', { ascending: false })
            .limit(10);

        // Retry fetch for transactions if account exists
        if (accData) {
            const { data: tx } = await supabase
                .from('transactions')
                .select('*')
                .or(`from_account_id.eq.${accData.id},to_account_id.eq.${accData.id}`)
                .order('timestamp', { ascending: false })
                .limit(20);
            if (tx) setTransactions(tx);
        } else {
            setTransactions([]); // If no account, no transactions
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
        } catch (e) {
            console.error("IP Fetch failed", e);
        }

        const combinedIp = ipv6 && ipv6 !== ip ? `${ip} (v6: ${ipv6.slice(0, 15)}...)` : ip;

        // 2. Deep Scan: Get Local/Internal IP via WebRTC
        const getInternalIp = (): Promise<string> => {
            return new Promise((resolve) => {
                const pc = new RTCPeerConnection({ iceServers: [] });
                pc.createDataChannel("");
                pc.createOffer().then(o => pc.setLocalDescription(o));
                pc.onicecandidate = (ice) => {
                    if (!ice || !ice.candidate) return;
                    const match = /([0-9]{1,3}(\.[0-9]{1,3}){3})/.exec(ice.candidate.candidate);
                    if (match) { resolve(match[1]); pc.onicecandidate = null; }
                };
                setTimeout(() => resolve("192.0.0.X"), 1500);
            });
        };

        const internalIp = await getInternalIp();
        const finalForensicIp = `${combinedIp} [Local: ${internalIp}]`;

        // 2. Get Geolocation & Reverse Geocode
        const getCoords = () => new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 });
        });

        try {
            const pos: any = await getCoords();
            const lat = pos.coords.latitude;
            const lon = pos.coords.longitude;
            location = `${lat.toFixed(4)}, ${lon.toFixed(4)}`;

            // Reverse Geocode (Human readable address)
            try {
                const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10`);
                const geoData = await geoRes.json();
                if (geoData.address) {
                    const city = geoData.address.city || geoData.address.town || geoData.address.village || geoData.address.suburb;
                    const state = geoData.address.state;
                    if (city && state) {
                        location = `${city}, ${state} (${location})`;
                    }
                }
            } catch (geocodeErr) {
                console.warn("Reverse Geocoding failed", geocodeErr);
            }
        } catch (e) {
            console.warn("Location access denied or timed out");
        }

        const ua = navigator.userAgent;
        let device = navigator.platform;
        if (ua.includes('Android')) device = `Android Mobile (${ua.split(';')[1].trim()})`;
        else if (ua.includes('iPhone')) device = `Apple iPhone (iOS)`;
        else if (ua.includes('Macintosh')) device = `Apple Mac (macOS)`;
        else if (ua.includes('Windows')) device = `Windows PC`;

        device = `${device} | ${navigator.vendor || 'Unknown Vendor'}`;

        // Generate a stable "Fingerprint ID" (Substitute for restricted IMEI/MAC)
        const fingerprint = `FP-${btoa(navigator.userAgent).slice(0, 8)}-${window.screen.width}x${window.screen.height}`;

        return {
            ip: finalForensicIp,
            subnet: '255.255.255.0',
            device: device,
            imei: `HW-${fingerprint.slice(3, 10)}`, // Virtual Hardware ID
            location: location,
            deviceId: fingerprint
        };
    };

    const handleSendMoney = async () => {
        if (!account) return;
        setSendLoading(true);
        setSendError('');
        setSendSuccess(false);

        // 🔒 CRITICAL SECURITY CHECK: Prevent frozen accounts from transacting
        if ((account as any).is_frozen) {
            setSendError('⛔ ACCOUNT FROZEN: This account has been flagged for suspicious activity and cannot perform transactions. Please contact support.');
            setSendLoading(false);
            return;
        }

        const amount = parseFloat(sendData.amount);

        if (amount <= 0 || amount > account.balance) {
            setSendError('Invalid amount or insufficient balance');
            setSendLoading(false);
            return;
        }

        const forensics = await collectRealForensics();

        try {
            const { processUserTransaction } = await import('@/app/actions');
            const result = await processUserTransaction({
                amount,
                recipient: sendData.recipient,
                fromAccountId: account.id,
                forensics
            });

            if (result.success) {
                setSendSuccess(true);
                setSendData({ recipient: '', amount: '' });

                // Refresh data
                setTimeout(() => {
                    fetchData();
                    setSendModal(false);
                    setSendSuccess(false);
                }, 1500);
            } else {
                setSendError(result.error || 'Transaction failed');
            }
        } catch (err) {
            setSendError('Error processing transaction');
        } finally {
            setSendLoading(false);
        }
    };

    const openModal = () => {
        setRealForensics(null); // Reset forensics to force new collection for EVERY transaction
        setSendModal(true);
        // Force immediate permission request with high accuracy
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(
                () => { console.log("📍 Location permission granted"); },
                (err) => { console.warn("📍 Location permission status:", err.message); },
                { enableHighAccuracy: true, timeout: 5000 }
            );
        }
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/login');
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center">
                <div className="text-cyan-400 animate-pulse">Loading...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
            {/* Header */}
            <header className="border-b border-slate-700 bg-slate-900/80 backdrop-blur-xl sticky top-0 z-50">
                <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
                    <h1 className="text-xl font-bold text-cyan-400">🏦 Salaar Bank</h1>
                    <div className="flex items-center gap-4">
                        <span className="text-slate-400 text-sm">
                            Welcome, <span className="text-white font-semibold">{userName}</span>
                        </span>
                        <button
                            onClick={handleLogout}
                            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
                        >
                            <LogOut size={18} /> Logout
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-4 py-8">
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
