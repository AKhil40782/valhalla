'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, PlusCircle, Send, Trash2, AlertTriangle, Sparkles, ChevronDown } from 'lucide-react';

interface RawTransaction {
    id: string;
    from_account: string;
    to_account: string;
    amount: number;
    ip_address: string;
    location: string;
    timestamp: string;
    fraud_type?: string;
}

type FraudType = 'structuring' | 'ip_collision' | 'velocity_attack' | 'geo_anomaly' | 'money_mule';

const FRAUD_TYPES: { value: FraudType; label: string; description: string }[] = [
    { value: 'structuring', label: 'Structuring / Smurfing', description: 'Multiple small deposits below reporting threshold' },
    { value: 'ip_collision', label: 'Shared IP Attack', description: 'Multiple accounts accessed from same IP address' },
    { value: 'velocity_attack', label: 'Velocity Attack', description: 'Rapid burst of transactions in short timeframe' },
    { value: 'geo_anomaly', label: 'Geographic Anomaly', description: 'Impossible travel - logins from distant locations' },
    { value: 'money_mule', label: 'Money Mule Ring', description: 'Layered transfers through mule accounts to orchestrator' },
];

export default function InputPage() {
    const [transactions, setTransactions] = useState<RawTransaction[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<string | null>(null);
    const [selectedFraudType, setSelectedFraudType] = useState<FraudType>('structuring');
    const [showFraudDropdown, setShowFraudDropdown] = useState(false);

    // Form state
    const [formData, setFormData] = useState({
        from_account: '',
        to_account: '',
        amount: '',
        ip_address: '',
        location: '',
        timestamp: new Date().toISOString().slice(0, 16)
    });

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const addTransaction = () => {
        if (!formData.from_account || !formData.to_account || !formData.amount) {
            alert('Please fill in required fields: From Account, To Account, and Amount');
            return;
        }

        const newTx: RawTransaction = {
            id: `tx_${Date.now()}`,
            from_account: formData.from_account,
            to_account: formData.to_account,
            amount: parseFloat(formData.amount),
            ip_address: formData.ip_address || 'Unknown',
            location: formData.location || 'Unknown',
            timestamp: formData.timestamp || new Date().toISOString()
        };

        setTransactions(prev => [...prev, newTx]);

        setFormData(prev => ({
            ...prev,
            from_account: '',
            to_account: '',
            amount: '',
            timestamp: new Date().toISOString().slice(0, 16)
        }));
    };

    const removeTransaction = (id: string) => {
        setTransactions(prev => prev.filter(tx => tx.id !== id));
    };

    // Generate Demo Fraud Data based on selected type
    const generateDemoFraud = () => {
        const now = new Date();
        let demoTransactions: RawTransaction[] = [];

        switch (selectedFraudType) {
            case 'structuring':
                // Multiple deposits just under $10,000 threshold
                demoTransactions = [
                    { id: `demo_${Date.now()}_1`, from_account: 'EXT_CASH_001', to_account: 'ACC_SUSPECT_A', amount: 9500, ip_address: '103.45.67.89', location: 'Mumbai, IN', timestamp: new Date(now.getTime() - 3600000).toISOString(), fraud_type: 'Structuring' },
                    { id: `demo_${Date.now()}_2`, from_account: 'EXT_CASH_002', to_account: 'ACC_SUSPECT_A', amount: 9800, ip_address: '103.45.67.89', location: 'Mumbai, IN', timestamp: new Date(now.getTime() - 7200000).toISOString(), fraud_type: 'Structuring' },
                    { id: `demo_${Date.now()}_3`, from_account: 'EXT_CASH_003', to_account: 'ACC_SUSPECT_A', amount: 9200, ip_address: '103.45.67.90', location: 'Mumbai, IN', timestamp: new Date(now.getTime() - 10800000).toISOString(), fraud_type: 'Structuring' },
                    { id: `demo_${Date.now()}_4`, from_account: 'EXT_CASH_004', to_account: 'ACC_SUSPECT_A', amount: 9700, ip_address: '103.45.67.89', location: 'Delhi, IN', timestamp: new Date(now.getTime() - 14400000).toISOString(), fraud_type: 'Structuring' },
                ];
                break;

            case 'ip_collision':
                // Different accounts, same IP
                const sharedIP = '192.168.100.55';
                demoTransactions = [
                    { id: `demo_${Date.now()}_1`, from_account: 'ACC_USER_001', to_account: 'ACC_EXTERNAL', amount: 2500, ip_address: sharedIP, location: 'Unknown/Proxy', timestamp: new Date(now.getTime() - 60000).toISOString(), fraud_type: 'IP Collision' },
                    { id: `demo_${Date.now()}_2`, from_account: 'ACC_USER_002', to_account: 'ACC_EXTERNAL', amount: 3200, ip_address: sharedIP, location: 'Unknown/Proxy', timestamp: new Date(now.getTime() - 120000).toISOString(), fraud_type: 'IP Collision' },
                    { id: `demo_${Date.now()}_3`, from_account: 'ACC_USER_003', to_account: 'ACC_EXTERNAL', amount: 1800, ip_address: sharedIP, location: 'Unknown/Proxy', timestamp: new Date(now.getTime() - 180000).toISOString(), fraud_type: 'IP Collision' },
                    { id: `demo_${Date.now()}_4`, from_account: 'ACC_USER_004', to_account: 'ACC_MASTER', amount: 7500, ip_address: sharedIP, location: 'Unknown/Proxy', timestamp: new Date(now.getTime() - 240000).toISOString(), fraud_type: 'IP Collision' },
                ];
                break;

            case 'velocity_attack':
                // Many transactions in seconds
                demoTransactions = [
                    { id: `demo_${Date.now()}_1`, from_account: 'ACC_COMPROMISED', to_account: 'ACC_DROP_1', amount: 500, ip_address: '45.33.21.99', location: 'Lagos, NG', timestamp: new Date(now.getTime() - 5000).toISOString(), fraud_type: 'Velocity' },
                    { id: `demo_${Date.now()}_2`, from_account: 'ACC_COMPROMISED', to_account: 'ACC_DROP_2', amount: 500, ip_address: '45.33.21.99', location: 'Lagos, NG', timestamp: new Date(now.getTime() - 10000).toISOString(), fraud_type: 'Velocity' },
                    { id: `demo_${Date.now()}_3`, from_account: 'ACC_COMPROMISED', to_account: 'ACC_DROP_3', amount: 500, ip_address: '45.33.21.99', location: 'Lagos, NG', timestamp: new Date(now.getTime() - 15000).toISOString(), fraud_type: 'Velocity' },
                    { id: `demo_${Date.now()}_4`, from_account: 'ACC_COMPROMISED', to_account: 'ACC_DROP_4', amount: 500, ip_address: '45.33.21.99', location: 'Lagos, NG', timestamp: new Date(now.getTime() - 20000).toISOString(), fraud_type: 'Velocity' },
                    { id: `demo_${Date.now()}_5`, from_account: 'ACC_COMPROMISED', to_account: 'ACC_DROP_5', amount: 500, ip_address: '45.33.21.99', location: 'Lagos, NG', timestamp: new Date(now.getTime() - 25000).toISOString(), fraud_type: 'Velocity' },
                    { id: `demo_${Date.now()}_6`, from_account: 'ACC_COMPROMISED', to_account: 'ACC_DROP_6', amount: 500, ip_address: '45.33.21.99', location: 'Lagos, NG', timestamp: new Date(now.getTime() - 30000).toISOString(), fraud_type: 'Velocity' },
                ];
                break;

            case 'geo_anomaly':
                // Impossible travel
                demoTransactions = [
                    { id: `demo_${Date.now()}_1`, from_account: 'ACC_VIP_CLIENT', to_account: 'ACC_MERCHANT_1', amount: 15000, ip_address: '72.45.123.11', location: 'New York, US', timestamp: new Date(now.getTime() - 300000).toISOString(), fraud_type: 'Geo Anomaly' },
                    { id: `demo_${Date.now()}_2`, from_account: 'ACC_VIP_CLIENT', to_account: 'ACC_MERCHANT_2', amount: 22000, ip_address: '185.67.89.22', location: 'London, UK', timestamp: new Date(now.getTime() - 180000).toISOString(), fraud_type: 'Geo Anomaly' },
                    { id: `demo_${Date.now()}_3`, from_account: 'ACC_VIP_CLIENT', to_account: 'ACC_CRYPTO_EXCHANGE', amount: 35000, ip_address: '103.22.45.88', location: 'Singapore, SG', timestamp: new Date(now.getTime() - 60000).toISOString(), fraud_type: 'Geo Anomaly' },
                ];
                break;

            case 'money_mule':
                // Layering through mule network
                demoTransactions = [
                    { id: `demo_${Date.now()}_1`, from_account: 'ACC_SOURCE', to_account: 'ACC_MULE_1', amount: 25000, ip_address: '91.134.55.66', location: 'Kyiv, UA', timestamp: new Date(now.getTime() - 600000).toISOString(), fraud_type: 'Money Mule' },
                    { id: `demo_${Date.now()}_2`, from_account: 'ACC_MULE_1', to_account: 'ACC_MULE_2', amount: 12000, ip_address: '91.134.55.67', location: 'Kyiv, UA', timestamp: new Date(now.getTime() - 480000).toISOString(), fraud_type: 'Money Mule' },
                    { id: `demo_${Date.now()}_3`, from_account: 'ACC_MULE_1', to_account: 'ACC_MULE_3', amount: 12500, ip_address: '91.134.55.68', location: 'Warsaw, PL', timestamp: new Date(now.getTime() - 360000).toISOString(), fraud_type: 'Money Mule' },
                    { id: `demo_${Date.now()}_4`, from_account: 'ACC_MULE_2', to_account: 'ACC_ORCHESTRATOR', amount: 11500, ip_address: '91.134.55.69', location: 'Dubai, AE', timestamp: new Date(now.getTime() - 240000).toISOString(), fraud_type: 'Money Mule' },
                    { id: `demo_${Date.now()}_5`, from_account: 'ACC_MULE_3', to_account: 'ACC_ORCHESTRATOR', amount: 12000, ip_address: '91.134.55.70', location: 'Dubai, AE', timestamp: new Date(now.getTime() - 120000).toISOString(), fraud_type: 'Money Mule' },
                ];
                break;
        }

        setTransactions(prev => [...prev, ...demoTransactions]);
        setShowFraudDropdown(false);
    };

    const analyzeTransactions = async () => {
        if (transactions.length === 0) {
            alert('Please add at least one transaction to analyze');
            return;
        }

        setIsProcessing(true);
        setAnalysisResult(null);

        try {
            await new Promise(resolve => setTimeout(resolve, 2000));

            const ipCounts: Record<string, string[]> = {};
            const locationCounts: Record<string, { locations: string[]; timestamps: number[] }> = {};
            let suspiciousPatterns: string[] = [];

            // Detect fraud type from labels
            const fraudTypes = new Set(transactions.map(tx => tx.fraud_type).filter(Boolean));
            if (fraudTypes.size > 0) {
                suspiciousPatterns.push(`🏷️ **Detected Fraud Classification:** ${[...fraudTypes].join(', ')}`);
            }

            transactions.forEach(tx => {
                // IP tracking
                if (!ipCounts[tx.ip_address]) {
                    ipCounts[tx.ip_address] = [];
                }
                ipCounts[tx.ip_address].push(tx.from_account);

                // Location tracking for geo anomaly
                if (!locationCounts[tx.from_account]) {
                    locationCounts[tx.from_account] = { locations: [], timestamps: [] };
                }
                locationCounts[tx.from_account].locations.push(tx.location);
                locationCounts[tx.from_account].timestamps.push(new Date(tx.timestamp).getTime());

                // High value detection (Structuring threshold)
                if (tx.amount >= 9000 && tx.amount < 10000) {
                    suspiciousPatterns.push(`🔴 **Structuring Alert:** ₹${tx.amount.toLocaleString()} to ${tx.to_account} - just below ₹10,000 reporting threshold`);
                } else if (tx.amount > 10000) {
                    suspiciousPatterns.push(`⚠️ High-value transfer: $${tx.amount.toLocaleString()} from ${tx.from_account}`);
                }
            });

            // IP sharing detection
            Object.entries(ipCounts).forEach(([ip, accounts]) => {
                const uniqueAccounts = [...new Set(accounts)];
                if (uniqueAccounts.length > 1) {
                    suspiciousPatterns.push(`🔴 **Shared IP Address:** ${ip} used by ${uniqueAccounts.length} accounts (${uniqueAccounts.join(', ')})`);
                }
            });

            // Geographic Anomaly detection
            Object.entries(locationCounts).forEach(([account, data]) => {
                const uniqueLocations = [...new Set(data.locations)];
                if (uniqueLocations.length > 1) {
                    const sortedTimestamps = [...data.timestamps].sort();
                    const timeDiffMins = (sortedTimestamps[sortedTimestamps.length - 1] - sortedTimestamps[0]) / 1000 / 60;
                    if (timeDiffMins < 60 && uniqueLocations.length >= 2) {
                        suspiciousPatterns.push(`🟠 **Geographic Anomaly:** Account ${account} accessed from ${uniqueLocations.join(' → ')} within ${timeDiffMins.toFixed(0)} minutes (Impossible travel)`);
                    }
                }
            });

            // Velocity check
            if (transactions.length >= 5) {
                const timestamps = transactions.map(tx => new Date(tx.timestamp).getTime()).sort();
                const timeDiff = (timestamps[timestamps.length - 1] - timestamps[0]) / 1000;
                if (timeDiff < 60) {
                    suspiciousPatterns.push(`🔴 **Velocity Attack:** ${transactions.length} transactions in ${timeDiff.toFixed(0)} seconds`);
                } else if (timeDiff < 600) {
                    suspiciousPatterns.push(`🟠 **High Velocity:** ${transactions.length} transactions in ${(timeDiff / 60).toFixed(1)} minutes`);
                }
            }

            // Money Mule detection (chain pattern)
            const accountFlows: Record<string, string[]> = {};
            transactions.forEach(tx => {
                if (!accountFlows[tx.from_account]) accountFlows[tx.from_account] = [];
                accountFlows[tx.from_account].push(tx.to_account);
            });

            const muleChains: string[] = [];
            Object.entries(accountFlows).forEach(([from, tos]) => {
                tos.forEach(to => {
                    if (accountFlows[to]) {
                        muleChains.push(`${from} → ${to} → ${accountFlows[to].join('/')}`);
                    }
                });
            });
            if (muleChains.length > 0) {
                suspiciousPatterns.push(`🔴 **Money Mule Network Detected:**\n${muleChains.map(c => `   • ${c}`).join('\n')}`);
            }

            if (suspiciousPatterns.length === 0) {
                setAnalysisResult('✅ No suspicious patterns detected in the provided transactions.');
            } else {
                setAnalysisResult(`**Fraud Analysis Results:**\n\n${suspiciousPatterns.join('\n\n')}\n\n---\n**Recommendation:** Review flagged transactions and consider freezing associated accounts. File SAR if warranted.`);
            }
        } catch (error) {
            setAnalysisResult('Error analyzing transactions. Please try again.');
        } finally {
            setIsProcessing(false);
        }
    };

    const clearAll = () => {
        setTransactions([]);
        setAnalysisResult(null);
    };

    return (
        <div className="space-y-6 max-w-[1400px] mx-auto pb-10">
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-100">Raw Transaction Input</h1>
                    <p className="text-slate-400 mt-1">Manually enter transaction data or generate demo fraud scenarios</p>
                </div>
                <div className="flex gap-2 flex-wrap">
                    {/* Demo Fraud Dropdown */}
                    <div className="relative">
                        <Button
                            variant="neon"
                            className="gap-2"
                            onClick={() => setShowFraudDropdown(!showFraudDropdown)}
                        >
                            <Sparkles className="w-4 h-4" />
                            Create Demo Fraud
                            <ChevronDown className={`w-4 h-4 transition-transform ${showFraudDropdown ? 'rotate-180' : ''}`} />
                        </Button>

                        {showFraudDropdown && (
                            <div className="absolute right-0 mt-2 w-80 bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-50">
                                <div className="p-3 border-b border-slate-700">
                                    <p className="text-xs text-slate-400 uppercase tracking-wide font-bold">Select Fraud Type</p>
                                </div>
                                <div className="max-h-[300px] overflow-y-auto">
                                    {FRAUD_TYPES.map((type) => (
                                        <button
                                            key={type.value}
                                            onClick={() => setSelectedFraudType(type.value)}
                                            className={`w-full text-left p-3 hover:bg-slate-800 transition-colors ${selectedFraudType === type.value ? 'bg-cyan-950/30 border-l-2 border-cyan-500' : ''}`}
                                        >
                                            <div className="font-medium text-slate-200">{type.label}</div>
                                            <div className="text-xs text-slate-500 mt-0.5">{type.description}</div>
                                        </button>
                                    ))}
                                </div>
                                <div className="p-3 border-t border-slate-700">
                                    <Button onClick={generateDemoFraud} className="w-full" variant="neon">
                                        Generate {FRAUD_TYPES.find(t => t.value === selectedFraudType)?.label} Demo
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>

                    <Button variant="outline" className="gap-2">
                        <Upload className="w-4 h-4" />
                        Import CSV
                    </Button>

                    {transactions.length > 0 && (
                        <Button variant="ghost" className="gap-2 text-red-400" onClick={clearAll}>
                            <Trash2 className="w-4 h-4" />
                            Clear All
                        </Button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-12 gap-6">
                {/* Input Form */}
                <div className="col-span-12 lg:col-span-5">
                    <Card className="border-slate-800 bg-slate-950/50">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <PlusCircle className="w-5 h-5 text-cyan-400" />
                                Add Transaction
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs text-slate-400 mb-1 block">From Account *</label>
                                    <input
                                        type="text"
                                        name="from_account"
                                        value={formData.from_account}
                                        onChange={handleInputChange}
                                        placeholder="ACC_001"
                                        className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-cyan-500"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-400 mb-1 block">To Account *</label>
                                    <input
                                        type="text"
                                        name="to_account"
                                        value={formData.to_account}
                                        onChange={handleInputChange}
                                        placeholder="ACC_002"
                                        className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-cyan-500"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs text-slate-400 mb-1 block">Amount ($) *</label>
                                    <input
                                        type="number"
                                        name="amount"
                                        value={formData.amount}
                                        onChange={handleInputChange}
                                        placeholder="1000.00"
                                        className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-cyan-500"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-400 mb-1 block">IP Address</label>
                                    <input
                                        type="text"
                                        name="ip_address"
                                        value={formData.ip_address}
                                        onChange={handleInputChange}
                                        placeholder="192.168.1.1"
                                        className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-cyan-500"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs text-slate-400 mb-1 block">Location</label>
                                    <input
                                        type="text"
                                        name="location"
                                        value={formData.location}
                                        onChange={handleInputChange}
                                        placeholder="Mumbai, IN"
                                        className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-cyan-500"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-400 mb-1 block">Timestamp</label>
                                    <input
                                        type="datetime-local"
                                        name="timestamp"
                                        value={formData.timestamp}
                                        onChange={handleInputChange}
                                        className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-cyan-500"
                                    />
                                </div>
                            </div>

                            <Button onClick={addTransaction} className="w-full" variant="neon">
                                <PlusCircle className="w-4 h-4 mr-2" />
                                Add Transaction
                            </Button>
                        </CardContent>
                    </Card>
                </div>

                {/* Transaction List */}
                <div className="col-span-12 lg:col-span-7">
                    <Card className="border-slate-800 bg-slate-950/50 h-full">
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>Pending Transactions ({transactions.length})</CardTitle>
                            <Button
                                onClick={analyzeTransactions}
                                disabled={isProcessing || transactions.length === 0}
                                variant="neon"
                                className="gap-2"
                            >
                                <Send className="w-4 h-4" />
                                {isProcessing ? 'Analyzing...' : 'Analyze for Fraud'}
                            </Button>
                        </CardHeader>
                        <CardContent>
                            {transactions.length === 0 ? (
                                <div className="text-center py-12 text-slate-500">
                                    <AlertTriangle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                    <p>No transactions added yet.</p>
                                    <p className="text-sm mt-2">Use the form or click <strong>"Create Demo Fraud"</strong> to get started.</p>
                                </div>
                            ) : (
                                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                                    {transactions.map((tx) => (
                                        <div
                                            key={tx.id}
                                            className="bg-slate-900/50 border border-slate-800 rounded-lg p-4 flex items-center justify-between group hover:border-slate-700"
                                        >
                                            <div className="flex-1">
                                                <div className="flex items-center gap-4 mb-2 flex-wrap">
                                                    <span className="text-cyan-400 font-mono text-sm">{tx.from_account}</span>
                                                    <span className="text-slate-500">→</span>
                                                    <span className="text-purple-400 font-mono text-sm">{tx.to_account}</span>
                                                    <span className={`font-bold ${tx.amount > 5000 ? 'text-red-400' : 'text-emerald-400'}`}>
                                                        ${tx.amount.toLocaleString()}
                                                    </span>
                                                    {tx.fraud_type && (
                                                        <span className="text-[10px] px-2 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30">
                                                            {tx.fraud_type}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex gap-4 text-xs text-slate-500 flex-wrap">
                                                    <span>IP: {tx.ip_address}</span>
                                                    <span>Location: {tx.location}</span>
                                                    <span>{new Date(tx.timestamp).toLocaleString()}</span>
                                                </div>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => removeTransaction(tx.id)}
                                                className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Analysis Result */}
            {analysisResult && (
                <Card className="border-slate-800 bg-slate-950/50">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-yellow-400" />
                            Analysis Results
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div
                            className="bg-slate-900/50 border border-slate-800 rounded-lg p-4 text-slate-300 whitespace-pre-wrap"
                            dangerouslySetInnerHTML={{
                                __html: analysisResult
                                    .replace(/\*\*(.*?)\*\*/g, '<strong class="text-cyan-400">$1</strong>')
                                    .replace(/\n/g, '<br/>')
                            }}
                        />
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
