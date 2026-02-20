'use server';

// ============================================
// IP INTELLIGENCE SERVICE
// ============================================
// Detects proxies, VPNs, hosting providers, and geo-location anomalies.

import { supabase } from '@/lib/supabase';

export interface IPIntelligenceResult {
    isProxy: boolean;
    isVPN: boolean;
    isHosting: boolean;
    isp: string;
    org: string;
    country: string;
    countryCode: string;
    city: string;
    lat: number;
    lon: number;
    asn: string;
    threat: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH';
    details: string[];
}

// Known hosting/datacenter ISP keywords
const HOSTING_KEYWORDS = [
    'amazon', 'aws', 'google cloud', 'microsoft azure', 'digitalocean',
    'linode', 'vultr', 'ovh', 'hetzner', 'cloudflare', 'oracle cloud',
    'hostinger', 'godaddy', 'bluehost', 'contabo', 'kamatera',
    'upcloud', 'rackspace', 'ibm cloud', 'alibaba cloud',
];

// Known VPN provider ISP keywords
const VPN_KEYWORDS = [
    'nordvpn', 'expressvpn', 'surfshark', 'cyberghost', 'proton',
    'private internet access', 'mullvad', 'windscribe', 'tunnelbear',
    'ipvanish', 'hotspot shield', 'hide.me', 'torguard', 'astrill',
];

/**
 * Check IP intelligence using ip-api.com (free, 45 req/min).
 * Returns proxy/VPN/hosting flags, geo data, and threat level.
 */
export async function checkIPIntelligence(ip: string): Promise<IPIntelligenceResult> {
    const defaultResult: IPIntelligenceResult = {
        isProxy: false, isVPN: false, isHosting: false,
        isp: 'unknown', org: 'unknown',
        country: 'unknown', countryCode: '', city: 'unknown',
        lat: 0, lon: 0, asn: '',
        threat: 'NONE', details: [],
    };

    if (!ip || ip === 'unknown' || ip.startsWith('192.168') || ip.startsWith('10.') || ip.startsWith('127.')) {
        return { ...defaultResult, details: ['Private/local IP'] };
    }

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2500);

        // ip-api.com with proxy and hosting fields
        const response = await fetch(
            `http://ip-api.com/json/${ip}?fields=status,message,country,countryCode,city,lat,lon,isp,org,as,proxy,hosting`,
            { signal: controller.signal }
        );
        clearTimeout(timeout);

        const data = await response.json();

        if (data.status !== 'success') {
            return { ...defaultResult, details: [`API error: ${data.message}`] };
        }

        const ispLower = (data.isp || '').toLowerCase();
        const orgLower = (data.org || '').toLowerCase();
        const details: string[] = [];

        // Proxy detection (ip-api native)
        const isProxy = !!data.proxy;
        if (isProxy) details.push(`Proxy detected by IP intelligence`);

        // Hosting/datacenter detection
        let isHosting = !!data.hosting;
        if (!isHosting) {
            isHosting = HOSTING_KEYWORDS.some(kw => ispLower.includes(kw) || orgLower.includes(kw));
        }
        if (isHosting) details.push(`Hosting/datacenter: ${data.isp}`);

        // VPN detection (heuristic: hosting + not a known datacenter page)
        let isVPN = false;
        if (VPN_KEYWORDS.some(kw => ispLower.includes(kw) || orgLower.includes(kw))) {
            isVPN = true;
            details.push(`Known VPN provider: ${data.isp}`);
        } else if (isHosting && isProxy) {
            isVPN = true;
            details.push(`Likely VPN (hosting + proxy flags)`);
        }

        // Threat assessment
        let threat: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' = 'NONE';
        if (isProxy && isVPN) threat = 'HIGH';
        else if (isVPN || (isProxy && isHosting)) threat = 'MEDIUM';
        else if (isProxy || isHosting) threat = 'LOW';

        return {
            isProxy, isVPN, isHosting,
            isp: data.isp || 'unknown',
            org: data.org || 'unknown',
            country: data.country || 'unknown',
            countryCode: data.countryCode || '',
            city: data.city || 'unknown',
            lat: data.lat || 0,
            lon: data.lon || 0,
            asn: data.as || '',
            threat, details,
        };
    } catch (err) {
        return { ...defaultResult, details: ['IP intelligence check timed out'] };
    }
}

/**
 * Check for geo-location anomalies (impossible travel).
 * Compares current login location with the most recent login.
 */
export async function checkGeoAnomaly(
    userId: string,
    currentCountry: string,
    currentLat: number,
    currentLon: number
): Promise<{
    geoAnomaly: boolean;
    distanceKm: number;
    timeDiffMinutes: number;
    previousCountry: string | null;
    details: string;
}> {
    // Get the most recent access log for this user
    const { data: lastLog } = await supabase
        .from('anonymous_access_logs')
        .select('metadata, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (!lastLog || !lastLog.metadata) {
        return {
            geoAnomaly: false,
            distanceKm: 0,
            timeDiffMinutes: 0,
            previousCountry: null,
            details: 'First login — no history to compare',
        };
    }

    const meta = lastLog.metadata as any;
    const prevLat = meta.lat || 0;
    const prevLon = meta.lon || 0;
    const prevCountry = meta.country || 'unknown';
    const prevTime = new Date(lastLog.created_at).getTime();
    const now = Date.now();
    const timeDiffMinutes = (now - prevTime) / (1000 * 60);

    // Haversine distance
    const distanceKm = haversine(prevLat, prevLon, currentLat, currentLon);

    // Impossible travel: >500km in <60 minutes (would need >500 km/h)
    const speedKmH = timeDiffMinutes > 0 ? (distanceKm / timeDiffMinutes) * 60 : 0;
    const geoAnomaly = distanceKm > 500 && speedKmH > 500;

    let details = `Distance: ${Math.round(distanceKm)}km in ${Math.round(timeDiffMinutes)}min`;
    if (geoAnomaly) {
        details = `🚨 Impossible travel: ${Math.round(distanceKm)}km in ${Math.round(timeDiffMinutes)}min (${Math.round(speedKmH)} km/h) from ${prevCountry} to ${currentCountry}`;
    } else if (currentCountry !== prevCountry && prevCountry !== 'unknown') {
        details = `Country changed: ${prevCountry} → ${currentCountry} (${Math.round(distanceKm)}km, ${Math.round(timeDiffMinutes)}min ago)`;
    }

    return { geoAnomaly, distanceKm, timeDiffMinutes, previousCountry: prevCountry, details };
}

/**
 * Haversine formula to calculate distance between two points on Earth.
 */
function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}
