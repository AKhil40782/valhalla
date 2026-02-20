'use client';

import { RiskBadge } from './RiskBadge';
import { Monitor, Clock, MousePointer, Wifi, MapPin, Fingerprint, AlertTriangle } from 'lucide-react';

interface ProfileData {
    id: string;
    user_name: string;
    risk_score: number;
    risk_level: string;
    avg_transaction_time_ms: number;
    avg_clicks_per_session: number;
    avg_mouse_speed: number;
    total_transactions: number;
    total_sessions: number;
    last_active_at: string;
    typical_login_hour: number;
    typical_device: string;
    typical_ip_subnet: string;
    anomaly_flags: any[];
}

export function UserProfilePanel({ profile }: { profile: ProfileData }) {
    const anomalyCount = (profile.anomaly_flags || []).reduce((sum: number, f: any) => sum + (f.count || 0), 0);

    const formatTime = (ms: number) => {
        if (ms < 1000) return `${ms}ms`;
        return `${(ms / 1000).toFixed(1)}s`;
    };

    const formatHour = (h: number) => {
        const ampm = h >= 12 ? 'PM' : 'AM';
        const hour = h % 12 === 0 ? 12 : h % 12;
        return `${hour}:00 ${ampm}`;
    };

    const metrics = [
        { label: 'Avg Txn Time', value: formatTime(profile.avg_transaction_time_ms), icon: Clock, color: profile.avg_transaction_time_ms < 1000 ? 'text-red-400' : 'text-slate-300' },
        { label: 'Clicks/Session', value: profile.avg_clicks_per_session, icon: MousePointer, color: profile.avg_clicks_per_session < 10 ? 'text-red-400' : 'text-slate-300' },
        { label: 'Mouse Speed', value: `${profile.avg_mouse_speed.toFixed(0)} px/s`, icon: Fingerprint, color: profile.avg_mouse_speed > 400 ? 'text-orange-400' : 'text-slate-300' },
        { label: 'Login Hour', value: formatHour(profile.typical_login_hour), icon: Clock, color: (profile.typical_login_hour < 5 || profile.typical_login_hour > 22) ? 'text-orange-400' : 'text-slate-300' },
        { label: 'Device', value: profile.typical_device || 'Unknown', icon: Monitor, color: 'text-slate-300' },
        { label: 'IP Subnet', value: profile.typical_ip_subnet || 'Unknown', icon: Wifi, color: 'text-slate-300' },
    ];

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-bold text-slate-100">{profile.user_name}</h3>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">ID: {profile.id.slice(0, 8)}...</p>
                </div>
                <RiskBadge level={profile.risk_level} score={profile.risk_score} size="lg" />
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-2">
                <div className="bg-slate-800/40 rounded-lg p-2.5 border border-slate-700/50">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wide">Transactions</p>
                    <p className="text-lg font-bold text-slate-100">{profile.total_transactions}</p>
                </div>
                <div className="bg-slate-800/40 rounded-lg p-2.5 border border-slate-700/50">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wide">Sessions</p>
                    <p className="text-lg font-bold text-slate-100">{profile.total_sessions}</p>
                </div>
            </div>

            {/* Behaviour metrics */}
            <div className="space-y-1.5">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Behaviour Metrics</h4>
                {metrics.map((m) => {
                    const Icon = m.icon;
                    return (
                        <div key={m.label} className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-slate-800/30 transition-colors">
                            <div className="flex items-center gap-2 text-xs text-slate-400">
                                <Icon className="w-3.5 h-3.5" />
                                {m.label}
                            </div>
                            <span className={`text-xs font-mono font-medium ${m.color}`}>{m.value}</span>
                        </div>
                    );
                })}
            </div>

            {/* Anomaly flags */}
            {anomalyCount > 0 && (
                <div className="space-y-1.5">
                    <h4 className="text-xs font-semibold text-red-400 uppercase tracking-wider flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Anomaly Flags ({anomalyCount})
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                        {(profile.anomaly_flags || []).map((flag: any, i: number) => (
                            <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-red-950/40 border border-red-800/50 text-red-400 font-medium">
                                {flag.type?.replace(/_/g, ' ')} ×{flag.count}
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
