'use client';

import { useState } from 'react';
import { MessageCircle, Loader2, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { sendTestWhatsappAction } from '@/app/actions';

export function TestWhatsappButton() {
    const [isOpen, setIsOpen] = useState(false);
    const [phone, setPhone] = useState('');
    const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error' | 'simulated'>('idle');
    const [statusMessage, setStatusMessage] = useState('');

    const handleSend = async () => {
        if (!phone) return;
        setStatus('sending');
        try {
            const result = await sendTestWhatsappAction(phone);
            if (result.success) {
                setStatus(result.simulated ? 'simulated' : 'success');
                setStatusMessage(result.simulated ? 'Simulated (Check Logs)' : 'Message Sent!');
                setTimeout(() => {
                    setIsOpen(false);
                    setStatus('idle');
                    setPhone('');
                }, 2500);
            } else {
                setStatus('error');
                setStatusMessage('Failed');
            }
        } catch (e) {
            setStatus('error');
            setStatusMessage('Error');
        }
    };

    return (
        <div className="relative">
            <Button
                variant="ghost"
                size="icon"
                className="text-slate-400 hover:text-green-400"
                onClick={() => setIsOpen(!isOpen)}
                title="Test WhatsApp Notifications"
            >
                <MessageCircle className="w-5 h-5" />
            </Button>

            {isOpen && (
                <div className="absolute top-full right-0 mt-2 w-80 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-4 z-50 animate-in fade-in zoom-in-95">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-semibold text-slate-200 flex items-center gap-2">
                            WhatsApp Integration
                        </h3>
                        <button onClick={() => setIsOpen(false)} className="text-slate-500 hover:text-white">
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="space-y-3">
                        <p className="text-xs text-slate-400">
                            Send a test WhatsApp alert. <br />
                            <span className="text-slate-500 italic">(Requires Twilio Credentials in .env)</span>
                        </p>
                        <input
                            type="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="+919876543210"
                            className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-green-500"
                        />
                        <Button
                            className={`w-full text-white ${status === 'simulated' ? 'bg-amber-600 hover:bg-amber-500' : 'bg-green-600 hover:bg-green-500'}`}
                            onClick={handleSend}
                            disabled={status === 'sending' || !phone}
                        >
                            {status === 'sending' ? (
                                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending...</>
                            ) : status === 'success' ? (
                                <><Check className="w-4 h-4 mr-2" /> {statusMessage}</>
                            ) : status === 'simulated' ? (
                                <><Check className="w-4 h-4 mr-2" /> {statusMessage}</>
                            ) : (
                                'Send WhatsApp Alert'
                            )}
                        </Button>
                        {status === 'error' && (
                            <p className="text-xs text-red-400 text-center">Failed. Check Server Logs.</p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
