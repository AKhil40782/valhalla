'use client';

import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts';

interface BehaviourRadarChartProps {
    profile: {
        risk_score: number;
        avg_transaction_time_ms: number | null;
        avg_clicks_per_session: number | null;
        avg_mouse_speed: number | null;
        tx_count?: number;
        total_sessions?: number | null;
        anomaly_flags?: Record<string, boolean>;
    };
}

export function BehaviourRadarChart({ profile }: BehaviourRadarChartProps) {
    // Normalize values to 0-100 scale for the radar
    const normalize = (val: number, max: number) => Math.min(100, Math.round((val / max) * 100));

    const anomalyCount = profile.anomaly_flags ? Object.values(profile.anomaly_flags).filter(Boolean).length : 0;

    const data = [
        {
            metric: 'Risk Score',
            value: profile.risk_score || 0,
            fullMark: 100,
        },
        {
            metric: 'Txn Speed',
            value: profile.avg_transaction_time_ms
                ? normalize(6000 - Math.min(profile.avg_transaction_time_ms, 6000), 6000)
                : 0,
            fullMark: 100,
        },
        {
            metric: 'Click Rate',
            value: profile.avg_clicks_per_session
                ? normalize(profile.avg_clicks_per_session, 50)
                : 0,
            fullMark: 100,
        },
        {
            metric: 'Mouse Speed',
            value: profile.avg_mouse_speed
                ? normalize(profile.avg_mouse_speed, 2500)
                : 0,
            fullMark: 100,
        },
        {
            metric: 'Activity Vol.',
            value: normalize(profile.tx_count || 0, 50),
            fullMark: 100,
        },
        {
            metric: 'Anomalies',
            value: normalize(anomalyCount, 5),
            fullMark: 100,
        },
    ];

    const riskColor = profile.risk_score >= 80 ? '#ef4444' :
        profile.risk_score >= 60 ? '#f97316' :
            profile.risk_score >= 40 ? '#eab308' : '#22c55e';

    return (
        <div className="w-full h-full min-h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="72%" data={data}>
                    <PolarGrid stroke="#334155" strokeDasharray="3 3" />
                    <PolarAngleAxis
                        dataKey="metric"
                        tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 500 }}
                    />
                    <PolarRadiusAxis
                        angle={30}
                        domain={[0, 100]}
                        tick={{ fill: '#475569', fontSize: 9 }}
                        axisLine={false}
                    />
                    <Tooltip
                        contentStyle={{
                            backgroundColor: '#0f172a',
                            border: '1px solid #334155',
                            borderRadius: '8px',
                            fontSize: 12,
                            color: '#e2e8f0',
                        }}
                        formatter={(value: number | undefined) => [`${value ?? 0}`, 'Score']}
                    />
                    <Radar
                        name="Behaviour"
                        dataKey="value"
                        stroke={riskColor}
                        fill={riskColor}
                        fillOpacity={0.2}
                        strokeWidth={2}
                        dot={{ r: 3, fill: riskColor }}
                    />
                </RadarChart>
            </ResponsiveContainer>
        </div>
    );
}
