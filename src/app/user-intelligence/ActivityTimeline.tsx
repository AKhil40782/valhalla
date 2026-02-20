'use client';

import { format, formatDistanceToNow } from 'date-fns';
import { Shield, CreditCard, AlertTriangle, Bell, Smartphone, Globe, ChevronDown } from 'lucide-react';
import { useState } from 'react';

const EVENT_ICONS: Record<string, any> = {
    login: Globe,
    transaction: CreditCard,
    anomaly: AlertTriangle,
    alert: Bell,
    device_change: Smartphone,
    ip_change: Shield,
};

const SEVERITY_COLORS: Record<string, string> = {
    info: 'text-slate-400 bg-slate-800/50 border-slate-700',
    warning: 'text-yellow-400 bg-yellow-950/40 border-yellow-800',
    critical: 'text-red-400 bg-red-950/40 border-red-800',
};

const SEVERITY_DOT: Record<string, string> = {
    info: 'bg-slate-500',
    warning: 'bg-yellow-500',
    critical: 'bg-red-500 animate-pulse',
};

interface RiskEvent {
    id: string;
    event_type: string;
    severity: string;
    description: string;
    metadata: any;
    created_at: string;
}

export function ActivityTimeline({ events }: { events: RiskEvent[] }) {
    const [expanded, setExpanded] = useState<Set<string>>(new Set());

    const toggle = (id: string) => {
        setExpanded(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    if (events.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                <Bell className="w-8 h-8 mb-3 opacity-40" />
                <p className="text-sm">No events recorded</p>
            </div>
        );
    }

    return (
        <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-[19px] top-0 bottom-0 w-px bg-gradient-to-b from-slate-700 via-slate-800 to-transparent" />

            <div className="space-y-1">
                {events.map((event) => {
                    const Icon = EVENT_ICONS[event.event_type] || Bell;
                    const isExpanded = expanded.has(event.id);
                    const severityColor = SEVERITY_COLORS[event.severity] || SEVERITY_COLORS.info;

                    return (
                        <div key={event.id} className="relative pl-10">
                            {/* Timeline dot */}
                            <div className={`absolute left-[15px] top-3 w-2.5 h-2.5 rounded-full ring-2 ring-slate-950 ${SEVERITY_DOT[event.severity] || SEVERITY_DOT.info}`} />

                            <button
                                onClick={() => toggle(event.id)}
                                className={`w-full text-left rounded-lg border px-3 py-2.5 transition-all hover:bg-slate-800/40 ${severityColor}`}
                            >
                                <div className="flex items-center gap-2">
                                    <Icon className="w-3.5 h-3.5 shrink-0" />
                                    <span className="text-xs font-medium flex-1 truncate">{event.description}</span>
                                    <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform opacity-40 ${isExpanded ? 'rotate-180' : ''}`} />
                                </div>
                                <div className="flex items-center gap-2 mt-1 text-[10px] opacity-60">
                                    <span className="uppercase font-semibold">{event.event_type.replace('_', ' ')}</span>
                                    <span>•</span>
                                    <span title={format(new Date(event.created_at), 'PPpp')}>
                                        {formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}
                                    </span>
                                </div>

                                {isExpanded && event.metadata && Object.keys(event.metadata).length > 0 && (
                                    <div className="mt-2 pt-2 border-t border-slate-700/50 text-[10px] font-mono">
                                        {Object.entries(event.metadata).map(([key, val]) => (
                                            <div key={key} className="flex gap-2 py-0.5">
                                                <span className="text-slate-500 shrink-0">{key}:</span>
                                                <span className="text-slate-300 truncate">{typeof val === 'object' ? JSON.stringify(val) : String(val)}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
