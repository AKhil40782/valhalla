'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';

export type UserRole = 'admin' | 'user';

interface AuthState {
    user: User | null;
    role: UserRole | null;
    loading: boolean;
}

export function useAuth(): AuthState {
    const [user, setUser] = useState<User | null>(null);
    const [role, setRole] = useState<UserRole | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchAuth = async () => {
            try {
                const { data: { user: authUser } } = await supabase.auth.getUser();

                if (!authUser) {
                    setUser(null);
                    setRole(null);
                    setLoading(false);
                    return;
                }

                setUser(authUser);

                // Fetch role from profiles table
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('role')
                    .eq('id', authUser.id)
                    .single();

                setRole((profile?.role as UserRole) || 'user');
            } catch (err) {
                console.error('Auth fetch error:', err);
                setRole('user'); // Default to user on error
            } finally {
                setLoading(false);
            }
        };

        fetchAuth();

        // Listen for auth state changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (!session?.user) {
                setUser(null);
                setRole(null);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    return { user, role, loading };
}
