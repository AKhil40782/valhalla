'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ShieldAlert, LayoutDashboard, Share2, FileText, Search, Settings, Database, Users, Map, LogOut, Brain } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const routes = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Transactions', path: '/transactions', icon: FileText },
    { name: 'Network Graph', path: '/network', icon: Share2 },
    { name: 'Live Map', path: '/map', icon: Map },
    { name: 'Reports', path: '/reports', icon: FileText },
    { name: 'Investigation', path: '/investigate', icon: Search },
    { name: 'User Intelligence', path: '/user-intelligence', icon: Brain },
    { name: 'Simulator', path: '/attack-simulator', icon: Database },
    { name: 'Accounts', path: '/admin/accounts', icon: Users },
];

export function Sidebar() {
    const pathname = usePathname();
    const router = useRouter();

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/login');
    };

    return (
        <div className="h-screen w-64 border-r border-slate-800 bg-slate-950/80 backdrop-blur-xl flex flex-col fixed left-0 top-0 z-50">
            <div className="p-6">
                <div className="flex items-center gap-3 text-cyan-400 mb-8">
                    <ShieldAlert className="w-8 h-8" />
                    <span className="font-bold text-lg tracking-wider">SALAAR<br />BANK</span>
                </div>

                <div className="space-y-2">
                    {routes.map((route) => {
                        const Icon = route.icon;
                        const isActive = pathname === route.path;

                        return (
                            <Link key={route.path} href={route.path}>
                                <Button
                                    variant={isActive ? 'neon' : 'ghost'}
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
            </div>

            <div className="mt-auto p-6 border-t border-slate-800">
                <Button variant="ghost" className="w-full justify-start gap-3 text-slate-400 hover:text-slate-100">
                    <Settings className="w-5 h-5" />
                    Settings
                </Button>
                <Button
                    variant="ghost"
                    onClick={handleLogout}
                    className="w-full justify-start gap-3 text-red-400 hover:text-red-300 hover:bg-red-950/20 mt-1"
                >
                    <LogOut className="w-5 h-5" />
                    Logout
                </Button>
                <div className="mt-4 pt-4 border-t border-slate-800 text-xs text-slate-500 text-center">
                    <p>System Status: <span className="text-emerald-500">Online</span></p>
                    <p className="mt-1">v2.4.0-beta</p>
                </div>
            </div>
        </div>
    );
}
