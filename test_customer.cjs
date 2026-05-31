const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || 'https://your-project-ref.supabase.co';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'your-supabase-anon-key';

const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
);

async function testCustomer() {
  const { data, error } = await supabase
    .from('customers')
    .insert({ name: 'Test Customer', phone: '0123456789' })
    .select()
    .single();
    
  console.log("Data:", data);
  console.log("Error:", error);
}

testCustomer();
