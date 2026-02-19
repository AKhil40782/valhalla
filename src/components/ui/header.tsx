'use client';

import { Bell, Search, Menu, X, LayoutDashboard, Share2, Network, FileText, Settings, ShieldAlert, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { TestEmailButton } from './test-email-button';
import { TestWhatsappButton } from './test-whatsapp-button';

export function Header() {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const pathname = usePathname();

    const routes = [
        { name: 'Dashboard', path: '/', icon: LayoutDashboard },
        { name: 'Input Data', path: '/input', icon: Database },
        { name: 'Network Graph', path: '/network', icon: Share2 },
        { name: 'Reports', path: '/reports', icon: FileText },
        { name: 'Investigation', path: '/investigate', icon: Search },
    ];

    return (
        <header className="h-16 border-b border-slate-800 bg-slate-950/80 backdrop-blur-xl flex items-center justify-between px-6 sticky top-0 z-40 w-full">
            <div className="flex items-center gap-4 text-slate-400 text-sm">
                <Button variant="ghost" size="icon" className="md:hidden text-slate-400" onClick={() => setIsMobileMenuOpen(true)}>
                    <Menu className="w-6 h-6" />
                </Button>
                <div className="hidden sm:flex items-center gap-4">
                    <span className="bg-emerald-500/10 text-emerald-500 px-2 py-1 rounded text-xs border border-emerald-500/20">
                        Live Monitoring
                    </span>
                    <span>Last updated: just now</span>
                </div>
            </div>

            <div className="flex items-center gap-4">
                <div className="relative hidden md:block">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                        type="text"
                        placeholder="Search Entity ID, IP, or Hash..."
                        className="bg-slate-900 border border-slate-700 rounded-full py-1.5 pl-9 pr-4 text-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all w-64 text-slate-200"
                    />
                </div>

                <TestWhatsappButton />
                <TestEmailButton />

                <Button variant="ghost" size="icon" className="relative text-slate-400 hover:text-slate-100">
                    <Bell className="w-5 h-5" />
                    <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                </Button>

                <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-600 border border-slate-700 flex items-center justify-center text-white font-bold text-xs">
                    A
                </div>
            </div>

            {/* Mobile Sidebar Overlay */}
            {isMobileMenuOpen && (
                <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-sm md:hidden animate-in fade-in slide-in-from-left-10">
                    <div className="p-6 h-full flex flex-col">
                        <div className="flex items-center justify-between mb-8">
                            <div className="flex items-center gap-3 text-cyan-400">
                                <ShieldAlert className="w-8 h-8" />
                                <span className="font-bold text-lg tracking-wider">SALAAR<br />BANK</span>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(false)}>
                                <X className="w-6 h-6 text-slate-400" />
                            </Button>
                        </div>

                        <div className="space-y-2 flex-1">
                            {routes.map((route) => {
                                const Icon = route.icon;
                                const isActive = pathname === route.path;
                                return (
                                    <Link key={route.path} href={route.path} onClick={() => setIsMobileMenuOpen(false)}>
                                        <Button
                                            variant={isActive ? 'neon' : 'ghost'} // Assuming 'neon' variant exists in Button
                                            className={cn(
                                                "w-full justify-start gap-3 mb-1 font-medium",
                                                isActive ? "bg-cyan-950/30 text-cyan-400" : "text-slate-400 hover:text-slate-100"
                                            )}
                                        >
                                            <Icon className="w-5 h-5" />
                                            {route.name}
                                        </Button>
                                    </Link>
                                );
                            })}
                        </div>

                        <div className="mt-auto py-6 border-t border-slate-800">
                            <Button variant="ghost" className="w-full justify-start gap-3 text-slate-400 hover:text-slate-100">
                                <Settings className="w-5 h-5" />
                                Settings
                            </Button>
                            <div className="mt-4 pt-4 border-t border-slate-800 text-xs text-slate-500 text-center">
                                <p>System Status: <span className="text-emerald-500">Online</span></p>
                                <p className="mt-1">v2.4.0-beta</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </header>
    );
}
