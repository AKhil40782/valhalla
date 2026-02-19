'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Download, Share2, Shield, Plus, Loader2, CheckCircle, Clock, AlertTriangle, Eye, X } from "lucide-react";
import { generateFraudReport, generateCaseId } from '@/lib/pdf-generator';
import { getRealFraudData } from '@/app/actions';

interface Report {
    id: string;
    title: string;
    date: string;
    status: 'Generated' | 'Pending Review' | 'Generating' | 'Archived';
    type: 'SAR' | 'Evidence' | 'Analysis' | 'Summary';
    riskLevel?: string;
    content?: string;
}

export default function ReportsPage() {
    const [reports, setReports] = useState<Report[]>([]);
    const [loading, setLoading] = useState(true);
    const [isGenerating, setIsGenerating] = useState(false);
    const [selectedReport, setSelectedReport] = useState<Report | null>(null);
    const [isPdfExporting, setIsPdfExporting] = useState(false);

    // Fetch real data on mount
    useEffect(() => {
        loadReports();
    }, []);

    const loadReports = async () => {
        setLoading(true);
        try {
            const data = await getRealFraudData();

            // Generate reports from real data
            const generatedReports: Report[] = [];

            // SAR Report if critical alerts exist
            if (data.alerts && data.alerts.some((a: any) => a.severity === 'Critical')) {
                const criticalAlert = data.alerts.find((a: any) => a.severity === 'Critical');
                generatedReports.push({
                    id: generateCaseId(),
                    title: 'Suspicious Activity Report (SAR) - Money Mule Network',
                    date: new Date().toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }),
                    status: 'Generated',
                    type: 'SAR',
                    riskLevel: 'CRITICAL',
                    content: `# SUSPICIOUS ACTIVITY REPORT (SAR)
            
## Case Summary
${criticalAlert?.description || 'Suspicious activity detected in transaction network.'}

## Key Findings
- **Network Size**: ${data.stats?.uniqueAccounts || 0} accounts involved
- **Total Transactions**: ${data.stats?.totalTransactions || 0}
- **Graph Density**: ${data.stats?.graphDensity || 0}
- **Time Window**: Real-time monitoring

## Recommended Actions
1. Freeze all identified accounts immediately
2. File SAR with FinCEN within 24 hours
3. Preserve all transaction logs as evidence

## Risk Assessment: CRITICAL`
                });
            }

            // Structuring Analysis if threshold dodging detected
            const structuringTxs = data.timelineEvents?.filter((e: any) =>
                e.riskLevel === 'high' && e.details?.amount >= 9000 && e.details?.amount <= 9999
            ) || [];

            if (structuringTxs.length > 0) {
                const totalStructured = structuringTxs.reduce((sum: number, tx: any) => sum + (tx.details?.amount || 0), 0);

                generatedReports.push({
                    id: generateCaseId(),
                    title: 'Structuring Pattern Analysis - Threshold Dodging',
                    date: new Date().toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }),
                    status: 'Pending Review',
                    type: 'Analysis',
                    riskLevel: 'HIGH',
                    content: `# STRUCTURING PATTERN ANALYSIS

## Pattern Detected
Multiple transactions deliberately structured below ₹10,000 reporting threshold.

## Evidence
${structuringTxs.map((tx: any) => `- ${tx.details?.from} → ${tx.details?.to}: ₹${tx.details?.amount?.toLocaleString('en-IN')}`).join('\n')}

**Total Structured**: ₹${totalStructured.toLocaleString('en-IN')}

## Conclusion
Clear evidence of deliberate structuring to avoid BSA reporting requirements.`
                });
            }

            // Network Analysis Report with detailed transactions
            if (data.timelineEvents && data.timelineEvents.length > 0) {
                const transactionDetails = data.timelineEvents.slice(0, 15).map((tx: any) => {
                    return `| ${new Date(tx.timestamp).toLocaleDateString('en-IN')} | ${tx.details?.from || 'Unknown'} | ${tx.details?.to || 'Unknown'} | ₹${tx.details?.amount?.toLocaleString('en-IN') || 0} | ${tx.riskLevel.toUpperCase()} |`;
                }).join('\n');

                const totalValue = data.timelineEvents.reduce((sum: number, tx: any) => sum + (tx.details?.amount || 0), 0);

                generatedReports.push({
                    id: generateCaseId(),
                    title: 'Transaction Evidence & Network Analysis',
                    date: new Date().toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }),
                    status: 'Generated',
                    type: 'Evidence',
                    riskLevel: data.hackerInfo ? 'HIGH' : 'MEDIUM',
                    content: `# TRANSACTION EVIDENCE PACKAGE

## Summary
- **Total Transactions**: ${data.timelineEvents.length}
- **Total Value Transacted**: ₹${totalValue.toLocaleString('en-IN')}
- **Unique Accounts**: ${data.stats?.uniqueAccounts || 0}
- **Graph Density**: ${data.stats?.graphDensity || 0}

## Detailed Transaction Log

| Date | From | To | Amount | Risk |
|------|------|-------|--------|------|
${transactionDetails}

## Network Metrics
- **Sync Score**: ${data.stats?.avgSyncScore || 0}%
- **Suspected Fraud**: ${data.stats?.suspectedHacker || 'Negative'}
${data.hackerInfo ? `- **Primary Suspect**: ${data.hackerInfo.name} (In-Degree: ${data.hackerInfo.inDegree})` : ''}

## Forensic Evidence
${data.timelineEvents.slice(0, 5).map((tx: any) =>
                        `**Transaction ID**: ${tx.id}
- IP Address: ${tx.details?.ip || 'Unknown'}
- Device: ${tx.details?.device || 'Unknown'}
- Location: ${tx.details?.location || 'Unknown'}
- IMEI: ${tx.details?.imei || 'N/A'}
`).join('\n')}`
                });
            }

            setReports(generatedReports);
        } catch (error) {
            console.error('Error loading reports:', error);
        } finally {
            setLoading(false);
        }
    };

    const exportToPdf = async () => {
        setIsPdfExporting(true);
        try {
            const data = await getRealFraudData();
            const caseId = generateCaseId();

            generateFraudReport({
                caseId,
                generatedAt: new Date(),
                generatedBy: 'Fraud Investigation Team',
                summary: {
                    totalTransactions: data.stats?.totalTransactions || 0,
                    uniqueAccounts: data.stats?.uniqueAccounts || 0,
                    graphDensity: data.stats?.graphDensity || '0.0000',
                    suspectedHacker: data.stats?.suspectedHacker || 'Negative',
                    avgSyncScore: data.stats?.avgSyncScore || '0',
                },
                alerts: data.alerts || [],
                transactions: data.timelineEvents?.map((e: any) => ({
                    from: e.details?.from || 'Unknown',
                    to: e.details?.to || 'Unknown',
                    amount: e.details?.amount || 0,
                    timestamp: e.timestamp,
                    ip: e.details?.ip,
                    device: e.details?.device,
                })) || [],
                hackerInfo: data.hackerInfo || undefined,
            });
        } catch (err) {
            console.error('PDF Generation Error:', err);
            alert('Failed to generate PDF. Check console for details.');
        } finally {
            setIsPdfExporting(false);
        }
    };

    const getStatusIcon = (status: Report['status']) => {
        switch (status) {
            case 'Generated': return <CheckCircle className="w-4 h-4 text-emerald-500" />;
            case 'Pending Review': return <Clock className="w-4 h-4 text-amber-500" />;
            case 'Generating': return <Loader2 className="w-4 h-4 text-cyan-500 animate-spin" />;
            case 'Archived': return <Shield className="w-4 h-4 text-slate-500" />;
        }
    };

    const getTypeColor = (type: Report['type']) => {
        switch (type) {
            case 'SAR': return 'bg-red-500/20 text-red-400 border-red-500/30';
            case 'Evidence': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
            case 'Analysis': return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30';
            case 'Summary': return 'bg-green-500/20 text-green-400 border-green-500/30';
        }
    };

    const generateNewReport = async () => {
        setIsGenerating(true);

        try {
            const data = await getRealFraudData();
            const newId = `R-${new Date().getFullYear()}-${String(reports.length + 1).padStart(3, '0')}`;

            // Temporary report entry
            const tempReport: Report = {
                id: newId,
                title: 'AI Investigation in progress...',
                date: new Date().toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }),
                status: 'Generating',
                type: 'Analysis'
            };

            setReports(prev => [tempReport, ...prev]);

            // Simulate AI analysis delay
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Find most suspicious entity
            const suspiciousNode = data.graphElements
                .filter((el: any) => el.data?.type === 'account' && el.data?.risk > 50)
                .sort((a: any, b: any) => (b.data?.risk || 0) - (a.data?.risk || 0))[0];

            const suspectName = suspiciousNode?.data?.label || 'Multiple Entities';
            const suspectRisk = suspiciousNode?.data?.risk || 'Elevated';
            const suspectReason = suspiciousNode ? (
                suspiciousNode.data.metrics?.burstMode ? "Velocity Attack (Burst)" :
                    suspiciousNode.data.metrics?.thresholdDodging ? "Structuring Pattern" :
                        "Coordinated Network Cluster"
            ) : "General Network Analysis";

            setReports(prev => prev.map(r =>
                r.id === newId ? {
                    ...r,
                    title: `Intelligence Analysis: ${suspectName}`,
                    status: 'Generated' as const,
                    riskLevel: parseFloat(suspectRisk.toString()) > 80 ? 'CRITICAL' : 'HIGH',
                    content: `# INTELLIGENCE INVESTIGATION REPORT: ${suspectName}

## Executive Summary
Advanced behavioral analysis has identified high-risk activity originating from ${suspectName}. The system has flagged this entity for ${suspectReason}.

## Analytical Findings
- **Risk Score**: ${suspectRisk}/100
- **Primary Pattern**: ${suspectReason}
- **Network Centrality**: ${suspiciousNode?.data?.metrics?.degree || 0} connections
- **Device Reputation**: ${suspiciousNode?.data?.metrics?.deviceReuse > 1 ? 'Compromised (Shared Device)' : 'Normal'}
- **Temporal Sync**: ${suspiciousNode?.data?.metrics?.syncScore || 0}% coordination

## Investigation Detail
The subject account shows a strong correlation with known money laundering patterns. Specifically, the ${suspectReason} indicator suggests professional orchestration rather than individual behavior.

## Recommendations
1. **Immediate**: Apply temporary freeze to account ${suspiciousNode?.data?.id || 'targeted nodes'}
2. **Investigation**: Cross-verify registered KYC address with known high-risk zones
3. **Network**: Track funds to secondary exit points

**Generated by Salaar Intelligence Engine**
*Ref ID: ${newId}*`
                } : r
            ));

        } catch (err) {
            console.error("Report Generation Error:", err);
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="space-y-6 max-w-6xl mx-auto pb-10">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-100">Intelligence Reports</h1>
                    <p className="text-slate-400 mt-1">AI-generated case files and evidence packages for investigators.</p>
                </div>
                <Button
                    onClick={generateNewReport}
                    disabled={isGenerating}
                    variant="neon"
                    className="gap-2"
                >
                    {isGenerating ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Generating...
                        </>
                    ) : (
                        <>
                            <Plus className="w-4 h-4" />
                            Generate New Report
                        </>
                    )}
                </Button>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-4 gap-4">
                {[
                    { label: 'Total Reports', value: reports.length, color: 'text-slate-300' },
                    { label: 'Generated', value: reports.filter(r => r.status === 'Generated').length, color: 'text-emerald-400' },
                    { label: 'Pending Review', value: reports.filter(r => r.status === 'Pending Review').length, color: 'text-amber-400' },
                    { label: 'SARs Filed', value: reports.filter(r => r.type === 'SAR').length, color: 'text-red-400' },
                ].map((stat, i) => (
                    <Card key={i} className="bg-slate-900/40 border-slate-800">
                        <CardContent className="p-4 text-center">
                            <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
                            <div className="text-xs text-slate-500 mt-1">{stat.label}</div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Reports List */}
            <div className="grid gap-4">
                {reports.map((report) => (
                    <Card
                        key={report.id}
                        className={`bg-slate-950/50 border-slate-800 hover:bg-slate-900/50 transition-colors cursor-pointer group ${report.status === 'Generating' ? 'animate-pulse' : ''
                            }`}
                        onClick={() => report.content && setSelectedReport(report)}
                    >
                        <CardContent className="p-6 flex items-center justify-between">
                            <div className="flex items-start gap-4">
                                <div className={`h-12 w-12 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center group-hover:border-cyan-500/50 transition-colors ${report.riskLevel === 'CRITICAL' ? 'border-red-500/50' : ''
                                    }`}>
                                    {report.status === 'Generating' ? (
                                        <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
                                    ) : (
                                        <FileText className="w-6 h-6 text-slate-400 group-hover:text-cyan-400" />
                                    )}
                                </div>
                                <div>
                                    <div className="flex items-center gap-3 flex-wrap">
                                        <h3 className="font-semibold text-slate-200 group-hover:text-cyan-300">{report.title}</h3>
                                        <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 border border-slate-700 text-slate-400">{report.id}</span>
                                        <span className={`px-2 py-0.5 rounded text-[10px] border ${getTypeColor(report.type)}`}>{report.type}</span>
                                        {report.riskLevel && (
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${report.riskLevel === 'CRITICAL' ? 'bg-red-500/20 text-red-400' :
                                                report.riskLevel === 'HIGH' ? 'bg-orange-500/20 text-orange-400' :
                                                    'bg-yellow-500/20 text-yellow-400'
                                                }`}>
                                                {report.riskLevel}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-4 mt-1 text-sm text-slate-500">
                                        <span>Generated: {report.date}</span>
                                        <span>•</span>
                                        <span className="flex items-center gap-1">
                                            {getStatusIcon(report.status)}
                                            {report.status}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                {report.content && (
                                    <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white" onClick={(e) => { e.stopPropagation(); setSelectedReport(report); }}>
                                        <Eye className="w-4 h-4" />
                                    </Button>
                                )}
                                <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white">
                                    <Download className="w-4 h-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white">
                                    <Share2 className="w-4 h-4" />
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Report Viewer Modal */}
            {selectedReport && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelectedReport(null)}>
                    <Card className="w-full max-w-4xl max-h-[80vh] overflow-hidden bg-slate-900 border-slate-700" onClick={e => e.stopPropagation()}>
                        <CardHeader className="border-b border-slate-700 flex flex-row items-center justify-between">
                            <div>
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <FileText className="w-5 h-5 text-cyan-400" />
                                    {selectedReport.title}
                                </CardTitle>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-xs text-slate-500">{selectedReport.id}</span>
                                    <span className={`px-2 py-0.5 rounded text-[10px] border ${getTypeColor(selectedReport.type)}`}>{selectedReport.type}</span>
                                </div>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => setSelectedReport(null)}>
                                <X className="w-5 h-5" />
                            </Button>
                        </CardHeader>
                        <CardContent className="p-6 overflow-y-auto max-h-[60vh]">
                            <div
                                className="prose prose-invert prose-sm max-w-none"
                                dangerouslySetInnerHTML={{
                                    __html: selectedReport.content!
                                        .replace(/\n/g, '<br/>')
                                        .replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold text-cyan-400 mt-4 mb-2">$1</h1>')
                                        .replace(/^## (.+)$/gm, '<h2 class="text-lg font-bold text-purple-400 mt-3 mb-2">$1</h2>')
                                        .replace(/\*\*(.+?)\*\*/g, '<strong class="text-slate-200">$1</strong>')
                                        .replace(/`{3}([\s\S]*?)`{3}/g, '<pre class="bg-slate-800 p-3 rounded-lg my-3 overflow-x-auto text-xs text-cyan-300">$1</pre>')
                                        .replace(/`([^`]+)`/g, '<code class="bg-slate-800 px-1 rounded text-cyan-300">$1</code>')
                                }}
                            />
                        </CardContent>
                        <div className="border-t border-slate-700 p-4 flex justify-end gap-2">
                            <Button
                                variant="outline"
                                className="gap-2"
                                onClick={exportToPdf}
                                disabled={isPdfExporting}
                            >
                                {isPdfExporting ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Download className="w-4 h-4" />
                                )}
                                {isPdfExporting ? 'Generating...' : 'Export PDF'}
                            </Button>
                            <Button variant="neon" className="gap-2">
                                <Share2 className="w-4 h-4" />
                                Share Report
                            </Button>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
}
