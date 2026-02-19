import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Clock, Activity } from 'lucide-react';

interface AlertProps {
    alerts: {
        id: number;
        title: string;
        severity: string;
        time: string;
        description: string;
    }[];
}

export function AlertsFeed({ alerts }: AlertProps) {
    return (
        <Card className="h-full border-slate-800 bg-slate-950/50">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Activity className="w-5 h-5 text-red-500" />
                    Live Threat Feed
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {alerts.map((alert) => (
                    <div
                        key={alert.id}
                        className="p-4 rounded-lg bg-slate-900/50 border border-slate-800 hover:border-slate-700 transition-all group"
                    >
                        <div className="flex items-start justify-between mb-2">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${alert.severity === 'Critical' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                                    alert.severity === 'High' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' :
                                        'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                                }`}>
                                {alert.severity}
                            </span>
                            <div className="flex items-center gap-1 text-slate-500 text-xs">
                                <Clock className="w-3 h-3" />
                                {alert.time}
                            </div>
                        </div>
                        <h4 className="text-sm font-medium text-slate-200 group-hover:text-cyan-400 transition-colors mb-1">
                            {alert.title}
                        </h4>
                        <p className="text-xs text-slate-400 leading-relaxed">
                            {alert.description}
                        </p>
                    </div>
                ))}
            </CardContent>
        </Card>
    );
}
