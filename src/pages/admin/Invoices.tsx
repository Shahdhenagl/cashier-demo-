import { useState, useMemo } from 'react';
import { useStore } from '../../store/useStore';
import { ArrowRightLeft, Search, User, Printer, CreditCard, FileText, Table as TableIcon } from 'lucide-react';
import { normalizeArabic } from '../../utils/textUtils';
import * as XLSX from 'xlsx';

import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export default function Invoices() {
  const { orders, storeSettings } = useStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [showReturnsOnly, setShowReturnsOnly] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const [loading, setLoading] = useState(false);

  const handlePrint = (order: any) => {
    const printDate = new Date(order.created_at || Date.now()).toLocaleString('ar-EG', { calendar: 'gregory', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const isPayment = order.type === 'payment';
    const subtotal = order.items.reduce((sum: number, item: any) => sum + (item.sale_price * item.quantity), 0);
    const discountValue = Math.max(0, subtotal - order.total);
    const taxValue = Math.max(0, order.total - (subtotal - discountValue));
    
    // Calculate debt as of this transaction
    let debtAfter = 0;
    let debtBefore = 0;
    if (order.customer) {
      const customerOrders = orders.filter(o => o.customer?.id === order.customer.id);
      const sortedOrders = [...customerOrders].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      const currentIndex = sortedOrders.findIndex(o => o.id === order.id);
      
      const calcDebt = (upToIndex: number) => sortedOrders.slice(0, upToIndex).reduce((sum, o) => {
        const itemsSum = o.items.reduce((s, i) => s + (i.quantity * i.sale_price), 0);
        const discountRatio = itemsSum > 0 ? o.total / itemsSum : 1;
        const returnedValue = o.items.reduce((s, i) => s + (i.returned_quantity * i.sale_price), 0) * discountRatio;
        const effectiveTotal = o.type === 'payment' ? 0 : (o.total - returnedValue);
        return sum + (effectiveTotal - o.paid_amount);
      }, 0);

      debtBefore = calcDebt(currentIndex);
      debtAfter = calcDebt(currentIndex + 1);
    }

    let itemsHtml = '';
    if (isPayment) {
      itemsHtml = `<tr>
        <td style="text-align:center">1</td>
        <td colspan="3" style="padding:12px 4px;border-bottom:1px dashed #ddd;font-size:14px;font-weight:bold;text-align:right;">سداد مديونية سابقة</td>
        <td style="padding:12px 4px;border-bottom:1px dashed #ddd;text-align:left;font-size:14px;font-weight:bold;">${order.paid_amount.toFixed(2)}</td>
      </tr>`;
    } else {
      itemsHtml = order.items.map((item: any, idx: number) =>
        `<tr>
          <td style="text-align:center">${idx + 1}</td>
          <td style="padding:6px 4px;border-bottom:1px dashed #ddd;font-size:13px;text-align:right;">${item.name}${item.returned_quantity > 0 ? ` <span style="color:red;font-size:10px;">(مرتجع: ${item.returned_quantity})</span>` : ''}</td>
          <td style="padding:6px 4px;border-bottom:1px dashed #ddd;text-align:center;font-size:13px;">${item.quantity}</td>
          <td style="padding:6px 4px;border-bottom:1px dashed #ddd;text-align:center;font-size:13px;">${item.sale_price.toFixed(2)}</td>
          <td style="padding:6px 4px;border-bottom:1px dashed #ddd;text-align:left;font-size:13px;">${(item.sale_price * item.quantity).toFixed(2)}</td>
        </tr>`
      ).join('');
    }

    const invoiceUrl = `${window.location.origin}/view-invoice/${order.id}`;
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(invoiceUrl)}`;

    const customerBlock = order.customer
      ? `<div class="customer-info-grid">
            <div class="info-item"><strong>اسم العميل:</strong> <span>${order.customer.name}</span></div>
            <div class="info-item"><strong>رقم الهاتف:</strong> <span dir="ltr">${order.customer.phone}</span></div>
            <div class="info-item"><strong>رقم الكارت (ID):</strong> <span dir="ltr">${order.customer.custom_id || order.customer.id.substring(0, 8)}</span></div>
            <div class="info-item"><strong>رقم الفاتورة:</strong> <span>#${order.id}</span></div>
            <div class="info-item"><strong>المسؤول:</strong> <span>${order.cashier_name || '—'}</span></div>
            <div class="info-item"><strong>التاريخ:</strong> <span>${printDate}</span></div>
            <div class="info-item" style="grid-column: span 2; border-top: 1px dashed #e2e8f0; padding-top: 4px; margin-top: 2px;">
              <strong>إجمالي المديونية الحالية:</strong> 
              <span style="color: #dc2626; font-size: 14px;">${debtAfter.toFixed(2)} ${storeSettings.currency}</span>
            </div>
         </div>`
      : `<div class="customer-info-grid">
            <div class="info-item"><strong>اسم العميل:</strong> <span>عميل نقدي</span></div>
            <div class="info-item"><strong>رقم الفاتورة:</strong> <span>#${order.id}</span></div>
            <div class="info-item"><strong>المسؤول:</strong> <span>${order.cashier_name || '—'}</span></div>
            <div class="info-item"><strong>التاريخ:</strong> <span>${printDate}</span></div>
         </div>`;

    const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8"/>
  <title>فاتورة بيع #${order.id}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap');
    *{margin:0;padding:0;box-sizing:border-box;font-family:'Cairo', sans-serif;}
    body{background:#fff;color:#1e293b;padding:0;margin:0;}
    .invoice-container{width:148mm;min-height:100mm;margin:0 auto;padding:5mm;position:relative;display:flex;flex-direction:column;gap:5px;}
    
    .header-main{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #1e293b;padding-bottom:5px;margin-bottom:5px;}
    .logo{width:80px;height:80px;object-fit:contain;border-radius:12px;border:1px solid #e2e8f0;padding:2px;background:#fff;}
    .store-name{font-size:24px;font-weight:900;color:#1e293b;line-height:1.2;}
    .store-details{font-size:10px;color:#64748b;margin-top:3px;line-height:1.3;font-weight:bold;}
    .store-info-center{flex:1;display:flex;flex-direction:column;align-items:center;text-align:center;padding:0 10px;}
    
    .qr-code-container{display:flex;flex-direction:column;align-items:center;gap:3px;}
    .qr-code-img{width:80px;height:80px;padding:3px;background:#fff;border-radius:10px;border:1px solid #e2e8f0;box-shadow: 0 1px 3px rgba(0,0,0,0.1);}
    .qr-label{font-size:10px;font-weight:900;color:#1e293b;text-align:center;margin-top:2px;background:#f1f5f9;padding:2px 8px;border-radius:4px;}

    .customer-info-grid{display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-bottom:5px;background:#f8fafc;padding:8px;border-radius:10px;border:1px solid #e2e8f0;}
    .info-item{font-size:12px;display:flex;gap:6px;}
    .info-item strong{color:#64748b;white-space:nowrap;}
    .info-item span{color:#1e293b;font-weight:700;}

    table{width:100%;border-collapse:collapse;margin-bottom:5px;}
    thead th{background:#f1f5f9;color:#475569;font-size:12px;padding:8px 6px;text-align:center;border-bottom:2px solid #cbd5e1;}
    thead th:nth-child(2){text-align:right;}
    thead th:last-child{text-align:left;}
    
    .summary-section{margin-right:auto;width:60%;margin-top:5px;}
    .summary-row{display:flex;justify-content:space-between;padding:5px 0;font-size:13px;border-bottom:1px solid #f1f5f9;}
    .summary-row.total{border-top:2px solid #1e293b;border-bottom:none;margin-top:3px;font-size:18px;font-weight:900;color:#1e293b;}
    
    .payment-status{margin-top:8px;padding:6px;border-radius:6px;text-align:center;font-weight:bold;font-size:13px;}
    .status-paid{background:#ecfdf5;color:#059669;border:1px solid #a7f3d0;}
    .status-debt{background:#fef2f2;color:#dc2626;border:1px solid #fecaca;}
    
    .footer{text-align:center;margin-top:15px;padding-top:10px;border-top:1px dashed #cbd5e1;font-size:11px;color:#94a3b8;font-weight:bold;}
    
    @media print{
      @page{size:A5;margin:0;}
      body{-webkit-print-color-adjust:exact;}
      .invoice-container{width:148mm;height:auto;padding:5mm;}
    }
  </style>
</head>
<body>
  <div class="invoice-container">
    <div class="header-main">
      <img class="logo" src="${storeSettings.logo}" onerror="this.style.display='none'" />
      
      <div class="store-info-center">
        <div class="store-name">${storeSettings.name}</div>
        <div class="store-details">
          ${storeSettings.address ? `📍 ${storeSettings.address}<br/>` : ''}
          ${storeSettings.phone ? `📞 ${storeSettings.phone}` : ''}
          ${storeSettings.phone2 ? ` | ${storeSettings.phone2}` : ''}
        </div>
      </div>

      <div class="qr-code-container">
        <img class="qr-code-img" src="${qrCodeUrl}" alt="QR Code" />
        <div class="qr-label">تفاصيل الفاتورة</div>
      </div>
    </div>

    ${customerBlock}

    <table>
      <thead><tr>
        <th style="width:40px">#</th>
        <th style="text-align:right">${isPayment ? 'البيان' : 'المنتج'}</th>
        <th style="width:60px">${isPayment ? '' : 'الكمية'}</th>
        <th style="width:80px">${isPayment ? '' : 'السعر'}</th>
        <th style="width:100px;text-align:left">الإجمالي</th>
      </tr></thead>
      <tbody>${itemsHtml}</tbody>
    </table>

    <div class="summary-section">
      ${!isPayment ? `
      <div class="summary-row"><span>المجموع الفرعي:</span><span>${subtotal.toFixed(2)} ${storeSettings.currency}</span></div>
      <div class="summary-row"><span>الضريبة (${storeSettings.taxRate}%):</span><span>${taxValue.toFixed(2)} ${storeSettings.currency}</span></div>
      <div class="summary-row total"><span>الإجمالي النهائي:</span><span>${order.total.toFixed(2)} ${storeSettings.currency}</span></div>
      ` : `
      <div class="summary-row" style="margin-top:4px;color:#059669;font-weight:bold;"><span>المبلغ المدفوع:</span><span>${order.paid_amount.toFixed(2)} ${storeSettings.currency}</span></div>
      
      <div style="margin-top:10px; padding:10px; background:#f0f9ff; border-radius:10px; border:1px solid #bae6fd;">
        <div style="display:flex; justify-content:space-between; font-size:12px; color:#0369a1; margin-bottom:4px;">
          <span>المديونية قبل السداد:</span>
          <strong>${debtBefore.toFixed(2)} ${storeSettings.currency}</strong>
        </div>
        <div class="debt-info-line" style="color:#c2410c; margin-top:5px; border-top:1px dashed #bae6fd; padding-top:5px;">
          <span>المديونية المتبقية:</span>
          <strong style="font-size:16px;">${Math.max(0, debtAfter).toFixed(2)} ${storeSettings.currency}</strong>
        </div>
      </div>
      `}
      
      <div style="margin-top:10px; padding:8px; background:#f9fafb; border-radius:8px; border:1px solid #eee;">
        <div style="font-size:11px; color:#64748b; margin-bottom:4px; border-bottom:1px solid #eee; padding-bottom:2px; text-align:right;">تفاصيل الدفع:</div>
        ${order.paid_cash > 0 ? `<div class="summary-row" style="font-size:11px;"><span>💵 كاش:</span><span>${order.paid_cash.toFixed(2)}</span></div>` : ''}
        ${order.paid_visa > 0 ? `<div class="summary-row" style="font-size:11px;"><span>💳 فيزا:</span><span>${order.paid_visa.toFixed(2)}</span></div>` : ''}
        ${order.paid_wallet > 0 ? `<div class="summary-row" style="font-size:11px;"><span>📱 محفظة:</span><span>${order.paid_wallet.toFixed(2)}</span></div>` : ''}
        ${order.paid_instapay > 0 ? `<div class="summary-row" style="font-size:11px;"><span>⚡ انستا باي:</span><span>${order.paid_instapay.toFixed(2)}</span></div>` : ''}
      </div>

      ${(!isPayment && order.paid_amount < order.total) ? `
        <div class="payment-status status-debt" style="margin-top:10px;">
          <div>متبقي للتحصيل (آجل): ${(order.total - order.paid_amount).toFixed(2)} ${storeSettings.currency}</div>
        </div>
      ` : !isPayment ? `
        <div class="payment-status status-paid" style="margin-top:10px;">✓ تم سداد الفاتورة بالكامل</div>
      ` : ''}
    </div>

    <div class="footer">شكراً لثقتكم بنا - ${storeSettings.name} ترحب بكم دائماً</div>
  </div>
  <script>window.onload=()=>{setTimeout(()=>{window.print();window.onafterprint=()=>window.close();},500);}<\/script>
</body></html>`;

    const pw = window.open('', '_blank', 'width=800,height=1000');
    if (pw) { pw.document.write(html); pw.document.close(); }
  };

  // Extract unique years from orders
  const years = useMemo(() => {
    const y = new Set<string>();
    orders.forEach(o => y.add(new Date(o.date).getFullYear().toString()));
    return Array.from(y).sort((a, b) => parseInt(b) - parseInt(a));
  }, [orders]);

  const exportExcel = () => {
    const wsData = [
      ['تقرير الفواتير', '', '', '', '', '', '', ''],
      ['التاريخ', new Date().toLocaleDateString(), '', '', '', '', '', ''],
      [''],
      ['رقم الفاتورة', 'العميل', 'التاريخ', 'الإجمالي', 'المدفوع', 'كاش', 'فيزا', 'محفظة', 'انستا', 'الباقي', 'النوع'],
      ...filteredOrders.map(o => [
        o.id,
        o.customer?.name || 'عميل نقدي',
        new Date(o.date).toLocaleString('ar-SA'),
        o.total,
        o.paid_amount,
        o.paid_cash,
        o.paid_visa,
        o.paid_wallet,
        o.paid_instapay,
        o.type === 'payment' ? 0 : Math.max(0, o.total - o.paid_amount),
        o.type === 'payment' ? 'سداد' : 'بيع'
      ])
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Invoices');
    XLSX.writeFile(wb, `invoices_report_${new Date().toLocaleDateString()}.xlsx`);
  };

  const exportPDF = async () => {
    const element = document.getElementById('invoices-table');
    if (!element) return;
    
    setLoading(true);
    
    try {
      const canvas = await html2canvas(element, { 
        scale: 2,
        useCORS: true,
        logging: false,
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight,
        onclone: (clonedDoc) => {
          const el = clonedDoc.getElementById('invoices-table');
          if (el) {
            el.style.height = 'auto';
            el.style.overflow = 'visible';
          }
        }
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      let heightLeft = imgHeight;
      let position = 0;

      // Add the first page
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;

      // Add additional pages if needed
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pdfHeight;
      }
      
      pdf.save(`invoices_report_${new Date().toLocaleDateString()}.pdf`);
    } catch (error) {
      console.error('PDF Export Error:', error);
      alert('حدث خطأ أثناء تصدير ملف PDF');
    } finally {
      setLoading(false);
    }
  };

  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      const orderDate = new Date(o.date);
      const matchesMonth = selectedMonth === 'all' || (orderDate.getMonth() + 1).toString() === selectedMonth;
      const matchesYear = selectedYear === 'all' || orderDate.getFullYear().toString() === selectedYear;
      const matchesReturns = showReturnsOnly ? o.items.some(i => i.returned_quantity > 0) : true;
      
      const searchStr = searchQuery.toLowerCase();
      const matchesSearch = 
        o.id.toLowerCase().includes(searchStr) || 
        normalizeArabic(o.customer?.name || '').includes(normalizeArabic(searchStr)) ||
        (o.customer?.phone || '').includes(searchStr);


      return matchesMonth && matchesYear && matchesReturns && matchesSearch;
    });
  }, [orders, searchQuery, showReturnsOnly, selectedMonth, selectedYear]);

  return (
    <div className="p-8">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-800">فواتير البيع والمرتجعات</h1>
          <p className="text-slate-500 mt-2">مراجعة فواتير البيع وعمليات الاسترجاع مع الفلاتر المتقدمة</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={exportExcel}
            className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-emerald-700 transition shadow-lg"
          >
            <TableIcon size={18} /> Excel
          </button>
          <button 
            onClick={exportPDF}
            className="flex items-center gap-2 bg-red-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-red-700 transition shadow-lg disabled:opacity-50"
            disabled={loading}
          >
            {loading ? '...جاري التصدير' : <><FileText size={18} /> PDF</>}
          </button>
        </div>
      </div>

      <div id="invoices-table" className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden flex flex-col min-h-[500px]">
        {/* Advanced Filters */}
        <div className="p-5 border-b border-slate-100 bg-slate-50 grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
          <div className="relative md:col-span-2">
            <Search className="absolute right-4 top-3 text-slate-400" size={20} />
            <input
              type="text"
              placeholder="ابحث برقم الفاتورة، اسم العميل، أو رقم الهاتف..."
              style={{ '--tw-ring-color': storeSettings.themeColor + '40' } as any}
              className="w-full bg-white border border-slate-200 rounded-xl py-2.5 pr-12 pl-4 text-sm focus:outline-none focus:ring-2 shadow-sm transition"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <div className="flex gap-4 md:col-span-2 justify-end items-center">
            <select 
              value={selectedMonth} 
              onChange={e => setSelectedMonth(e.target.value)} 
              style={{ '--tw-ring-color': storeSettings.themeColor + '40' } as any}
              className="bg-white border border-slate-200 rounded-xl p-2.5 text-sm focus:ring-2 outline-none"
            >
              <option value="all">كل الشهور</option>
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i+1} value={(i+1).toString()}>{`شهر ${i+1}`}</option>
              ))}
            </select>

            <select 
              value={selectedYear} 
              onChange={e => setSelectedYear(e.target.value)} 
              style={{ '--tw-ring-color': storeSettings.themeColor + '40' } as any}
              className="bg-white border border-slate-200 rounded-xl p-2.5 text-sm focus:ring-2 outline-none"
            >
              <option value="all">كل السنوات</option>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>

        <div className="p-4 border-b border-slate-100 bg-white flex justify-between items-center">
           <label className="flex items-center gap-2 cursor-pointer text-sm font-bold text-slate-700 bg-slate-50 px-4 py-2 border border-slate-200 rounded-xl hover:bg-slate-100 transition">
              <input 
                type="checkbox" 
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                checked={showReturnsOnly}
                onChange={(e) => setShowReturnsOnly(e.target.checked)}
              />
              إظهار الفواتير المرتجعة فقط
            </label>
            <div 
              style={{ backgroundColor: storeSettings.themeColor + '15', color: storeSettings.themeColor, borderColor: storeSettings.themeColor + '30' }}
              className="text-sm font-bold px-5 py-2.5 border rounded-xl"
            >
              إجمالي النتائج: {filteredOrders.length}
            </div>
        </div>

        <div className="flex-1 overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-50 border-b border-slate-100 text-slate-400 font-medium">
              <tr>
                <th className="p-4">رقم الفاتورة</th>
                <th className="p-4">بيانات العميل</th>
                <th className="p-4">التاريخ والوقت</th>
                <th className="p-4 text-center">المسؤول</th>
                <th className="p-4">تفاصيل المنتجات</th>
                <th className="p-4 text-center border-x border-slate-100 bg-slate-100/50">الإجمالي</th>
                <th className="p-4 text-center text-orange-600">قيمة المرتجع</th>
                <th className="p-4 text-center text-green-600">المدفوع</th>
                <th className="p-4 text-center text-red-500 font-black">الباقي عليه</th>
                <th className="p-4 text-center">الحالة</th>
                <th className="p-4 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-12 text-center text-slate-400 text-lg font-bold">
                    لا يوجد فواتير تطابق بحثك حالياً.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => {
                  const hasReturns = order.items.some(i => i.returned_quantity > 0);
                  const returnedValue = order.items.reduce((sum, i) => sum + (i.returned_quantity * i.sale_price), 0);
                  const effectiveDebt = order.type === 'payment' ? 0 : Math.max(0, order.total - order.paid_amount);

                  return (
                    <tr key={order.id} className={`hover:bg-slate-50 transition ${hasReturns ? 'bg-red-50/20' : ''}`}>
                      <td className="p-4 font-mono font-bold" style={{ color: storeSettings.themeColor }}>{order.id}</td>
                      <td className="p-4">
                        {order.customer ? (
                          <div className="flex flex-col">
                            <span className="font-bold flex items-center gap-1"><User size={14} style={{ color: storeSettings.themeColor }} /> {order.customer.name}</span>
                            <span className="text-xs text-slate-500 font-mono mt-1" dir="ltr">{order.customer.phone}</span>
                            {(() => {
                              const cDebt = orders.filter(o => o.customer?.id === order.customer!.id)
                                .reduce((sum, o) => {
                                  const eTotal = o.type === 'payment' ? 0 : o.total;
                                  return sum + (eTotal - o.paid_amount);
                                }, 0);
                              return cDebt > 0 ? (
                                <span className="text-[10px] font-black text-red-500 mt-1 bg-red-50 px-2 py-0.5 rounded border border-red-100 w-fit">إجمالي الأجل: {cDebt.toFixed(2)}</span>
                              ) : null;
                            })()}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs font-bold bg-slate-100 px-2 py-1 rounded">عميل نقدي</span>
                        )}
                      </td>
                      <td className="p-4 text-slate-500">{new Date(order.date).toLocaleString('ar-SA')}</td>
                      <td className="p-4 text-center font-bold text-indigo-600">{order.cashier_name || 'غير معروف'}</td>
                      <td className="p-4 text-right">
                        {order.type === 'payment' ? (
                          <div className="flex items-center gap-2 text-indigo-600 font-bold">
                            <CreditCard size={14} /> سداد مديونية آجل
                          </div>
                        ) : (
                          <ul className="space-y-1">
                            {order.items.map(i => (
                              <li key={i.id} className={`flex items-center gap-2 ${i.returned_quantity > 0 ? 'text-red-500' : ''}`}>
                                • {i.name} <span className="text-xs text-slate-400">(الكمية: {i.quantity})</span> 
                                {i.returned_quantity > 0 && <span className="font-bold text-[10px] bg-red-100 px-1.5 py-0.5 rounded text-red-600">مرتجع: {i.returned_quantity}</span>}
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                       <td className="p-4 text-center font-black border-x border-slate-100 bg-slate-50/50" style={order.type === 'payment' ? { color: storeSettings.themeColor } : {}}>
                        {order.type === 'payment' ? `+ ${order.paid_amount.toFixed(2)}` : order.total.toFixed(2)} {storeSettings.currency}
                      </td>
                      <td className="p-4 text-center font-bold text-orange-600">
                        {returnedValue.toFixed(2)} {storeSettings.currency}
                      </td>
                      <td className="p-4 text-center font-black text-green-600">
                        {order.paid_amount.toFixed(2)} {storeSettings.currency}
                      </td>
                      <td className="p-4 text-center font-black text-red-500">
                        {effectiveDebt.toFixed(2)} {storeSettings.currency}
                      </td>
                      <td className="p-4 text-center">
                        {order.type === 'payment' ? (
                          <span style={{ backgroundColor: storeSettings.themeColor + '15', color: storeSettings.themeColor }} className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold">
                            سداد آجل
                          </span>
                        ) : hasReturns ? (
                          <span className="inline-flex items-center gap-1 bg-red-100 text-red-600 px-3 py-1 rounded-lg text-xs font-bold">
                            <ArrowRightLeft size={14} /> مرتجع جزئي/كلي
                          </span>
                        ) : order.total - order.paid_amount > 0 ? (
                          <span className="inline-flex items-center gap-1 bg-orange-100 text-orange-700 px-3 py-1 rounded-lg text-xs font-bold">
                            فاتورة أجل
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-green-100 text-green-600 px-3 py-1 rounded-lg text-xs font-bold">
                            فاتورة مكتملة
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        <button 
                          onClick={() => handlePrint(order)}
                          style={{ backgroundColor: storeSettings.themeColor + '10', color: storeSettings.themeColor }}
                          className="p-2 rounded-lg hover:bg-opacity-20 transition-all shadow-sm border border-transparent hover:border-current"
                          title="طباعة الفاتورة"
                        >
                          <Printer size={18} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
