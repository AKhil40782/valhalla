
import { v4 as uuidv4 } from 'uuid';

export interface Account {
    id: string;
    owner_name: string;
    account_number: string;
    risk_score: number;
    balance: number;
}

export interface Transaction {
    id: string;
    from_account_id: string;
    to_account_id: string;
    amount: number;
    timestamp: string;
    device_id: string;
    ip_address: string;
    location: string;
    type: 'deposit' | 'transfer' | 'withdrawal';
}

const FIRST_NAMES = ['John', 'Salaar', 'Rocky', 'Adheera', 'Garuda', 'Reena', 'Deepa', 'Vikram'];
const LAST_NAMES = ['Doe', 'Khan', 'Bhai', 'Reddy', 'Roy', 'Sen', 'Das', 'Singh'];

export function generateAccount(): Account {
    return {
        id: uuidv4(),
        owner_name: `${FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)]} ${LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)]}`,
        account_number: `ACC_${Math.floor(Math.random() * 1000000000)}`,
        risk_score: Math.floor(Math.random() * 100),
        balance: Math.floor(Math.random() * 50000) + 1000,
    };
}

export function generateTransaction(from: Account, to: Account): Transaction {
    const isFraud = Math.random() > 0.9;

    // Simulate reuse of devices for fraud
    const deviceId = isFraud ? "dev_cloned_001" : `dev_${uuidv4().substring(0, 8)}`;
    const ipAddress = isFraud ? "192.168.1.55" : `10.0.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;

    return {
        id: uuidv4(),
        from_account_id: from.id,
        to_account_id: to.id,
        amount: isFraud ? Math.floor(Math.random() * 9000) + 1000 : Math.floor(Math.random() * 500),
        timestamp: new Date().toISOString(),
        device_id: deviceId,
        ip_address: ipAddress,
        location: isFraud ? "Unknown/Proxy" : "Mumbai, IN",
        type: 'transfer'
    };
}

// Generate the initial Salaar Bank state
export const DEMO_ACCOUNTS = Array.from({ length: 15 }, generateAccount);
export const DEMO_TRANSACTIONS = []; 
