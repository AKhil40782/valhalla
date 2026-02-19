'use client';

import React, { useState } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createAttackTransaction } from '../actions';
import { Loader2, AlertCircle, ShieldAlert } from 'lucide-react';

export default function AttackSimulator() {
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<'idle' | 'success' | 'detected'>('idle');
    const [formData, setFormData] = useState({
        sender: 'Mule_' + Math.floor(Math.random() * 100),
        amount: '4500',
        receiver: 'Orchestrator_X',
        useVpn: true
    });

    const handleAttack = async () => {
        setLoading(true);
        setStatus('idle');

        // Call server action
        await createAttackTransaction({
            sender: formData.sender,
            amount: parseFloat(formData.amount),
            receiver: formData.receiver,
            isVpn: formData.useVpn,
            // Simulate device fingerprint
            deviceId: formData.useVpn ? 'DEV_CLONED_ID_99' : 'DEV_' + Math.random().toString(36).substring(7)
        });

        setTimeout(() => {
            setLoading(false);
            setStatus('success');
        }, 800);
    };

    return (
        <div className="min-h-screen bg-black text-white p-6 flex flex-col items-center justify-center relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-600 to-red-900 animate-pulse"></div>

            <Card className="w-full max-w-md bg-zinc-900/90 border-red-900/50 p-6 relative z-10 backdrop-blur-xl">
                <div className="flex items-center justify-center mb-6 gap-3">
                    <ShieldAlert className="w-10 h-10 text-red-500" />
                    <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-red-500 to-orange-500">
                        Fraud Simulator
                    </h1>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="text-xs text-zinc-500 uppercase tracking-widest mb-1 block">Sender Identity</label>
                        <Input
                            value={formData.sender}
                            onChange={(e) => setFormData({ ...formData, sender: e.target.value })}
                            className="bg-black/50 border-zinc-800 text-red-400 font-mono"
                        />
                    </div>

                    <div>
                        <label className="text-xs text-zinc-500 uppercase tracking-widest mb-1 block">Amount ($)</label>
                        <Input
                            type="number"
                            value={formData.amount}
                            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                            className="bg-black/50 border-zinc-800 font-mono text-xl"
                        />
                    </div>

                    <div>
                        <label className="text-xs text-zinc-500 uppercase tracking-widest mb-1 block">Receiver (Target)</label>
                        <Input
                            value={formData.receiver}
                            onChange={(e) => setFormData({ ...formData, receiver: e.target.value })}
                            className="bg-black/50 border-zinc-800 font-mono"
                        />
                    </div>

                    <div className="flex items-center gap-3 p-3 bg-red-950/20 border border-red-900/30 rounded-lg">
                        <input
                            type="checkbox"
                            checked={formData.useVpn}
                            onChange={(e) => setFormData({ ...formData, useVpn: e.target.checked })}
                            className="w-5 h-5 accent-red-500"
                        />
                        <div className="text-sm">
                            <span className="text-red-400 font-bold block">Activate VPN / Shared Device</span>
                            <span className="text-zinc-600 text-xs">Simulates linked attribute attack</span>
                        </div>
                    </div>

                    <Button
                        onClick={handleAttack}
                        disabled={loading}
                        className="w-full bg-red-600 hover:bg-red-700 text-white font-bold h-12 text-lg shadow-[0_0_20px_rgba(220,38,38,0.4)] transition-all active:scale-95"
                    >
                        {loading ? <Loader2 className="animate-spin" /> : "🚀 INITIATE TRANSFER"}
                    </Button>
                </div>

                {status === 'success' && (
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
