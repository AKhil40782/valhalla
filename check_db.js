
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://lskduvcaahmhydaqvnjq.supabase.co';
const supabaseKey = 'sb_publishable_YFO_w48vUCJ1XoYJO_6z-w_wyvhgXhi';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkFrank() {
    const frankId = 'a0000000-0000-0000-0000-000000000006';

    console.log("🔍 Checking Frank's database presence...");

    const { data: profile, error: pError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', frankId)
        .single();

    if (profile) {
        console.log("Profile Keys:", Object.keys(profile));
        console.log("Profile Example:", profile);
    } else {
        console.log("Profile not found for Frank, fetching any profile...");
        const { data: anyProfile } = await supabase.from('profiles').select('*').limit(1).single();
        if (anyProfile) {
            console.log("Any Profile Keys:", Object.keys(anyProfile));
            console.log("Any Profile:", anyProfile);
        }
    }

    const { data: account, error: aError } = await supabase
        .from('accounts')
        .select('*')
        .eq('user_id', frankId)
        .single();

    console.log("Account:", account, aError ? `Error: ${aError.message}` : "Found");

    const { data: allAccounts } = await supabase.from('accounts').select('user_id, account_number');
    console.log("All Accounts:", allAccounts?.map(a => `${a.account_number} (${a.user_id})`));
}

checkFrank();
