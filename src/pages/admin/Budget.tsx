import { useState, useMemo } from 'react';
import { useStore } from '../../store/useStore';
import { calculateInvoiceProfit } from '../../utils/invoiceProfit';
import { allocatePayment } from '../../utils/paymentAllocator';
import { 
  TrendingUp, TrendingDown, DollarSign, Activity, Filter, 
  Calendar, FileText, Banknote, CreditCard, Smartphone, Zap
} from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface UnifiedTransaction {
  id: string;
  originalId: string;
  type: 'revenue' | 'expense';
  category: string;
  description: string;
  amount: number;
  payment_method: 'cash' | 'visa' | 'wallet' | 'instapay';
  date: Date;
}

export default function Budget() {
  const { orders, expenses, purchaseInvoices, employeeTransactions, storeSettings } = useStore();
  
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'month' | 'custom_month' | 'year' | 'custom_year' | 'custom'>('month');
  const [customDate, setCustomDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [customMonth, setCustomMonth] = useState<string>(new Date().toISOString().slice(0, 7));
  const [customYear, setCustomYear] = useState<string>(new Date().getFullYear().toString());
  const [methodFilter, setMethodFilter] = useState<'all' | 'cash' | 'visa' | 'wallet' | 'instapay'>('all');
  const [isExporting, setIsExporting] = useState(false);

  const exportToPDF = async () => {
    const element = document.getElementById('budget-report');
    if (!element) return;
    
    setIsExporting(true);
    
    const buttons = element.querySelectorAll('.export-hide');
    buttons.forEach((b: any) => b.style.display = 'none');
    
    try {
      const canvas = await html2canvas(element, { 
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight,
        onclone: (clonedDoc) => {
          const el = clonedDoc.getElementById('budget-report');
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
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;
      
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
      heightLeft -= pdfHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
        heightLeft -= pdfHeight;
      }

      pdf.save(`Budget_Report_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error(error);
      alert('حدث خطأ أثناء تصدير التقرير');
    } finally {
      buttons.forEach((b: any) => b.style.display = '');
      setIsExporting(false);
    }
  };

  // Aggregation Logic
  const allTransactions = useMemo(() => {
    const txs: UnifiedTransaction[] = [];

    // Helper to add split transactions by payment method
    const addSplits = (
      id: string, type: 'revenue' | 'expense', category: string, desc: string, dateStr: string,
      cash: number, visa: number, wallet: number, instapay: number
    ) => {
      const date = new Date(dateStr);
      if (cash > 0) txs.push({ id: `${id}-cash`, originalId: id, type, category, description: desc, amount: cash, payment_method: 'cash', date });
      if (visa > 0) txs.push({ id: `${id}-visa`, originalId: id, type, category, description: desc, amount: visa, payment_method: 'visa', date });
      if (wallet > 0) txs.push({ id: `${id}-wallet`, originalId: id, type, category, description: desc, amount: wallet, payment_method: 'wallet', date });
      if (instapay > 0) txs.push({ id: `${id}-instapay`, originalId: id, type, category, description: desc, amount: instapay, payment_method: 'instapay', date });
    };

    // 1. Orders (Sales revenues & Debt payments & Refunds)
    orders.filter((order) => !order.is_deleted).forEach(o => {
      // Revenues: payments received
      if (o.paid_amount > 0) {
        const cat = o.type === 'sale' ? 'مبيعات كاشير' : 'تحصيل من العميل';
        const desc = o.type === 'sale' ? `فاتورة مبيعات #${o.id}` : `تحصيل من العميل #${o.id}`;
        addSplits(o.id, 'revenue', cat, desc, o.date, o.paid_cash, o.paid_visa, o.paid_wallet, o.paid_instapay);
      }

      // Expenses: Returns refunded amount (usually cash)
      // Since order items track refunds, let's sum them
      const totalRefunded = o.items?.reduce((sum, item) => sum + (item.refunded_amount || 0), 0) || 0;
      if (totalRefunded > 0) {
        // We assume refunds are cash. If multiple methods were supported in returns we'd split it.
        txs.push({
          id: `${o.id}-refund`,
          originalId: o.id,
          type: 'expense',
          category: 'مرتجعات عملاء',
          description: `إرجاع للفاتورة #${o.id}`,
          amount: totalRefunded,
          payment_method: 'cash', // default assumption for returns
          date: new Date(o.date) // Should ideally be the return date, but order date is fallback. Usually they happen same day or we don't have return date stored in this basic schema.
        });
      }
    });

    // 2. Manual finance transactions (store expenses and extra revenues)
    expenses.forEach(e => {
      const isRevenue = e.amount < 0;
      addSplits(
        e.id,
        isRevenue ? 'revenue' : 'expense',
        `${isRevenue ? 'إيرادات' : 'مصروفات'} - ${e.category}`,
        e.note || (isRevenue ? 'إيراد عام' : 'مصروف عام'),
        e.date,
        Math.abs(e.paid_cash || 0),
        Math.abs(e.paid_visa || 0),
        Math.abs(e.paid_wallet || 0),
        Math.abs(e.paid_instapay || 0)
      );
    });

    const hasMatchingExpense = (et: typeof employeeTransactions[number]) => {
      const etDate = new Date(et.created_at).toISOString().slice(0, 10);
      return expenses.some(e => {
        const expenseDate = new Date(e.date).toISOString().slice(0, 10);
        return e.category === 'رواتب'
          && expenseDate === etDate
          && Math.abs(e.amount) === Math.abs(et.amount)
          && Math.abs(e.paid_cash || 0) === Math.abs(et.paid_cash || 0)
          && Math.abs(e.paid_visa || 0) === Math.abs(et.paid_visa || 0)
          && Math.abs(e.paid_wallet || 0) === Math.abs(et.paid_wallet || 0)
          && Math.abs(e.paid_instapay || 0) === Math.abs(et.paid_instapay || 0);
      });
    };

    // 3. Purchase Invoices (Purchases & Supplier payments)
    purchaseInvoices.forEach(p => {
      if (p.paid_amount > 0) {
        addSplits(p.id, 'expense', p.total === 0 ? 'سداد للمورد' : 'مشتريات وموردين', `${p.total === 0 ? 'سداد للمورد' : 'فاتورة مشتريات'} #${p.invoice_number}`, p.created_at, p.paid_cash, p.paid_visa, p.paid_wallet, p.paid_instapay);
      }
    });

    // 4. Employee Transactions (Salaries & Advances)
    employeeTransactions.forEach(et => {
      if (hasMatchingExpense(et)) return;
      const cat = et.type === 'salary' ? 'رواتب' : 'سلف موظفين';
      addSplits(et.id, 'expense', `رواتب وموظفين - ${cat}`, et.note || `دفع ${cat}`, et.created_at, et.paid_cash, et.paid_visa, et.paid_wallet, et.paid_instapay);
    });

    // Sort by date descending
    return txs.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [orders, expenses, purchaseInvoices, employeeTransactions]);

  // Filtering Logic
  const filteredTransactions = useMemo(() => {
    let result = allTransactions;

    // Date Filter
    if (dateFilter !== 'all') {
      const now = new Date();
      result = result.filter(tx => {
        if (dateFilter === 'today') {
          return tx.date.toDateString() === now.toDateString();
        } else if (dateFilter === 'month') {
          return tx.date.getMonth() === now.getMonth() && tx.date.getFullYear() === now.getFullYear();
        } else if (dateFilter === 'year') {
          return tx.date.getFullYear() === now.getFullYear();
        } else if (dateFilter === 'custom') {
          const txYear = tx.date.getFullYear();
          const txMonth = String(tx.date.getMonth() + 1).padStart(2, '0');
          const txDay = String(tx.date.getDate()).padStart(2, '0');
          const txDateStr = `${txYear}-${txMonth}-${txDay}`;
          return txDateStr === customDate;
        } else if (dateFilter === 'custom_month') {
          const txYear = tx.date.getFullYear();
          const txMonth = String(tx.date.getMonth() + 1).padStart(2, '0');
          return `${txYear}-${txMonth}` === customMonth;
        } else if (dateFilter === 'custom_year') {
          return tx.date.getFullYear().toString() === customYear;
        }
        return true;
      });
    }

    // Method Filter
    if (methodFilter !== 'all') {
      result = result.filter(tx => tx.payment_method === methodFilter);
    }

    return result;
  }, [allTransactions, dateFilter, methodFilter, customDate, customMonth, customYear]);

  // Stats Logic
  const stats = useMemo(() => {
    let totalRevenue = 0;
    let totalExpense = 0;
    let collectedFromInvoices = 0;
    let collectedFromOther = 0;

    filteredTransactions.forEach(tx => {
      if (tx.type === 'revenue') {
        totalRevenue += tx.amount;
        if (tx.category === 'مبيعات كاشير') {
          collectedFromInvoices += tx.amount;
        } else if (tx.category === 'تحصيل من العميل') {
          const origOrder = orders.find((o: any) => o.id === tx.id);
          if (origOrder) {
            const { toSales, toOldDebt } = allocatePayment(origOrder, orders);
            collectedFromInvoices += toSales;
            collectedFromOther += toOldDebt;
          } else {
            collectedFromOther += tx.amount;
          }
        } else {
          collectedFromOther += tx.amount;
        }
      }
      else if (tx.type === 'expense') totalExpense += tx.amount;
    });

    const orderMatchesDateFilter = (date: Date) => {
      if (dateFilter === 'all') return true;
      const now = new Date();
      if (dateFilter === 'today') {
        return date.toDateString() === now.toDateString();
      }
      if (dateFilter === 'month') {
        return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
      }
      if (dateFilter === 'year') {
        return date.getFullYear() === now.getFullYear();
      }
      if (dateFilter === 'custom') {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}` === customDate;
      }
      if (dateFilter === 'custom_month') {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        return `${year}-${month}` === customMonth;
      }
      if (dateFilter === 'custom_year') {
        return date.getFullYear().toString() === customYear;
      }
      return true;
    };

    const getInvoiceProfitByMethod = (order: any) => {
      const profit = calculateInvoiceProfit(order);
      if (methodFilter === 'all') return profit;

      const paidAmount = Number(order.paid_amount) || 0;
      if (paidAmount <= 0) return 0;

      const methodAmount = Number(order[`paid_${methodFilter}`]) || 0;
      return profit * (methodAmount / paidAmount);
    };

    const invoiceProfit = orders
      .filter(order => orderMatchesDateFilter(new Date(order.date)))
      .reduce((sum, order) => sum + getInvoiceProfitByMethod(order), 0);

    return {
      totalRevenue,
      totalExpense,
      invoiceProfit,
      collectedFromInvoices,
      collectedFromOther,
      netProfit: totalRevenue - totalExpense,
      count: filteredTransactions.length
    };
  }, [filteredTransactions, orders, dateFilter, customDate, customMonth, customYear, methodFilter]);

  const totalCustomerDebt = useMemo(() => {
    return Math.max(0, orders.filter(o => !o.is_deleted).reduce((sum, o) => sum + (o.total - o.paid_amount), 0));
  }, [orders]);

  const totalSupplierDebt = useMemo(() => {
    return Math.max(0, purchaseInvoices.reduce((sum, inv) => sum + (inv.total - inv.paid_amount), 0));
  }, [purchaseInvoices]);

  const getMethodIcon = (method: string) => {
    switch (method) {
      case 'cash': return <Banknote size={16} className="text-emerald-500" />;
      case 'visa': return <CreditCard size={16} className="text-blue-500" />;
      case 'wallet': return <Smartphone size={16} className="text-purple-500" />;
      case 'instapay': return <Zap size={16} className="text-yellow-500" />;
      default: return <Banknote size={16} />;
    }
  };

  const getMethodName = (method: string) => {
    switch (method) {
      case 'cash': return 'كاش';
      case 'visa': return 'فيزا';
      case 'wallet': return 'محفظة';
      case 'instapay': return 'انستاباي';
      default: return method;
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-8 animate-fade-in" id="budget-report">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800 dark:text-white flex items-center gap-3">
            <Activity className="text-indigo-600" size={32} />
            الميزانية العامة
          </h1>
          <p className="text-slate-500 mt-2 font-medium">ملخص الأرباح والمصروفات وحركة الخزينة الشاملة</p>
        </div>

        {/* Filters and Actions */}
        <div className="flex items-center gap-3">
          <div className="export-hide">
            <button 
              onClick={exportToPDF}
              disabled={isExporting}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition shadow-sm border ${
                isExporting ? 'bg-slate-100 text-slate-400 border-slate-200' : 'bg-red-50 text-red-600 hover:bg-red-100 border-red-100'
              }`}
              title="تصدير كملف PDF"
            >
              <FileText size={18} />
              {isExporting ? 'جاري التصدير...' : 'تصدير PDF'}
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-slate-800 p-2 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 export-hide">
          <div className="flex items-center gap-2 border-l border-slate-200 dark:border-slate-700 pl-3">
            <Calendar size={18} className="text-slate-400" />
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as any)}
              className="bg-transparent text-sm font-bold text-slate-700 dark:text-slate-200 focus:outline-none"
            >
              <option value="today">اليوم</option>
              <option value="month">الشهر الحالي</option>
              <option value="custom_month">شهر محدد</option>
              <option value="year">السنة الحالية</option>
              <option value="custom_year">سنة محددة</option>
              <option value="all">كل الأوقات</option>
              <option value="custom">يوم محدد</option>
            </select>
            {dateFilter === 'custom' && (
              <input 
                type="date" 
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                className="bg-transparent text-sm font-bold text-indigo-600 dark:text-indigo-400 focus:outline-none ml-2"
              />
            )}
            {dateFilter === 'custom_month' && (
              <input 
                type="month" 
                value={customMonth}
                onChange={(e) => setCustomMonth(e.target.value)}
                className="bg-transparent text-sm font-bold text-indigo-600 dark:text-indigo-400 focus:outline-none ml-2"
              />
            )}
            {dateFilter === 'custom_year' && (
              <input 
                type="number" 
                value={customYear}
                onChange={(e) => setCustomYear(e.target.value)}
                className="bg-transparent text-sm font-bold text-indigo-600 dark:text-indigo-400 focus:outline-none ml-2 w-20"
                placeholder="2026"
                min="2020"
                max="2100"
              />
            )}
          </div>
          <div className="flex items-center gap-2 pr-2">
            <Filter size={18} className="text-slate-400" />
            <select
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value as any)}
              className="bg-transparent text-sm font-bold text-slate-700 dark:text-slate-200 focus:outline-none"
            >
              <option value="all">كل طرق الدفع</option>
              <option value="cash">كاش</option>
              <option value="visa">فيزا</option>
              <option value="wallet">محافظ إلكترونية</option>
              <option value="instapay">انستاباي</option>
            </select>
          </div>
          </div>
        </div>
      </div>

      {/* New Breakdown Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 rounded-2xl flex items-center justify-center">
              <DollarSign size={24} />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-500">المحصل من الفواتير</p>
              <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                {stats.collectedFromInvoices.toFixed(2)} <span className="text-xs text-slate-400">{storeSettings.currency}</span>
              </h3>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 rounded-2xl flex items-center justify-center">
              <TrendingUp size={24} />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-500">إيرادات أخرى ومسدد آجل</p>
              <h3 className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1">
                {stats.collectedFromOther.toFixed(2)} <span className="text-xs text-slate-400">{storeSettings.currency}</span>
              </h3>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/50 text-amber-600 rounded-2xl flex items-center justify-center">
              <Activity size={24} />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-500">إجمالي الآجل على العملاء</p>
              <h3 className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
                {totalCustomerDebt.toFixed(2)} <span className="text-xs text-slate-400">{storeSettings.currency}</span>
              </h3>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-red-100 dark:bg-red-900/50 text-red-600 rounded-2xl flex items-center justify-center">
              <FileText size={24} />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-500">إجمالي المديونية للموردين</p>
              <h3 className="text-2xl font-black text-red-600 dark:text-red-400 mt-1">
                {totalSupplierDebt.toFixed(2)} <span className="text-xs text-slate-400">{storeSettings.currency}</span>
              </h3>
            </div>
          </div>
        </div>
      </div>

      {/* Main Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-6">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 rounded-2xl flex items-center justify-center">
              <TrendingUp size={24} />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-500">إجمالي الإيرادات</p>
              <h3 className="text-2xl font-black text-slate-800 dark:text-white mt-1">{stats.totalRevenue.toFixed(2)}</h3>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-red-100 dark:bg-red-900/50 text-red-600 rounded-2xl flex items-center justify-center">
              <TrendingDown size={24} />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-500">إجمالي المصروفات</p>
              <h3 className="text-2xl font-black text-slate-800 dark:text-white mt-1">{stats.totalExpense.toFixed(2)}</h3>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 rounded-2xl flex items-center justify-center">
              <FileText size={24} />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-500">إجمالي الربح من الفواتير</p>
              <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{stats.invoiceProfit.toFixed(2)}</h3>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 relative overflow-hidden group">
          <div className={`absolute inset-0 opacity-10 transition-opacity group-hover:opacity-20 ${stats.netProfit >= 0 ? 'bg-emerald-500' : 'bg-red-500'}`} />
          <div className="flex items-center gap-4 mb-4 relative z-10">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg ${stats.netProfit >= 0 ? 'bg-emerald-500' : 'bg-red-500'}`}>
              <DollarSign size={24} />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-500">صافي حركة الخزنة</p>
              <h3 className={`text-2xl font-black mt-1 ${stats.netProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                {stats.netProfit.toFixed(2)}
              </h3>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 rounded-2xl flex items-center justify-center">
              <FileText size={24} />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-500">العمليات التي تمت</p>
              <h3 className="text-2xl font-black text-slate-800 dark:text-white mt-1">{stats.count} <span className="text-sm text-slate-500 font-bold">معاملة</span></h3>
            </div>
          </div>
        </div>
      </div>

      {/* Balance Sheet Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Revenues Table */}
        <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col">
          <div className="p-6 border-b border-emerald-100 dark:border-emerald-900/30 bg-emerald-50/50 dark:bg-emerald-900/10">
            <h2 className="text-xl font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
              <TrendingUp size={24} />
              الإيرادات
            </h2>
          </div>
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-right">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 font-bold text-sm">
                  <th className="px-4 py-3">التاريخ</th>
                  <th className="px-4 py-3">التصنيف</th>
                  <th className="px-4 py-3">الدفع</th>
                  <th className="px-4 py-3 text-left">القيمة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredTransactions.filter(tx => tx.type === 'revenue').length > 0 ? (
                  filteredTransactions.filter(tx => tx.type === 'revenue').map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                            {tx.date.toLocaleDateString('ar-SA')}
                          </span>
                          <span className="text-xs text-slate-500">
                            {tx.date.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-700 dark:text-slate-300 text-sm">{tx.category}</span>
                          <span className="text-xs text-slate-500 max-w-[120px] truncate" title={tx.description}>{tx.description}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {getMethodIcon(tx.payment_method)}
                          <span className="font-bold text-slate-700 dark:text-slate-300 text-xs">
                            {getMethodName(tx.payment_method)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-left">
                        <span className="font-black text-emerald-600 dark:text-emerald-400">
                          + {tx.amount.toFixed(2)}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-4 py-12 text-center text-slate-500">
                      <p className="font-bold">لا توجد إيرادات</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Expenses Table */}
        <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col">
          <div className="p-6 border-b border-red-100 dark:border-red-900/30 bg-red-50/50 dark:bg-red-900/10">
            <h2 className="text-xl font-bold text-red-700 dark:text-red-400 flex items-center gap-2">
              <TrendingDown size={24} />
              المصروفات
            </h2>
          </div>
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-right">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 font-bold text-sm">
                  <th className="px-4 py-3">التاريخ</th>
                  <th className="px-4 py-3">التصنيف</th>
                  <th className="px-4 py-3">الدفع</th>
                  <th className="px-4 py-3 text-left">القيمة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredTransactions.filter(tx => tx.type === 'expense').length > 0 ? (
                  filteredTransactions.filter(tx => tx.type === 'expense').map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                            {tx.date.toLocaleDateString('ar-SA')}
                          </span>
                          <span className="text-xs text-slate-500">
                            {tx.date.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-700 dark:text-slate-300 text-sm">{tx.category}</span>
                          <span className="text-xs text-slate-500 max-w-[120px] truncate" title={tx.description}>{tx.description}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {getMethodIcon(tx.payment_method)}
                          <span className="font-bold text-slate-700 dark:text-slate-300 text-xs">
                            {getMethodName(tx.payment_method)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-left">
                        <span className="font-black text-red-600 dark:text-red-400">
                          - {tx.amount.toFixed(2)}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-4 py-12 text-center text-slate-500">
                      <p className="font-bold">لا توجد مصروفات</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
