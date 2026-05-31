const supabaseUrl = process.env.SUPABASE_URL || 'https://your-project-ref.supabase.co';
const key = process.env.SUPABASE_ANON_KEY || 'your-supabase-anon-key';
const url = `${supabaseUrl}/rest/v1/orders?select=id,total,order_items(quantity,returned_quantity,sale_price,products(name,purchase_price))`;

fetch(url, {
  headers: {
    'apikey': key,
    'Authorization': `Bearer ${key}`
  }
})
.then(r => r.json())
.then(data => console.log(JSON.stringify(data, null, 2)))
.catch(e => console.error(e));
