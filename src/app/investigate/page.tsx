'use client';

import { useState, useEffect } from 'react';
import { InvestigatorChat } from "@/components/fraud/InvestigatorChat";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Loader2 } from "lucide-react";
import { getRealFraudData } from '@/app/actions';

export default function InvestigationPage() {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const fraudData = await getRealFraudData();
                setData(fraudData);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
            </div>
        );
    }

    // Find most suspicious entity for context
    const suspiciousNode = data?.graphElements
        ?.filter((el: any) => el.data?.type === 'account')
        ?.sort((a: any, b: any) => (b.data?.risk || 0) - (a.data?.risk || 0))[0];

    const suspect = suspiciousNode?.data;

    const explanation = `
**Investigation Case: Coordinated Pattern Analysis**

My initial scan of the live network has identified **${suspect?.label || 'multiple suspicious clusters'}** as the primary focus.

**Current Indicators:**
- **Top Risk Score**: ${suspect?.risk || 0}/100
- **Network Centrality**: ${suspect?.metrics?.degree || 0} active links
- **System Integrity**: ${data?.stats?.avgSyncScore || 0}% temporal coordination detected
- **Identified Nodes**: ${data?.stats?.uniqueAccounts || 0} active accounts in cluster

You can ask me to analyze specific transaction logs, cross-reference IP addresses, or explain the ${suspect?.metrics?.burstMode ? 'Velocity Burst' : 'Structuring Pattern'} detected.
    `;

    return (
        <div className="h-[calc(100vh-6rem)] grid grid-cols-12 gap-6 pb-6">
            <div className="col-span-12 lg:col-span-8 flex flex-col gap-6 h-full">
                <InvestigatorChat explanation={explanation} />
            </div>

            <div className="col-span-12 lg:col-span-4 flex flex-col gap-6 h-full">
                <Card className="h-full border-slate-800 bg-slate-950/50">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Search className="w-5 h-5 text-slate-400" />
                            Case Context
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 text-slate-400 text-sm">
                        <div className="p-4 bg-slate-900/50 rounded-lg border border-slate-800">
                            <h3 className="font-semibold text-slate-200 mb-2">Primary Suspect</h3>
                            <p>Identity: <span className="text-cyan-400 font-mono">{suspect?.label || 'Searching...'}</span></p>
                            <p>Risk: <span className={suspect?.risk > 80 ? "text-red-400 font-bold" : "text-amber-400"}>{suspect?.risk || 0}/100</span></p>
                        </div>
                        <div className="p-4 bg-slate-900/50 rounded-lg border border-slate-800">
                            <h3 className="font-semibold text-slate-200 mb-2">Forensic Anchors</h3>
                            <ul className="list-disc list-inside space-y-1">
                                <li>{suspect?.metrics?.deviceReuse > 1 ? 'High Device Overlap' : 'Isolated Device'}</li>
                                <li>{suspect?.metrics?.syncScore > 60 ? 'Synchronized Inflow' : 'Organic Temporal Flow'}</li>
                                <li>Status: {suspect?.id?.includes('FROZEN') ? '🔒 Frozen' : '🟢 Monitored'}</li>
                            </ul>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
