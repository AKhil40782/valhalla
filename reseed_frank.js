
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://lskduvcaahmhydaqvnjq.supabase.co';
const supabaseKey = 'sb_publishable_YFO_w48vUCJ1XoYJO_6z-w_wyvhgXhi';

const supabase = createClient(supabaseUrl, supabaseKey);

async function seedFrank() {
    const frankId = 'a0000000-0000-0000-0000-000000000006';

    console.log("🚀 Re-seeding Frank User 6...");

    // 1. Create Profile
    const { data: pData, error: pError } = await supabase
        .from('profiles')
        .insert({
            id: frankId,
            email: 'frank@demo.com',
            full_name: 'Frank User 6',
            role: 'user'
        })
        .select();

    if (pError) console.error("Profile Insert Error:", pError.message);
    else console.log("Profile Inserted:", pData);

    // 2. Create Account
    const { data: aData, error: aError } = await supabase
        .from('accounts')
        .insert({
            user_id: frankId,
            account_number: 'SAL_FRANK',
            balance: 100000.00
        })
        .select();

    if (aError) console.error("Account Insert Error:", aError.message);
    else console.log("Account Inserted:", aData);

    // 3. Create Transaction
    if (aData && aData[0]) {
        const { error: tError } = await supabase
            .from('transactions')
            .insert({
                from_account_id: aData[0].id,
                to_account_number: 'HACKER_X',
                amount: 5500.00,
                ip_address: '44.55.66.77',
                device_id: 'dev_frank_001',
                device_name: 'Frank Alpha Device',
                location: 'Berlin, DE'
            });

        if (tError) console.error("Transaction Insert Error:", tError.message);
        else console.log("Transaction Inserted");
    }
}

seedFrank();
