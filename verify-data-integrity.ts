
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// Load env vars
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase URL or Key');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
    console.log('Fetching accounts and profiles...');
    const { data: accounts, error: err1 } = await supabase.from('accounts').select('*');
    const { data: profiles, error: err2 } = await supabase.from('profiles').select('*');

    if (err1 || err2) {
        console.error('Error fetching data:', err1, err2);
        return;
    }

    console.log(`Fetched ${accounts?.length} accounts and ${profiles?.length} profiles.`);

    const profileIds = new Set(profiles?.map((p: any) => p.id));

    let missingProfiles = 0;
    if (accounts) {
        accounts.forEach((acc: any) => {
            if (!profileIds.has(acc.user_id)) {
                console.log(`Account ${acc.account_number} (ID: ${acc.id}) has user_id ${acc.user_id} which is NOT in profiles.`);
                missingProfiles++;
            }
        });
    }

    if (missingProfiles === 0) {
        console.log('All accounts have valid linked profiles.');
    } else {
        console.log(`Found ${missingProfiles} accounts with missing profiles.`);
    }
}

checkData();
