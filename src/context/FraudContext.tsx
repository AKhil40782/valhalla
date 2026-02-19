'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { getRealFraudData } from '@/app/actions';

interface FraudData {
    graphElements: any[];
    timelineEvents: any[];
    alerts: any[];
    stats: any;
    hackerInfo?: any;
    fraudClusters?: any[];
}

interface FraudContextType {
    data: FraudData | null;
    loading: boolean;
    error: any;
    refresh: () => Promise<void>;
}

const FraudContext = createContext<FraudContextType>({
    data: null,
    loading: false,
    error: null,
    refresh: async () => { },
});

export const useFraudData = () => useContext(FraudContext);

export const FraudProvider = ({ children }: { children: React.ReactNode }) => {
    const [data, setData] = useState<FraudData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<any>(null);

    const fetchData = async () => {
        try {
            setLoading(true);
            const res = await getRealFraudData();
            setData(res);
        } catch (err) {
            console.error("Failed to fetch fraud data in background", err);
            setError(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // Fetch immediately on mount (background load)
        fetchData();
    }, []);

    return (
        <FraudContext.Provider value={{ data, loading, error, refresh: fetchData }}>
            {children}
        </FraudContext.Provider>
    );
};
