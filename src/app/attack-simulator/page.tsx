'use client';

import React, { useState } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createAttackTransaction, saveAccountsBatch, saveTransactionsBatch } from '../actions';
import { Loader2, AlertCircle, ShieldAlert, Cpu, Users, ArrowRightLeft, Database } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from '@/hooks/useAuth';

export default function AttackSimulator() {
    const { user } = useAuth();
    const [mode, setMode] = useState<'single' | 'batch'>('single');
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<'idle' | 'success' | 'detected'>('idle');
    const [progress, setProgress] = useState(0);
    const [log, setLog] = useState<string[]>([]);

    // Single Attack Form
    const [formData, setFormData] = useState({
        sender: 'Mule_' + Math.floor(Math.random() * 100),
        amount: '4500',
        receiver: 'Orchestrator_X',
        useVpn: true
    });

    // Batch Simulation Config
    const [batchConfig, setBatchConfig] = useState({
        nodeCount: 1000,
        legitRatio: 70,
        muleRatio: 15,
        hackerRatio: 5,
        scammedRatio: 10
    });

    const addLog = (msg: string) => setLog(prev => [msg, ...prev].slice(0, 5));

    const handleAttack = async () => {
        setLoading(true);
        setStatus('idle');
        await createAttackTransaction({
            sender: formData.sender,
            amount: parseFloat(formData.amount),
            receiver: formData.receiver,
            isVpn: formData.useVpn,
            deviceId: formData.useVpn ? 'DEV_CLONED_ID_99' : 'DEV_' + Math.random().toString(36).substring(7)
        });
        setTimeout(() => { setLoading(false); setStatus('success'); }, 800);
    };

    const firstNames = ["James", "Mary", "Robert", "Patricia", "John", "Jennifer", "Michael", "Linda", "David", "Elizabeth", "William", "Barbara", "Richard", "Susan", "Joseph", "Jessica", "Thomas", "Sarah", "Charles", "Karen"];
    const lastNames = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin"];

    const generateName = () => `${firstNames[Math.floor(Math.random() * firstNames.length)]} ${lastNames[Math.floor(Math.random() * lastNames.length)]}`;

    const runBatchSimulation = async () => {
        setLoading(true);
        setProgress(0);
        setLog([]);
        addLog("🚀 Starting Batch Simulation...");

        try {
            const total = Math.min(100000, Math.max(10, batchConfig.nodeCount));
            const counts = {
                Legit: Math.ceil(total * (batchConfig.legitRatio / 100)),
                Mule: Math.ceil(total * (batchConfig.muleRatio / 100)),
                Hacker: Math.ceil(total * (batchConfig.hackerRatio / 100)),
                Scammed: Math.ceil(total * (batchConfig.scammedRatio / 100)),
            };

            addLog(`Plan: ${counts.Legit} Legit, ${counts.Mule} Mule, ${counts.Scammed} Scammed, ${counts.Hacker} Hacker`);

            // Store IDs for linking
            const idMap: Record<string, string[]> = { Legit: [], Mule: [], Hacker: [], Scammed: [] };
            const accountNumMap: Record<string, string> = {};
            let allAccounts: any[] = [];
            const BATCH_SIZE = 500;

            // 1. GENERATE ACCOUNTS
            const types = ['Legit', 'Mule', 'Hacker', 'Scammed'] as const;
            let processed = 0;

            for (const type of types) {
                const count = counts[type];
                addLog(` Generating ${count} ${type} accounts...`);

                for (let i = 0; i < count; i++) {
                    const id = uuidv4();
                    const accName = type === 'Hacker' ? `HACKER_${Math.random().toString(36).substr(2, 6).toUpperCase()}` : generateName();

                    const accNum = `SIM_${Math.random().toString().substr(2, 10)}`;
                    idMap[type].push(id);
                    accountNumMap[id] = accNum;

                    allAccounts.push({
                        id,
                        account_number: accNum,
                        balance: type === 'Hacker' ? 0 : (type === 'Scammed' ? 500000 : 10000 + Math.random() * 50000),
                        virtual_name: accName,
                        simulation_type: type,
                        is_simulated: true,
                        risk_score: type === 'Hacker' ? 100 : (type === 'Mule' ? 60 : 0),
                        created_at: new Date().toISOString()
                    });

                    if (allAccounts.length >= BATCH_SIZE) {
                        const result = await saveAccountsBatch(allAccounts, user?.id);
                        if (!result.success) { throw new Error(result.error); }
                        allAccounts = [];
                        processed += BATCH_SIZE;
                        setProgress((processed / (total * 2)) * 100); // 50% for accounts
                    }
                }
            }
            if (allAccounts.length > 0) {
                const result = await saveAccountsBatch(allAccounts, user?.id);
                if (!result.success) throw new Error(result.error);
            }

            addLog("✅ Accounts Created. Linking Transactions...");

            // 2. GENERATE TRANSACTIONS
            // Patterns:
            // Legit -> Legit (Mesh)
            // Scammed -> Mule (Funnel)
            // Mule -> Hacker (Aggregation)

            let allTxs: any[] = [];
            const txBatchSize = 500;
            let txCount = 0;

            const createTx = (from: string, to: string, amount: number, isVpn: boolean = false) => {
                allTxs.push({
                    id: uuidv4(),
                    from_account_id: from,
                    to_account_id: to,
                    to_account_number: accountNumMap[to] || 'UNKNOWN',
                    amount,
                    timestamp: new Date().toISOString(),
                    transaction_type: 'transfer',
                    location: isVpn ? 'DATACENTER_PROXY' : 'SIMULATION_GRID',
                    device_id: 'SIM_DEV_' + from.substring(0, 8),
                    ip_address: isVpn
                        ? `185.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`
                        : `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
                    vpn_flag: isVpn
                });
            };

            // Scammed -> Mule
            for (const scammedId of idMap.Scammed) {
                // Send to 1-2 random mules
                const targetMule = idMap.Mule[Math.floor(Math.random() * idMap.Mule.length)];
                if (targetMule) createTx(scammedId, targetMule, 15000 + Math.random() * 20000);
            }

            // Mule -> Hacker
            for (const muleId of idMap.Mule) {
                // Determine if this mule sends to hacker
                if (Math.random() > 0.2 && idMap.Hacker.length > 0) {
                    const targetHacker = idMap.Hacker[Math.floor(Math.random() * idMap.Hacker.length)];
                    // High probability of VPN for money laundering step
                    createTx(muleId, targetHacker, 40000 + Math.random() * 30000, Math.random() > 0.3);
                }
            }

            // Legit -> Legit (Noise)
            for (let i = 0; i < counts.Legit * 0.5; i++) {
                const sender = idMap.Legit[Math.floor(Math.random() * idMap.Legit.length)];
                const receiver = idMap.Legit[Math.floor(Math.random() * idMap.Legit.length)];
                if (sender !== receiver) createTx(sender, receiver, 100 + Math.random() * 5000);
            }

            // Save Transactions
            const totalTxs = allTxs.length;
            addLog(`Generated ${totalTxs} Transactions. Saving...`);

            for (let i = 0; i < totalTxs; i += txBatchSize) {
                const batch = allTxs.slice(i, i + txBatchSize);
                const result = await saveTransactionsBatch(batch);
                if (!result.success) throw new Error("Transactions Save Failed: " + result.error);
                setProgress(50 + ((i / totalTxs) * 50));
            }

            setProgress(100);
            setStatus('success');
            addLog("🎉 Simulation Complete!");

        } catch (e) {
            console.error(e);
            addLog("❌ Error: " + String(e));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-black text-white p-6 flex flex-col items-center justify-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-600 to-red-900 animate-pulse"></div>

            <div className="flex gap-4 mb-8 z-10">
                <Button
                    variant={mode === 'single' ? 'default' : 'outline'}
                    className={mode === 'single' ? "bg-red-600 border-transparent" : "border-red-900 text-red-500 hover:bg-red-950/30"}
                    onClick={() => setMode('single')}
                >
                    <ArrowRightLeft className="mr-2 h-4 w-4" /> Single Attack
                </Button>
                <Button
                    variant={mode === 'batch' ? 'default' : 'outline'}
                    className={mode === 'batch' ? "bg-purple-600 border-transparent hover:bg-purple-700" : "border-purple-900 text-purple-500 hover:bg-purple-950/30"}
                    onClick={() => setMode('batch')}
                >
                    <Database className="mr-2 h-4 w-4" /> Batch Simulation
                </Button>
            </div>

            <Card className={`w-full max-w-lg ${mode === 'batch' ? 'bg-zinc-900/90 border-purple-900/50' : 'bg-zinc-900/90 border-red-900/50'} p-6 relative z-10 backdrop-blur-xl transition-colors duration-500`}>
                <div className="flex items-center justify-center mb-6 gap-3">
                    {mode === 'batch' ? <Users className="w-10 h-10 text-purple-500" /> : <ShieldAlert className="w-10 h-10 text-red-500" />}
                    <h1 className={`text-2xl font-bold bg-clip-text text-transparent ${mode === 'batch' ? 'bg-gradient-to-r from-purple-500 to-pink-500' : 'bg-gradient-to-r from-red-500 to-orange-500'}`}>
                        {mode === 'batch' ? 'Large Scale Sandbox' : 'Fraud Simulator'}
                    </h1>
                </div>

                {mode === 'single' ? (
                    <div className="space-y-4">
                        <div>
                            <label className="text-xs text-zinc-500 uppercase tracking-widest mb-1 block">Sender Identity</label>
                            <Input value={formData.sender} onChange={(e) => setFormData({ ...formData, sender: e.target.value })} className="bg-black/50 border-zinc-800 text-red-400 font-mono" />
                        </div>
                        <div>
                            <label className="text-xs text-zinc-500 uppercase tracking-widest mb-1 block">Amount ($)</label>
                            <Input type="number" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} className="bg-black/50 border-zinc-800 font-mono text-xl" />
                        </div>
                        <div>
                            <label className="text-xs text-zinc-500 uppercase tracking-widest mb-1 block">Receiver (Target)</label>
                            <Input value={formData.receiver} onChange={(e) => setFormData({ ...formData, receiver: e.target.value })} className="bg-black/50 border-zinc-800 font-mono" />
                        </div>
                        <div className="flex items-center gap-3 p-3 bg-red-950/20 border border-red-900/30 rounded-lg">
                            <input type="checkbox" checked={formData.useVpn} onChange={(e) => setFormData({ ...formData, useVpn: e.target.checked })} className="w-5 h-5 accent-red-500" />
                            <div className="text-sm">
                                <span className="text-red-400 font-bold block">Activate VPN / Shared Device</span>
                                <span className="text-zinc-600 text-xs">Simulates linked attribute attack</span>
                            </div>
                        </div>
                        <Button onClick={handleAttack} disabled={loading} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold h-12 text-lg shadow-[0_0_20px_rgba(220,38,38,0.4)] transition-all active:scale-95">
                            {loading ? <Loader2 className="animate-spin" /> : "🚀 INITIATE TRANSFER"}
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div>
                            <label className="text-xs text-zinc-500 uppercase tracking-widest mb-1 block">Total Nodes (Max 100k)</label>
                            <Input type="number" max={100000} value={batchConfig.nodeCount} onChange={(e) => setBatchConfig({ ...batchConfig, nodeCount: parseInt(e.target.value) || 0 })} className="bg-black/50 border-zinc-800 font-mono text-xl text-purple-400" />
                        </div>

                        <div className="space-y-2 pt-2">
                            <div className="flex justify-between text-xs text-zinc-400"><span>Legitimate Users ({batchConfig.legitRatio}%)</span></div>
                            <input type="range" min="0" max="100" value={batchConfig.legitRatio} onChange={(e) => setBatchConfig({ ...batchConfig, legitRatio: parseInt(e.target.value) })} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-green-500" />

                            <div className="flex justify-between text-xs text-zinc-400"><span>Scammed Victims ({batchConfig.scammedRatio}%)</span></div>
                            <input type="range" min="0" max="100" value={batchConfig.scammedRatio} onChange={(e) => setBatchConfig({ ...batchConfig, scammedRatio: parseInt(e.target.value) })} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-orange-500" />

                            <div className="flex justify-between text-xs text-zinc-400"><span>Money Mules ({batchConfig.muleRatio}%)</span></div>
                            <input type="range" min="0" max="100" value={batchConfig.muleRatio} onChange={(e) => setBatchConfig({ ...batchConfig, muleRatio: parseInt(e.target.value) })} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-yellow-500" />

                            <div className="flex justify-between text-xs text-zinc-400"><span>Hackers ({batchConfig.hackerRatio}%)</span></div>
                            <input type="range" min="0" max="100" value={batchConfig.hackerRatio} onChange={(e) => setBatchConfig({ ...batchConfig, hackerRatio: parseInt(e.target.value) })} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-red-600" />
                        </div>

                        <div className="bg-black/50 p-3 rounded text-xs font-mono h-24 overflow-y-auto border border-zinc-800">
                            {log.length === 0 ? <span className="text-zinc-600">Ready to simulate...</span> : log.map((l, i) => <div key={i} className="mb-1">{l}</div>)}
                        </div>

                        {loading && (
                            <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
                                <div className="bg-purple-500 h-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
                            </div>
                        )}

                        <Button onClick={runBatchSimulation} disabled={loading} className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold h-12 text-lg shadow-[0_0_20px_rgba(147,51,234,0.4)] transition-all active:scale-95">
                            {loading ? <span className="flex items-center gap-2"><Loader2 className="animate-spin" /> PROCESSING...</span> : "🧪 RUN SIMULATION"}
                        </Button>
                    </div>
                )}

                {status === 'success' && mode === 'single' && (
                    <div className="mt-4 p-3 bg-green-950/30 border border-green-900/50 rounded text-green-400 text-center text-sm animate-in fade-in slide-in-from-bottom-2">
                        ✅ Transaction Sent! Check Dashboard.
                    </div>
                )}
            </Card>

            <div className="mt-8 text-center text-zinc-600 text-xs">
                ⚠️ Simulation Mode • For Educational Use Only
            </div>
        </div>
    );
}
