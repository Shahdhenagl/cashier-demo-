import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Order, StoreSettings } from '../store/useStore';
import { CheckCircle2, Printer, Download, Phone, User, MapPin } from 'lucide-react';
import html2canvas from 'html2canvas';

export default function PublicInvoice() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const settingsRes = await supabase.from('store_settings').select('*').maybeSingle();
        if (settingsRes.data) {
          const s = settingsRes.data;
          setSettings({
            name: s.name,
            currency: s.currency,
            logo: s.logo,
            taxRate: s.tax_rate,
            themeColor: s.theme_color,
            address: s.address,
            phone: s.phone,
            phone2: s.phone2,
            whatsappCountryCode: s.whatsapp_country_code,
            initial_balance: s.initial_balance,
            locationUrl: s.location_url
          });
        }

        // Try Orders first
        const { data: o } = await supabase
          .from('orders')
          .select('*, customers(*), order_items(*, products(*))')
          .eq('id', id)
          .maybeSingle();

        if (o) {
          const itemRows = (o.order_items as any[]) ?? [];
          const items = itemRows.map((i: any) => ({
            id: i.product_id,
            name: i.product_name || i.products?.name || 'منتج غير معروف',
            quantity: i.quantity,
            sale_price: i.sale_price,
            returned_quantity: i.returned_quantity || 0,
          }));

          let debtBefore = 0;
          let debtAfter = 0;
          if (o.customer_id) {
            const { data: allCustOrders } = await supabase
              .from('orders')
              .select('id, total, paid_amount, type, created_at')
              .eq('customer_id', o.customer_id)
              .lte('created_at', o.created_at);
            
            if (allCustOrders) {
              debtBefore = allCustOrders.reduce((sum, ord) => {
                if (ord.id === o.id) return sum;
                if (ord.type === 'payment') return sum - ord.paid_amount;
                if (ord.type === 'return') return sum;
                return sum + (ord.total - ord.paid_amount);
              }, 0);
              debtAfter = o.type === 'payment' ? debtBefore - o.paid_amount : debtBefore + (o.total - o.paid_amount);
            }
          }

          setOrder({
            id: o.id,
            total: o.total,
            paid_amount: o.paid_amount,
            paid_cash: o.paid_cash,
            paid_visa: o.paid_visa,
            paid_wallet: o.paid_wallet,
            paid_instapay: o.paid_instapay,
            type: o.type,
            payment_method: o.payment_method,
            date: o.created_at,
            items,
            cashier_name: o.cashier_name,
            debtBefore,
            debtAfter,
            originType: 'sale',
            customer: o.customers ? { 
              id: o.customers.id, 
              name: o.customers.name, 
              phone: o.customers.phone, 
              custom_id: o.customers.custom_id,
              timestamp: o.customers.created_at 
            } : undefined
          } as any);
          return;
        }

        // Try Purchase Invoices if not found in orders
        const { data: inv } = await supabase
          .from('purchase_invoices')
          .select('*, suppliers(*), purchase_items(*, products(*))')
          .or(`id.eq.${id},invoice_number.eq.${id}`)
          .maybeSingle();

        if (inv) {
          const itemRows = (inv.purchase_items as any[]) ?? [];
          const items = itemRows.map((i: any) => ({
            id: i.product_id,
            name: i.products?.name || 'منتج غير معروف',
            quantity: i.quantity,
            sale_price: i.purchase_price,
            returned_quantity: 0
          }));

          setOrder({
            id: inv.invoice_number || inv.id,
            total: inv.total,
            paid_amount: inv.paid_amount,
            paid_cash: inv.paid_cash,
            paid_visa: inv.paid_visa,
            paid_wallet: inv.paid_wallet,
            paid_instapay: inv.paid_instapay,
            type: inv.total === 0 ? 'payment' : 'sale',
            payment_method: inv.payment_method,
            date: inv.created_at,
            items,
            originType: 'purchase',
            supplier: inv.suppliers ? {
              name: inv.suppliers.name,
              phone: inv.suppliers.phone
            } : undefined
          } as any);
          return;
        }

        throw new Error('Invoice not found');
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    if (id) fetchData();
  }, [id]);

  const downloadAsImage = async () => {
    const element = document.getElementById('invoice-print-area');
    if (!element) return;
    const canvas = await html2canvas(element, { scale: 3, backgroundColor: '#ffffff' });
    const link = document.createElement('a');
    link.download = `invoice-${order?.id}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (error || !order || !settings) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white p-6 text-center">
      <div className="text-red-500 text-6xl mb-4">⚠️</div>
      <h1 className="text-2xl font-black text-slate-800">عذراً، الفاتورة غير موجودة</h1>
      <p className="text-slate-500 mt-2">يرجى التأكد من الرابط الصحيح.</p>
    </div>
  );

  const subtotal = order.items.reduce((sum, item) => sum + (item.quantity * item.sale_price), 0);
  const taxRate = settings.taxRate || 0;
  // If Tax exists: Total = (Subtotal - Discount) * (1 + TaxRate)
  // Discount = Subtotal - (Total / (1 + TaxRate))
  const calculatedDiscount = Math.max(0, subtotal - (order.total / (1 + (taxRate / 100))));
  const taxValue = (subtotal - calculatedDiscount) * (taxRate / 100);
  const isPayment = order.type === 'payment';

  return (
    <div className="min-h-screen bg-slate-50 py-4 sm:py-10 px-2 sm:px-4 font-sans flex flex-col items-center gap-4 sm:gap-6" dir="rtl">
      
      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3 no-print w-full max-w-2xl justify-center">
         <button onClick={() => window.print()} className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-slate-800 text-white px-4 sm:px-6 py-3 rounded-xl font-bold shadow-md hover:bg-slate-900 transition text-sm">
            <Printer size={18} /> طباعة
         </button>
         <button onClick={downloadAsImage} className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-indigo-600 text-white px-4 sm:px-6 py-3 rounded-xl font-bold shadow-md hover:bg-indigo-700 transition text-sm">
            <Download size={18} /> حفظ كصورة
         </button>
         <a 
            href={`tel:${settings.phone}`} 
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-emerald-600 text-white px-4 sm:px-6 py-3 rounded-xl font-bold shadow-md hover:bg-emerald-700 transition text-sm"
         >
            <Phone size={18} /> اتصل بنا
         </a>
         {settings.locationUrl && (
           <a 
              href={settings.locationUrl} 
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-sky-600 text-white px-4 sm:px-6 py-3 rounded-xl font-bold shadow-md hover:bg-sky-700 transition text-sm"
           >
              <MapPin size={18} /> المقر
           </a>
         )}
      </div>

      {/* Invoice Area */}
      <div id="invoice-print-area" className="bg-white w-full max-w-2xl shadow-xl sm:shadow-2xl rounded-2xl sm:rounded-none overflow-hidden flex flex-col relative border border-slate-200 sm:border-none">
        
        {/* Decorative Top Bar (no-print) */}
        <div className="h-2 w-full bg-slate-800 no-print"></div>

        <div className="p-5 sm:p-[12mm] flex flex-col h-full">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-center sm:items-start border-b-2 border-slate-100 pb-6 mb-6 gap-4">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 text-center sm:text-right">
              {settings.logo && (
                <div className="bg-slate-50 p-2 rounded-2xl border border-slate-100 shadow-sm">
                  <img src={settings.logo} alt="Logo" className="w-20 h-20 object-contain" />
                </div>
              )}
              <div>
                <h1 className="text-2xl sm:text-3xl font-black text-slate-800 leading-tight">{settings.name}</h1>
                <div className="text-xs sm:text-sm text-slate-500 mt-2 space-y-1 font-medium">
                  {settings.address && <p className="flex items-center justify-center sm:justify-start gap-1">📍 {settings.address}</p>}
                  {(settings.phone || settings.phone2) && (
                    <p className="flex items-center justify-center sm:justify-start gap-1" dir="ltr">
                      {settings.phone2 && <span>{settings.phone2} | </span>}
                      {settings.phone} 📞
                    </p>
                  )}
                </div>
              </div>
            </div>
            <div className="flex flex-col items-center sm:items-end gap-3">
              <div className="flex items-center gap-2">
                <span className="text-slate-400 font-bold text-[10px] sm:text-xs uppercase tracking-widest">رقم الفاتورة</span>
                <span className="text-lg sm:text-xl font-black text-slate-900 font-mono bg-slate-100 px-3 py-1 rounded-lg border border-slate-200">#{order.id}</span>
              </div>
              {order.cashier_name && (
                <div className="flex items-center gap-1.5 text-[11px] font-black text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-full border border-indigo-100 shadow-sm">
                  <User size={12} className="opacity-70" />
                  <span>المحاسب: {order.cashier_name}</span>
                </div>
              )}
            </div>
          </div>

          {/* Info Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
             <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">
                    {(order as any).originType === 'purchase' ? 'المورد' : 'العميل'}
                  </span>
                  <CheckCircle2 size={14} className="text-emerald-500" />
                </div>
                <div className="text-sm font-black text-slate-800">
                  {(order as any).originType === 'purchase' ? ((order as any).supplier?.name || 'مورد') : (order.customer?.name || 'عميل نقدي')}
                </div>
                <div className="flex justify-between items-center mt-1">
                  <div className="text-xs font-bold text-slate-500 font-mono" dir="ltr">{order.customer?.phone || '-'}</div>
                  {order.customer && (
                    <div className="text-[10px] font-black bg-red-50 text-red-600 px-2 py-0.5 rounded-lg border border-red-100">
                      إجمالي المديونية: {((order as any).debtAfter || 0).toFixed(2)}
                    </div>
                  )}
                </div>
             </div>
             <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">التفاصيل</span>
                  <span className="text-[10px] text-slate-400 font-mono">{new Date(order.date).toLocaleDateString('ar-SA')}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-600">التاريخ:</span>
                  <span className="text-[13px] font-black text-slate-800">{new Date(order.date).toLocaleDateString('ar-EG', { calendar: 'gregory', day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-600">التوقيت:</span>
                  <span className="text-[13px] font-black text-slate-800">{new Date(order.date).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                {order.customer?.custom_id && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-600">رقم الكارت:</span>
                    <span className="text-[13px] font-black text-indigo-600 font-mono">{order.customer.custom_id}</span>
                  </div>
                )}
             </div>
          </div>

          {/* Items Table */}
          <div className="overflow-x-auto -mx-5 sm:mx-0 mb-6">
            <table className="w-full text-sm border-separate border-spacing-0">
              <thead>
                <tr className="bg-slate-50">
                  <th className="p-4 text-center text-[11px] font-black text-slate-400 border-b border-slate-100 w-10">#</th>
                  <th className="p-4 text-right text-[11px] font-black text-slate-400 border-b border-slate-100">{isPayment ? 'البيان' : 'المنتج'}</th>
                  {!isPayment && <th className="p-4 text-center text-[11px] font-black text-slate-400 border-b border-slate-100 w-16">الكمية</th>}
                  <th className="p-4 text-center text-[11px] font-black text-slate-400 border-b border-slate-100 w-24">السعر</th>
                  <th className="p-4 text-left text-[11px] font-black text-slate-400 border-b border-slate-100 w-28">الإجمالي</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {order.items.map((item, idx) => (
                  <tr key={idx} className="group">
                    <td className="p-4 text-center text-slate-400 font-bold text-xs">{idx + 1}</td>
                    <td className="p-4 font-black text-slate-800 text-sm">{item.name}</td>
                    {!isPayment && <td className="p-4 text-center font-black text-slate-800">{item.quantity}</td>}
                    <td className="p-4 text-center font-bold text-slate-600 text-xs">{item.sale_price.toFixed(2)}</td>
                    <td className="p-4 text-left font-black text-slate-900 text-sm">{ (item.quantity * item.sale_price).toFixed(2) }</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Summary Section */}
          <div className="mr-auto w-full sm:w-3/5 mt-auto space-y-4">
            <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100 space-y-3">
              {!isPayment && (
                <>
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-slate-500">المجموع الفرعي</span>
                    <span className="text-slate-800">{subtotal.toFixed(2)} {settings.currency}</span>
                  </div>
                  {calculatedDiscount > 0.5 && (
                    <div className="flex justify-between text-xs font-bold text-red-500">
                      <span>🏷️ الخصم</span>
                      <span>- {calculatedDiscount.toFixed(2)} {settings.currency}</span>
                    </div>
                  )}
                  {taxRate > 0 && (
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-slate-500">الضريبة ({taxRate}%)</span>
                      <span className="text-slate-800">{taxValue.toFixed(2)} {settings.currency}</span>
                    </div>
                  )}
                  <div className="h-px bg-slate-200 my-1"></div>
                  <div className="flex justify-between items-center text-xl font-black text-slate-800">
                    <span>الإجمالي</span>
                    <span className="text-2xl">{order.total.toFixed(2)} {settings.currency}</span>
                  </div>
                </>
              )}

              {/* Payment Status / Debt info */}
              <div className={`p-4 rounded-xl border text-center font-black ${order.type === 'payment' ? 'bg-indigo-50 border-indigo-100' : (order.paid_amount < order.total ? 'bg-red-50 text-red-600 border-red-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100')}`}>
                {isPayment ? (
                  <div className="space-y-3">
                    <div className="text-indigo-600 text-lg border-b border-indigo-100 pb-2">المبلغ المدفوع: {order.paid_amount.toFixed(2)} {settings.currency}</div>
                    <div className="flex justify-between items-center text-xs text-slate-500">
                      <span>المديونية قبل السداد:</span>
                      <span className="font-bold">{((order as any).debtBefore || 0).toFixed(2)} {settings.currency}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm text-orange-700 bg-white p-2 rounded-lg border border-orange-100 shadow-sm">
                      <span>المديونية المتبقية:</span>
                      <span className="text-lg font-black">{Math.max(0, (order as any).debtAfter || 0).toFixed(2)} {settings.currency}</span>
                    </div>
                  </div>
                ) : order.paid_amount < order.total ? (
                  <div className="flex flex-col gap-1">
                    <div className="text-base">متبقي آجل: {(order.total - order.paid_amount).toFixed(2)} {settings.currency}</div>
                    <div className="text-[10px] opacity-70">تم سداد: {order.paid_amount.toFixed(2)} {settings.currency}</div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    <CheckCircle2 size={18} /> تم السداد بالكامل
                  </div>
                )}
              </div>
            </div>

            {/* Payment Details Card */}
            <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm space-y-2">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center border-b border-slate-50 pb-2 mb-2">طريقة الدفع</div>
              <div className="grid grid-cols-2 gap-2">
                {order.paid_cash > 0 && <div className="flex justify-between p-2 bg-slate-50 rounded-lg text-[11px] font-black text-slate-700"><span>💵 كاش</span><span>{order.paid_cash.toFixed(2)}</span></div>}
                {order.paid_visa > 0 && <div className="flex justify-between p-2 bg-slate-50 rounded-lg text-[11px] font-black text-slate-700"><span>💳 فيزا</span><span>{order.paid_visa.toFixed(2)}</span></div>}
                {order.paid_wallet > 0 && <div className="flex justify-between p-2 bg-slate-50 rounded-lg text-[11px] font-black text-slate-700"><span>📱 محفظة</span><span>{order.paid_wallet.toFixed(2)}</span></div>}
                {order.paid_instapay > 0 && <div className="flex justify-between p-2 bg-slate-50 rounded-lg text-[11px] font-black text-slate-700"><span>⚡ انستا</span><span>{order.paid_instapay.toFixed(2)}</span></div>}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center mt-10 pt-6 border-t border-dashed border-slate-200 text-[11px] text-slate-400 font-black italic">
             شكراً لثقتكم بنا - {settings.name} ترحب بكم دائماً
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          body { background: white; padding: 0; }
          .no-print { display: none; }
          .min-h-screen { background: white; padding: 0; min-height: auto; }
          #invoice-print-area { 
            box-shadow: none; 
            border: none; 
            padding: 8mm; 
            margin: 0 auto; 
            width: 148mm; 
            min-height: 205mm; 
            border-radius: 0;
          }
          #invoice-print-area table th, #invoice-print-area table td {
            padding: 8px 4px;
          }
        }
        @media (max-width: 640px) {
          #invoice-print-area {
            max-width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
