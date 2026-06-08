export function allocatePayment(paymentOrder: any, allOrders: any[]) {
  if (paymentOrder.type !== 'payment') return { toSales: 0, toOldDebt: 0 };
  
  const customerId = paymentOrder.customer?.id;
  if (!customerId) return { toSales: paymentOrder.paid_amount, toOldDebt: 0 };

  // Sort all orders for this customer chronologically
  const customerOrders = allOrders
    .filter(o => !o.is_deleted && o.customer?.id === customerId)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  let totalSalesDebt = 0;
  let totalPriorPayments = 0;

  for (const o of customerOrders) {
    if (o.id === paymentOrder.id) break; // Stop when we reach THIS payment
    
    if (o.type === 'sale') {
      totalSalesDebt += (o.total - o.paid_amount);
    } else if (o.type === 'payment') {
      totalPriorPayments += o.paid_amount;
    }
  }

  const effectiveSalesDebtRemaining = Math.max(0, totalSalesDebt - totalPriorPayments);
  
  const toSales = Math.min(paymentOrder.paid_amount, effectiveSalesDebtRemaining);
  const toOldDebt = Math.max(0, paymentOrder.paid_amount - toSales);

  return { toSales, toOldDebt };
}
