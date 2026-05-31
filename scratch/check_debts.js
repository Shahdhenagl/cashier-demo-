const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkDebts() {
  const { data: orders, error: oError } = await supabase.from('orders').select('*, customers(*)');
  const { data: customers, error: cError } = await supabase.from('customers').select('*');

  if (oError || cError) {
    console.error(oError || cError);
    return;
  }

  console.log(`Total orders: ${orders.length}`);
  console.log(`Total customers: ${customers.length}`);

  orders.forEach(o => {
    if (o.total > o.paid_amount) {
      console.log(`Order ${o.id} has debt: Total=${o.total}, Paid=${o.paid_amount}, Customer=${o.customers?.name || 'Unknown'}`);
    }
  });

  // Calculate debt per customer like in the UI
  const debts = customers.map(c => {
    const custOrders = orders.filter(o => o.customer_id === c.id);
    const totalDebt = custOrders.reduce((sum, o) => sum + (o.total - (o.paid_amount || 0)), 0);
    return { name: c.name, totalDebt };
  }).filter(d => d.totalDebt > 0);

  console.log("Customers with debt:", debts);
}

checkDebts();
