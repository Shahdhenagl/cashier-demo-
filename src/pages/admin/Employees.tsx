import { useState } from 'react';
import { useStore, type Employee } from '../../store/useStore';
import { 
  Users, Plus, Trash2, Edit3, Search, X, 
  Wallet, Landmark, CreditCard, Zap, Phone,
  DollarSign, Clock, Briefcase
} from 'lucide-react';

export default function Employees() {
  const { 
    employees, employeeTransactions, storeSettings, 
    addEmployee, updateEmployee, deleteEmployee, addEmployeeTransaction 
  } = useStore();

  const [activeTab, setActiveTab] = useState<'employees' | 'transactions'>('employees');
  const [searchTerm, setSearchTerm] = useState('');
  const [showEmpModal, setShowEmpModal] = useState(false);
  const [showTransModal, setShowTransModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [transType, setTransType] = useState<'salary' | 'advance'>('advance');

  const [empFormData, setEmpFormData] = useState({
    name: '',
    phone: '',
    job_title: '',
    working_hours: '',
    monthly_salary: ''
  });

  const [transFormData, setTransFormData] = useState({
    amount: '',
    paid_cash: '',
    paid_visa: '',
    paid_wallet: '',
    paid_instapay: '',
    month: new Date().toISOString().slice(0, 7),
    dedDays: '',
    dedAmount: '',
    note: ''
  });

  // --- Calculations ---
  const tc = storeSettings.themeColor;

  const filteredEmployees = employees.filter(e => 
    e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.job_title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredTransactions = employeeTransactions
    .filter(t => {
      const emp = employees.find(e => e.id === t.employee_id);
      return emp?.name.toLowerCase().includes(searchTerm.toLowerCase());
    })
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const getMonthlyAdvances = (empId: string, month: string) => {
    return employeeTransactions
      .filter(t => t.employee_id === empId && t.type === 'advance' && t.month === month)
      .reduce((sum, t) => sum + t.amount, 0);
  };

  // --- Handlers ---
  const handleOpenEmpModal = (emp: Employee | null = null) => {
    if (emp) {
      setEditingEmployee(emp);
      setEmpFormData({
        name: emp.name,
        phone: emp.phone || '',
        job_title: emp.job_title,
        working_hours: emp.working_hours,
        monthly_salary: emp.monthly_salary.toString()
      });
    } else {
      setEditingEmployee(null);
      setEmpFormData({ name: '', phone: '', job_title: '', working_hours: '', monthly_salary: '' });
    }
    setShowEmpModal(true);
  };

  const handleEmpSubmit = async () => {
    if (!empFormData.name || !empFormData.monthly_salary) return alert('يرجى إكمال البيانات الأساسية');
    
    const data = {
      name: empFormData.name,
      phone: empFormData.phone,
      job_title: empFormData.job_title,
      working_hours: empFormData.working_hours,
      monthly_salary: parseFloat(empFormData.monthly_salary) || 0
    };

    if (editingEmployee) {
      await updateEmployee(editingEmployee.id, data);
    } else {
      await addEmployee(data);
    }
    setShowEmpModal(false);
  };

  const handleOpenTransModal = (emp: Employee, type: 'salary' | 'advance') => {
    setSelectedEmployee(emp);
    setTransType(type);
    
    const currentMonth = new Date().toISOString().slice(0, 7);
    const advances = type === 'salary' ? getMonthlyAdvances(emp.id, currentMonth) : 0;
    const netAmount = type === 'salary' ? Math.max(0, emp.monthly_salary - advances) : '';

    setTransFormData({
      amount: netAmount.toString(),
      paid_cash: netAmount.toString(),
      paid_visa: '',
      paid_wallet: '',
      paid_instapay: '',
      month: currentMonth,
      dedDays: '',
      dedAmount: '',
      note: type === 'salary' ? `راتب شهر ${currentMonth}` : ''
    });
    setShowTransModal(true);
  };

  const handleTransSubmit = async () => {
    const cash = parseFloat(transFormData.paid_cash) || 0;
    const visa = parseFloat(transFormData.paid_visa) || 0;
    const wallet = parseFloat(transFormData.paid_wallet) || 0;
    const insta = parseFloat(transFormData.paid_instapay) || 0;
    const total = cash + visa + wallet + insta;

    if (total <= 0) return alert('يرجى إدخال مبلغ صحيح');

    await addEmployeeTransaction({
      employee_id: selectedEmployee!.id,
      amount: total,
      type: transType,
      payment_method: cash >= visa ? 'cash' : 'visa',
      paid_cash: cash,
      paid_visa: visa,
      paid_wallet: wallet,
      paid_instapay: insta,
      month: transFormData.month,
      deductions: (parseFloat(transFormData.dedAmount) || 0) + ((parseFloat(transFormData.dedDays) || 0) * (selectedEmployee!.monthly_salary / 30)),
      note: transFormData.note
    });

    setShowTransModal(false);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto h-[calc(100vh-2rem)] overflow-y-auto" dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8 bg-white p-6 rounded-[32px] shadow-sm border border-slate-100">
        <div>
          <h1 className="text-3xl font-black text-slate-800 flex items-center gap-3">
            <div className="p-2 bg-indigo-600 rounded-2xl text-white shadow-lg shadow-indigo-200">
              <Users size={28} />
            </div>
            إدارة الموظفين والرواتب
          </h1>
          <p className="text-slate-500 mt-2 font-medium">سجل الموظفين، الرواتب، والسلف الشهرية</p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="relative">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text"
              placeholder="بحث عن موظف..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-2xl pr-12 pl-4 py-3 focus:ring-2 focus:ring-indigo-500/20 outline-none font-medium w-64"
            />
          </div>
          
          <button 
            onClick={() => handleOpenEmpModal()}
            style={{ backgroundColor: tc }}
            className="flex items-center gap-2 text-white px-6 py-3 rounded-2xl font-bold hover:opacity-90 transition shadow-lg"
          >
            <Plus size={20} /> موظف جديد
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 bg-slate-100 p-1.5 rounded-2xl w-fit">
        <button 
          onClick={() => setActiveTab('employees')}
          className={`px-6 py-2.5 rounded-xl font-bold transition ${activeTab === 'employees' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          قائمة الموظفين
        </button>
        <button 
          onClick={() => setActiveTab('transactions')}
          className={`px-6 py-2.5 rounded-xl font-bold transition ${activeTab === 'transactions' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          سجل العمليات
        </button>
      </div>

      {activeTab === 'employees' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredEmployees.map(emp => {
            const currentMonth = new Date().toISOString().slice(0, 7);
            const advances = getMonthlyAdvances(emp.id, currentMonth);
            
            return (
              <div key={emp.id} className="bg-white rounded-[32px] p-6 shadow-sm border border-slate-100 hover:border-indigo-200 transition-all group">
                <div className="flex justify-between items-start mb-4">
                  <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-500 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                    <Briefcase size={28} />
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleOpenEmpModal(emp)} className="p-2 text-slate-400 hover:text-indigo-600 transition"><Edit3 size={18} /></button>
                    <button onClick={() => deleteEmployee(emp.id)} className="p-2 text-slate-400 hover:text-red-500 transition"><Trash2 size={18} /></button>
                  </div>
                </div>

                <h3 className="text-xl font-black text-slate-800 mb-1">{emp.name}</h3>
                <p className="text-slate-500 text-sm font-medium mb-4 flex flex-col gap-1">
                   <span>{emp.job_title || 'بدون مسمى وظيفي'}</span>
                   {emp.phone && <span className="text-indigo-600 flex items-center gap-1"><Phone size={12} /> {emp.phone}</span>}
                </p>

                <div className="space-y-3 mb-6">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400 flex items-center gap-1"><Clock size={14} /> المواعيد</span>
                    <span className="font-bold text-slate-700">{emp.working_hours || 'غير محدد'}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400 flex items-center gap-1"><DollarSign size={14} /> الراتب</span>
                    <span className="font-black text-slate-800">{emp.monthly_salary.toLocaleString()} {storeSettings.currency}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm p-3 bg-red-50 rounded-xl border border-red-100">
                    <span className="text-red-600 font-bold flex items-center gap-1">سلف الشهر</span>
                    <span className="font-black text-red-700">{advances.toLocaleString()} {storeSettings.currency}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => handleOpenTransModal(emp, 'advance')}
                    className="flex items-center justify-center gap-2 py-3 rounded-xl bg-slate-100 text-slate-700 font-bold hover:bg-slate-200 transition text-sm"
                  >
                    <Wallet size={16} /> صرف سلفة
                  </button>
                  <button 
                    onClick={() => handleOpenTransModal(emp, 'salary')}
                    style={{ backgroundColor: tc }}
                    className="flex items-center justify-center gap-2 py-3 rounded-xl text-white font-bold hover:opacity-90 transition shadow-md text-sm"
                  >
                    <Landmark size={16} /> صرف راتب
                  </button>
                </div>
              </div>
            );
          })}

          {filteredEmployees.length === 0 && (
            <div className="col-span-full py-20 text-center bg-white rounded-[32px] border border-dashed border-slate-200 opacity-50">
              <Users size={64} className="mx-auto mb-4 text-slate-300" />
              <p className="text-xl font-bold">لا يوجد موظفون مضافون بعد</p>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-[32px] shadow-sm border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right">
              <thead>
                <tr className="bg-slate-50/50 text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-100">
                  <th className="p-6">التاريخ</th>
                  <th className="p-6">الموظف</th>
                  <th className="p-6">النوع</th>
                  <th className="p-6">الشهر</th>
                  <th className="p-6">طريقة الدفع</th>
                  <th className="p-6 text-left">المبلغ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredTransactions.map(t => {
                  const emp = employees.find(e => e.id === t.employee_id);
                  return (
                    <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-6 text-slate-400 text-xs font-bold">{new Date(t.created_at).toLocaleDateString('ar-SA')}</td>
                      <td className="p-6 font-bold text-slate-800">{emp?.name || 'موظف محذوف'}</td>
                      <td className="p-6">
                        <span className={`px-2.5 py-1 rounded-lg font-bold text-[10px] ${
                          t.type === 'salary' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-amber-50 text-amber-600 border border-amber-100'
                        }`}>
                          {t.type === 'salary' ? 'راتب' : 'سلفة'}
                        </span>
                      </td>
                      <td className="p-6 text-slate-500 font-medium">{t.month}</td>
                      <td className="p-6">
                        <div className="flex flex-col gap-1">
                          {t.paid_cash > 0 && <span className="text-[10px] font-black text-emerald-600 flex items-center gap-1"><Landmark size={12} /> كاش: {t.paid_cash.toLocaleString()}</span>}
                          {t.paid_visa > 0 && <span className="text-[10px] font-black text-blue-600 flex items-center gap-1"><CreditCard size={12} /> فيزا: {t.paid_visa.toLocaleString()}</span>}
                          {t.paid_instapay > 0 && <span className="text-[10px] font-black text-amber-600 flex items-center gap-1"><Zap size={12} /> انستا: {t.paid_instapay.toLocaleString()}</span>}
                        </div>
                      </td>
                      <td className="p-6 text-left">
                        <div className="flex flex-col items-left">
                          <span className="font-black text-lg text-slate-800">
                            {t.amount.toLocaleString()} <span className="text-xs font-normal text-slate-400">{storeSettings.currency}</span>
                          </span>
                          {t.deductions > 0 && (
                            <span className="text-[10px] font-bold text-red-500">
                              خصومات: -{t.deductions.toLocaleString()}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Employee Modal */}
      {showEmpModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8 text-white flex justify-between items-center" style={{ backgroundColor: tc }}>
              <div>
                <h2 className="text-2xl font-black">{editingEmployee ? 'تعديل بيانات موظف' : 'إضافة موظف جديد'}</h2>
                <p className="text-white/70 text-sm mt-1">سجل بيانات الموظف والراتب الأساسي</p>
              </div>
              <button onClick={() => setShowEmpModal(false)} className="bg-white/10 p-2 rounded-full hover:bg-white/20 transition text-white"><X size={24} /></button>
            </div>
            <div className="p-8 space-y-6">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">اسم الموظف</label>
                <input 
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 focus:ring-2 focus:ring-indigo-500/20 outline-none font-bold"
                  value={empFormData.name}
                  onChange={e => setEmpFormData({...empFormData, name: e.target.value})}
                  placeholder="مثال: أحمد محمد"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">رقم الهاتف</label>
                <input 
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 focus:ring-2 focus:ring-indigo-500/20 outline-none font-bold"
                  value={empFormData.phone}
                  onChange={e => setEmpFormData({...empFormData, phone: e.target.value})}
                  placeholder="01xxxxxxxxx"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">المسمى الوظيفي</label>
                  <input 
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 focus:ring-2 focus:ring-indigo-500/20 outline-none font-bold"
                    value={empFormData.job_title}
                    onChange={e => setEmpFormData({...empFormData, job_title: e.target.value})}
                    placeholder="شيف، كاشير..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">مواعيد العمل</label>
                  <input 
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 focus:ring-2 focus:ring-indigo-500/20 outline-none font-bold"
                    value={empFormData.working_hours}
                    onChange={e => setEmpFormData({...empFormData, working_hours: e.target.value})}
                    placeholder="10ص - 10م"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">الراتب الشهري</label>
                <input 
                  type="number"
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 focus:ring-2 focus:ring-indigo-500/20 outline-none font-black text-xl"
                  value={empFormData.monthly_salary}
                  onChange={e => setEmpFormData({...empFormData, monthly_salary: e.target.value})}
                  placeholder="0.00"
                />
              </div>
              <button onClick={handleEmpSubmit} style={{ backgroundColor: tc }} className="w-full text-white py-5 rounded-2xl font-black text-lg shadow-xl hover:opacity-90 transition-all">
                {editingEmployee ? 'حفظ التعديلات' : 'إضافة الموظف'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transaction Modal (Salary/Advance) */}
      {showTransModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8 text-white flex justify-between items-center" style={{ backgroundColor: transType === 'salary' ? '#059669' : '#d97706' }}>
              <div>
                <h2 className="text-2xl font-black">{transType === 'salary' ? 'صرف راتب شهري' : 'صرف سلفة لموظف'}</h2>
                <p className="text-white/70 text-sm mt-1">{selectedEmployee?.name}</p>
              </div>
              <button onClick={() => setShowTransModal(false)} className="bg-white/10 p-2 rounded-full hover:bg-white/20 transition text-white"><X size={24} /></button>
            </div>
            
            <div className="p-8 space-y-6">
              {transType === 'salary' && (
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">الراتب الأساسي</p>
                    <p className="text-lg font-black text-slate-700">{selectedEmployee?.monthly_salary.toLocaleString()} {storeSettings.currency}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-red-400 uppercase">سلف الشهر (خصم)</p>
                    <p className="text-lg font-black text-red-600">-{getMonthlyAdvances(selectedEmployee!.id, transFormData.month).toLocaleString()} {storeSettings.currency}</p>
                  </div>
                </div>
              )}

              {transType === 'salary' && (
                <div className="space-y-4 bg-slate-50 p-6 rounded-[24px] border border-slate-100">
                  <p className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <Trash2 size={16} className="text-red-500" /> تطبيق خصومات إضافية
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">بعدد الأيام</label>
                      <input 
                        type="number" 
                        placeholder="0 يوم"
                        className="w-full bg-white border border-slate-200 rounded-xl p-3 outline-none font-bold" 
                        value={transFormData.dedDays} 
                        onChange={e => {
                          const days = e.target.value;
                          const dailyRate = selectedEmployee!.monthly_salary / 30;
                          const totalDed = (parseFloat(days) || 0) * dailyRate + (parseFloat(transFormData.dedAmount) || 0);
                          const advances = getMonthlyAdvances(selectedEmployee!.id, transFormData.month);
                          const net = Math.max(0, selectedEmployee!.monthly_salary - advances - totalDed);
                          setTransFormData({
                            ...transFormData, 
                            dedDays: days,
                            amount: net.toFixed(2),
                            paid_cash: net.toFixed(2),
                            paid_visa: '', paid_wallet: '', paid_instapay: ''
                          });
                        }} 
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">بمبلغ محدد</label>
                      <input 
                        type="number" 
                        placeholder="0.00"
                        className="w-full bg-white border border-slate-200 rounded-xl p-3 outline-none font-bold" 
                        value={transFormData.dedAmount} 
                        onChange={e => {
                          const amt = e.target.value;
                          const dailyRate = selectedEmployee!.monthly_salary / 30;
                          const totalDed = (parseFloat(transFormData.dedDays) || 0) * dailyRate + (parseFloat(amt) || 0);
                          const advances = getMonthlyAdvances(selectedEmployee!.id, transFormData.month);
                          const net = Math.max(0, selectedEmployee!.monthly_salary - advances - totalDed);
                          setTransFormData({
                            ...transFormData, 
                            dedAmount: amt,
                            amount: net.toFixed(2),
                            paid_cash: net.toFixed(2),
                            paid_visa: '', paid_wallet: '', paid_instapay: ''
                          });
                        }} 
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">الشهر المستهدف</label>
                  <input 
                    type="month"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 focus:ring-1 outline-none font-bold"
                    value={transFormData.month}
                    onChange={e => setTransFormData({...transFormData, month: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">المبلغ الإجمالي</label>
                  <input 
                    type="number"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 focus:ring-1 outline-none font-black text-indigo-600"
                    value={transFormData.amount}
                    onChange={e => setTransFormData({...transFormData, amount: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <p className="text-sm font-bold text-slate-700 border-b border-slate-100 pb-2">تفاصيل الدفع (طرق الدفع)</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">كاش</label>
                    <input type="number" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none font-bold" value={transFormData.paid_cash} onChange={e => setTransFormData({...transFormData, paid_cash: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">فيزا</label>
                    <input type="number" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none font-bold" value={transFormData.paid_visa} onChange={e => setTransFormData({...transFormData, paid_visa: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">محفظة</label>
                    <input type="number" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none font-bold" value={transFormData.paid_wallet} onChange={e => setTransFormData({...transFormData, paid_wallet: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">انستا باي</label>
                    <input type="number" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none font-bold" value={transFormData.paid_instapay} onChange={e => setTransFormData({...transFormData, paid_instapay: e.target.value})} />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">ملاحظات</label>
                <textarea 
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 h-20 outline-none font-medium resize-none"
                  value={transFormData.note}
                  onChange={e => setTransFormData({...transFormData, note: e.target.value})}
                  placeholder="اكتب ملاحظات إضافية..."
                />
              </div>

              <button 
                onClick={handleTransSubmit} 
                style={{ backgroundColor: transType === 'salary' ? '#059669' : '#d97706' }} 
                className="w-full text-white py-5 rounded-2xl font-black text-lg shadow-xl hover:opacity-90 transition-all"
              >
                تأكيد العملية
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
