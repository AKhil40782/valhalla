const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    'https://lskduvcaahmhydaqvnjq.supabase.co',
    'sb_publishable_YFO_w48vUCJ1XoYJO_6z-w_wyvhgXhi'
);

async function run() {
    // Test 1: Insert into tor_exit_nodes
    const { error: e1 } = await supabase.from('tor_exit_nodes').upsert({
        ip_address: '1.2.3.4',
        last_seen: new Date().toISOString(),
        source: 'test'
    }, { onConflict: 'ip_address' });

    if (e1) {
        console.log('tor_exit_nodes table does NOT exist yet. Error:', e1.message);
        console.log('');
        console.log('>>> Please run the migration SQL in Supabase SQL Editor:');
        console.log('>>> File: supabase/anonymity_migration.sql');
    } else {
        console.log('✅ tor_exit_nodes table exists');
        // Cleanup test row
        await supabase.from('tor_exit_nodes').delete().eq('ip_address', '1.2.3.4');
    }

    // Test 2: Check anonymous_access_logs
    const { error: e2 } = await supabase.from('anonymous_access_logs').select('id').limit(1);
    if (e2) {
        console.log('❌ anonymous_access_logs table does NOT exist. Error:', e2.message);
    } else {
        console.log('✅ anonymous_access_logs table exists');
    }
}

run();
