import { useState } from 'react';
import { useStore } from '../../store/useStore';
import { BookUser, CreditCard, Search, Banknote, X, FileText, Table as TableIcon } from 'lucide-react';
import { normalizeArabic } from '../../utils/textUtils';
import * as XLSX from 'xlsx';

import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export default function DeferredAccounts() {
  const { customers, orders, storeSettings, checkout } = useStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [paymentForm, setPaymentForm] = useState({
    cash: '',
    visa: '',
    wallet: '',
    instapay: ''
  });

  // Calculate debts
  const customersWithDebt = customers.map(c => {
    const customerOrders = orders.filter(o => o.customer?.id === c.id);
    const totalDebt = Math.max(0, customerOrders.reduce((sum, o) => {
      // Debt = Original Total - Paid Amount (Returns are cash payout, don't affect debt)
      const effectiveTotal = o.type === 'payment' ? 0 : o.total;
      return sum + (effectiveTotal - o.paid_amount);
    }, 0));
    
    return { 
      ...c, 
      totalDebt, 
      orders: customerOrders.filter(o => o.total - o.paid_amount > 0) // optional: keep only unpaid invoices for reference
    };
  }).filter(c => c.totalDebt > 0)
    .sort((a, b) => b.totalDebt - a.totalDebt);

  const filteredCustomers = customersWithDebt.filter(c => 
    normalizeArabic(c.name).includes(normalizeArabic(searchQuery)) || 
    c.phone.includes(searchQuery)
  );


  const exportExcel = () => {
    const wsData = [
      ['تقرير حسابات الآجل', '', '', ''],
      ['التاريخ', new Date().toLocaleDateString(), '', ''],
      [''],
      ['الاسم', 'رقم الهاتف', 'المديونية', 'عدد الفواتير'],
      ...filteredCustomers.map(c => [
        c.name,
        c.phone,
        c.totalDebt,
        c.orders.length
      ])
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Debts');
    XLSX.writeFile(wb, `deferred_accounts_report_${new Date().toLocaleDateString()}.xlsx`);
  };

  const exportPDF = async () => {
    const element = document.getElementById('deferred-table');
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
          const el = clonedDoc.getElementById('deferred-table');
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
      
      pdf.save(`deferred_accounts_report_${new Date().toLocaleDateString()}.pdf`);
    } catch (error) {
      console.error('PDF Export Error:', error);
      alert('حدث خطأ أثناء تصدير ملف PDF');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (customer: any) => {
    setSelectedCustomer(customer);
    setPaymentForm({
      cash: customer.totalDebt.toString(),
      visa: '',
      wallet: '',
      instapay: ''
    });
    setIsModalOpen(true);
  };

  const handleProcessPayment = async () => {
    const cash = parseFloat(paymentForm.cash) || 0;
    const visa = parseFloat(paymentForm.visa) || 0;
    const wallet = parseFloat(paymentForm.wallet) || 0;
    const insta = parseFloat(paymentForm.instapay) || 0;
    const totalPaid = cash + visa + wallet + insta;

    if (totalPaid <= 0 || !selectedCustomer) {
      alert('الرجاء إدخال مبلغ صحيح');
      return;
    }
    
    if (totalPaid > selectedCustomer.totalDebt + 1) { // +1 for small rounding issues
      alert('المبلغ المدفوع أكبر من إجمالي الدين');
      return;
    }

    try {
      // Pass total=0, paidAmount=amount, type='payment'
      const invoiceId = await checkout(
        0, 
        { name: selectedCustomer.name, phone: selectedCustomer.phone, custom_id: selectedCustomer.custom_id }, 
        totalPaid, 
        'payment',
        cash >= visa ? 'cash' : 'visa',
        { cash, visa, wallet, instapay: insta }
      );
      
      alert(`تم تسجيل الدفعة بنجاح!\nرقم الإيصال: ${invoiceId}`);
      setIsModalOpen(false);
      setSelectedCustomer(null);
      setPaymentForm({ cash: '', visa: '', wallet: '', instapay: '' });
    } catch (e: any) {
      alert('حدث خطأ أثناء معالجة الدفعة: ' + e.message);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto font-sans text-slate-800">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
            <BookUser style={{ color: storeSettings.themeColor }} size={32} />
            حسابات الآجل (الديون)
          </h1>
          <p className="text-slate-500 mt-2">إدارة العملاء المتعثرين وتسجيل الدفعات للفواتير الآجلة</p>
        </div>
        <div className="flex items-center gap-3">
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
          <div className="relative w-full md:w-96">
            <Search className="absolute right-4 top-3.5 text-slate-400" size={20} />
            <input
              type="text"
              placeholder="ابحث برقم الهاتف أو اسم العميل..."
              className="w-full bg-white border border-slate-200 rounded-2xl py-3 pr-12 pl-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div id="deferred-table" className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right" dir="rtl">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-sm">
              <tr>
                <th className="py-4 px-6 font-bold">اسم العميل</th>
                <th className="py-4 px-6 font-bold">رقم الهاتف</th>
                <th className="py-4 px-6 font-bold">الفواتير المعلقة</th>
                <th className="py-4 px-6 font-bold">إجمالي المديونية</th>
                <th className="py-4 px-6 font-bold text-left">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCustomers.length > 0 ? (
                filteredCustomers.map((customer) => (
                  <tr key={customer.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-4 px-6 font-bold text-slate-800">{customer.name}</td>
                    <td className="py-4 px-6 font-mono text-slate-600" dir="ltr">{customer.phone}</td>
                    <td className="py-4 px-6">
                      <div className="flex flex-wrap gap-2">
                        {customer.orders.slice(0, 3).map((o: any) => (
                          <span key={o.id} className="bg-slate-100 text-slate-600 text-xs px-2 py-1 rounded-md font-mono">
                            #{o.id}
                          </span>
                        ))}
                        {customer.orders.length > 3 && (
                          <span className="text-xs text-slate-400">+{customer.orders.length - 3} فواتير أخرى</span>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-red-600 font-black text-lg bg-red-50 px-3 py-1 rounded-xl block w-max">
                        {customer.totalDebt.toFixed(2)} <span className="text-xs">{storeSettings.currency}</span>
                      </span>
                    </td>
                    <td className="py-4 px-6 text-left">
                      <button 
                        onClick={() => handleOpenModal(customer)}
                        style={{ backgroundColor: storeSettings.themeColor + '15', color: storeSettings.themeColor }}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all hover:bg-opacity-25"
                      >
                        <CreditCard size={18} /> سداد
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    <BookUser size={48} className="mx-auto mb-4 opacity-50" />
                    لا يوجد عملاء لديهم التزامات مالية حالياً
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && selectedCustomer && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div 
              style={{ background: `linear-gradient(160deg, ${storeSettings.themeColor} 0%, ${storeSettings.themeColor}dd 100%)` }}
              className="p-6 text-white flex justify-between items-center"
            >
              <h2 className="text-xl font-black flex items-center gap-2 drop-shadow">
                <Banknote /> تسجيل دفعة سداد
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="hover:bg-white/20 p-2 rounded-xl transition">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-5">
              <div className="flex flex-col items-center bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div className="text-sm font-bold text-slate-500 mb-1">إجمالي المديونية</div>
                <div className="text-3xl font-black text-red-600">{selectedCustomer.totalDebt.toFixed(2)} <span className="text-lg">{storeSettings.currency}</span></div>
                <div className="mt-2 text-sm font-semibold">{selectedCustomer.name} - <span dir="ltr">{selectedCustomer.phone}</span></div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 text-center py-2 bg-indigo-50 rounded-xl mb-2">
                  <span className="text-xs font-bold text-indigo-400">توزيع مبلغ السداد</span>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase text-right">💵 كاش</label>
                  <input
                    type="number" dir="ltr"
                    className="w-full border border-slate-200 rounded-xl py-3 px-3 text-lg font-black text-center focus:ring-2 focus:ring-indigo-500"
                    value={paymentForm.cash}
                    onChange={(e) => setPaymentForm({...paymentForm, cash: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase text-right">💳 فيزا</label>
                  <input
                    type="number" dir="ltr"
                    className="w-full border border-slate-200 rounded-xl py-3 px-3 text-lg font-black text-center focus:ring-2 focus:ring-indigo-500"
                    value={paymentForm.visa}
                    onChange={(e) => setPaymentForm({...paymentForm, visa: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase text-right">📱 محفظة</label>
                  <input
                    type="number" dir="ltr"
                    className="w-full border border-slate-200 rounded-xl py-3 px-3 text-lg font-black text-center focus:ring-2 focus:ring-indigo-500"
                    value={paymentForm.wallet}
                    onChange={(e) => setPaymentForm({...paymentForm, wallet: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase text-right">⚡ انستا باي</label>
                  <input
                    type="number" dir="ltr"
                    className="w-full border border-slate-200 rounded-xl py-3 px-3 text-lg font-black text-center focus:ring-2 focus:ring-indigo-500"
                    value={paymentForm.instapay}
                    onChange={(e) => setPaymentForm({...paymentForm, instapay: e.target.value})}
                  />
                </div>
              </div>

              <div className="bg-slate-900 p-4 rounded-2xl text-center">
                <span className="text-slate-400 text-xs font-bold block mb-1">إجمالي المبلغ المدفوع</span>
                <span className="text-2xl font-black text-white">
                  {((parseFloat(paymentForm.cash) || 0) + (parseFloat(paymentForm.visa) || 0) + (parseFloat(paymentForm.wallet) || 0) + (parseFloat(paymentForm.instapay) || 0)).toLocaleString()} {storeSettings.currency}
                </span>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleProcessPayment}
                  style={{ backgroundColor: storeSettings.themeColor, boxShadow: `0 4px 12px ${storeSettings.themeColor}40` }}
                  className="flex-1 text-white py-4 rounded-xl font-bold transition-all hover:bg-opacity-90"
                >
                  إتمام عملية الدفع
                </button>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="px-6 border border-slate-200 hover:bg-slate-50 text-slate-600 py-3.5 rounded-xl font-bold transition"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
