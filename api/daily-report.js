import {
  buildFinancialStats,
  cairoDayRange,
  fetchReportData,
  fetchStoreSettings,
  getSupabase,
  money,
  productSalesStats,
  sendTelegramText,
} from './_report-utils.js';

export function buildDailyMessage(settings, range, data) {
  const stats = buildFinancialStats(data);
  const currency = settings.currency;
  const netCash = stats.totalRevenue - stats.totalExpense;
  const topProducts = productSalesStats(stats.salesOrders)
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);

  const lines = [
    `تقرير نهاية اليوم - ${settings.name}`,
    `الفترة: ${range.label}`,
    '',
    'ملخص مالي:',
    `إجمالي الإيرادات: ${money(stats.totalRevenue, currency)}`,
    `- مبيعات مدفوعة: ${money(stats.salesRevenue, currency)}`,
    `- تحصيلات عملاء: ${money(stats.customerPayments, currency)}`,
    `- إيرادات أخرى: ${money(stats.manualRevenue, currency)}`,
    '',
    `إجمالي المصروفات والمدفوعات: ${money(stats.totalExpense, currency)}`,
    `- مصروفات مباشرة: ${money(stats.manualExpenses, currency)}`,
    `- مشتريات وسداد موردين: ${money(stats.purchasePayments, currency)}`,
    `- رواتب/سلف موظفين: ${money(stats.payroll, currency)}`,
    `- مرتجعات عملاء: ${money(stats.customerRefunds, currency)}`,
    '',
    `صافي حركة اليوم: ${money(netCash, currency)}`,
    `ربح الفواتير التقريبي: ${money(stats.invoiceProfit, currency)}`,
    '',
    'حركة الفواتير:',
    `فواتير بيع: ${stats.salesOrders.length}`,
    `تحصيلات عملاء: ${stats.paymentOrders.length}`,
    `فواتير محذوفة: ${stats.deletedOrders.length}`,
    `فواتير شراء/سداد مورد: ${data.purchases.length}`,
    `مصروفات مسجلة: ${data.expenses.filter((expense) => Number(expense.amount || 0) > 0).length}`,
  ];

  if (topProducts.length) {
    lines.push('', 'أكثر المنتجات مبيعًا اليوم:');
    topProducts.forEach((product, index) => {
      lines.push(`${index + 1}. ${product.name} | كمية: ${product.qty} | قيمة: ${money(product.revenue, currency)}`);
    });
  }

  return lines.join('\n');
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const supabase = getSupabase();
    const range = cairoDayRange(new Date());
    const [settings, data] = await Promise.all([
      fetchStoreSettings(supabase),
      fetchReportData(supabase, range.start, range.end),
    ]);
    const result = await sendTelegramText(buildDailyMessage(settings, range, data));
    return res.status(200).json({ ok: true, result });
  } catch (error) {
    return res.status(500).json({ ok: false, error: String(error) });
  }
}
