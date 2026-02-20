'use client';

import { cn } from '@/lib/utils';

const RISK_COLORS: Record<string, { bg: string; text: string; border: string; glow: string }> = {
    CRITICAL: { bg: 'bg-red-950/60', text: 'text-red-400', border: 'border-red-700', glow: 'shadow-red-500/20' },
    HIGH: { bg: 'bg-orange-950/60', text: 'text-orange-400', border: 'border-orange-700', glow: 'shadow-orange-500/20' },
    MEDIUM: { bg: 'bg-yellow-950/60', text: 'text-yellow-400', border: 'border-yellow-700', glow: 'shadow-yellow-500/20' },
    LOW: { bg: 'bg-emerald-950/60', text: 'text-emerald-400', border: 'border-emerald-700', glow: 'shadow-emerald-500/20' },
};

export function RiskBadge({ level, score, size = 'md' }: { level: string; score?: number; size?: 'sm' | 'md' | 'lg' }) {
    const colors = RISK_COLORS[level] || RISK_COLORS.LOW;
    const sizeClasses = {
        sm: 'text-[10px] px-1.5 py-0.5',
        md: 'text-xs px-2.5 py-1',
        lg: 'text-sm px-3 py-1.5',
    };

    return (
        <span className={cn(
            'inline-flex items-center gap-1.5 rounded-full border font-bold tracking-wide shadow-sm',
            colors.bg, colors.text, colors.border, colors.glow,
            sizeClasses[size]
        )}>
            <span className={cn('w-1.5 h-1.5 rounded-full animate-pulse', {
                'bg-red-400': level === 'CRITICAL',
                'bg-orange-400': level === 'HIGH',
                'bg-yellow-400': level === 'MEDIUM',
                'bg-emerald-400': level === 'LOW',
            })} />
            {level}
            {score !== undefined && <span className="opacity-70 font-mono">({score})</span>}
        </span>
    );
}
