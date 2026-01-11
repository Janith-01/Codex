// Quick Supabase connection test
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

console.log('\n🔍 Testing Supabase Connection...\n');
console.log('URL:', supabaseUrl);
console.log('Key:', supabaseKey ? '✓ Present' : '✗ Missing');

if (!supabaseUrl || !supabaseKey) {
    console.error('\n❌ Missing environment variables!\n');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
    try {
        // Try to query the documents table
        const { data, error } = await supabase
            .from('documents')
            .select('*')
            .limit(1);

        if (error) {
            console.error('\n❌ Database Error:', error.message);
            if (error.message.includes('relation') && error.message.includes('does not exist')) {
                console.log('\n💡 The "documents" table does not exist yet.');
                console.log('   Please run the SQL script in your Supabase dashboard:\n');
                console.log('   1. Go to https://supabase.com/dashboard');
                console.log('   2. Select your project');
                console.log('   3. Go to SQL Editor');
                console.log('   4. Run the CREATE TABLE script from DATABASE_SETUP.md\n');
            }
            process.exit(1);
        }

        console.log('\n✅ Connection successful!');
        console.log('📊 Documents in database:', data.length);
        console.log('\n🎉 Your Codex Editor is ready to use!');
        console.log('   Start the app: npm start');
        console.log('   Open: http://localhost:3000\n');

    } catch (err) {
        console.error('\n❌ Unexpected Error:', err.message);
        process.exit(1);
    }
}

testConnection();
