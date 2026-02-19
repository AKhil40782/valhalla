'use client';

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export function AdminGuard({ children }: { children: React.ReactNode }) {
    const { user, role, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading) {
            if (!user) {
                router.push('/login');
            } else if (role !== 'admin') {
                router.push('/user/dashboard');
            }
        }
    }, [user, role, loading, router]);

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-cyan-400 border-t-transparent"></div>
                    <span className="text-slate-400 text-sm">Verifying access...</span>
                </div>
            </div>
        );
    }

    if (!user || role !== 'admin') {
        return null; // Will redirect via useEffect
    }

    return <>{children}</>;
}
