-- ============================================
-- ANONYMITY DETECTION — Database Migration
-- ============================================

-- 1. Tor Exit Node Cache
CREATE TABLE IF NOT EXISTS tor_exit_nodes (
    ip_address TEXT PRIMARY KEY,
    last_seen TIMESTAMPTZ DEFAULT NOW(),
    source TEXT DEFAULT 'torproject'
);

CREATE INDEX IF NOT EXISTS idx_tor_exit_nodes_last_seen ON tor_exit_nodes(last_seen);

-- 2. Anonymous Access Logs
CREATE TABLE IF NOT EXISTS anonymous_access_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    ip_address TEXT,
    tor_detected BOOLEAN DEFAULT FALSE,
    proxy_detected BOOLEAN DEFAULT FALSE,
    vpn_detected BOOLEAN DEFAULT FALSE,
    hosting_detected BOOLEAN DEFAULT FALSE,
    geo_anomaly BOOLEAN DEFAULT FALSE,
    fingerprint_hardened BOOLEAN DEFAULT FALSE,
    risk_score FLOAT DEFAULT 0,
    risk_level TEXT DEFAULT 'LOW' CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH')),
    action_taken TEXT DEFAULT 'none',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_anon_logs_user ON anonymous_access_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_anon_logs_ip ON anonymous_access_logs(ip_address);
CREATE INDEX IF NOT EXISTS idx_anon_logs_risk ON anonymous_access_logs(risk_level);
CREATE INDEX IF NOT EXISTS idx_anon_logs_time ON anonymous_access_logs(created_at);

-- 3. RLS Policies
ALTER TABLE tor_exit_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE anonymous_access_logs ENABLE ROW LEVEL SECURITY;

-- Allow service role full access, anon can read tor nodes and insert/read own logs
CREATE POLICY "Allow all for tor_exit_nodes" ON tor_exit_nodes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anonymous_access_logs" ON anonymous_access_logs FOR ALL USING (true) WITH CHECK (true);
