'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { getUserDevices, removeUserDevice, getDeviceSecurityEvents } from '@/app/actions';
import { collectDeviceMetadata, generateDeviceHash } from '@/lib/security/device-fingerprint';
import {
    Smartphone, Monitor, Shield, ShieldAlert, Trash2, ArrowLeft,
    Clock, MapPin, AlertTriangle, CheckCircle2, Activity, XCircle,
    RefreshCw
} from 'lucide-react';

interface TrustedDevice {
    id: string;
    device_hash: string;
    device_name: string;
    ip_first_seen: string;
    first_seen: string;
    last_seen: string;
    trusted_status: boolean;
    risk_flag: boolean;
}

interface SecurityEvent {
    id: string;
    event_type: string;
    device_hash: string;
    ip_address: string;
    metadata: any;
    created_at: string;
}

const EVENT_LABELS: Record<string, { label: string; color: string; icon: any }> = {
    device_login: { label: 'Device Login', color: '#3b82f6', icon: Monitor },
    device_registered: { label: 'New Device Trusted', color: '#22c55e', icon: CheckCircle2 },
    device_removed: { label: 'Device Removed', color: '#ef4444', icon: Trash2 },
    otp_failed: { label: 'OTP Failed', color: '#f59e0b', icon: AlertTriangle },
    suspicious_environment: { label: 'Suspicious Environment', color: '#ef4444', icon: ShieldAlert },
    risk_flagged: { label: 'Risk Flagged', color: '#ef4444', icon: AlertTriangle },
};

export default function DeviceManagementPage() {
    const router = useRouter();
    const [devices, setDevices] = useState<TrustedDevice[]>([]);
    const [events, setEvents] = useState<SecurityEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentDeviceHash, setCurrentDeviceHash] = useState('');
    const [removingId, setRemovingId] = useState<string | null>(null);
    const [userId, setUserId] = useState('');

    useEffect(() => {
        const init = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                router.push('/login');
                return;
            }
            setUserId(user.id);

            // Get current device hash
            const metadata = collectDeviceMetadata();
            const salt = process.env.NEXT_PUBLIC_DEVICE_SALT || 'default_salt';
            const hash = await generateDeviceHash(metadata, salt);
            setCurrentDeviceHash(hash);

            await fetchData(user.id);
        };
        init();
    }, [router]);

    const fetchData = async (uid: string) => {
        setLoading(true);
        const [devResult, evtResult] = await Promise.all([
            getUserDevices(uid),
            getDeviceSecurityEvents(uid, 15),
        ]);
        setDevices(devResult.devices);
        setEvents(evtResult.events);
        setLoading(false);
    };

    const handleRemoveDevice = async (deviceId: string) => {
        if (!confirm('Remove this device? You will need to verify with OTP on your next login from it.')) return;
        setRemovingId(deviceId);
        const result = await removeUserDevice(userId, deviceId);
        if (result.success) {
            setDevices(devices.filter(d => d.id !== deviceId));
        }
        setRemovingId(null);
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleString('en-IN', {
            timeZone: 'Asia/Kolkata',
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
        });
    };

    const timeAgo = (dateStr: string) => {
        const diff = Date.now() - new Date(dateStr).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'Just now';
        if (mins < 60) return `${mins}m ago`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        return `${days}d ago`;
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-cyan-400 border-t-transparent"></div>
                    <span className="text-slate-400 text-sm">Loading devices...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.push('/user/dashboard')}
                            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                        >
                            <ArrowLeft size={20} />
                        </button>
                        <div>
                            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                                <Shield className="text-cyan-400" />
                                Device Security
                            </h1>
                            <p className="text-slate-400 text-sm mt-1">Manage your trusted devices and security events</p>
                        </div>
                    </div>
                    <button
                        onClick={() => fetchData(userId)}
                        className="p-2 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-slate-800 transition-colors"
                        title="Refresh"
                    >
                        <RefreshCw size={18} />
                    </button>
                </div>

                {/* Trusted Devices */}
                <div className="mb-8">
                    <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <Smartphone size={18} className="text-cyan-400" />
                        Trusted Devices ({devices.length})
                    </h2>

                    {devices.length === 0 ? (
                        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-8 text-center">
                            <Monitor size={40} className="text-slate-600 mx-auto mb-3" />
                            <p className="text-slate-400">No trusted devices found</p>
                            <p className="text-slate-500 text-sm mt-1">Devices are trusted after OTP verification during login</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {devices.map((device) => {
                                const isCurrent = device.device_hash === currentDeviceHash;
                                return (
                                    <div
                                        key={device.id}
                                        className="rounded-xl p-5 flex items-center justify-between transition-all"
                                        style={{
                                            backgroundColor: isCurrent ? 'rgba(6, 182, 212, 0.05)' : 'rgba(30, 41, 59, 0.5)',
                                            border: isCurrent ? '1px solid rgba(6, 182, 212, 0.3)' : '1px solid #334155',
                                        }}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-lg flex items-center justify-center"
                                                style={{
                                                    backgroundColor: device.risk_flag ? 'rgba(239, 68, 68, 0.15)' : 'rgba(6, 182, 212, 0.1)',
                                                    border: `1px solid ${device.risk_flag ? 'rgba(239, 68, 68, 0.3)' : 'rgba(6, 182, 212, 0.2)'}`,
                                                }}>
                                                {device.risk_flag ? (
                                                    <ShieldAlert size={20} className="text-red-400" />
                                                ) : (
                                                    <Monitor size={20} className="text-cyan-400" />
                                                )}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <p className="text-white font-medium">{device.device_name}</p>
                                                    {isCurrent && (
                                                        <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                                                            style={{ backgroundColor: 'rgba(6, 182, 212, 0.15)', color: '#22d3ee' }}>
                                                            THIS DEVICE
                                                        </span>
                                                    )}
                                                    {device.risk_flag && (
                                                        <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                                                            style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#f87171' }}>
                                                            RISK FLAGGED
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-4 mt-1">
                                                    <span className="text-slate-500 text-xs flex items-center gap-1">
                                                        <MapPin size={11} />
                                                        IP: {device.ip_first_seen || 'Unknown'}
                                                    </span>
                                                    <span className="text-slate-500 text-xs flex items-center gap-1">
                                                        <Clock size={11} />
                                                        Last seen: {timeAgo(device.last_seen)}
                                                    </span>
                                                </div>
                                                <p className="text-slate-600 text-xs mt-1">
                                                    First seen: {formatDate(device.first_seen)}
                                                </p>
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => handleRemoveDevice(device.id)}
                                            disabled={removingId === device.id}
                                            className="p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-950/30 transition-all disabled:opacity-50"
                                            title="Remove device"
                                        >
                                            {removingId === device.id ? (
                                                <div className="animate-spin rounded-full h-5 w-5 border-2 border-red-400 border-t-transparent"></div>
                                            ) : (
                                                <Trash2 size={18} />
                                            )}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Security Events Timeline */}
                <div>
                    <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <Activity size={18} className="text-cyan-400" />
                        Security Events
                    </h2>

                    {events.length === 0 ? (
                        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-8 text-center">
                            <Shield size={40} className="text-slate-600 mx-auto mb-3" />
                            <p className="text-slate-400">No security events recorded</p>
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {events.map((event, index) => {
                                const eventInfo = EVENT_LABELS[event.event_type] || {
                                    label: event.event_type,
                                    color: '#64748b',
                                    icon: Activity,
                                };
                                const Icon = eventInfo.icon;

                                return (
                                    <div key={event.id} className="flex items-start gap-4 py-3 px-4 rounded-lg hover:bg-slate-800/30 transition-colors">
                                        {/* Timeline line */}
                                        <div className="flex flex-col items-center">
                                            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                                                style={{ backgroundColor: `${eventInfo.color}15`, border: `1px solid ${eventInfo.color}40` }}>
                                                <Icon size={14} style={{ color: eventInfo.color }} />
                                            </div>
                                            {index < events.length - 1 && (
                                                <div className="w-px h-full min-h-[20px] bg-slate-800 mt-1"></div>
                                            )}
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 min-w-0 pb-2">
                                            <div className="flex items-center justify-between">
                                                <p className="text-sm font-medium" style={{ color: eventInfo.color }}>
                                                    {eventInfo.label}
                                                </p>
                                                <span className="text-slate-600 text-xs">{timeAgo(event.created_at)}</span>
                                            </div>
                                            {event.ip_address && (
                                                <p className="text-slate-500 text-xs mt-1">IP: {event.ip_address}</p>
                                            )}
                                            {event.metadata?.deviceName && (
                                                <p className="text-slate-500 text-xs">Device: {event.metadata.deviceName}</p>
                                            )}
                                            {event.metadata?.error && (
                                                <p className="text-red-400/70 text-xs mt-1 flex items-center gap-1">
                                                    <XCircle size={10} />
                                                    {event.metadata.error}
                                                </p>
                                            )}
                                            {event.metadata?.flags && event.metadata.flags.length > 0 && (
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                    {event.metadata.flags.map((flag: string, i: number) => (
                                                        <span key={i} className="text-[10px] px-2 py-0.5 rounded-full"
                                                            style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#f87171' }}>
                                                            {flag}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
