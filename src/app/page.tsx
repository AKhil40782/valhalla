'use client';

import { useEffect, useState } from 'react';
import { FraudGraph } from "@/components/fraud/FraudGraph";
import { AlertsFeed } from "@/components/fraud/AlertsFeed";
import { InvestigatorChat } from "@/components/fraud/InvestigatorChat";
import { TimelineReplay } from "@/components/fraud/TimelineReplay";
import { getRealFraudData } from "@/app/actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, ShieldCheck, Users, Zap, TrendingUp, Cpu, Wifi, RefreshCw } from "lucide-react";
import { AdminGuard } from "@/components/auth/AdminGuard";

export default function Home() {
  const [data, setData] = useState<any>({
    graphElements: [],
    alerts: [],
    timelineEvents: [],
    stats: { totalTransactions: 0, uniqueAccounts: 0 },
    hackerInfo: null
  });
  const [loading, setLoading] = useState(true);
  const [liveMode, setLiveMode] = useState(true);

  const fetchData = async () => {
    const result = await getRealFraudData();
    setData(result);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Auto-refresh every 5 seconds
  useEffect(() => {
    if (!liveMode) return;
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [liveMode]);

  const [actionLoading, setActionLoading] = useState(false);

  const handleAction = async () => {
    if (data.hackerInfo.severity === 'CRITICAL') {
      if (!confirm(`Are you sure you want to FREEZE account ${data.hackerInfo.name}?`)) return;

      setActionLoading(true);
      try {
        const { freezeAccount } = await import('@/app/actions');
        const result = await freezeAccount(data.hackerInfo.id);
        if (result.success) {
          alert(`SUCCESS: Account ${data.hackerInfo.name} has been frozen.`);
          fetchData(); // Refresh data
        } else {
          alert(`ERROR: ${result.error}`);
        }
      } catch (err) {
        alert("Failed to freeze account. Check console.");
      } finally {
        setActionLoading(false);
      }
    } else {
      scrollToInvestigation();
    }
  };

  const scrollToInvestigation = () => {
    const element = document.getElementById('investigation-section');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <AdminGuard>
      <div className="space-y-6 max-w-[1600px] mx-auto pb-10">

        {/* Hacker Alert Banner */}
        {data.hackerInfo && (
          <div className={`border-2 rounded-xl p-4 animate-pulse flex items-center justify-between ${data.hackerInfo.severity === 'CRITICAL'
            ? 'bg-red-900/40 border-red-600'
            : 'bg-yellow-900/40 border-yellow-600'
            }`}>
            <div className="flex items-center gap-4">
              <div className="text-4xl">{data.hackerInfo.severity === 'CRITICAL' ? '🚨' : '⚠️'}</div>
              <div>
                <div className={`${data.hackerInfo.severity === 'CRITICAL' ? 'text-red-400' : 'text-yellow-400'} font-bold text-lg`}>
                  {data.hackerInfo.severity} FRAUD {data.hackerInfo.severity === 'CRITICAL' ? 'RING' : 'PATTERN'} DETECTED
                </div>
                <div className={data.hackerInfo.severity === 'CRITICAL' ? 'text-red-300' : 'text-yellow-300'}>
                  Account <strong className="text-white">"{data.hackerInfo.name}"</strong> is receiving funds from <strong>{data.hackerInfo.inDegree}</strong> different accounts.
                  <span className={`ml-2 px-2 py-0.5 rounded text-xs ${data.hackerInfo.severity === 'CRITICAL' ? 'bg-red-800' : 'bg-yellow-800'}`}>
                    {data.hackerInfo.severity === 'CRITICAL' ? 'Fan-In Attack' : 'Suspicious Velocity'}
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={handleAction}
              disabled={actionLoading}
              className={`px-6 py-3 rounded-lg font-bold transition-all ${data.hackerInfo.severity === 'CRITICAL' ? 'bg-red-600 hover:bg-red-500' : 'bg-yellow-600 hover:bg-yellow-500'
                } text-white disabled:opacity-50 disabled:cursor-not-allowed`}>
              {actionLoading ? 'PROCESSING...' : (data.hackerInfo.severity === 'CRITICAL' ? 'FREEZE ACCOUNT' : 'INVESTIGATE')}
            </button>
          </div>
        )}

        {/* Live Mode Toggle */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-200">Investigator Dashboard</h2>
            <p className="text-slate-500 text-sm">Real-time fraud monitoring • Supabase Connected</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setLiveMode(!liveMode)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all ${liveMode ? 'bg-green-900/30 border-green-700 text-green-400' : 'bg-slate-800 border-slate-700 text-slate-400'
                }`}
            >
              <Wifi size={16} className={liveMode ? 'animate-pulse' : ''} />
              {liveMode ? 'LIVE' : 'PAUSED'}
            </button>
            <button onClick={fetchData} className="p-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-400 hover:text-white">
              <RefreshCw size={18} />
            </button>
          </div>
        </div>

        {/* Top Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { label: 'Total Transactions', value: data.stats?.totalTransactions || 0, icon: Activity, color: 'text-cyan-500' },
            { label: 'Unique Accounts', value: data.stats?.uniqueAccounts || 0, icon: Users, color: 'text-purple-500' },
            { label: 'Graph Density', value: data.stats?.graphDensity || '0.0000', icon: Zap, color: parseFloat(data.stats?.graphDensity) > 0.01 ? 'text-red-500' : 'text-slate-500' },
            { label: 'Suspected Hacker', value: data.stats?.suspectedHacker || 'Negative', icon: ShieldCheck, color: data.stats?.suspectedHacker === 'Critical' ? 'text-red-500' : data.stats?.suspectedHacker === 'Moderate' ? 'text-yellow-500' : 'text-emerald-500' },
            { label: 'Coordinated Sync', value: (data.stats?.avgSyncScore || '0') + '%', icon: TrendingUp, color: 'text-blue-500' },
            { label: 'System Status', value: 'Monitoring', icon: Cpu, color: 'text-emerald-500' },
          ].map((stat, i) => (
            <Card key={i} className="bg-slate-900/40 border-slate-800/60 backdrop-blur-sm">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-400 mb-1">{stat.label}</p>
                  <div className="text-xl font-bold text-slate-100">{stat.value}</div>
                </div>
                <div className={`p-2 rounded-lg bg-slate-950/50 border border-slate-800 ${stat.color}`}>
                  <stat.icon className="w-5 h-5" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-12 gap-6">
          {/* Main Graph View */}
          <div className="col-span-12 lg:col-span-8 flex flex-col gap-6">
            <Card className="h-[500px] border-slate-800 bg-slate-950/50 flex flex-col overflow-hidden">
              <CardHeader className="border-b border-slate-800/50 py-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">🏦 Salaar Bank - Live Fraud Network</CardTitle>
                  <div className="flex gap-2">
                    <span className="text-xs px-2 py-1 rounded bg-cyan-950/50 border border-cyan-800 text-cyan-400">Real-Time</span>
                    {liveMode && (
                      <span className="text-xs px-2 py-1 rounded bg-emerald-950/50 border border-emerald-800 text-emerald-400 animate-pulse">● Live</span>
                    )}
                  </div>
                </div>
              </CardHeader>
              <div className="flex-1 relative bg-slate-900/20">
                {loading ? (
                  <div className="flex items-center justify-center h-full text-slate-500">Loading...</div>
                ) : data.graphElements?.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-500">
                    <div className="text-5xl mb-4">📊</div>
                    <div className="text-lg font-medium">Awaiting Transaction Data</div>
                    <div className="text-sm text-slate-600 mt-2">Transactions from user accounts will appear here in real-time.</div>
                  </div>
                ) : (
                  <FraudGraph elements={data.graphElements} />
                )}
              </div>
            </Card>

            {/* Timeline + Chat */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <TimelineReplay events={data.timelineEvents || []} />
              <div id="investigation-section">
                <InvestigatorChat explanation={data.hackerInfo
                  ? `🚨 **FRAUD ALERT**\n\nAccount "${data.hackerInfo.name}" is receiving funds from ${data.hackerInfo.inDegree} different sources. This is a classic **Fan-In Money Laundering** pattern.\n\n**Forensic Matrix:**\n• **Graph Density:** ${data.stats?.graphDensity}\n• **Global Sync:** ${data.stats?.avgSyncScore}%\n• **Alert Severity:** ${data.hackerInfo.severity}\n\n**Recommendation:** Freeze account immediately and investigate source accounts for shared hardware identifiers.`
                  : `No active fraud rings detected. \n\n**Current Baseline:**\n• Network Density: ${data.stats?.graphDensity || '0.0000'}\n• Synchronization: ${data.stats?.avgSyncScore || 0}%\n\nMonitoring all transactions in real-time.`
                } />
              </div>
            </div>
          </div>

          {/* Right Sidebar */}
          <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
            <AlertsFeed alerts={data.alerts || []} />

            {/* Investigation Tools */}
            <Card className="border-slate-800 bg-slate-950/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Investigation Tools</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <a href="/network" className="block w-full py-3 px-4 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-center font-semibold transition-all">
                  🔍 Full Network View
                </a>
                <a href="/reports" className="block w-full py-3 px-4 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-center font-semibold transition-all">
                  📄 Generate Report
                </a>
              </CardContent>
            </Card>

            {/* System Status */}
            <Card className="border-slate-800 bg-slate-950/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">System Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center justify-between py-2 border-b border-slate-800">
                  <span className="text-slate-400">Database</span>
                  <span className="text-emerald-400 flex items-center gap-1">● Connected</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-slate-800">
                  <span className="text-slate-400">Real-Time Sync</span>
                  <span className={liveMode ? 'text-emerald-400' : 'text-slate-500'}>{liveMode ? '● Active' : '○ Paused'}</span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-slate-400">Detection Engine</span>
                  <span className="text-emerald-400">● Running</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AdminGuard >
  );
}
