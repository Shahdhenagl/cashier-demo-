import { useState } from 'react';
import { useStore } from '../../store/useStore';
import { BookUser, CreditCard, Search, Banknote, X, FileText, Table as TableIcon, Plus, User, UserPlus, Truck } from 'lucide-react';
import { normalizeArabic } from '../../utils/textUtils';
import * as XLSX from 'xlsx';

import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export default function DeferredAccounts() {
  const { customers, orders, suppliers, purchaseInvoices, storeSettings, checkout, addPurchaseInvoice, addSupplier } = useStore();
  const activeOrders = orders.filter((order) => !order.is_deleted);
  
  const [activeTab, setActiveTab] = useState<'customers' | 'suppliers'>('customers');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<any>(null); // Customer or Supplier
  const [paymentForm, setPaymentForm] = useState({
    cash: '',
    visa: '',
    wallet: '',
    instapay: ''
  });

  // Add previous debt state
  const [isAddDebtOpen, setIsAddDebtOpen] = useState(false);
  const [addDebtSearch, setAddDebtSearch] = useState('');
  const [selectedAddDebtEntity, setSelectedAddDebtEntity] = useState<any>(null);
  const [addDebtAmount, setAddDebtAmount] = useState<string>('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  // --- Customers Logic ---
  const filteredSearchCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(addDebtSearch.toLowerCase()) || 
    c.phone.includes(addDebtSearch)
  ).slice(0, 5);

  const customersWithDebt = customers.map(c => {
    const customerOrders = activeOrders.filter(o => o.customer?.id === c.id);
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

  // --- Suppliers Logic ---
  const filteredSearchSuppliers = suppliers.filter(s => 
    s.name.toLowerCase().includes(addDebtSearch.toLowerCase()) || 
    (s.phone && s.phone.includes(addDebtSearch))
  ).slice(0, 5);

  const suppliersWithDebt = suppliers.map(s => {
    const supplierInvoices = purchaseInvoices.filter(inv => inv.supplier_id === s.id);
    const totalDebt = Math.max(0, supplierInvoices.reduce((sum, inv) => sum + (inv.total - inv.paid_amount), 0));
    return { ...s, totalDebt, invoices: supplierInvoices.filter(inv => inv.total - inv.paid_amount > 0) };
  }).filter(s => s.totalDebt > 0).sort((a, b) => b.totalDebt - a.totalDebt);

  const getPrimaryPaymentMethod = (cash: number, visa: number, wallet: number, instapay: number) => {
    const methods: { method: 'cash' | 'visa' | 'wallet' | 'instapay'; amount: number }[] = [
      { method: 'cash', amount: cash },
      { method: 'visa', amount: visa },
      { method: 'wallet', amount: wallet },
      { method: 'instapay', amount: instapay }
    ];
    return methods.sort((a, b) => b.amount - a.amount)[0].method;
  };

  // Filtered lists for table
  const displayList = activeTab === 'customers' 
    ? customersWithDebt.filter(c => normalizeArabic(c.name).includes(normalizeArabic(searchQuery)) || c.phone.includes(searchQuery))
    : suppliersWithDebt.filter(s => normalizeArabic(s.name).includes(normalizeArabic(searchQuery)) || (s.phone && s.phone.includes(searchQuery)));

  const handleOpenAddDebtModal = () => {
    setSelectedAddDebtEntity(null);
    setAddDebtAmount('');
    setAddDebtSearch('');
    setIsAddDebtOpen(true);
  };

  const handleProcessAddDebt = async () => {
    const amount = parseFloat(addDebtAmount);
    if (!amount || amount <= 0) {
      alert('الرجاء إدخال مبلغ صحيح أكبر من الصفر');
      return;
    }

    if (activeTab === 'customers') {
      if (!selectedAddDebtEntity && !addDebtSearch.trim()) {
        alert('الرجاء اختيار العميل أولاً');
        return;
      }
      try {
        const invoiceId = await checkout(
          amount, 
          selectedAddDebtEntity ? { name: selectedAddDebtEntity.name, phone: selectedAddDebtEntity.phone, custom_id: selectedAddDebtEntity.custom_id } : { name: addDebtSearch, phone: '' }, 
          0, 
          'previous_debt' as any // Using previous_debt type if supported, or sale
        );
        alert(`تم إضافة مديونية العميل السابقة بنجاح!\nرقم الفاتورة: ${invoiceId}`);
      } catch (e: any) {
        alert('حدث خطأ أثناء إضافة مديونية العميل السابقة');
        return;
      }
    } else {
      // Supplier
      if (!selectedAddDebtEntity && !addDebtSearch.trim()) {
        alert('الرجاء اختيار المورد أولاً');
        return;
      }
      try {
        let supplierId = selectedAddDebtEntity?.id;
        if (!supplierId) {
          const newSup = await addSupplier({ name: addDebtSearch, phone: '', address: '' });
          if (!newSup) throw new Error('Failed to create supplier');
          supplierId = newSup.id;
        }
        
        const invoiceNum = `PREV-DEBT-${Date.now()}`;
        await addPurchaseInvoice({
          invoice_number: invoiceNum,
          supplier_id: supplierId,
          total: amount,
          paid_amount: 0,
          payment_method: 'cash'
        }, []);
        alert(`تم إضافة مستحقات المورد السابقة بنجاح!\nرقم الفاتورة: ${invoiceNum}`);
      } catch (e: any) {
        alert('حدث خطأ أثناء إضافة مستحقات المورد السابقة');
        return;
      }
    }

    setIsAddDebtOpen(false);
    setSelectedAddDebtEntity(null);
    setAddDebtAmount('');
    setAddDebtSearch('');
  };

  const exportExcel = () => {
    const wsData = [
      [`تقرير حسابات الآجل - ${activeTab === 'customers' ? 'مديونية العملاء' : 'مستحقات الموردين'}`, '', '', ''],
      ['التاريخ', new Date().toLocaleDateString(), '', ''],
      [''],
      ['الاسم', 'رقم الهاتف', activeTab === 'customers' ? 'مديونية العميل' : 'مستحقات المورد', activeTab === 'customers' ? 'عدد الفواتير' : 'عدد فواتير الشراء'],
      ...displayList.map((item: any) => [
        item.name,
        item.phone || '—',
        item.totalDebt,
        activeTab === 'customers' ? item.orders.length : item.invoices.length
      ])
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Debts');
    XLSX.writeFile(wb, `deferred_accounts_${activeTab}_${new Date().toLocaleDateString()}.xlsx`);
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
      
      pdf.save(`deferred_accounts_report_${activeTab}_${new Date().toLocaleDateString()}.pdf`);
    } catch (error) {
      console.error('PDF Export Error:', error);
      alert('حدث خطأ أثناء تصدير ملف PDF');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (entity: any) => {
    setSelectedEntity(entity);
    setPaymentForm({
      cash: entity.totalDebt.toString(),
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

    if (totalPaid <= 0 || !selectedEntity) {
      alert('الرجاء إدخال مبلغ صحيح');
      return;
    }
    
    if (totalPaid > selectedEntity.totalDebt + 1) { // +1 for small rounding issues
      alert('المبلغ المدفوع أكبر من إجمالي الدين');
      return;
    }

    try {
      if (activeTab === 'customers') {
        const invoiceId = await checkout(
          0, 
          { name: selectedEntity.name, phone: selectedEntity.phone, custom_id: selectedEntity.custom_id }, 
          totalPaid, 
          'payment',
          getPrimaryPaymentMethod(cash, visa, wallet, insta),
          { cash, visa, wallet, instapay: insta }
        );
        alert(`تم تسجيل تحصيل من العميل بنجاح!\nرقم الإيصال: ${invoiceId}`);
      } else {
        const invoiceNum = `PAY-DEBT-${Date.now()}`;
        await addPurchaseInvoice({
          invoice_number: invoiceNum,
          supplier_id: selectedEntity.id,
          total: 0,
          paid_amount: totalPaid,
          payment_method: getPrimaryPaymentMethod(cash, visa, wallet, insta)
        }, [], {
          cash,
          visa,
          wallet,
          instapay: insta
        });
        alert(`تم تسجيل سداد للمورد بنجاح!\nرقم الإيصال: ${invoiceNum}`);
      }
      
      setIsModalOpen(false);
      setSelectedEntity(null);
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
            حسابات الآجل
          </h1>
          <p className="text-slate-500 mt-2">إدارة مديونية العملاء وتحصيلها، ومستحقات الموردين وسدادها</p>
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex bg-slate-200/50 p-1 rounded-xl self-end">
            <button
              onClick={() => setActiveTab('customers')}
              className={`px-6 py-2 rounded-lg font-bold text-sm transition-all ${activeTab === 'customers' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              مديونية العملاء
            </button>
            <button
              onClick={() => setActiveTab('suppliers')}
              className={`px-6 py-2 rounded-lg font-bold text-sm transition-all ${activeTab === 'suppliers' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              مستحقات الموردين
            </button>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={handleOpenAddDebtModal}
              style={{ backgroundColor: storeSettings.themeColor }}
              className="flex items-center gap-2 text-white px-5 py-2.5 rounded-xl font-bold hover:opacity-90 transition shadow-lg shrink-0"
            >
              <Plus size={18} /> إضافة {activeTab === 'customers' ? 'مديونية عميل سابقة' : 'مستحقات مورد سابقة'}
            </button>
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
            <div className="relative w-full md:w-80">
              <Search className="absolute right-4 top-3.5 text-slate-400" size={20} />
              <input
                type="text"
                placeholder={`ابحث برقم الهاتف أو اسم ${activeTab === 'customers' ? 'العميل' : 'المورد'}...`}
                className="w-full bg-white border border-slate-200 rounded-2xl py-3 pr-12 pl-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      <div id="deferred-table" className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right" dir="rtl">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-sm">
              <tr>
                <th className="py-4 px-6 font-bold">{activeTab === 'customers' ? 'اسم العميل' : 'اسم المورد'}</th>
                <th className="py-4 px-6 font-bold">رقم الهاتف</th>
                <th className="py-4 px-6 font-bold">الفواتير المعلقة</th>
                <th className="py-4 px-6 font-bold">{activeTab === 'customers' ? 'مديونية العميل' : 'مستحقات المورد'}</th>
                <th className="py-4 px-6 font-bold text-left">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayList.length > 0 ? (
                displayList.map((entity: any) => (
                  <tr key={entity.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-4 px-6 font-bold text-slate-800">{entity.name}</td>
                    <td className="py-4 px-6 font-mono text-slate-600" dir="ltr">{entity.phone || '—'}</td>
                    <td className="py-4 px-6">
                      <div className="flex flex-wrap gap-2">
                        {(entity.orders || entity.invoices).slice(0, 3).map((o: any) => (
                          <span key={o.id} className="bg-slate-100 text-slate-600 text-xs px-2 py-1 rounded-md font-mono">
                            #{o.id || o.invoice_number}
                          </span>
                        ))}
                        {(entity.orders || entity.invoices).length > 3 && (
                          <span className="text-xs text-slate-400">+{(entity.orders || entity.invoices).length - 3} فواتير أخرى</span>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-red-600 font-black text-lg bg-red-50 px-3 py-1 rounded-xl block w-max">
                        {entity.totalDebt.toFixed(2)} <span className="text-xs">{storeSettings.currency}</span>
                      </span>
                    </td>
                    <td className="py-4 px-6 text-left">
                      <button 
                        onClick={() => handleOpenModal(entity)}
                        style={{ backgroundColor: storeSettings.themeColor + '15', color: storeSettings.themeColor }}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all hover:bg-opacity-25"
                      >
                        <CreditCard size={18} /> {activeTab === 'customers' ? 'تحصيل من العميل' : 'سداد للمورد'}
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    <BookUser size={48} className="mx-auto mb-4 opacity-50" />
                    لا يوجد {activeTab === 'customers' ? 'عملاء عليهم مديونية' : 'موردين لهم مستحقات'} حالياً
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment Modal */}
      {isModalOpen && selectedEntity && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div 
              style={{ background: `linear-gradient(160deg, ${storeSettings.themeColor} 0%, ${storeSettings.themeColor}dd 100%)` }}
              className="p-6 text-white flex justify-between items-center"
            >
              <h2 className="text-xl font-black flex items-center gap-2 drop-shadow">
                <Banknote /> {activeTab === 'customers' ? 'تحصيل من العميل' : 'سداد للمورد'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="hover:bg-white/20 p-2 rounded-xl transition">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-5">
              <div className="flex flex-col items-center bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div className="text-sm font-bold text-slate-500 mb-1">{activeTab === 'customers' ? 'مديونية العميل' : 'مستحقات المورد'}</div>
                <div className="text-3xl font-black text-red-600">{selectedEntity.totalDebt.toFixed(2)} <span className="text-lg">{storeSettings.currency}</span></div>
                <div className="mt-2 text-sm font-semibold">{selectedEntity.name} - <span dir="ltr">{selectedEntity.phone || '—'}</span></div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 text-center py-2 bg-indigo-50 rounded-xl mb-2">
                  <span className="text-xs font-bold text-indigo-400">{activeTab === 'customers' ? 'توزيع مبلغ التحصيل' : 'توزيع مبلغ السداد'}</span>
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
                <span className="text-slate-400 text-xs font-bold block mb-1">{activeTab === 'customers' ? 'إجمالي المبلغ المحصل' : 'إجمالي المبلغ المدفوع'}</span>
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
                  {activeTab === 'customers' ? 'إتمام التحصيل' : 'إتمام السداد'}
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

      {/* Add Debt Modal */}
      {isAddDebtOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div 
              style={{ background: `linear-gradient(160deg, ${storeSettings.themeColor} 0%, ${storeSettings.themeColor}dd 100%)` }}
              className="p-6 text-white flex justify-between items-center"
            >
              <h2 className="text-xl font-black flex items-center gap-2 drop-shadow">
                <UserPlus /> إضافة {activeTab === 'customers' ? 'مديونية عميل سابقة' : 'مستحقات مورد سابقة'}
              </h2>
              <button onClick={() => setIsAddDebtOpen(false)} className="hover:bg-white/20 p-2 rounded-xl transition">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-5">
              {/* Entity selection */}
              <div className="relative">
                <label className="block text-sm font-bold text-slate-700 mb-2">اختر {activeTab === 'customers' ? 'العميل' : 'المورد'}</label>
                {selectedAddDebtEntity ? (
                  <div className="flex items-center justify-between bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-inner">
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-800">{selectedAddDebtEntity.name}</span>
                      <span className="text-xs text-slate-500 font-mono" dir="ltr">{selectedAddDebtEntity.phone || '—'}</span>
                    </div>
                    <button 
                      onClick={() => setSelectedAddDebtEntity(null)}
                      className="text-red-500 hover:text-red-700 font-bold text-sm bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition"
                    >
                      تغيير
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder={`ابحث باسم ${activeTab === 'customers' ? 'العميل' : 'المورد'} أو رقم الموبايل...`}
                        className="w-full bg-white border border-slate-200 rounded-xl py-3.5 pr-4 pl-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                        value={addDebtSearch}
                        onChange={e => {
                          setAddDebtSearch(e.target.value);
                          setShowSuggestions(true);
                        }}
                        onFocus={() => setShowSuggestions(true)}
                      />
                    </div>
                    {showSuggestions && addDebtSearch.trim() && (
                      <div className="absolute right-0 left-0 mt-2 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden z-[60] animate-in slide-in-from-top-2 duration-150 max-h-56 overflow-y-auto">
                        {(activeTab === 'customers' ? filteredSearchCustomers : filteredSearchSuppliers).length > 0 ? (
                          (activeTab === 'customers' ? filteredSearchCustomers : filteredSearchSuppliers).map((item: any) => (
                            <button
                              key={item.id}
                              onClick={() => {
                                setSelectedAddDebtEntity(item);
                                setShowSuggestions(false);
                              }}
                              className="w-full p-3 text-right hover:bg-indigo-50 flex items-center justify-between border-b border-slate-100 last:border-0"
                            >
                              <div className="flex flex-col items-start text-right">
                                <span className="font-bold text-slate-800 text-sm">{item.name}</span>
                                <span className="text-xs text-slate-500 font-mono">{item.phone || '—'}</span>
                              </div>
                              {activeTab === 'customers' ? <User size={16} className="text-slate-400" /> : <Truck size={16} className="text-slate-400" />}
                            </button>
                          ))
                        ) : (
                          <div className="p-4 text-center text-slate-400 text-xs text-right">
                            <p>لا يوجد نتائج تطابق بحثك</p>
                            <button 
                              className="mt-2 text-indigo-600 font-bold hover:underline"
                              onClick={() => {
                                // For unknown, just let them submit with the text as name
                                setShowSuggestions(false);
                              }}
                            >
                              الاستمرار بالاسم "{addDebtSearch}"
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                    {showSuggestions && (
                      <div className="fixed inset-0 z-[55]" onClick={() => setShowSuggestions(false)} />
                    )}
                  </>
                )}
              </div>

              {/* Debt amount */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">{activeTab === 'customers' ? 'رصيد مديونية العميل القديم' : 'رصيد مستحقات المورد القديم'}</label>
                <div className="relative">
                  <input
                    type="number"
                    dir="ltr"
                    className="w-full border border-slate-200 rounded-xl py-4 px-4 text-xl font-black text-center focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner"
                    value={addDebtAmount}
                    onChange={(e) => setAddDebtAmount(e.target.value)}
                    placeholder="0.00"
                    min={1}
                  />
                  <div className="absolute left-4 top-4 text-slate-400 font-bold">{storeSettings.currency}</div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleProcessAddDebt}
                  style={{ backgroundColor: storeSettings.themeColor, boxShadow: `0 4px 12px ${storeSettings.themeColor}40` }}
                  className="flex-1 text-white py-4 rounded-xl font-bold transition-all hover:bg-opacity-90"
                >
                  إضافة {activeTab === 'customers' ? 'المديونية' : 'المستحقات'}
                </button>
                <button
                  onClick={() => setIsAddDebtOpen(false)}
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
