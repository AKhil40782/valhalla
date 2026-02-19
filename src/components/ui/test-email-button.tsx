'use client';

import { useState } from 'react';
import { Mail, Loader2, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { sendTestEmailAction } from '@/app/actions';

export function TestEmailButton() {
    const [isOpen, setIsOpen] = useState(false);
    const [email, setEmail] = useState('');
    const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');

    const handleSend = async () => {
        if (!email) return;
        setStatus('sending');
        try {
            const result = await sendTestEmailAction(email);
            if (result.success) {
                setStatus('success');
                setTimeout(() => {
                    setIsOpen(false);
                    setStatus('idle');
                    setEmail('');
                }, 2000);
            } else {
                setStatus('error');
            }
        } catch (e) {
            setStatus('error');
        }
    };

    return (
        <div className="relative">
            <Button
                variant="ghost"
                size="icon"
                className="text-slate-400 hover:text-slate-100"
                onClick={() => setIsOpen(!isOpen)}
                title="Test Email Notifications"
            >
                <Mail className="w-5 h-5" />
            </Button>

            {isOpen && (
                <div className="absolute top-full right-0 mt-2 w-80 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-4 z-50 animate-in fade-in zoom-in-95">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-semibold text-slate-200">Test Email Integration</h3>
                        <button onClick={() => setIsOpen(false)} className="text-slate-500 hover:text-white">
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="space-y-3">
                        <p className="text-xs text-slate-400">
                            Enter an email address to send a test notification from the fraud system.
                        </p>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="analyst@salaarbank.com"
                            className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                        />
                        <Button
                            className="w-full bg-cyan-600 hover:bg-cyan-500 text-white"
                            onClick={handleSend}
                            disabled={status === 'sending' || !email}
                        >
                            {status === 'sending' ? (
                                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending...</>
                            ) : status === 'success' ? (
                                <><Check className="w-4 h-4 mr-2" /> Sent!</>
                            ) : (
                                'Send Test Alert'
                            )}
                        </Button>
                        {status === 'error' && (
                            <p className="text-xs text-red-400 text-center">Failed to send. Check API Key.</p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
