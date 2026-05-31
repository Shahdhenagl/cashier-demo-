import { create } from 'zustand';
import { supabase } from '../lib/supabase';

// ─── Types ───────────────────────────────────────────────────
export interface Product {
  id: string;
  name: string;
  barcode: string;
  purchase_price: number;
  average_purchase_price: number;
  sale_price: number;
  stock_quantity: number;
  category_id: string;
  is_hidden?: boolean; // إخفاء المنتج من الكاشير دون حذفه
}

export interface Category {
  id: string;
  name: string;
}

export interface OrderItem extends Product {
  quantity: number;
  returned_quantity: number;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  timestamp: string;
  custom_id?: string;
}

export interface Supplier {
  id: string;
  name: string;
  phone: string;
  address: string;
  created_at: string;
}

export interface Cashier {
  id: string;
  name: string;
  password?: string;
  pin?: string;
  phone: string;
  photo_url: string;
  created_at: string;
}

export interface PurchaseItem {
  id?: string;
  product_id: string;
  quantity: number;
  purchase_price: number;
}

export interface PurchaseInvoice {
  id: string;
  invoice_number: string;
  supplier_id: string;
  total: number;
  paid_amount: number;
  paid_cash: number;
  paid_visa: number;
  paid_wallet: number;
  paid_instapay: number;
  payment_method: 'cash' | 'visa' | 'wallet' | 'instapay';
  created_at: string;
  items?: PurchaseItem[];
}

export interface Order {
  id: string;
  items: OrderItem[];
  total: number;
  paid_amount: number;
  paid_cash: number;
  paid_visa: number;
  paid_wallet: number;
  paid_instapay: number;
  type: 'sale' | 'payment';
  date: string;
  payment_method: 'cash' | 'visa' | 'wallet' | 'instapay';
  customer?: Customer;
  cashier_name?: string;
  isOffline?: boolean;
}

export interface Expense {
  id: string;
  category: string;
  amount: number;
  paid_cash: number;
  paid_visa: number;
  paid_wallet: number;
  paid_instapay: number;
  note: string;
  payment_method: 'cash' | 'visa' | 'wallet' | 'instapay';
  date: string;
}

export interface StoreSettings {
  name: string;
  currency: string;
  logo: string;
  taxRate: number;
  themeColor: string;
  address: string;
  phone: string;
  phone2: string;
  whatsappCountryCode: string;
  initial_balance: number;
}

export interface Employee {
  id: string;
  name: string;
  job_title: string;
  phone: string;
  working_hours: string;
  monthly_salary: number;
  created_at: string;
}

export interface EmployeeTransaction {
  id: string;
  employee_id: string;
  amount: number;
  type: 'salary' | 'advance';
  payment_method: 'cash' | 'visa' | 'wallet' | 'instapay';
  paid_cash: number;
  paid_visa: number;
  paid_wallet: number;
  paid_instapay: number;
  month: string;
  deductions: number;
  note: string;
  created_at: string;
}

// ─── Store Interface ──────────────────────────────────────────
interface CashierStore {
  storeSettings: StoreSettings;
  products: Product[];
  categories: Category[];
  customers: Customer[];
  suppliers: Supplier[];
  cashiers: Cashier[];
  cart: OrderItem[];
  orders: Order[];
  expenses: Expense[];
  purchaseInvoices: PurchaseInvoice[];
  invoiceCounter: number;
  activeInvoiceId: string;
  isLoading: boolean;
  dbError: string | null;
  activeCashier: Cashier | null;
  employees: Employee[];
  employeeTransactions: EmployeeTransaction[];

  // Data loading
  loadAll: () => Promise<void>;
  loadSettingsOnly: () => Promise<void>;
  loadProductsOnly: () => Promise<void>;

  // Cart
  addToCart: (product: Product) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  updatePrice: (productId: string, price: number) => void;
  clearCart: () => void;

  // Operations
  checkout: (
    total: number, 
    customerDetails?: { name: string; phone: string; custom_id?: string }, 
    paidAmount?: number, 
    type?: 'sale' | 'payment', 
    paymentMethod?: string,
    splitPayments?: { cash: number; visa: number; wallet: number; instapay: number },
    cashierName?: string
  ) => Promise<string>;
  processReturn: (orderId: string, productId: string, returnQty: number) => Promise<boolean>;

  // Admin
  loadAnalyticsData: (startDate?: string, endDate?: string) => Promise<Order[]>;
  updateSettings: (settings: Partial<StoreSettings>) => Promise<void>;
  addProduct: (product: Omit<Product, 'id'>) => Promise<void>;
  updateProduct: (id: string, product: Partial<Product>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  
  // Expenses
  addExpense: (expense: Omit<Expense, 'id' | 'date'>) => Promise<void>;
  updateExpense: (id: string, expense: Partial<Expense>) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;

  // Suppliers
  addSupplier: (supplier: Omit<Supplier, 'id' | 'created_at'>) => Promise<void>;
  updateSupplier: (id: string, supplier: Partial<Supplier>) => Promise<void>;
  deleteSupplier: (id: string) => Promise<void>;

  // Customers
  updateCustomer: (id: string, customer: Partial<Customer>) => Promise<void>;

  // Cashiers
  loadCashiers: () => Promise<void>;
  addCashier: (cashier: Omit<Cashier, 'id' | 'created_at'>) => Promise<void>;
  updateCashier: (id: string, cashier: Partial<Cashier>) => Promise<void>;
  deleteCashier: (id: string) => Promise<void>;

  // Employees
  loadEmployees: () => Promise<void>;
  addEmployee: (employee: Omit<Employee, 'id' | 'created_at'>) => Promise<void>;
  updateEmployee: (id: string, employee: Partial<Employee>) => Promise<void>;
  deleteEmployee: (id: string) => Promise<void>;
  addEmployeeTransaction: (transaction: Omit<EmployeeTransaction, 'id' | 'created_at'>) => Promise<void>;

  // Purchases
  loadPurchaseInvoices: () => Promise<void>;
  addPurchaseInvoice: (
    invoice: Omit<PurchaseInvoice, 'id' | 'created_at' | 'items' | 'paid_cash' | 'paid_visa' | 'paid_wallet' | 'paid_instapay'>, 
    items: PurchaseItem[],
    splitPayments?: { cash: number; visa: number; wallet: number; instapay: number }
  ) => Promise<void>;
  paySupplierDebt: (supplierId: string, amount: number, splitPayments?: { cash: number; visa: number; wallet: number; instapay: number }) => Promise<void>;

  // Realtime
  setupRealtime: () => void;

  // Offline Sync
  offlineQueue: any[];
  offlineReturnsQueue: any[];
  isOnline: boolean;
  isSyncing: boolean;
  syncOfflineQueue: () => Promise<void>;
  syncOfflineReturnsQueue: () => Promise<void>;

  // Auth
  isAdminAuthenticated: boolean;
  isPOSAuthenticated: boolean;
  login: (pin: string) => boolean;
  logout: () => void;
  loginPOS: (name: string, password?: string) => boolean;
  logoutPOS: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────
function mapSettings(row: Record<string, unknown>): StoreSettings {
  return {
    name: (row.name as string) ?? 'محلي',
    currency: (row.currency as string) ?? 'ج.م',
    logo: (row.logo as string) ?? '',
    taxRate: (row.tax_rate as number) ?? 0,
    themeColor: (row.theme_color as string) ?? '#4f46e5',
    address: (row.address as string) ?? '',
    phone: (row.phone as string) ?? '',
    phone2: (row.phone2 as string) ?? '',
    whatsappCountryCode: (row.whatsapp_country_code as string) ?? '2',
    initial_balance: (row.initial_balance as number) ?? 0,
  };
}

// ─── Store ───────────────────────────────────────────────────
export const useStore = create<CashierStore>((set, get) => ({
  storeSettings: {
    name: 'محل اللحوم الطازجة',
    currency: 'ج.م',
    logo: 'https://cdn-icons-png.flaticon.com/512/3143/3143641.png',
    taxRate: 0,
    themeColor: '#4f46e5',
    address: '',
    phone: '',
    phone2: '',
    whatsappCountryCode: '2',
    initial_balance: 0,
  },
  products: [],
  categories: [],
  customers: [],
  suppliers: [],
  cashiers: [],
  cart: [],
  orders: [],
  expenses: [],
  purchaseInvoices: [],
  employees: [],
  employeeTransactions: [],
  invoiceCounter: 1,
  activeInvoiceId: '1',
  isLoading: false,
  dbError: null,
  offlineQueue: typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('cashier_offline_queue') || '[]') : [],
  offlineReturnsQueue: typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('cashier_offline_returns_queue') || '[]') : [],
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  isSyncing: false,
  activeCashier: null,
  isAdminAuthenticated: !!sessionStorage.getItem('cashier_admin_auth'),
  isPOSAuthenticated: !!sessionStorage.getItem('cashier_pos_auth'),

  login: (pin: string) => {
    if (pin === '1111') { // Admin PIN
      sessionStorage.setItem('cashier_admin_auth', 'true');
      set({ isAdminAuthenticated: true });
      return true;
    }
    return false;
  },

  logout: () => {
    sessionStorage.removeItem('cashier_admin_auth');
    set({ isAdminAuthenticated: false });
  },

  loginPOS: (name, password) => {
    const { cashiers } = get();
    const cashier = cashiers.find(c => c.name === name && c.password === password);
    if (cashier) {
      sessionStorage.setItem('cashier_pos_auth', 'true');
      sessionStorage.setItem('active_cashier_name', cashier.name);
      set({ isPOSAuthenticated: true, activeCashier: cashier });
      return true;
    }
    return false;
  },

  logoutPOS: () => {
    sessionStorage.removeItem('cashier_pos_auth');
    sessionStorage.removeItem('active_cashier_name');
    set({ isPOSAuthenticated: false, activeCashier: null });
  },

  // ── Load all data from Supabase ────────────────────────────
  loadAll: async () => {
    set({ isLoading: true, dbError: null });
    try {
      const [settingsRes, categoriesRes, productsRes, customersRes, ordersRes, counterRes, cashiersRes, employeesRes, employeeTransactionsRes] =
        await Promise.all([
          supabase.from('store_settings').select('*').limit(1).maybeSingle(),
          supabase.from('categories').select('*').order('name'),
          supabase.from('products').select('*').order('name'),
          supabase.from('customers').select('*').order('created_at', { ascending: false }),
          supabase
            .from('orders')
            .select('*, customers(*), order_items(*, products(*))')
            .order('created_at', { ascending: false })
            .limit(200),
          supabase.from('invoice_counter').select('current_value').limit(1).maybeSingle(),
          supabase.from('cashiers').select('*').order('created_at', { ascending: false }),
          supabase.from('employees').select('*').order('created_at', { ascending: false }),
          supabase.from('employee_transactions').select('*').order('created_at', { ascending: false }),
        ]);

      const settings = settingsRes.data ? mapSettings(settingsRes.data as Record<string, unknown>) : get().storeSettings;

      const customers: Customer[] = ((customersRes.data ?? []) as Record<string, unknown>[]).map((c) => ({
        id: c.id as string,
        name: c.name as string,
        phone: c.phone as string,
        custom_id: c.custom_id as string,
        timestamp: c.created_at as string,
      }));

      const orders: Order[] = ((ordersRes.data ?? []) as Record<string, unknown>[]).map((o) => {
        const custRow = o.customers as Record<string, unknown> | null;
        const itemRows = (o.order_items as Record<string, unknown>[]) ?? [];
        const items: OrderItem[] = itemRows.map((i) => {
          const prod = (i.products as Record<string, unknown>) ?? {};
          return {
            id: (i.product_id as string) ?? (i.id as string),
            name: (i.product_name as string) ?? (prod.name as string) ?? '',
            barcode: (prod.barcode as string) ?? '',
            purchase_price: (i.purchase_price as number) ?? (prod.average_purchase_price as number) ?? (prod.purchase_price as number) ?? 0,
            average_purchase_price: (i.purchase_price as number) ?? (prod.average_purchase_price as number) ?? (prod.purchase_price as number) ?? 0,
            sale_price: i.sale_price as number,
            stock_quantity: (prod.stock_quantity as number) ?? 0,
            category_id: (prod.category_id as string) ?? '',
            quantity: i.quantity as number,
            returned_quantity: (i.returned_quantity as number) ?? 0,
          };
        });
        return {
          id: o.id as string,
          total: o.total as number,
          paid_amount: (o.paid_amount as number) ?? (o.total as number),
          paid_cash: (o.paid_cash as number) ?? 0,
          paid_visa: (o.paid_visa as number) ?? 0,
          paid_wallet: (o.paid_wallet as number) ?? 0,
          paid_instapay: (o.paid_instapay as number) ?? 0,
          type: (o.type as string) as 'sale' | 'payment' ?? 'sale',
          payment_method: (o.payment_method as any) ?? 'cash',
          date: o.created_at as string,
          items,
          cashier_name: (o.cashier_name as string) ?? undefined,
          customer: custRow
            ? { 
                id: custRow.id as string, 
                name: custRow.name as string, 
                phone: custRow.phone as string, 
                custom_id: custRow.custom_id as string,
                timestamp: custRow.created_at as string 
              }
            : undefined,
        };
      });

      const counter = (counterRes.data as Record<string, unknown> | null)?.current_value as number ?? 1;

        set({
        storeSettings: settings,
        categories: (categoriesRes.data ?? []) as Category[],
        products: (productsRes.data ?? []).map((p: any) => ({
          ...p,
          average_purchase_price: p.average_purchase_price ?? p.purchase_price ?? 0
        })) as Product[],
        customers,
        orders,
        cashiers: (cashiersRes.data ?? []) as Cashier[],
        expenses: [], // Default to empty
        invoiceCounter: counter,
        activeInvoiceId: counter.toString(),
        isLoading: false,
        activeCashier: sessionStorage.getItem('active_cashier_name') 
          ? ((cashiersRes.data ?? []) as Cashier[]).find(c => c.name === sessionStorage.getItem('active_cashier_name')) || null
          : (sessionStorage.getItem('cashier_pos_auth') === 'true' ? { id: 'master', name: 'المدير', pin: '123456', phone: '', photo_url: '', created_at: '' } : null),
        employees: (employeesRes.data ?? []) as Employee[],
        employeeTransactions: (employeeTransactionsRes.data ?? []) as EmployeeTransaction[],
      });

      // Fetch expenses separately to avoid breaking the whole loadAll if the table is missing
      try {
        const { data: expData } = await supabase.from('expenses').select('*').order('created_at', { ascending: false });
        if (expData) {
          set({
            expenses: (expData as any[]).map(e => ({
              id: e.id,
              category: e.category,
              amount: e.amount,
              paid_cash: e.paid_cash || 0,
              paid_visa: e.paid_visa || 0,
              paid_wallet: e.paid_wallet || 0,
              paid_instapay: e.paid_instapay || 0,
              note: e.note,
              payment_method: e.payment_method ?? 'cash',
              date: e.created_at
            }))
          });
        }
      } catch (e) {
        console.error("Expenses table might not exist yet:", e);
      }

      try {
        const { data: supData } = await supabase.from('suppliers').select('*').order('created_at', { ascending: false });
        if (supData) {
          set({
            suppliers: (supData as any[]).map(s => ({
              ...s
            }))
          });
        }
      } catch (e) {
        console.error("Suppliers table might not exist yet:", e);
      }

      // Fetch purchase invoices
      get().loadPurchaseInvoices();

      // Setup Realtime subscriptions
      get().setupRealtime();

      // Sync settings across tabs
      const bc = new BroadcastChannel('cashier-sync');
      bc.onmessage = (msg) => {
        if (msg.data === 'sync_settings') {
          get().loadSettingsOnly();
        }
      };
    } catch (err) {
      set({ isLoading: false, dbError: String(err) });
    }
  },

  loadSettingsOnly: async () => {
    try {
      const { data } = await supabase.from('store_settings').select('*').limit(1).maybeSingle();
      if (data) {
        set({ storeSettings: mapSettings(data as Record<string, unknown>) });
      }
    } catch(e) { console.error(e); }
  },

  loadProductsOnly: async () => {
    try {
      const { data, error } = await supabase.from('products').select('*').order('name');
      if (!error && data) {
        set({
          products: data.map((p: any) => ({
            ...p,
            average_purchase_price: p.average_purchase_price ?? p.purchase_price ?? 0
          })) as Product[]
        });
      }
    } catch (e) {
      console.error("Error loading products only:", e);
    }
  },

  syncOfflineQueue: async () => {
    const state = get();
    if (state.isSyncing || state.offlineQueue.length === 0) return;

    set({ isSyncing: true });

    const queue = [...state.offlineQueue];
    const failedOrders = [];

    for (const offlineOrder of queue) {
      try {
        const { data: counterData, error: counterError } = await supabase
          .from('invoice_counter')
          .select('current_value')
          .eq('id', 1)
          .single();

        if (counterError || !counterData) {
          throw new Error("Could not fetch counter");
        }

        const realInvoiceId = (counterData as any).current_value.toString();
        const nextCounter = (counterData as any).current_value + 1;

        await supabase
          .from('invoice_counter')
          .update({ current_value: nextCounter })
          .eq('id', 1);

        let customerId: string | null = null;
        let finalCustomer = offlineOrder.customer;

        if (finalCustomer) {
          const phone = finalCustomer.phone?.trim();
          const custom_id = finalCustomer.custom_id?.trim();
          
          let existingCust = null;
          if (phone || custom_id) {
            const orQuery = [];
            if (phone) orQuery.push(`phone.eq.${phone}`);
            if (custom_id) orQuery.push(`custom_id.eq.${custom_id}`);
            const { data } = await supabase
              .from('customers')
              .select('*')
              .or(orQuery.join(','))
              .maybeSingle();
            existingCust = data;
          }

          if (existingCust) {
            customerId = existingCust.id;
            finalCustomer = {
              id: existingCust.id,
              name: existingCust.name,
              phone: existingCust.phone,
              custom_id: existingCust.custom_id,
              timestamp: existingCust.created_at
            };
          } else {
            const { data: newCust } = await supabase
              .from('customers')
              .insert({ 
                name: finalCustomer.name || 'بدون اسم', 
                phone: phone || null, 
                custom_id: custom_id || null
              })
              .select()
              .single();
            if (newCust) {
              customerId = (newCust as any).id;
              finalCustomer = {
                id: customerId!,
                name: (newCust as any).name,
                phone: (newCust as any).phone,
                custom_id: (newCust as any).custom_id,
                timestamp: (newCust as any).created_at
              };
            }
          }
        }

        const { error: orderError } = await supabase.from('orders').insert({ 
          id: realInvoiceId, 
          total: offlineOrder.total, 
          paid_amount: offlineOrder.paid_amount,
          paid_cash: offlineOrder.paid_cash,
          paid_visa: offlineOrder.paid_visa,
          paid_wallet: offlineOrder.paid_wallet,
          paid_instapay: offlineOrder.paid_instapay,
          type: offlineOrder.type,
          customer_id: customerId,
          payment_method: offlineOrder.payment_method,
          cashier_name: offlineOrder.cashier_name,
          created_at: offlineOrder.date
        });

        if (orderError) throw orderError;

        const itemsPayload = offlineOrder.items.map((item: any) => ({
          order_id: realInvoiceId,
          product_id: item.id,
          product_name: item.name,
          barcode: item.barcode,
          quantity: item.quantity,
          returned_quantity: item.returned_quantity || 0,
          sale_price: item.sale_price,
          purchase_price: item.average_purchase_price || item.purchase_price || 0,
        }));
        const { error: itemsError } = await supabase.from('order_items').insert(itemsPayload);
        if (itemsError) console.error("Sync Order Items Error:", itemsError);

        for (const item of offlineOrder.items) {
          const { data: prodData } = await supabase.from('products').select('stock_quantity').eq('id', item.id).single();
          const currentStock = prodData?.stock_quantity ?? 0;
          const netQty = item.quantity - (item.returned_quantity || 0);
          await supabase.from('products').update({ stock_quantity: Math.max(0, currentStock - netQty) }).eq('id', item.id);
        }

        set((s) => ({
          orders: s.orders.map(o => o.id === offlineOrder.id ? { ...o, id: realInvoiceId, customer: finalCustomer || undefined, isOffline: false } : o)
        }));

      } catch (err) {
        console.error("Failed to sync offline order:", offlineOrder.id, err);
        failedOrders.push(offlineOrder);
      }
    }

    localStorage.setItem('cashier_offline_queue', JSON.stringify(failedOrders));
    set({
      offlineQueue: failedOrders,
      isSyncing: false
    });

    new BroadcastChannel('cashier-sync').postMessage('sync_products');
    get().syncOfflineReturnsQueue();
  },

  // ── Cart ───────────────────────────────────────────────────
  addToCart: (product) =>
    set((state) => {
      if (product.stock_quantity <= 0) return state;
      const existing = state.cart.find((i) => i.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock_quantity) return state;
        return { cart: state.cart.map((i) => (i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i)) };
      }
      return { cart: [...state.cart, { ...product, quantity: 1, returned_quantity: 0 }] };
    }),

  removeFromCart: (productId) => set((state) => ({ cart: state.cart.filter((i) => i.id !== productId) })),

  updateQuantity: (productId: string, quantity: number) =>
    set((state) => {
      const product = state.products.find((p) => p.id === productId);
      if (!product) return state;
      const validQty = Math.max(1, Math.min(quantity, product.stock_quantity));
      return { cart: state.cart.map((i) => (i.id === productId ? { ...i, quantity: validQty } : i)) };
    }),

  updatePrice: (productId, price) =>
    set((state) => ({
      cart: state.cart.map((i) => (i.id === productId ? { ...i, sale_price: price } : i))
    })),

  clearCart: () => set({ cart: [] }),

  // ── Checkout ───────────────────────────────────────────────
  checkout: async (total, customerDetails, paidAmount = total, type = 'sale', paymentMethod = 'cash', splitPayments, cashierName) => {
    const state = get();
    const finalCashierName = cashierName || state.activeCashier?.name || 'مدير النظام';
    if (state.cart.length === 0 && type !== 'payment') return state.activeInvoiceId;

    const savedPaidAmount = type === 'payment' ? paidAmount : Math.min(total, paidAmount);

    const executeOfflineCheckout = () => {
      const offlineId = `OFF-${Date.now()}`;
      
      let customerId: string | null = null;
      let finalCustomer: Customer | undefined;
      
      if (customerDetails?.phone.trim() || customerDetails?.custom_id?.trim()) {
        const phone = customerDetails.phone?.trim();
        const custom_id = customerDetails.custom_id?.trim();
        
        const existing = state.customers.find((c) => 
          (phone && c.phone === phone) || (custom_id && c.custom_id === custom_id)
        );

        if (existing) {
          customerId = existing.id;
          finalCustomer = existing;
        } else {
          customerId = `OFF-CUST-${Date.now()}`;
          finalCustomer = {
            id: customerId,
            name: customerDetails.name || 'بدون اسم',
            phone: phone || '',
            custom_id: custom_id || '',
            timestamp: new Date().toISOString()
          };
        }
      }

      const newOfflineOrder = {
        id: offlineId,
        total,
        paid_amount: savedPaidAmount,
        paid_cash: splitPayments ? (splitPayments.cash || 0) : (paymentMethod === 'cash' ? savedPaidAmount : 0),
        paid_visa: splitPayments ? (splitPayments.visa || 0) : (paymentMethod === 'visa' ? savedPaidAmount : 0),
        paid_wallet: splitPayments ? (splitPayments.wallet || 0) : (paymentMethod === 'wallet' ? savedPaidAmount : 0),
        paid_instapay: splitPayments ? (splitPayments.instapay || 0) : (paymentMethod === 'instapay' ? savedPaidAmount : 0),
        type,
        payment_method: paymentMethod as any,
        date: new Date().toISOString(),
        customer: finalCustomer,
        cashier_name: finalCashierName,
        items: state.cart.map((i) => ({ ...i })),
        isOffline: true
      };

      const updatedQueue = [...state.offlineQueue, newOfflineOrder];
      localStorage.setItem('cashier_offline_queue', JSON.stringify(updatedQueue));

      const updatedProducts = state.products.map((p) => {
        const cartItem = state.cart.find((c) => c.id === p.id);
        return cartItem ? { ...p, stock_quantity: Math.max(0, p.stock_quantity - cartItem.quantity) } : p;
      });

      const updatedCustomers = finalCustomer && !state.customers.find((c) => c.id === finalCustomer!.id)
        ? [finalCustomer, ...state.customers]
        : state.customers;

      set({
        orders: [newOfflineOrder, ...state.orders],
        cart: [],
        products: updatedProducts,
        customers: updatedCustomers,
        offlineQueue: updatedQueue
      });

      return offlineId;
    };

    try {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        throw new Error("No network connectivity");
      }

      // 1. Get the LATEST counter value from DB right now (Atomic approach)
      const { data: counterData, error: counterError } = await supabase
        .from('invoice_counter')
        .select('current_value')
        .eq('id', 1)
        .single();

      if (counterError || !counterData) {
        throw new Error("Counter Fetch Error");
      }

      const invoiceId = (counterData as any).current_value.toString();
      const nextCounter = (counterData as any).current_value + 1;

      // 2. Increment counter in DB immediately to "lock" this number
      const { error: updateCounterError } = await supabase
        .from('invoice_counter')
        .update({ current_value: nextCounter })
        .eq('id', 1);

      if (updateCounterError) {
        console.error("Counter Update Error:", updateCounterError);
      }

      let customerId: string | null = null;
      let finalCustomer: Customer | undefined;

      // Upsert customer
      if (customerDetails?.phone.trim() || customerDetails?.custom_id?.trim()) {
        const phone = customerDetails.phone?.trim();
        const custom_id = customerDetails.custom_id?.trim();
        
        const existing = state.customers.find((c) => 
          (phone && c.phone === phone) || (custom_id && c.custom_id === custom_id)
        );

        if (existing) {
          customerId = existing.id;
          finalCustomer = existing;
          
          if (customerDetails.name && existing.name !== customerDetails.name) {
             await supabase.from('customers').update({ name: customerDetails.name }).eq('id', existing.id);
             existing.name = customerDetails.name;
          }
        } else {
          const { data: newCust } = await supabase
            .from('customers')
            .insert({ 
              name: customerDetails.name || 'بدون اسم', 
              phone: phone || null, 
              custom_id: custom_id 
            })
            .select()
            .single();
          if (newCust) {
            customerId = (newCust as Record<string, unknown>).id as string;
            finalCustomer = {
              id: customerId,
              name: (newCust as Record<string, unknown>).name as string,
              phone: (newCust as Record<string, unknown>).phone as string,
              custom_id: (newCust as Record<string, unknown>).custom_id as string,
              timestamp: (newCust as Record<string, unknown>).created_at as string,
            };
          }
        }
      }

      // Insert order
      const { error: orderError } = await supabase.from('orders').insert({ 
        id: invoiceId, 
        total, 
        paid_amount: savedPaidAmount,
        paid_cash: splitPayments ? (splitPayments.cash || 0) : (paymentMethod === 'cash' ? savedPaidAmount : 0),
        paid_visa: splitPayments ? (splitPayments.visa || 0) : (paymentMethod === 'visa' ? savedPaidAmount : 0),
        paid_wallet: splitPayments ? (splitPayments.wallet || 0) : (paymentMethod === 'wallet' ? savedPaidAmount : 0),
        paid_instapay: splitPayments ? (splitPayments.instapay || 0) : (paymentMethod === 'instapay' ? savedPaidAmount : 0),
        type,
        customer_id: customerId,
        payment_method: paymentMethod,
        cashier_name: finalCashierName
      });

      if (orderError) {
        console.error("Order Insert Error:", orderError);
        // If duplicate key, it means another cashier took the number in that millisecond.
        alert(`عذراً، رقم الفاتورة مستخدم حالياً (${invoiceId}). يرجى المحاولة مرة أخرى.`);
        return invoiceId;
      }

      // Insert order items
      const itemsPayload = state.cart.map((item) => ({
        order_id: invoiceId,
        product_id: item.id,
        product_name: item.name,
        barcode: item.barcode,
        quantity: item.quantity,
        returned_quantity: 0,
        sale_price: item.sale_price,
        purchase_price: item.average_purchase_price || item.purchase_price,
      }));
      const { error: itemsError } = await supabase.from('order_items').insert(itemsPayload);
      if (itemsError) {
        console.error("Order Items Insert Error:", itemsError);
      }

      // Update stock
      for (const item of state.cart) {
        const newQty = (state.products.find((p) => p.id === item.id)?.stock_quantity ?? 0) - item.quantity;
        await supabase.from('products').update({ stock_quantity: Math.max(0, newQty) }).eq('id', item.id);
      }

      // Build new order for local state
      const newOrder: Order = {
        id: invoiceId,
        items: state.cart.map((i) => ({ ...i })),
        total,
        paid_amount: savedPaidAmount,
        paid_cash: splitPayments ? (splitPayments.cash || 0) : (paymentMethod === 'cash' ? savedPaidAmount : 0),
        paid_visa: splitPayments ? (splitPayments.visa || 0) : (paymentMethod === 'visa' ? savedPaidAmount : 0),
        paid_wallet: splitPayments ? (splitPayments.wallet || 0) : (paymentMethod === 'wallet' ? savedPaidAmount : 0),
        paid_instapay: splitPayments ? (splitPayments.instapay || 0) : (paymentMethod === 'instapay' ? savedPaidAmount : 0),
        type,
        payment_method: paymentMethod as any,
        date: new Date().toISOString(),
        customer: finalCustomer,
        cashier_name: finalCashierName
      };

      const updatedProducts = state.products.map((p) => {
        const cartItem = state.cart.find((c) => c.id === p.id);
        return cartItem ? { ...p, stock_quantity: Math.max(0, p.stock_quantity - cartItem.quantity) } : p;
      });

      const updatedCustomers = finalCustomer && !state.customers.find((c) => c.id === finalCustomer!.id)
        ? [finalCustomer, ...state.customers]
        : state.customers;

      set({
        orders: [newOrder, ...state.orders],
        cart: [],
        products: updatedProducts,
        customers: updatedCustomers,
        invoiceCounter: nextCounter,
        activeInvoiceId: nextCounter.toString(),
      });

      new BroadcastChannel('cashier-sync').postMessage('sync_products');

      return invoiceId;
    } catch (err) {
      console.warn("Network offline or Supabase connection failed. Falling back to offline checkout:", err);
      return executeOfflineCheckout();
    }
  },

  // ── Returns ────────────────────────────────────────────────
  processReturn: async (orderId, productId, returnQty) => {
    const state = get();
    const orderIndex = state.orders.findIndex((o) => o.id === orderId);
    if (orderIndex === -1) return false;

    const order = state.orders[orderIndex];
    const itemIndex = order.items.findIndex((i) => i.id === productId);
    if (itemIndex === -1) return false;

    const item = order.items[itemIndex];
    const available = item.quantity - item.returned_quantity;
    if (returnQty <= 0 || returnQty > available) return false;

    const newReturnedQty = item.returned_quantity + returnQty;

    const executeOfflineReturn = () => {
      const updatedItems = order.items.map((i, idx) =>
        idx === itemIndex ? { ...i, returned_quantity: newReturnedQty } : i
      );
      const updatedOrders = state.orders.map((o, idx) =>
        idx === orderIndex ? { ...o, items: updatedItems } : o
      );
      const updatedProducts = state.products.map((p) =>
        p.id === productId ? { ...p, stock_quantity: p.stock_quantity + returnQty } : p
      );

      if (orderId.startsWith('OFF-')) {
        const updatedQueue = state.offlineQueue.map((o) => {
          if (o.id === orderId) {
            return {
              ...o,
              items: o.items.map((i: any) =>
                i.id === productId ? { ...i, returned_quantity: newReturnedQty } : i
              ),
            };
          }
          return o;
        });
        localStorage.setItem('cashier_offline_queue', JSON.stringify(updatedQueue));
        set({
          orders: updatedOrders,
          products: updatedProducts,
          offlineQueue: updatedQueue,
        });
      } else {
        const newOfflineReturn = {
          orderId,
          productId,
          returnQty,
          date: new Date().toISOString(),
        };
        const updatedReturnsQueue = [...state.offlineReturnsQueue, newOfflineReturn];
        localStorage.setItem('cashier_offline_returns_queue', JSON.stringify(updatedReturnsQueue));
        set({
          orders: updatedOrders,
          products: updatedProducts,
          offlineReturnsQueue: updatedReturnsQueue,
        });
      }

      new BroadcastChannel('cashier-sync').postMessage('sync_products');
      return true;
    };

    try {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        throw new Error("No network connectivity");
      }

      const orderItemRow = await supabase
        .from('order_items')
        .select('id, returned_quantity')
        .eq('order_id', orderId)
        .eq('product_id', productId)
        .single();

      if (orderItemRow.error) {
        throw orderItemRow.error;
      }

      if (orderItemRow.data) {
        const { error: updateError } = await supabase
          .from('order_items')
          .update({ returned_quantity: newReturnedQty })
          .eq('id', (orderItemRow.data as Record<string, unknown>).id as string);
        if (updateError) throw updateError;
      }

      const product = state.products.find((p) => p.id === productId);
      if (product) {
        const { error: prodError } = await supabase
          .from('products')
          .update({ stock_quantity: product.stock_quantity + returnQty })
          .eq('id', productId);
        if (prodError) throw prodError;
      }

      const updatedItems = order.items.map((i, idx) =>
        idx === itemIndex ? { ...i, returned_quantity: newReturnedQty } : i
      );
      const updatedOrders = state.orders.map((o, idx) =>
        idx === orderIndex ? { ...o, items: updatedItems } : o
      );
      const updatedProducts = state.products.map((p) =>
        p.id === productId ? { ...p, stock_quantity: p.stock_quantity + returnQty } : p
      );

      set({ orders: updatedOrders, products: updatedProducts });
      new BroadcastChannel('cashier-sync').postMessage('sync_products');
      return true;
    } catch (err) {
      console.warn("Network offline or Supabase return failed. Falling back to offline return:", err);
      return executeOfflineReturn();
    }
  },

  syncOfflineReturnsQueue: async () => {
    const state = get();
    if (state.isSyncing || state.offlineReturnsQueue.length === 0) return;

    set({ isSyncing: true });

    const queue = [...state.offlineReturnsQueue];
    const failedReturns = [];

    for (const returnItem of queue) {
      try {
        const orderItemRow = await supabase
          .from('order_items')
          .select('id, returned_quantity')
          .eq('order_id', returnItem.orderId)
          .eq('product_id', returnItem.productId)
          .single();

        if (orderItemRow.error) throw orderItemRow.error;

        if (orderItemRow.data) {
          const currentReturned = (orderItemRow.data as any).returned_quantity || 0;
          const { error: updateError } = await supabase
            .from('order_items')
            .update({ returned_quantity: currentReturned + returnItem.returnQty })
            .eq('id', (orderItemRow.data as any).id);
          if (updateError) throw updateError;
        }

        const { data: prodData, error: prodGetError } = await supabase
          .from('products')
          .select('stock_quantity')
          .eq('id', returnItem.productId)
          .single();
        
        if (prodGetError) throw prodGetError;

        const currentStock = prodData?.stock_quantity ?? 0;
        const { error: prodError } = await supabase
          .from('products')
          .update({ stock_quantity: currentStock + returnItem.returnQty })
          .eq('id', returnItem.productId);
        
        if (prodError) throw prodError;

      } catch (err) {
        console.error("Failed to sync offline return:", returnItem, err);
        failedReturns.push(returnItem);
      }
    }

    localStorage.setItem('cashier_offline_returns_queue', JSON.stringify(failedReturns));
    set({
      offlineReturnsQueue: failedReturns,
      isSyncing: false
    });

    new BroadcastChannel('cashier-sync').postMessage('sync_products');
  },

  // ── Admin ──────────────────────────────────────────────────
  loadAnalyticsData: async (startDate, endDate) => {
    let query = supabase
      .from('orders')
      .select('*, customers(*), order_items(*, products(*))')
      .order('created_at', { ascending: false });

    if (startDate) query = query.gte('created_at', startDate);
    if (endDate) query = query.lte('created_at', endDate);

    const { data, error } = await query.limit(1000);
    if (error) {
      console.error("Analytics Load Error:", error);
      return [];
    }

    const orders: Order[] = (data as Record<string, unknown>[]).map((o) => {
      const custRow = o.customers as Record<string, unknown> | null;
      const itemRows = (o.order_items as Record<string, unknown>[]) ?? [];
      const items: OrderItem[] = itemRows.map((i) => {
        const prod = (i.products as Record<string, unknown>) ?? {};
        return {
          id: (i.product_id as string) ?? (i.id as string),
          name: (i.product_name as string) ?? (prod.name as string) ?? '',
          barcode: (prod.barcode as string) ?? '',
          purchase_price: (i.purchase_price as number) ?? (prod.average_purchase_price as number) ?? (prod.purchase_price as number) ?? 0,
          average_purchase_price: (i.purchase_price as number) ?? (prod.average_purchase_price as number) ?? (prod.purchase_price as number) ?? 0,
          sale_price: i.sale_price as number,
          stock_quantity: (prod.stock_quantity as number) ?? 0,
          category_id: (prod.category_id as string) ?? '',
          quantity: i.quantity as number,
          returned_quantity: (i.returned_quantity as number) ?? 0,
        };
      });
      return {
        id: o.id as string,
        total: o.total as number,
        paid_amount: (o.paid_amount as number) ?? (o.total as number),
        paid_cash: (o.paid_cash as number) ?? 0,
        paid_visa: (o.paid_visa as number) ?? 0,
        paid_wallet: (o.paid_wallet as number) ?? 0,
        paid_instapay: (o.paid_instapay as number) ?? 0,
        type: (o.type as string) as 'sale' | 'payment' ?? 'sale',
        payment_method: (o.payment_method as any) ?? 'cash',
        date: o.created_at as string,
        items,
        cashier_name: (o.cashier_name as string) ?? undefined,
        customer: custRow
          ? { id: custRow.id as string, name: custRow.name as string, phone: custRow.phone as string, timestamp: custRow.created_at as string }
          : undefined,
      };
    });

    return orders;
  },

  // ── Cashiers ──────────────────────────────────────────────
  loadCashiers: async () => {
    const { data } = await supabase.from('cashiers').select('*').order('created_at', { ascending: false });
    if (data) set({ cashiers: data as Cashier[] });
  },

  addCashier: async (cashier) => {
    const { data } = await supabase.from('cashiers').insert(cashier).select().single();
    if (data) set((state) => ({ cashiers: [data as unknown as Cashier, ...state.cashiers] }));
  },

  updateCashier: async (id, updated) => {
    await supabase.from('cashiers').update(updated).eq('id', id);
    set((state) => ({ cashiers: state.cashiers.map((c) => (c.id === id ? { ...c, ...updated } : c)) }));
  },

  deleteCashier: async (id) => {
    await supabase.from('cashiers').delete().eq('id', id);
    set((state) => ({ cashiers: state.cashiers.filter((c) => c.id !== id) }));
  },

  updateSettings: async (newSettings) => {
    const mapped: Record<string, unknown> = {};
    if (newSettings.name !== undefined) mapped.name = newSettings.name;
    if (newSettings.currency !== undefined) mapped.currency = newSettings.currency;
    if (newSettings.logo !== undefined) mapped.logo = newSettings.logo;
    if (newSettings.taxRate !== undefined) mapped.tax_rate = newSettings.taxRate;
    if (newSettings.themeColor !== undefined) mapped.theme_color = newSettings.themeColor;
    if (newSettings.address !== undefined) mapped.address = newSettings.address;
    if (newSettings.phone !== undefined) mapped.phone = newSettings.phone;
    if (newSettings.phone2 !== undefined) mapped.phone2 = newSettings.phone2;
    if (newSettings.whatsappCountryCode !== undefined) mapped.whatsapp_country_code = newSettings.whatsappCountryCode;
    if (newSettings.initial_balance !== undefined) mapped.initial_balance = newSettings.initial_balance;

    const { data: existing } = await supabase.from('store_settings').select('id').limit(1).maybeSingle();
    
    if (existing?.id) {
      await supabase.from('store_settings').update(mapped).eq('id', existing.id);
    } else {
      await supabase.from('store_settings').insert(mapped);
    }
    
    set((state) => ({ storeSettings: { ...state.storeSettings, ...newSettings } }));
    new BroadcastChannel('cashier-sync').postMessage('sync_settings');
  },

setupRealtime: () => {
    const channel = supabase
      .channel('db-changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders' },
        async (payload) => {
          const newOrder = payload.new as any;
          
          // Fetch items for the new order to have a complete order object
          const { data: items } = await supabase
            .from('order_items')
            .select('*, products(*)')
            .eq('order_id', newOrder.id);

          const { data: customer } = newOrder.customer_id 
            ? await supabase.from('customers').select('*').eq('id', newOrder.customer_id).single()
            : { data: null };

          const formattedOrder: Order = {
            id: newOrder.id,
            total: newOrder.total,
            paid_amount: newOrder.paid_amount,
            paid_cash: newOrder.paid_cash || 0,
            paid_visa: newOrder.paid_visa || 0,
            paid_wallet: newOrder.paid_wallet || 0,
            paid_instapay: newOrder.paid_instapay || 0,
            type: newOrder.type,
            payment_method: newOrder.payment_method,
            date: newOrder.created_at,
            cashier_name: newOrder.cashier_name,
            customer: customer ? {
              id: customer.id,
              name: customer.name,
              phone: customer.phone,
              timestamp: customer.created_at
            } : undefined,
            items: (items || []).map(i => ({
              id: i.product_id,
              name: i.product_name,
              barcode: i.barcode,
              purchase_price: i.purchase_price,
              average_purchase_price: i.purchase_price,
              sale_price: i.sale_price,
              stock_quantity: i.products?.stock_quantity || 0,
              category_id: i.products?.category_id || '',
              quantity: i.quantity,
              returned_quantity: i.returned_quantity || 0
            }))
          };

          set((state) => ({
            orders: [formattedOrder, ...state.orders.filter(o => o.id !== formattedOrder.id)]
          }));
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'products' },
        (payload) => {
          const { eventType, new: newRecord, old: oldRecord } = payload;
          set((state) => {
            let updatedProducts = [...state.products];
            if (eventType === 'INSERT') {
              const p = newRecord as any;
              updatedProducts = [{
                ...p,
                average_purchase_price: p.average_purchase_price ?? p.purchase_price ?? 0
              } as Product, ...updatedProducts];
            } else if (eventType === 'UPDATE') {
              updatedProducts = updatedProducts.map((p) =>
                p.id === (newRecord as any).id ? { 
                  ...(newRecord as any),
                  average_purchase_price: (newRecord as any).average_purchase_price ?? (newRecord as any).purchase_price ?? 0
                } as Product : p
              );
            } else if (eventType === 'DELETE') {
              updatedProducts = updatedProducts.filter((p) => p.id !== (oldRecord as any).id);
            }
            return { products: updatedProducts };
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'invoice_counter' },
        (payload) => {
          const nextVal = (payload.new as any).current_value;
          set({ 
            invoiceCounter: nextVal,
            activeInvoiceId: nextVal.toString()
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  addProduct: async (product) => {
    // Realtime subscription handles the live INSERT — no need to broadcast
    await supabase.from('products').insert(product);
  },

  updateProduct: async (id, updated) => {
    // Realtime subscription handles the live UPDATE — no need to broadcast
    await supabase.from('products').update(updated).eq('id', id);
  },

  deleteProduct: async (id) => {
    // Realtime subscription handles the live DELETE — no need to broadcast
    await supabase.from('products').delete().eq('id', id);
  },

  // ── Expenses ──────────────────────────────────────────────
  addExpense: async (expense) => {
    const { data, error } = await supabase.from('expenses').insert({
      category: expense.category,
      amount: expense.amount,
      paid_cash: expense.paid_cash || 0,
      paid_visa: expense.paid_visa || 0,
      paid_wallet: expense.paid_wallet || 0,
      paid_instapay: expense.paid_instapay || 0,
      note: expense.note,
      payment_method: expense.payment_method
    }).select().single();
    
    if (error) {
      console.error("Add Expense Error:", error);
      return;
    }

    if (data) {
      const newExp: Expense = {
        id: (data as any).id,
        category: (data as any).category,
        amount: (data as any).amount,
        paid_cash: (data as any).paid_cash || 0,
        paid_visa: (data as any).paid_visa || 0,
        paid_wallet: (data as any).paid_wallet || 0,
        paid_instapay: (data as any).paid_instapay || 0,
        note: (data as any).note,
        payment_method: (data as any).payment_method,
        date: (data as any).created_at
      };
      set((state) => ({ expenses: [newExp, ...state.expenses] }));
    }
  },

  updateExpense: async (id, expense) => {
    const { data, error } = await supabase.from('expenses').update({
      category: expense.category,
      amount: expense.amount,
      paid_cash: expense.paid_cash,
      paid_visa: expense.paid_visa,
      paid_wallet: expense.paid_wallet,
      paid_instapay: expense.paid_instapay,
      note: expense.note,
      payment_method: expense.payment_method
    }).eq('id', id).select().single();

    if (error) {
      console.error("Update Expense Error:", error);
      return;
    }

    if (data) {
      set((state) => ({
        expenses: state.expenses.map((e) => (e.id === id ? { ...e, ...expense } : e))
      }));
    }
  },

  deleteExpense: async (id: string) => {
    await supabase.from('expenses').delete().eq('id', id);
    set((state) => ({ expenses: state.expenses.filter((e) => e.id !== id) }));
  },

  // ── Suppliers ─────────────────────────────────────────────
  addSupplier: async (supplier) => {
    const { data, error } = await supabase.from('suppliers').insert(supplier).select().single();
    if (error) {
      console.error("Add Supplier Error:", error);
      return;
    }
    if (data) {
      set((state) => ({ suppliers: [data as unknown as Supplier, ...state.suppliers] }));
    }
  },

  updateSupplier: async (id, updated) => {
    const { data, error } = await supabase.from('suppliers').update(updated).eq('id', id).select().single();
    if (error) {
      console.error("Update Supplier Error:", error);
      return;
    }
    if (data) {
      set((state) => ({ suppliers: state.suppliers.map((s) => (s.id === id ? { ...s, ...updated } : s)) }));
    }
  },

  deleteSupplier: async (id) => {
    await supabase.from('suppliers').delete().eq('id', id);
    set((state) => ({ suppliers: state.suppliers.filter((s) => s.id !== id) }));
  },

  // ── Purchases ─────────────────────────────────────────────
  loadPurchaseInvoices: async () => {
    try {
      const { data } = await supabase.from('purchase_invoices').select('*, purchase_items(*)').order('created_at', { ascending: false });
      if (data) {
        const mapped = (data as any[]).map(inv => ({
          ...inv,
          paid_cash: inv.paid_cash || 0,
          paid_visa: inv.paid_visa || 0,
          paid_wallet: inv.paid_wallet || 0,
          paid_instapay: inv.paid_instapay || 0,
          items: inv.purchase_items || []
        }));
        set({ purchaseInvoices: mapped as PurchaseInvoice[] });
      }
    } catch (e) {
      console.error(e);
    }
  },

  addPurchaseInvoice: async (invoice, items, splitPayments) => {
    const state = get();
    // 1. Insert Invoice
    const { data: invData, error: invError } = await supabase
      .from('purchase_invoices')
      .insert({
        invoice_number: invoice.invoice_number,
        supplier_id: invoice.supplier_id,
        total: invoice.total,
        paid_amount: invoice.paid_amount,
        paid_cash: splitPayments?.cash || 0,
        paid_visa: splitPayments?.visa || 0,
        paid_wallet: splitPayments?.wallet || 0,
        paid_instapay: splitPayments?.instapay || 0,
        payment_method: invoice.payment_method
      })
      .select()
      .single();

    if (invError) {
      console.error("Add Purchase Invoice Error:", invError);
      throw new Error(`خطأ في حفظ الفاتورة: ${invError.message}`);
    }

    const newInvoiceId = (invData as any).id;

    // 2. Insert Items
    const itemsToInsert = items.map(item => ({
      invoice_id: newInvoiceId,
      product_id: item.product_id,
      quantity: item.quantity,
      purchase_price: item.purchase_price
    }));

    const { error: itemsError } = await supabase.from('purchase_items').insert(itemsToInsert);
    if (itemsError) {
      console.error("Add Purchase Items Error:", itemsError);
      throw new Error(`خطأ في حفظ أصناف الفاتورة: ${itemsError.message}`);
    }

    // 3. Update stock and average price for each product
    const updatedProducts = [...state.products];
    for (const item of items) {
      const productIndex = updatedProducts.findIndex(p => p.id === item.product_id);
      if (productIndex !== -1) {
        const product = updatedProducts[productIndex];
        const oldQty = product.stock_quantity;
        const oldAvgPrice = product.average_purchase_price || product.purchase_price || 0;
        
        const newQty = oldQty + item.quantity;
        const newTotalValue = (oldQty * oldAvgPrice) + (item.quantity * item.purchase_price);
        const newAvgPrice = newQty > 0 ? newTotalValue / newQty : 0;

        // Update DB
        await supabase.from('products').update({
          stock_quantity: newQty,
          average_purchase_price: newAvgPrice,
          purchase_price: item.purchase_price
        }).eq('id', product.id);

        // Update local state copy
        updatedProducts[productIndex] = {
          ...product,
          stock_quantity: newQty,
          average_purchase_price: newAvgPrice,
          purchase_price: item.purchase_price
        };
      }
    }

    // 4. Update local state
    const completeInvoice: PurchaseInvoice = {
      ...invData as any,
      items
    };

    set({
      purchaseInvoices: [completeInvoice, ...state.purchaseInvoices],
      products: updatedProducts
    });

    new BroadcastChannel('cashier-sync').postMessage('sync_products');
  },

  paySupplierDebt: async (supplierId, amount, splitPayments) => {
    const state = get();
    const invoiceNumber = `PAY-${Date.now()}`;
    
    try {
      const { data, error } = await supabase
        .from('purchase_invoices')
        .insert({
          invoice_number: invoiceNumber,
          supplier_id: supplierId,
          total: 0,
          paid_amount: amount,
          paid_cash: splitPayments?.cash || 0,
          paid_visa: splitPayments?.visa || 0,
          paid_wallet: splitPayments?.wallet || 0,
          paid_instapay: splitPayments?.instapay || 0,
          payment_method: (splitPayments?.cash || 0) >= (splitPayments?.visa || 0) ? 'cash' : 'visa'
        })
        .select()
        .single();

      if (error) {
        console.error("Payment Insert Error:", error);
        throw error;
      }

      // Update local state with the complete record from DB (includes created_at)
      const newPayment: PurchaseInvoice = {
        ...(data as any),
        items: []
      };

      set({
        purchaseInvoices: [newPayment, ...state.purchaseInvoices]
      });
    } catch (e) {
      console.error("Pay Supplier Debt Exception:", e);
      throw e;
    }
  },

  updateCustomer: async (id, updated) => {
    const { error } = await supabase.from('customers').update(updated).eq('id', id);
    if (error) {
      console.error("Update Customer Error:", error);
      throw error;
    }
    set((state) => ({
      customers: state.customers.map((c) => (c.id === id ? { ...c, ...updated } : c))
    }));
  },

  // ── Employees ─────────────────────────────────────────────
  loadEmployees: async () => {
    const [empRes, transRes] = await Promise.all([
      supabase.from('employees').select('*').order('created_at', { ascending: false }),
      supabase.from('employee_transactions').select('*').order('created_at', { ascending: false }),
    ]);
    if (empRes.data) set({ employees: empRes.data as Employee[] });
    if (transRes.data) set({ employeeTransactions: transRes.data as EmployeeTransaction[] });
  },

  addEmployee: async (employee) => {
    const { data, error } = await supabase.from('employees').insert(employee).select().single();
    if (error) {
      console.error("Add Employee Error:", error);
      return;
    }
    if (data) {
      set((state) => ({ employees: [data as Employee, ...state.employees] }));
    }
  },

  updateEmployee: async (id, updated) => {
    const { data, error } = await supabase.from('employees').update(updated).eq('id', id).select().single();
    if (error) {
      console.error("Update Employee Error:", error);
      return;
    }
    if (data) {
      set((state) => ({ employees: state.employees.map((e) => (e.id === id ? { ...e, ...updated } : e)) }));
    }
  },

  deleteEmployee: async (id) => {
    await supabase.from('employees').delete().eq('id', id);
    set((state) => ({ 
      employees: state.employees.filter((e) => e.id !== id),
      employeeTransactions: state.employeeTransactions.filter(t => t.employee_id !== id)
    }));
  },

  addEmployeeTransaction: async (transaction) => {
    const { data, error } = await supabase.from('employee_transactions').insert(transaction).select().single();
    if (error) {
      console.error("Add Employee Transaction Error:", error);
      return;
    }
    
    if (data) {
      const emp = get().employees.find(e => e.id === transaction.employee_id);
      const note = `${transaction.type === 'salary' ? 'راتب' : 'سلفة'} - ${emp?.name || 'موظف'}${transaction.note ? ` (${transaction.note})` : ''}`;
      
      // Add to expenses
      await get().addExpense({
        category: 'رواتب',
        amount: transaction.amount,
        paid_cash: transaction.paid_cash,
        paid_visa: transaction.paid_visa,
        paid_wallet: transaction.paid_wallet,
        paid_instapay: transaction.paid_instapay,
        note: note,
        payment_method: transaction.payment_method
      });

      set((state) => ({ employeeTransactions: [data as EmployeeTransaction, ...state.employeeTransactions] }));
    }
  },
}));
