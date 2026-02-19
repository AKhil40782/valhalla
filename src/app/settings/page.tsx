'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Mail, Send, CheckCircle, Loader2, AlertCircle, Settings } from 'lucide-react';
import { sendTestEmailAction } from '@/app/actions';

export default function SettingsPage() {
    const [testEmail, setTestEmail] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

    const handleTestEmail = async () => {
        if (!testEmail || !testEmail.includes('@')) {
            setResult({ success: false, message: 'Please enter a valid email address' });
            return;
        }

        setIsSending(true);
        setResult(null);

        try {
            const response = await sendTestEmailAction(testEmail);
            if (response.success) {
                setResult({ success: true, message: `✅ Test email sent via ${response.provider} to ${testEmail}` });
            } else {
                setResult({ success: false, message: `❌ Failed (${(response as any).provider}): ${(response as any).error || 'Unknown error'}` });
            }
        } catch (error) {
            setResult({ success: false, message: `❌ Error: ${String(error)}` });
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div className="space-y-6 max-w-4xl mx-auto pb-10">
            <header>
                <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
                    <Settings className="w-8 h-8 text-cyan-400" />
                    System Settings
                </h1>
                <p className="text-slate-400">Configure notifications, integrations, and system preferences.</p>
            </header>

            {/* Email Configuration */}
            <Card className="border-slate-800 bg-slate-950/50">
                <CardHeader className="border-b border-slate-800/50">
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <Mail className="w-5 h-5 text-cyan-400" />
                        Email Notifications
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                    <div className="bg-emerald-950/30 border border-emerald-800/50 rounded-lg p-4 flex items-center gap-3">
                        <CheckCircle className="w-5 h-5 text-emerald-400" />
                        <div>
                            <div className="text-emerald-400 font-medium">Resend API Connected</div>
                            <div className="text-emerald-600 text-sm">Email notifications are active</div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                Test Email Address
                            </label>
                            <div className="flex gap-3">
                                <input
                                    type="email"
                                    placeholder="your@email.com"
                                    value={testEmail}
                                    onChange={(e) => setTestEmail(e.target.value)}
                                    className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                                />
                                <Button
                                    onClick={handleTestEmail}
                                    disabled={isSending}
                                    variant="neon"
                                    className="gap-2 px-6"
                                >
                                    {isSending ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Sending...
                                        </>
                                    ) : (
                                        <>
                                            <Send className="w-4 h-4" />
                                            Send Test
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>

                        {result && (
                            <div className={`p-4 rounded-lg border ${result.success
                                ? 'bg-emerald-950/30 border-emerald-800/50 text-emerald-400'
                                : 'bg-red-950/30 border-red-800/50 text-red-400'
                                }`}>
                                {result.message}
                            </div>
                        )}
                    </div>

                    <div className="pt-4 border-t border-slate-800">
                        <h4 className="text-sm font-medium text-slate-300 mb-3">Notification Triggers</h4>
                        <div className="space-y-3">
                            {[
                                { label: 'Critical Fraud Alert Detected', enabled: true },
                                { label: 'Account Frozen', enabled: true },
                                { label: 'New Suspicious Pattern', enabled: true },
                                { label: 'Daily Summary Report', enabled: false },
                            ].map((trigger, i) => (
                                <div key={i} className="flex items-center justify-between py-2">
                                    <span className="text-slate-400">{trigger.label}</span>
                                    <div className={`px-3 py-1 rounded-full text-xs font-medium ${trigger.enabled
                                        ? 'bg-emerald-500/20 text-emerald-400'
                                        : 'bg-slate-800 text-slate-500'
                                        }`}>
                                        {trigger.enabled ? 'Active' : 'Disabled'}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* WhatsApp Configuration (Coming Soon) */}
            <Card className="border-slate-800 bg-slate-950/50 opacity-60">
                <CardHeader className="border-b border-slate-800/50">
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <span className="text-2xl">📱</span>
                        WhatsApp Notifications
                        <span className="px-2 py-0.5 rounded text-[10px] bg-slate-700 text-slate-400 ml-2">Coming Soon</span>
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                    <p className="text-slate-500">WhatsApp integration via Twilio will be available in the next update.</p>
                </CardContent>
            </Card>
        </div>
    );
}
