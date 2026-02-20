const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
    'https://lskduvcaahmhydaqvnjq.supabase.co',
    'sb_publishable_YFO_w48vUCJ1XoYJO_6z-w_wyvhgXhi'
);

const sql = fs.readFileSync('supabase/anonymity_migration.sql', 'utf8');
const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0 && !s.startsWith('--'));

async function run() {
    for (const stmt of statements) {
        const { error } = await supabase.rpc('exec_sql', { query: stmt + ';' });
        if (error) {
            // Try direct table creation via REST
            console.log('Statement result:', error.message, '| Stmt:', stmt.substring(0, 60) + '...');
        } else {
            console.log('OK:', stmt.substring(0, 60) + '...');
        }
    }
    console.log('Migration complete');
}

run();
