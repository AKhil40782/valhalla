'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Play, Pause, SkipBack, SkipForward, Clock } from 'lucide-react';

interface TimelineEvent {
    id: string;
    timestamp: string;
    type: 'transaction' | 'alert' | 'login';
    description: string;
    riskLevel?: 'low' | 'medium' | 'high' | 'critical';
    details?: {
        from: string;
        to: string;
        id: string;
        ip: string;
        subnet: string;
        device: string;
        imei: string;
        location: string;
        time: string;
    };
}

interface TimelineReplayProps {
    events: TimelineEvent[];
    onEventSelect?: (event: TimelineEvent) => void;
}

export function TimelineReplay({ events, onEventSelect }: TimelineReplayProps) {
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [speed, setSpeed] = useState(1);
    const [showFullDetails, setShowFullDetails] = useState(false);

    useEffect(() => {
        if (!isPlaying || events.length === 0) return;

        const interval = setInterval(() => {
            setCurrentIndex(prev => {
                if (prev >= events.length - 1) {
                    setIsPlaying(false);
                    return prev;
                }
                return prev + 1;
            });
        }, 1000 / speed);

        return () => clearInterval(interval);
    }, [isPlaying, speed, events.length]);

    const getRiskColor = (level?: string) => {
        switch (level) {
            case 'critical': return 'bg-red-500';
            case 'high': return 'bg-orange-500';
            case 'medium': return 'bg-yellow-500';
            default: return 'bg-emerald-500';
        }
    };

    const formatTime = (timestamp: string) => {
        return new Date(timestamp).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    };

    const currentEvent = events[currentIndex];

    return (
        <Card className="border-slate-800 bg-slate-950/50">
            <CardHeader className="pb-3 border-b border-slate-800/50 flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                    <Clock className="w-5 h-5 text-cyan-400" />
                    Forensics Timeline
                </CardTitle>
                <div className="flex bg-slate-900 rounded-lg p-1 text-[10px]">
                    <span className="px-2 text-slate-500 uppercase tracking-widest font-bold">Safe-Flow 2.0</span>
                </div>
            </CardHeader>
            <CardContent className="p-4">
                {/* Controls */}
                <div className="flex items-center justify-center gap-2 mb-4">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setCurrentIndex(0)}
                        className="text-slate-400 hover:text-slate-100"
                    >
                        <SkipBack className="w-4 h-4" />
                    </Button>
                    <Button
                        variant="neon"
                        size="icon"
                        onClick={() => setIsPlaying(!isPlaying)}
                        className="w-10 h-10"
                    >
                        {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setCurrentIndex(Math.min(currentIndex + 1, events.length - 1))}
                        className="text-slate-400 hover:text-slate-100"
                    >
                        <SkipForward className="w-4 h-4" />
                    </Button>
                    <select
                        value={speed}
                        onChange={(e) => setSpeed(Number(e.target.value))}
                        className="ml-4 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-300"
                    >
                        <option value={0.5}>0.5x</option>
                        <option value={1}>1x</option>
                        <option value={2}>2x</option>
                        <option value={10}>Sync</option>
                    </select>
                </div>

                {/* Progress Bar */}
                <div className="relative h-2 bg-slate-800 rounded-full mb-4 overflow-hidden">
                    <div
                        className="absolute h-full bg-gradient-to-r from-cyan-500 to-purple-500 transition-all duration-300"
                        style={{ width: `${(currentIndex / Math.max(events.length - 1, 1)) * 100}%` }}
                    />
                    {events.map((event, idx) => (
                        <div
                            key={event.id}
                            className={`absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full cursor-pointer transition-transform hover:scale-150 ${getRiskColor(event.riskLevel)}`}
                            style={{ left: `${(idx / Math.max(events.length - 1, 1)) * 100}%` }}
                            onClick={() => {
                                setCurrentIndex(idx);
                                onEventSelect?.(event);
                            }}
                        />
                    ))}
                </div>

                {/* Current Event Display */}
                {events.length > 0 && currentEvent && (
                    <div
                        className="bg-slate-900/80 border border-slate-700 rounded-lg p-4 cursor-pointer hover:bg-slate-800/80 transition-all"
                        onClick={() => setShowFullDetails(!showFullDetails)}
                    >
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] text-cyan-500 font-mono font-bold tracking-tighter">
                                {formatTime(currentEvent.timestamp)}
                            </span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-sm font-bold border ${currentEvent.riskLevel === 'critical' ? 'border-red-500 text-red-500' : 'border-slate-600 text-slate-400'} bg-black/40`}>
                                {(currentEvent.type || 'EVENT').toUpperCase()}
                            </span>
                        </div>
                        <p className="text-sm font-medium text-slate-200 mb-3">{currentEvent.description}</p>

                        {/* Detail Preview or Full Details */}
                        {showFullDetails && currentEvent.details ? (
                            <div className="mt-4 pt-4 border-t border-slate-800 grid grid-cols-2 gap-y-3 gap-x-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                <div>
                                    <label className="text-[10px] uppercase text-slate-500 block mb-0.5">Sender (User 1)</label>
                                    <div className="text-xs text-slate-300 font-medium">{currentEvent.details.from}</div>
                                </div>
                                <div>
                                    <label className="text-[10px] uppercase text-slate-500 block mb-0.5">Reciever (User 2)</label>
                                    <div className="text-xs text-slate-300 font-medium">{currentEvent.details.to}</div>
                                </div>
                                <div>
                                    <label className="text-[10px] uppercase text-slate-500 block mb-0.5">IP Address</label>
                                    <div className="text-xs text-cyan-400 font-mono">{currentEvent.details.ip}</div>
                                </div>
                                <div>
                                    <label className="text-[10px] uppercase text-slate-500 block mb-0.5">Subnet Mask</label>
                                    <div className="text-xs text-slate-300 font-mono">{currentEvent.details.subnet}</div>
                                </div>
                                <div>
                                    <label className="text-[10px] uppercase text-slate-500 block mb-0.5">ISP / Provider</label>
                                    <div className={`text-xs font-mono ${(currentEvent.details as any).isVpn ? 'text-orange-400' : 'text-slate-300'}`}>{(currentEvent.details as any).isp || 'Unknown'}</div>
                                </div>
                                <div>
                                    <label className="text-[10px] uppercase text-slate-500 block mb-0.5">IP City</label>
                                    <div className="text-xs text-slate-300">{(currentEvent.details as any).ipCity || 'Unknown'}</div>
                                </div>
                                {(currentEvent.details as any).isVpn && (
                                    <div className="col-span-2 bg-orange-950/20 border border-orange-800/50 rounded p-2 text-center">
                                        <span className="text-[10px] text-orange-400 font-bold uppercase">🛡️ VPN / Proxy Detected</span>
                                    </div>
                                )}
                                <div>
                                    <label className="text-[10px] uppercase text-slate-500 block mb-0.5">Platform Detail</label>
                                    <div className="text-xs text-slate-300">{currentEvent.details.device}</div>
                                </div>
                                <div>
                                    <label className="text-[10px] uppercase text-slate-500 block mb-0.5">Hardware ID</label>
                                    <div className="text-xs text-purple-400 font-mono">{currentEvent.details.imei}</div>
                                </div>
                                <div>
                                    <label className="text-[10px] uppercase text-slate-500 block mb-0.5">MAC Address</label>
                                    <div className="text-xs text-emerald-400 font-mono">{(currentEvent.details as any).macAddress || 'N/A'}</div>
                                </div>
                                <div>
                                    <label className="text-[10px] uppercase text-slate-500 block mb-0.5">Location</label>
                                    <div className="text-xs text-slate-300">{currentEvent.details.location}</div>
                                </div>
                                <div>
                                    <label className="text-[10px] uppercase text-slate-500 block mb-0.5">Transaction ID</label>
                                    <div className="text-[9px] text-slate-500 font-mono truncate">{currentEvent.details.id}</div>
                                </div>
                                <div className="col-span-2 text-center mt-2">
                                    <span className="text-[10px] text-slate-600 italic underline">Click to collapse forensics view</span>
                                </div>
                            </div>
                        ) : (
                            <div className="text-[10px] text-slate-500 flex items-center gap-1 justify-center py-1 border border-dashed border-slate-800 rounded">
                                🖱️ Click to view packet forensics (IP, IMEI, Location)
                            </div>
                        )}
                    </div>
                )}

                {events.length === 0 && (
                    <div className="text-center text-slate-500 py-8 border border-dashed border-slate-800 rounded-lg">
                        <div className="text-2xl mb-2">📡</div>
                        <p className="text-xs">Waiting for live data packets...</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
