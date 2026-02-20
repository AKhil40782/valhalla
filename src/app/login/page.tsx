'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { ShieldCheck, Mail, Lock, AlertCircle, LogIn, Smartphone, KeyRound, RefreshCw, CheckCircle2 } from 'lucide-react';
import { collectDeviceMetadata, generateDeviceHash, getDeviceLabel, isSuspiciousEnvironment } from '@/lib/security/device-fingerprint';
import { detectBrowserPrivacy } from '@/lib/security/browser-privacy-detector';
import { checkDeviceTrust, sendDeviceVerificationOTP, verifyDeviceAndRegister, checkAnonymity } from '@/app/actions';

type LoginStep = 'credentials' | 'device_check' | 'otp_verify' | 'success';

export default function LoginPage() {
    const router = useRouter();
    const [formData, setFormData] = useState({
        email: '',
        password: '',
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Device verification state
    const [loginStep, setLoginStep] = useState<LoginStep>('credentials');
    const [otpCode, setOtpCode] = useState(['', '', '', '', '', '']);
    const [otpError, setOtpError] = useState('');
    const [otpLoading, setOtpLoading] = useState(false);
    const [resendCooldown, setResendCooldown] = useState(0);
    const [sessionUserId, setSessionUserId] = useState<string>('');
    const [deviceInfo, setDeviceInfo] = useState<{ hash: string; name: string; ip: string }>({ hash: '', name: '', ip: '' });
    const [devOtpCode, setDevOtpCode] = useState('');
    const [anonymityRisk, setAnonymityRisk] = useState<{ level: string; details: string[]; signals: Record<string, boolean> } | null>(null);
    const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

    // Helper: redirect based on role
    const redirectByRole = async (userId: string) => {
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', userId)
            .single();

        if (profile?.role === 'admin') {
            router.push('/');
        } else {
            router.push('/user/dashboard');
        }
    };

    // Check if already logged in
    useEffect(() => {
        const checkSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                await redirectByRole(session.user.id);
            }
        };
        checkSession();
    }, [router]);

    // Resend cooldown timer
    useEffect(() => {
        if (resendCooldown > 0) {
            const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [resendCooldown]);

    // Get user's public IP
    const getPublicIP = async (): Promise<string> => {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 3000);
            const res = await fetch('https://api.ipify.org?format=json', { signal: controller.signal });
            clearTimeout(timeout);
            const data = await res.json();
            return data.ip || 'unknown';
        } catch {
            return 'unknown';
        }
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const { data, error: authError } = await supabase.auth.signInWithPassword({
                email: formData.email,
                password: formData.password,
            });

            if (authError) {
                setError(authError.message);
                setLoading(false);
                return;
            }

            if (data.session) {
                const userId = data.session.user.id;
                setSessionUserId(userId);
                setLoginStep('device_check');

                // Collect device metadata (instant, no network)
                const metadata = collectDeviceMetadata();
                const salt = process.env.NEXT_PUBLIC_DEVICE_SALT || 'default_salt';
                const { suspicious, flags } = isSuspiciousEnvironment(metadata);
                const name = getDeviceLabel(metadata.userAgent);

                // Run hash generation + IP lookup + browser privacy detection in parallel
                const [hash, ip, privacyResult] = await Promise.all([
                    generateDeviceHash(metadata, salt),
                    getPublicIP(),
                    detectBrowserPrivacy(),
                ]);

                setDeviceInfo({ hash, name, ip });

                // Run device trust check + anonymity check in parallel
                const [trustResult, anonResult] = await Promise.all([
                    checkDeviceTrust(userId, hash, name, ip, flags),
                    checkAnonymity(userId, ip, {
                        isTorBrowser: privacyResult.isTorBrowser,
                        canvasBlocked: privacyResult.canvasBlocked,
                        webglBlocked: privacyResult.webglBlocked,
                        webrtcDisabled: privacyResult.webrtcDisabled,
                        audioBlocked: privacyResult.audioBlocked,
                        entropyScore: privacyResult.entropyScore,
                        privacyFlags: privacyResult.privacyFlags,
                    }),
                ]);

                // Store anonymity result for UI
                if (anonResult.level !== 'LOW') {
                    setAnonymityRisk({ level: anonResult.level, details: anonResult.details, signals: anonResult.signals as unknown as Record<string, boolean> });
                }

                // Force OTP if anonymity risk is HIGH (even for trusted devices)
                const forceOTP = anonResult.requiresOTP;

                if (trustResult.trusted && !forceOTP) {
                    // Device is trusted + low anonymity risk — proceed to dashboard
                    setLoginStep('success');
                    setTimeout(() => redirectByRole(userId), 800);
                } else {
                    // Device not trusted OR high anonymity risk — show OTP UI
                    setLoginStep('otp_verify');
                    setLoading(false);
                    setTimeout(() => otpInputRefs.current[0]?.focus(), 100);

                    // Send OTP (non-blocking from UI perspective)
                    const otpResult = await sendDeviceVerificationOTP(userId, formData.email);
                    if (!otpResult.success) {
                        setOtpError(otpResult.error || 'Failed to send verification code');
                    }
                    if (otpResult.code) setDevOtpCode(otpResult.code);
                    setResendCooldown(30);
                }
            }
        } catch (err: any) {
            setError(err.message || 'Login failed. Please try again.');
            setLoading(false);
        }
    };

    // Handle OTP input
    const handleOtpChange = (index: number, value: string) => {
        if (value.length > 1) value = value.slice(-1);
        if (!/^\d*$/.test(value)) return;

        const newOtp = [...otpCode];
        newOtp[index] = value;
        setOtpCode(newOtp);
        setOtpError('');

        // Auto-advance to next input
        if (value && index < 5) {
            otpInputRefs.current[index + 1]?.focus();
        }

        // Auto-submit when all 6 digits entered
        if (value && index === 5 && newOtp.every(d => d !== '')) {
            handleVerifyOTP(newOtp.join(''));
        }
    };

    // Handle backspace in OTP inputs
    const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
        if (e.key === 'Backspace' && !otpCode[index] && index > 0) {
            otpInputRefs.current[index - 1]?.focus();
        }
    };

    // Handle OTP paste
    const handleOtpPaste = (e: React.ClipboardEvent) => {
        e.preventDefault();
        const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
        if (pasted.length === 6) {
            const newOtp = pasted.split('');
            setOtpCode(newOtp);
            otpInputRefs.current[5]?.focus();
            handleVerifyOTP(pasted);
        }
    };

    // Verify OTP
    const handleVerifyOTP = async (code: string) => {
        setOtpLoading(true);
        setOtpError('');

        try {
            const result = await verifyDeviceAndRegister(
                sessionUserId,
                code,
                deviceInfo.hash,
                deviceInfo.name,
                deviceInfo.ip
            );

            if (result.success) {
                setLoginStep('success');
                setTimeout(() => redirectByRole(sessionUserId), 800);
            } else {
                setOtpError(result.error || 'Verification failed');
                setOtpCode(['', '', '', '', '', '']);
                otpInputRefs.current[0]?.focus();
            }
        } catch (err: any) {
            setOtpError(err.message || 'Verification failed');
        } finally {
            setOtpLoading(false);
        }
    };

    // Resend OTP
    const handleResendOTP = async () => {
        if (resendCooldown > 0) return;
        setOtpError('');
        setOtpCode(['', '', '', '', '', '']);

        const result = await sendDeviceVerificationOTP(sessionUserId, formData.email);
        if (!result.success) {
            setOtpError(result.error || 'Failed to resend code');
        }
        if (result.code) setDevOtpCode(result.code);
        setResendCooldown(30);
        otpInputRefs.current[0]?.focus();
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="flex items-center justify-center mb-4">
                        <ShieldCheck className="w-12 h-12 text-cyan-400" />
                    </div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-500">
                        🏦 Salaar Bank
                    </h1>
                    <p className="text-slate-500 mt-2">Secure Banking Portal</p>
                </div>

                {/* ===================== STEP 1: CREDENTIALS ===================== */}
                {loginStep === 'credentials' && (
                    <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700 rounded-2xl p-8 shadow-2xl">
                        <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
                            <LogIn size={20} />
                            Sign In
                        </h2>

                        <form onSubmit={handleLogin} className="space-y-4">
                            <div>
                                <label className="text-sm text-slate-400 block mb-1">Email</label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500" size={18} />
                                    <input
                                        type="email"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        className="w-full pl-10 pr-4 py-3 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                        placeholder="you@example.com"
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-sm text-slate-400 block mb-1">Password</label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500" size={18} />
                                    <input
                                        type="password"
                                        value={formData.password}
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                        className="w-full pl-10 pr-4 py-3 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                        placeholder="••••••••"
                                        required
                                    />
                                </div>
                            </div>

                            {error && (
                                <div className="bg-red-900/30 border border-red-800 text-red-400 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
                                    <AlertCircle size={16} />
                                    {error}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold rounded-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {loading ? (
                                    <>
                                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                                        Verifying Device...
                                    </>
                                ) : (
                                    <>
                                        <LogIn size={18} />
                                        Sign In
                                    </>
                                )}
                            </button>
                        </form>

                        <div className="mt-6 text-center text-slate-500 text-sm">
                            Don&apos;t have an account?{' '}
                            <Link href="/register" className="text-cyan-400 hover:underline">
                                Create Account
                            </Link>
                        </div>
                    </div>
                )}

                {/* ===================== STEP 2: DEVICE CHECK (Loading) ===================== */}
                {loginStep === 'device_check' && (
                    <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700 rounded-2xl p-8 shadow-2xl text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-3 border-cyan-400 border-t-transparent mx-auto mb-4"></div>
                        <h2 className="text-lg font-semibold text-white mb-2">Verifying Device</h2>
                        <p className="text-slate-400 text-sm">Checking device trust status...</p>
                    </div>
                )}

                {/* ===================== STEP 3: OTP VERIFICATION ===================== */}
                {loginStep === 'otp_verify' && (
                    <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700 rounded-2xl p-8 shadow-2xl">
                        <div className="text-center mb-6">
                            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                                style={{ background: 'linear-gradient(135deg, #164e63 0%, #0e7490 100%)' }}>
                                <Smartphone className="w-8 h-8 text-cyan-300" />
                            </div>
                            <h2 className="text-xl font-semibold text-white mb-2 flex items-center justify-center gap-2">
                                <KeyRound size={20} className="text-cyan-400" />
                                Device Verification
                            </h2>
                            <p className="text-slate-400 text-sm">
                                New device detected. We&apos;ve sent a 6-digit code to your email.
                            </p>
                            <div className="mt-3 px-4 py-2 rounded-lg inline-block" style={{ backgroundColor: 'rgba(6, 182, 212, 0.1)', border: '1px solid rgba(6, 182, 212, 0.2)' }}>
                                <p className="text-cyan-400 text-xs font-mono">{formData.email}</p>
                            </div>
                        </div>

                        {/* Anonymity Risk Warning Badge */}
                        {anonymityRisk && (
                            <div className="mb-4 p-3 rounded-lg" style={{
                                backgroundColor: anonymityRisk.level === 'HIGH' ? 'rgba(239, 68, 68, 0.08)' : 'rgba(245, 158, 11, 0.08)',
                                border: `1px solid ${anonymityRisk.level === 'HIGH' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
                            }}>
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-sm">{anonymityRisk.level === 'HIGH' ? '🚨' : '⚠️'}</span>
                                    <p className={`text-xs font-bold uppercase tracking-wider ${anonymityRisk.level === 'HIGH' ? 'text-red-400' : 'text-amber-400'}`}>
                                        {anonymityRisk.level === 'HIGH' ? 'High Anonymity Risk' : 'Anonymity Warning'}
                                    </p>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {anonymityRisk.signals.tor_exit_match && (
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-500/20 text-red-300 border border-red-500/30">🧅 Tor Exit Node</span>
                                    )}
                                    {anonymityRisk.signals.tor_browser && (
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-500/20 text-red-300 border border-red-500/30">🧅 Tor Browser</span>
                                    )}
                                    {anonymityRisk.signals.vpn_detected && (
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30">🛡️ VPN</span>
                                    )}
                                    {anonymityRisk.signals.proxy_flag && (
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30">🔀 Proxy</span>
                                    )}
                                    {anonymityRisk.signals.geo_anomaly && (
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-orange-500/20 text-orange-300 border border-orange-500/30">🌍 Geo Anomaly</span>
                                    )}
                                    {anonymityRisk.signals.fingerprint_hardened && (
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-500/20 text-purple-300 border border-purple-500/30">🔒 Hardened</span>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Device info badge */}
                        <div className="mb-4 p-3 rounded-lg flex items-center gap-3" style={{ backgroundColor: 'rgba(30, 41, 59, 0.8)', border: '1px solid #334155' }}>
                            <Smartphone size={16} className="text-slate-400 flex-shrink-0" />
                            <div className="text-xs">
                                <p className="text-slate-300 font-medium">{deviceInfo.name}</p>
                                <p className="text-slate-500">IP: {deviceInfo.ip}</p>
                            </div>
                        </div>

                        {/* Demo OTP Code Display */}
                        {devOtpCode && (
                            <div className="mb-6 p-3 rounded-lg text-center" style={{ backgroundColor: 'rgba(34, 197, 94, 0.08)', border: '1px solid rgba(34, 197, 94, 0.25)' }}>
                                <p className="text-emerald-400 text-[10px] font-semibold uppercase tracking-wider mb-1">🧪 Demo Mode — Your OTP Code</p>
                                <p className="text-white text-2xl font-bold font-mono tracking-[8px]">{devOtpCode}</p>
                            </div>
                        )}

                        {/* OTP Input */}
                        <div className="flex justify-center gap-3 mb-6" onPaste={handleOtpPaste}>
                            {otpCode.map((digit, index) => (
                                <input
                                    key={index}
                                    ref={(el) => { otpInputRefs.current[index] = el; }}
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={1}
                                    value={digit}
                                    onChange={(e) => handleOtpChange(index, e.target.value)}
                                    onKeyDown={(e) => handleOtpKeyDown(index, e)}
                                    className="w-12 h-14 text-center text-xl font-bold bg-slate-900/60 border-2 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all"
                                    style={{
                                        borderColor: digit ? '#06b6d4' : '#334155',
                                        boxShadow: digit ? '0 0 15px rgba(6, 182, 212, 0.15)' : 'none',
                                    }}
                                    disabled={otpLoading}
                                />
                            ))}
                        </div>

                        {otpError && (
                            <div className="bg-red-900/30 border border-red-800 text-red-400 px-4 py-3 rounded-lg text-sm flex items-center gap-2 mb-4">
                                <AlertCircle size={16} />
                                {otpError}
                            </div>
                        )}

                        {/* Verify Button */}
                        <button
                            onClick={() => handleVerifyOTP(otpCode.join(''))}
                            disabled={otpLoading || otpCode.some(d => !d)}
                            className="w-full py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold rounded-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2 mb-4"
                        >
                            {otpLoading ? (
                                <>
                                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                                    Verifying...
                                </>
                            ) : (
                                <>
                                    <ShieldCheck size={18} />
                                    Verify & Trust Device
                                </>
                            )}
                        </button>

                        {/* Resend */}
                        <div className="text-center">
                            <button
                                onClick={handleResendOTP}
                                disabled={resendCooldown > 0}
                                className="text-sm text-slate-400 hover:text-cyan-400 disabled:text-slate-600 flex items-center gap-2 mx-auto transition-colors"
                            >
                                <RefreshCw size={14} className={resendCooldown > 0 ? '' : 'animate-none'} />
                                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
                            </button>
                        </div>
                    </div>
                )}

                {/* ===================== STEP 4: SUCCESS ===================== */}
                {loginStep === 'success' && (
                    <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700 rounded-2xl p-8 shadow-2xl text-center">
                        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                            style={{ background: 'linear-gradient(135deg, #065f46 0%, #059669 100%)' }}>
                            <CheckCircle2 className="w-8 h-8 text-emerald-300" />
                        </div>
                        <h2 className="text-lg font-semibold text-white mb-2">Device Verified</h2>
                        <p className="text-slate-400 text-sm">Redirecting to your dashboard...</p>
                        <div className="mt-4">
                            <div className="animate-spin rounded-full h-6 w-6 border-2 border-emerald-400 border-t-transparent mx-auto"></div>
                        </div>
                    </div>
                )}

                {/* Admin Link */}
                {loginStep === 'credentials' && (
                    <div className="mt-4 text-center">
                        <Link href="/" className="text-slate-500 hover:text-slate-400 text-sm">
                            ← Back to Dashboard
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
}
