const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkDebts() {
  try {
    const { data: orders, error: oError } = await supabase.from('orders').select('*, customers(*)');
    const { data: customers, error: cError } = await supabase.from('customers').select('*');

    if (oError) throw oError;
    if (cError) throw cError;

    console.log(`Total orders: ${orders.length}`);
    console.log(`Total customers: ${customers.length}`);

    let debtFound = false;
    orders.forEach(o => {
      if (o.total > o.paid_amount) {
        console.log(`Order ${o.id} has debt: Total=${o.total}, Paid=${o.paid_amount}, Customer=${o.customers?.name || 'Unknown'}`);
        debtFound = true;
      }
    });

    if (!debtFound) console.log("No orders with debt found.");

    const debts = customers.map(c => {
      const custOrders = orders.filter(o => o.customer_id === c.id);
      const totalDebt = custOrders.reduce((sum, o) => sum + (o.total - (o.paid_amount || 0)), 0);
      return { name: c.name, totalDebt };
    }).filter(d => d.totalDebt > 0);

    console.log("Customers with debt:", debts);
  } catch (err) {
    console.error("Error:", err);
  }
}

checkDebts();
