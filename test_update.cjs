const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || 'https://your-project-ref.supabase.co';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'your-supabase-anon-key';

const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
);

async function testUpdate() {
  const { data: existing, error: selectError } = await supabase.from('store_settings').select('id').limit(1).maybeSingle();
  console.log("Existing:", existing, "Select Error:", selectError);

  if (existing?.id) {
    const { data, error } = await supabase.from('store_settings').update({ theme_color: '#e54048' }).eq('id', existing.id).select();
    console.log("Update Data:", data, "Update Error:", error);
  }
}

testUpdate();
