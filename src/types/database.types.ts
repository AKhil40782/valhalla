export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  role: 'user' | 'investigator' | 'hacker' | 'admin' | string;
  created_at: string;
  phone?: string | null;
  avatar_url?: string | null;
  updated_at?: string | null;
}

export interface Account {
  id: string;
  user_id: string;
  account_number: string;
  balance: number;
  is_frozen: boolean;
  risk_score: number;
  created_at: string;
  branch_code?: string | null;
  branch_name?: string | null;
  account_type?: string | null;
  kyc_verified?: boolean | null;
  updated_at?: string | null;
  owner_name?: string | null;
}

export interface Transaction {
  id: string;
  from_account_id: string | null;
  to_account_id?: string | null;
  to_account_number?: string | null;
  amount: number;
  status: string;
  currency?: string | null;
  ip_address?: string | null;
  subnet_mask?: string | null;
  device_id?: string | null;
  device_name?: string | null;
  imei?: string | null;
  location?: string | null;
  location_lat?: number | null;
  location_lng?: number | null;
  location_city?: string | null;
  location_country?: string | null;
  timestamp: string;
  branch_code?: string | null;
  transaction_type?: string | null;
  channel?: string | null;
  session_id?: string | null;
  is_flagged?: boolean | null;
  merchant_category?: string | null;
}

export interface FraudAlert {
  id: string;
  account_id?: string | null;
  transaction_id?: string | null;
  risk_score?: number | null;
  risk_level?: string | null;
  alert_type?: string | null;
  detect_reason?: string | null;
  status: string;
  feedback_status?: string | null;
  cluster_id?: string | null;
  linked_accounts?: string[] | null;
  assigned_to?: string | null;
  created_at: string;
  resolved_at?: string | null;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  resource_id?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  timestamp: string;
}

export interface InvestigationCase {
  id: string;
  case_number?: string | null;
  title?: string | null;
  summary?: string | null;
  evidence_links?: string[] | null;
  accounts_involved?: string[] | null;
  status?: string | null;
  risk_score?: number | null;
  sar_filed?: boolean | null;
  sar_reference?: string | null;
  assigned_investigator?: string | null;
  created_at: string;
  updated_at: string;
  closed_at?: string | null;
}

export interface AccountLink {
  id: string;
  account_a_id: string | null;
  account_b_id: string | null;
  link_type: string;
  strength: number;
  first_detected: string;
  last_seen: string;
  occurrence_count: number;
  metadata?: any | null;
}

export interface Session {
  id: string;
  account_id: string | null;
  session_id: string;
  ip_address?: string | null;
  device_id?: string | null;
  location_city?: string | null;
  location_country?: string | null;
  started_at: string;
  ended_at?: string | null;
  transaction_count: number;
  is_suspicious: boolean;
}

export interface RiskVector {
  id: number;
  content?: string | null;
  metadata?: any | null;
  embedding?: any | null;
}

export interface TorExitNode {
  ip_address: string;
  last_seen: string;
  source?: string | null;
}

export interface AnonymousAccessLog {
  id: string;
  user_id: string | null;
  ip_address?: string | null;
  tor_detected: boolean;
  proxy_detected: boolean;
  vpn_detected: boolean;
  hosting_detected: boolean;
  geo_anomaly: boolean;
  fingerprint_hardened: boolean;
  risk_score: number;
  risk_level: string;
  action_taken: string;
  metadata?: any | null;
  created_at: string;
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Partial<Profile>;
        Update: Partial<Profile>;
      };
      accounts: {
        Row: Account;
        Insert: Partial<Account>;
        Update: Partial<Account>;
      };
      transactions: {
        Row: Transaction;
        Insert: Partial<Transaction>;
        Update: Partial<Transaction>;
      };
      fraud_alerts: {
        Row: FraudAlert;
        Insert: Partial<FraudAlert>;
        Update: Partial<FraudAlert>;
      };
      audit_logs: {
        Row: AuditLog;
        Insert: Partial<AuditLog>;
        Update: Partial<AuditLog>;
      };
      investigation_cases: {
        Row: InvestigationCase;
        Insert: Partial<InvestigationCase>;
        Update: Partial<InvestigationCase>;
      };
      account_links: {
        Row: AccountLink;
        Insert: Partial<AccountLink>;
        Update: Partial<AccountLink>;
      };
      sessions: {
        Row: Session;
        Insert: Partial<Session>;
        Update: Partial<Session>;
      };
      risk_vectors: {
        Row: RiskVector;
        Insert: Partial<RiskVector>;
        Update: Partial<RiskVector>;
      };
      tor_exit_nodes: {
        Row: TorExitNode;
        Insert: Partial<TorExitNode>;
        Update: Partial<TorExitNode>;
      };
      anonymous_access_logs: {
        Row: AnonymousAccessLog;
        Insert: Partial<AnonymousAccessLog>;
        Update: Partial<AnonymousAccessLog>;
      };
    };
  };
}
