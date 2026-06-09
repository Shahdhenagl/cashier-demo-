import React, { useState } from 'react';
import { useStore } from '../../store/useStore';
import { Package, AlertTriangle, Lightbulb, MessageSquare, CheckCircle, Trash2, Plus, MessageCircle } from 'lucide-react';

export default function Needs() {
  const [activeTab, setActiveTab] = useState<'needs' | 'suggestions' | 'notes'>('needs');
  
  const { 
    products, 
    productSuggestions, 
    accountantNotes,
    addProductSuggestion,
    markProductSuggestionPurchased,
    deleteProductSuggestion,
    addAccountantNote,
    markAccountantNoteRead,
    deleteAccountantNote,
    activeCashier
  } = useStore();

  // Suggestions State
  const [newSuggestionName, setNewSuggestionName] = useState('');
  const [newSuggestionNotes, setNewSuggestionNotes] = useState('');
  const [isAddingSuggestion, setIsAddingSuggestion] = useState(false);

  // Notes State
  const [newNoteText, setNewNoteText] = useState('');
  const [isAddingNote, setIsAddingNote] = useState(false);

  const outOfStock = products.filter(p => p.stock_quantity <= 0);
  const lowStock = products.filter(p => p.stock_quantity > 0 && p.stock_quantity <= 5);

  const handleAddSuggestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSuggestionName.trim()) return;
    setIsAddingSuggestion(true);
    await addProductSuggestion({
      name: newSuggestionName,
      notes: newSuggestionNotes,
    });
    setNewSuggestionName('');
    setNewSuggestionNotes('');
    setIsAddingSuggestion(false);
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteText.trim()) return;
    setIsAddingNote(true);
    await addAccountantNote({
      note: newNoteText,
      created_by: activeCashier?.name || 'Unknown',
    });
    setNewNoteText('');
    setIsAddingNote(false);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-800">النواقص والمقترحات</h1>
      </div>

      {/* Tabs */}
      <div className="flex bg-white rounded-xl p-1 shadow-sm mb-6 w-full max-w-2xl border border-slate-100">
        <button
          onClick={() => setActiveTab('needs')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'needs'
              ? 'bg-red-50 text-red-700 shadow-sm'
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
          }`}
        >
          <Package size={18} />
          <span>النواقص ({outOfStock.length + lowStock.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('suggestions')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'suggestions'
              ? 'bg-blue-50 text-blue-700 shadow-sm'
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
          }`}
        >
          <Lightbulb size={18} />
          <span>مقترحات العملاء</span>
        </button>
        <button
          onClick={() => setActiveTab('notes')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'notes'
              ? 'bg-amber-50 text-amber-700 shadow-sm'
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
          }`}
        >
          <MessageSquare size={18} />
          <span>ملاحظات المحاسبين</span>
        </button>
      </div>

      {/* Content */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        
        {/* Needs Tab */}
        {activeTab === 'needs' && (
          <div className="p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <AlertTriangle className="text-red-500" size={20} />
              منتجات نفدت تماماً
            </h2>
            {outOfStock.length === 0 ? (
              <p className="text-slate-500 text-sm mb-8">لا يوجد منتجات نفدت.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                {outOfStock.map(p => (
                  <div key={p.id} className="border border-red-100 bg-red-50/50 rounded-lg p-4 flex justify-between items-center">
                    <div>
                      <h3 className="font-medium text-slate-800">{p.name}</h3>
                      <p className="text-xs text-slate-500 mt-1">الباركود: {p.barcode}</p>
                    </div>
                    <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-1 rounded">نفد</span>
                  </div>
                ))}
              </div>
            )}

            <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Package className="text-orange-500" size={20} />
              منتجات أوشكت على النفاد
            </h2>
            {lowStock.length === 0 ? (
              <p className="text-slate-500 text-sm">لا يوجد منتجات أوشكت على النفاد.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {lowStock.map(p => (
                  <div key={p.id} className="border border-orange-100 bg-orange-50/50 rounded-lg p-4 flex justify-between items-center">
                    <div>
                      <h3 className="font-medium text-slate-800">{p.name}</h3>
                      <p className="text-xs text-slate-500 mt-1">الباركود: {p.barcode}</p>
                    </div>
                    <span className="bg-orange-100 text-orange-800 text-xs font-bold px-2 py-1 rounded">
                      باقي {p.stock_quantity}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Suggestions Tab */}
        {activeTab === 'suggestions' && (
          <div className="p-6">
            <div className="mb-8 bg-slate-50 p-4 rounded-xl border border-slate-100">
              <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <Plus size={16} /> إضافة مقترح جديد
              </h3>
              <form onSubmit={handleAddSuggestion} className="flex flex-col md:flex-row gap-3">
                <input
                  type="text"
                  placeholder="اسم المنتج المقترح"
                  value={newSuggestionName}
                  onChange={(e) => setNewSuggestionName(e.target.value)}
                  className="flex-1 rounded-lg border-slate-200 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
                <input
                  type="text"
                  placeholder="ملاحظات (اختياري)"
                  value={newSuggestionNotes}
                  onChange={(e) => setNewSuggestionNotes(e.target.value)}
                  className="flex-1 rounded-lg border-slate-200 focus:ring-blue-500 focus:border-blue-500"
                />
                <button
                  type="submit"
                  disabled={isAddingSuggestion || !newSuggestionName.trim()}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  إضافة
                </button>
              </form>
            </div>

            <div className="space-y-3">
              {productSuggestions.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <Lightbulb className="mx-auto h-12 w-12 text-slate-300 mb-3" />
                  <p>لا توجد مقترحات حالياً</p>
                </div>
              ) : (
                productSuggestions.map((s) => (
                  <div key={s.id} className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-lg hover:border-blue-300 transition-colors">
                    <div>
                      <h4 className="font-medium text-slate-800">{s.name}</h4>
                      {s.notes && <p className="text-sm text-slate-500 mt-1">{s.notes}</p>}
                      <p className="text-xs text-slate-400 mt-2">
                        {new Date(s.created_at).toLocaleDateString('ar-EG')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => markProductSuggestionPurchased(s.id)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-md hover:bg-emerald-100 transition-colors text-sm font-medium"
                        title="تم الشراء (سيتم حذفه من القائمة)"
                      >
                        <CheckCircle size={16} />
                        تم الشراء
                      </button>
                      <button
                        onClick={() => deleteProductSuggestion(s.id)}
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-md transition-colors"
                        title="حذف"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Notes Tab */}
        {activeTab === 'notes' && (
          <div className="p-6">
            <div className="mb-8 bg-slate-50 p-4 rounded-xl border border-slate-100">
              <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <MessageCircle size={16} /> رسالة للمدير
              </h3>
              <form onSubmit={handleAddNote} className="flex flex-col gap-3">
                <textarea
                  placeholder="اكتب ملاحظتك هنا لتصل إلى الإدارة..."
                  value={newNoteText}
                  onChange={(e) => setNewNoteText(e.target.value)}
                  className="w-full rounded-lg border-slate-200 focus:ring-amber-500 focus:border-amber-500 min-h-[100px] resize-y"
                  required
                />
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isAddingNote || !newNoteText.trim()}
                    className="bg-amber-600 hover:bg-amber-700 text-white px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
                  >
                    إرسال الملاحظة
                  </button>
                </div>
              </form>
            </div>

            <div className="space-y-4">
              {accountantNotes.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <MessageSquare className="mx-auto h-12 w-12 text-slate-300 mb-3" />
                  <p>لا توجد ملاحظات</p>
                </div>
              ) : (
                accountantNotes.map((note) => (
                  <div key={note.id} className="p-4 bg-amber-50/30 border border-amber-100 rounded-lg">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-amber-800">{note.created_by || 'محاسب'}</span>
                        <span className="text-xs text-amber-600/70">
                          {new Date(note.created_at).toLocaleString('ar-EG')}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => markAccountantNoteRead(note.id)}
                          className="text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded hover:bg-amber-200 transition-colors"
                        >
                          تحديد كمقروء (إخفاء)
                        </button>
                        <button
                          onClick={() => deleteAccountantNote(note.id)}
                          className="text-red-400 hover:text-red-600 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                    <p className="text-slate-700 whitespace-pre-wrap">{note.note}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
