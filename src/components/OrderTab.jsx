import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Building2, Phone, MapPin, Package, Plus, Trash2,
  Send, Clock, CheckCircle, Search, X,
  MessageCircle, Download, History, ShoppingCart,
  Users, Edit3, FileText,
} from 'lucide-react';
import { supabase } from '../supabase-config';
import {
  generateOrderPDF,
  validatePakistaniNumber,
  toWaNumber,
  SHOP,
} from './orderUtils';
import VendorsModal  from './VendorsModal';
import OrderHistory  from './OrderHistory';

// ── Shared style constants ────────────────────────────────────────────────────
const inputCls =
  'w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-800 bg-white ' +
  'outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-200 transition-all';
const labelCls =
  'block text-xs font-semibold text-slate-800 mb-1.5 uppercase tracking-wide';

// ── Vendor persistence ────────────────────────────────────────────────────────
const LS_KEY = 'adnan_vendors_v1';

async function loadVendorsFromDB(setSavedVendors, setLoadingVendors) {
  setLoadingVendors(true);
  try {
    const { data, error } = await supabase.from('vendors').select('*').order('name');
    if (!error && data) { setSavedVendors(data); setLoadingVendors(false); return; }
  } catch (_) {}
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) setSavedVendors(JSON.parse(raw));
  } catch (_) {}
  setLoadingVendors(false);
}

async function saveVendorToDB(name, phone, address, setSavedVendors) {
  if (!name.trim()) return;
  const entry = { name: name.trim(), phone: (phone || '').trim(), address: (address || '').trim() };
  let usedSupabase = false;
  try {
    const { error } = await supabase
      .from('vendors')
      .upsert({ ...entry, updated_at: new Date().toISOString() }, { onConflict: 'name' });
    if (!error) usedSupabase = true;
  } catch (_) {}

  if (!usedSupabase) {
    try {
      const raw      = localStorage.getItem(LS_KEY);
      const existing = raw ? JSON.parse(raw) : [];
      const idx      = existing.findIndex((v) => v.name.toLowerCase() === entry.name.toLowerCase());
      if (idx >= 0) existing[idx] = { ...existing[idx], ...entry };
      else          existing.push({ ...entry, id: `local_${Date.now()}` });
      localStorage.setItem(LS_KEY, JSON.stringify(existing));
      setSavedVendors(existing);
    } catch (_) {}
    return;
  }
  // Reload from Supabase so the list is fresh
  const { data } = await supabase.from('vendors').select('*').order('name');
  if (data) setSavedVendors(data);
}

async function deleteVendorFromDB(vendorItem, setSavedVendors, confirm) {
  const ok = await confirm('Remove this vendor from saved vendors?');
  if (!ok) return;
  if (vendorItem.id && !String(vendorItem.id).startsWith('local_')) {
    try {
      const { error } = await supabase.from('vendors').delete().eq('id', vendorItem.id);
      if (!error) {
        setSavedVendors((prev) => prev.filter((v) => v.id !== vendorItem.id));
        return;
      }
    } catch (_) {}
  }
  try {
    const raw     = localStorage.getItem(LS_KEY);
    const existing = raw ? JSON.parse(raw) : [];
    const updated  = existing.filter((v) => v.name.toLowerCase() !== vendorItem.name.toLowerCase());
    localStorage.setItem(LS_KEY, JSON.stringify(updated));
    setSavedVendors(updated);
  } catch (e) { alert('Error: ' + e.message); }
}

async function updateVendorInDB(vendorItem, updatedData, setSavedVendors, alert) {
  const entry = {
    name:    updatedData.name.trim(),
    phone:   (updatedData.phone    || '').trim(),
    address: (updatedData.address  || '').trim(),
  };
  if (vendorItem.id && !String(vendorItem.id).startsWith('local_')) {
    try {
      const { error } = await supabase
        .from('vendors')
        .update({ ...entry, updated_at: new Date().toISOString() })
        .eq('id', vendorItem.id);
      if (!error) {
        setSavedVendors((prev) =>
          prev.map((v) => (v.id === vendorItem.id ? { ...v, ...entry } : v)),
        );
        return;
      }
    } catch (_) {}
  }
  // localStorage fallback
  try {
    const raw      = localStorage.getItem(LS_KEY);
    const existing = raw ? JSON.parse(raw) : [];
    const idx      = existing.findIndex((v) => v.name.toLowerCase() === vendorItem.name.toLowerCase());
    if (idx >= 0) existing[idx] = { ...existing[idx], ...entry };
    localStorage.setItem(LS_KEY, JSON.stringify(existing));
    setSavedVendors(existing);
  } catch (e) { await alert('Error: ' + e.message); }
}

// ══════════════════════════════════════════════════════════════════════════════
// OrderTab — main component
// Props:  inventory   Product[]
//         orders      Order[]  (realtime from parent)
//         confirm     (message) => Promise<boolean>
//         alert       (message) => Promise<void>
// ══════════════════════════════════════════════════════════════════════════════
export default function OrderTab({ inventory, orders, confirm, alert }) {
  const [view, setView] = useState('create');
  const [showManualEntry, setShowManualEntry] = useState(false);

  // ── Manual Product Entry ────────────────────────────────────────────────────
  const [manualProduct, setManualProduct] = useState({
    name: '',
    brand: '',
    type: '',
    quantity: 1,
  });

  // ── Vendor autocomplete (create form) ─────────────────────────────────────
  const [vendorName,     setVendorName]     = useState('');
  const [vendorPhone,    setVendorPhone]    = useState('');
  const [vendorAddress,  setVendorAddress]  = useState('');
  const [showVendorSugg, setShowVendorSugg] = useState(false);
  const [vendorSugg,     setVendorSugg]     = useState([]);
  const [activeSuggIdx,  setActiveSuggIdx]  = useState(-1);
  const vendorRef  = useRef(null);
  const suggRef    = useRef(null);

  // ── Shared vendor store ────────────────────────────────────────────────────
  const [savedVendors,    setSavedVendors]    = useState([]);
  const [loadingVendors,  setLoadingVendors]  = useState(false);
  const [showVendorsModal, setShowVendorsModal] = useState(false);

  const loadVendors = useCallback(
    () => loadVendorsFromDB(setSavedVendors, setLoadingVendors),
    [],
  );
  useEffect(() => { loadVendors(); }, [loadVendors]);

  // ── Product filter (create form) ───────────────────────────────────────────
  const [filterMode,       setFilterMode]       = useState([]);
  const [customThreshold,  setCustomThreshold]  = useState(5);
  const [productSearch,    setProductSearch]    = useState('');

  // ── Order cart ─────────────────────────────────────────────────────────────
  const [orderItems,    setOrderItems]    = useState([]);
  const [showCartModal, setShowCartModal] = useState(false);
  const [loading,       setLoading]       = useState(false);

  // ── Vendor suggestions (merges DB vendors + order-derived vendors) ──────────
  const orderVendors = [
    ...new Map(
      orders.map((o) => [
        o.vendorName || o.vendor_name,
        {
          name:    o.vendorName    || o.vendor_name    || '',
          phone:   o.vendorPhone   || o.vendor_phone   || '',
          address: o.vendorAddress || o.vendor_address || '',
        },
      ]),
    ).values(),
  ].filter((v) => v.name);

  const allVendors = [
    ...savedVendors.map((v) => ({ name: v.name, phone: v.phone || '', address: v.address || '' })),
    ...orderVendors,
  ].filter(
    (v, i, arr) =>
      arr.findIndex((x) => x.name.toLowerCase() === v.name.toLowerCase()) === i,
  );

  useEffect(() => {
    if (vendorName.trim().length > 0) {
      const sugg = allVendors.filter((v) =>
        v.name.toLowerCase().includes(vendorName.toLowerCase()),
      );
      setVendorSugg(sugg);
      setShowVendorSugg(sugg.length > 0);
      setActiveSuggIdx(-1);
    } else {
      setShowVendorSugg(false);
      setActiveSuggIdx(-1);
    }
  }, [vendorName, orders, savedVendors]); // eslint-disable-line

  useEffect(() => {
    const handler = (e) => {
      if (vendorRef.current && !vendorRef.current.contains(e.target))
        setShowVendorSugg(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (activeSuggIdx >= 0 && suggRef.current) {
      const item = suggRef.current.children[activeSuggIdx];
      if (item) item.scrollIntoView({ block: 'nearest' });
    }
  }, [activeSuggIdx]);

  const handleVendorKeyDown = (e) => {
    if (!showVendorSugg || !vendorSugg.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault(); setActiveSuggIdx((i) => Math.min(i + 1, vendorSugg.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault(); setActiveSuggIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && activeSuggIdx >= 0) {
      e.preventDefault();
      const v = vendorSugg[activeSuggIdx];
      setVendorName(v.name); setVendorPhone(v.phone); setVendorAddress(v.address);
      setShowVendorSugg(false); setActiveSuggIdx(-1);
    } else if (e.key === 'Escape') {
      setShowVendorSugg(false); setActiveSuggIdx(-1);
    }
  };

  // ── Product filtering ──────────────────────────────────────────────────────
  const showProductTable = filterMode.length > 0 || productSearch.trim().length > 0;

  const filteredProducts = inventory.filter((p) => {
    const matchesFilter = (() => {
      if (filterMode.length === 0) return true;
      if (filterMode.includes('outofstock') && p.stock === 0) return true;
      if (filterMode.includes('lowstock')   && p.stock > 0 && p.stock <= 5) return true;
      if (filterMode.includes('custom')     && p.stock < customThreshold) return true;
      return false;
    })();
    const matchesSearch =
      productSearch.trim() === '' ||
      [p.name, p.brand, p.type].some((f) =>
        f?.toLowerCase().includes(productSearch.toLowerCase()),
      );
    return (filterMode.length > 0 ? matchesFilter : true) && matchesSearch;
  }).filter((p) => (productSearch.trim() ? true : filterMode.length > 0));

  const toggleFilter = (mode) =>
    setFilterMode((prev) =>
      prev.includes(mode) ? prev.filter((m) => m !== mode) : [...prev, mode],
    );

  // ── Cart helpers ───────────────────────────────────────────────────────────
  const addToOrder = (p) => {
    if (orderItems.find((i) => i.id === p.id)) return;
    setOrderItems((prev) => [
      ...prev,
      { 
        id: p.id, 
        name: p.name, 
        brand: p.brand || '—', 
        type: p.type, 
        currentStock: p.stock, 
        orderQuantity: 10,
        isManual: false 
      },
    ]);
  };

  const addManualProduct = async () => {
    if (!manualProduct.name.trim()) {
      await alert('Please enter product name');
      return;
    }
    if (!manualProduct.quantity || manualProduct.quantity < 1) {
      await alert('Please enter valid quantity');
      return;
    }

    const newId = `manual_${Date.now()}_${Math.random()}`;
    setOrderItems((prev) => [
      ...prev,
      {
        id: newId,
        name: manualProduct.name.trim(),
        brand: manualProduct.brand.trim() || 'New',
        type: manualProduct.type.trim() || 'General',
        currentStock: 0,
        orderQuantity: manualProduct.quantity,
        isManual: true,
        manualDetails: {
          name: manualProduct.name.trim(),
          brand: manualProduct.brand.trim() || 'New',
          type: manualProduct.type.trim() || 'General',
        }
      },
    ]);
    
    // Reset manual product form
    setManualProduct({ name: '', brand: '', type: '', quantity: 1 });
    setShowManualEntry(false);
  };

  const removeFromOrder = (id) => setOrderItems((prev) => prev.filter((i) => i.id !== id));
  const updateQty = (id, qty) =>
    setOrderItems((prev) =>
      prev.map((i) => {
        if (i.id !== id) return i;
        if (qty === '') return { ...i, orderQuantity: '' };
        const num = parseInt(qty);
        return { ...i, orderQuantity: isNaN(num) ? '' : num };
      }),
    );
  const totalCartQty = orderItems.reduce((s, i) => s + (Number(i.orderQuantity) || 0), 0);

  // ── Save order ─────────────────────────────────────────────────────────────
  const saveOrder = async (sendWhatsApp = false) => {
    if (!vendorName.trim()) return alert('Please enter vendor name');
    if (!orderItems.length) return alert('No items in order');
    setLoading(true);
    try {
      const orderNo   = `PO${Date.now().toString().slice(-7)}`;
      const orderData = {
        order_no:       orderNo,
        vendor_name:    vendorName.trim(),
        vendor_phone:   vendorPhone.trim(),
        vendor_address: vendorAddress.trim(),
        items:          orderItems.map(item => ({
          ...item,
          isManual: item.isManual || false,
          manualDetails: item.manualDetails || null
        })),
        status:         'pending',
        created_at:     new Date().toISOString(),
      };
      const { data, error } = await supabase.from('orders').insert(orderData).select().single();
      if (error) throw error;

      await saveVendorToDB(vendorName, vendorPhone, vendorAddress, setSavedVendors);

      const orderObj = {
        ...orderData,
        id: data.id, orderNo,
        vendorName:    orderData.vendor_name,
        vendorPhone:   orderData.vendor_phone,
        vendorAddress: orderData.vendor_address,
        createdAt:     orderData.created_at,
      };
      const blob = generateOrderPDF(orderObj, true);

      if (sendWhatsApp && vendorPhone && validatePakistaniNumber(vendorPhone)) {
        const file  = new File([blob], `PurchaseOrder_${orderNo}.pdf`, { type: 'application/pdf' });
        const waNum = toWaNumber(vendorPhone);
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: `Purchase Order ${orderNo}` });
        } else {
          const url = URL.createObjectURL(blob);
          const a   = document.createElement('a'); a.href = url; a.download = `PurchaseOrder_${orderNo}.pdf`; a.click();
          URL.revokeObjectURL(url);
          const msg =
            `Hello *${vendorName}*!\n\nPurchase Order *${orderNo}* from *${SHOP.name}*.\n` +
            `📦 ${orderItems.length} products | 🔢 ${orderItems.reduce((s, i) => s + i.orderQuantity, 0)} units total.\n\n` +
            `Please see the attached PDF for full details.\n\n📞 ${SHOP.phone}\n📍 ${SHOP.address}`;
          setTimeout(() => window.open(`https://wa.me/${waNum}?text=${encodeURIComponent(msg)}`, '_blank'), 600);
        }
      } else {
        const url = URL.createObjectURL(blob);
        const a   = document.createElement('a'); a.href = url; a.download = `PurchaseOrder_${orderNo}.pdf`; a.click();
        URL.revokeObjectURL(url);
      }

      // Reset form
      setOrderItems([]); setVendorName(''); setVendorPhone(''); setVendorAddress('');
      setFilterMode([]); setProductSearch(''); setView('history'); setShowCartModal(false);
    } catch (err) { await alert('Failed: ' + err.message); }
    finally { setLoading(false); }
  };

  // ── Filter config ──────────────────────────────────────────────────────────
  const filterConfig = [
    {
      key: 'outofstock', emoji: '🚫', label: 'Out of Stock',
      sub: `${inventory.filter((p) => p.stock === 0).length} items with 0 qty`,
      color: '#dc2626', activeClass: 'border-red-500 bg-red-50',
    },
    {
      key: 'lowstock', emoji: '⚠️', label: 'Low Stock (≤ 5)',
      sub: `${inventory.filter((p) => p.stock > 0 && p.stock <= 5).length} items at risk`,
      color: '#d97706', activeClass: 'border-amber-500 bg-amber-50',
    },
    {
      key: 'custom', emoji: '🔢', label: 'Custom Threshold',
      sub: `Items below ${customThreshold} units`,
      color: '#7c3aed', activeClass: 'border-violet-500 bg-violet-50',
    },
  ];

  const pendingCount = orders.filter((o) => o.status === 'pending').length;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* ── View Switcher ── */}
      <div className="flex gap-2 sm:gap-3 mb-6">
        <button
          className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 py-2.5 rounded-lg font-semibold text-xs sm:text-sm border transition-all ${
            view === 'create'
              ? 'bg-gradient-to-br from-cyan-700 to-cyan-500 text-white shadow-md border-transparent'
              : 'bg-slate-100 text-slate-500 border-slate-300 hover:bg-slate-200'
          }`}
          onClick={() => setView('create')}
        >
          <Plus size={16} /> New Order
        </button>
        <button
          className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 py-2.5 rounded-lg font-semibold text-xs sm:text-sm border transition-all ${
            view === 'history'
              ? 'bg-gradient-to-br from-cyan-700 to-cyan-500 text-white shadow-md border-transparent'
              : 'bg-slate-100 text-slate-500 border-slate-300 hover:bg-slate-200'
          }`}
          onClick={() => setView('history')}
        >
          <History size={16} /> History ({orders.length})
          {pendingCount > 0 && (
            <span className="bg-amber-400 text-white rounded-full text-xs font-extrabold px-1.5 py-0.5 leading-none">
              {pendingCount}
            </span>
          )}
        </button>
        <button
          className={`flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2.5 rounded-lg font-semibold text-xs sm:text-sm border transition-all ${
            showVendorsModal
              ? 'bg-gradient-to-br from-violet-600 to-violet-500 text-white shadow-md border-transparent'
              : 'bg-slate-100 text-slate-500 border-slate-300 hover:bg-slate-200'
          }`}
          onClick={() => { setShowVendorsModal(true); loadVendors(); }}
        >
          <Users size={16} />
          <span className="hidden sm:inline">Vendors</span>
          <span className="sm:hidden">{savedVendors.length > 0 ? savedVendors.length : ''}</span>
        </button>
      </div>

      {/* ════════════ CREATE ORDER ════════════ */}
      {view === 'create' && (
        <div>
          {/* ── Filter Bar ── */}
          <div className="flex flex-wrap items-center gap-3 px-4 sm:px-5 py-4 bg-white border border-sky-200 rounded-xl mb-5 shadow-sm">
            {filterConfig.map((f) => {
              const on = filterMode.includes(f.key);
              return (
                <div
                  key={f.key}
                  onClick={() => toggleFilter(f.key)}
                  className={`flex items-center gap-2 flex-1 min-w-[160px] sm:min-w-[200px] px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg cursor-pointer border-2 transition-all select-none ${
                    on ? f.activeClass : 'border-slate-300 bg-white hover:border-cyan-300'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-[13px] sm:text-[15px] truncate" style={{ color: on ? f.color : undefined }}>
                      {f.emoji} {f.label}
                    </div>
                    <div className="text-xs sm:text-sm text-slate-500 mt-0.5">{f.sub}</div>
                  </div>
                  <div
                    className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                      on ? 'border-current' : 'border-slate-300 bg-white'
                    }`}
                    style={{ background: on ? f.color : undefined, borderColor: on ? f.color : undefined }}
                  >
                    {on && (
                      <svg viewBox="0 0 10 8" width="10" height="10">
                        <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                </div>
              );
            })}

            {filterMode.includes('custom') && (
              <div className="flex items-center gap-2 sm:gap-3 py-2 w-full sm:w-auto">
                <label className="text-sm font-semibold text-violet-700 whitespace-nowrap">Show items below:</label>
                <input
                  type="number" min="1" value={customThreshold}
                  onChange={(e) => setCustomThreshold(Math.max(1, parseInt(e.target.value) || 1))}
                  className="max-w-[80px] text-center font-mono font-bold border-2 border-violet-500 rounded-lg px-2 py-1.5 text-base outline-none focus:ring-2 focus:ring-violet-200"
                />
                <span className="text-sm text-slate-500">units</span>
              </div>
            )}

            <div className={`w-full mt-1 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium border ${
              filterMode.length > 0 ? 'bg-sky-50 text-cyan-800 border-sky-200' : 'bg-slate-50 text-slate-500 border-slate-200'
            }`}>
              {filterMode.length === 0
                ? 'ℹ️ Click a filter above to show products — or use the search bar'
                : `🔍 ${filteredProducts.length} product${filteredProducts.length !== 1 ? 's' : ''} match your filter${filterMode.length > 1 ? 's' : ''}`
              }
            </div>

            {filterMode.length > 0 && (
              <button
                className="flex items-center gap-1.5 text-sm text-slate-500 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                onClick={() => setFilterMode([])}
              >
                <X size={14} /> Clear Filters
              </button>
            )}
          </div>

          {/* ── Two-column layout ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* LEFT: Vendor Details */}
            <div className="bg-white rounded-xl border border-sky-200 shadow-sm overflow-hidden">
              <div className="flex justify-between items-center px-5 py-4 border-b border-sky-100 bg-gradient-to-r from-sky-50 to-cyan-50">
                <div className="flex items-center gap-2 text-base sm:text-lg font-bold text-cyan-800">
                  <Building2 size={20} /> Vendor Details
                </div>
              </div>
              <div className="p-4 sm:p-6">
                {/* Vendor name + autocomplete */}
                <div className="mb-4 relative" ref={vendorRef}>
                  <label className={labelCls}>Vendor Name <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
                    <input
                      className={inputCls + ' pl-10'}
                      placeholder="Enter or search vendor…"
                      value={vendorName}
                      onChange={(e) => setVendorName(e.target.value)}
                      onKeyDown={handleVendorKeyDown}
                      autoComplete="off"
                    />
                  </div>
                  {showVendorSugg && (
                    <div
                      ref={suggRef}
                      className="absolute top-[calc(100%+6px)] left-0 right-0 z-[300] bg-white border-2 border-cyan-600 rounded-xl shadow-2xl max-h-56 overflow-y-auto"
                    >
                      {vendorSugg.map((v, i) => (
                        <div
                          key={i}
                          className={`px-4 py-3 cursor-pointer border-b border-sky-50 transition-colors last:border-0 ${
                            activeSuggIdx === i ? 'bg-cyan-50 border-l-4 border-l-cyan-500' : 'hover:bg-sky-50'
                          }`}
                          onMouseEnter={() => setActiveSuggIdx(i)}
                          onClick={() => {
                            setVendorName(v.name); setVendorPhone(v.phone); setVendorAddress(v.address);
                            setShowVendorSugg(false); setActiveSuggIdx(-1);
                          }}
                        >
                          <div className="font-bold text-base">{v.name}</div>
                          {v.phone   && <div className="text-sm text-slate-500 mt-0.5">📞 {v.phone}</div>}
                          {v.address && <div className="text-sm text-slate-500 mt-0.5">📍 {v.address}</div>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Vendor phone */}
                <div className="mb-4">
                  <label className={labelCls}>Vendor Phone</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
                    <input
                      className={`${inputCls} pl-10 ${vendorPhone && validatePakistaniNumber(vendorPhone) ? 'border-emerald-500' : ''}`}
                      placeholder="0300-1234567"
                      value={vendorPhone}
                      onChange={(e) => setVendorPhone(e.target.value)}
                      maxLength={15}
                    />
                  </div>
                  {vendorPhone && validatePakistaniNumber(vendorPhone) && (
                    <div className="text-emerald-600 text-xs sm:text-sm mt-1.5">✓ Valid — WhatsApp PDF will be sent directly</div>
                  )}
                  {vendorPhone && !validatePakistaniNumber(vendorPhone) && (
                    <div className="text-slate-400 text-xs sm:text-sm mt-1.5">Enter valid Pakistani number for WhatsApp</div>
                  )}
                </div>

                {/* Vendor address */}
                <div>
                  <label className={labelCls}>Vendor Address</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
                    <input
                      className={`${inputCls} pl-10`}
                      placeholder="Optional address"
                      value={vendorAddress}
                      onChange={(e) => setVendorAddress(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT: Product List */}
            <div className="bg-white rounded-xl border border-sky-200 shadow-sm overflow-hidden">
              <div className="flex justify-between items-center px-4 sm:px-5 py-4 border-b border-sky-100 bg-gradient-to-r from-sky-50 to-cyan-50">
                <div className="flex items-center gap-2 text-base sm:text-lg font-bold text-cyan-800">
                  <Package size={20} /> Products
                  {showProductTable && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-cyan-100 text-cyan-800">
                      {filteredProducts.length}
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-lg bg-gradient-to-br from-emerald-600 to-emerald-500 text-white text-xs font-semibold shadow hover:-translate-y-px transition-all"
                    onClick={() => setShowManualEntry(true)}
                  >
                    <Edit3 size={13} /> Add New Product
                  </button>
                  {showProductTable && filteredProducts.length > 0 && (
                    <button
                      className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-lg bg-gradient-to-br from-cyan-700 to-cyan-500 text-white text-xs font-semibold shadow hover:-translate-y-px transition-all"
                      onClick={() => filteredProducts.forEach((p) => addToOrder(p))}
                    >
                      <Plus size={13} /> Add All
                    </button>
                  )}
                </div>
              </div>

              {/* Search */}
              <div className="px-4 sm:px-5 pt-3.5 pb-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                  <input
                    className="w-full pl-9 pr-9 py-2.5 border border-slate-300 rounded-lg text-sm outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-200 transition-all"
                    placeholder="Search product by name, brand or type…"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                  />
                  {productSearch && (
                    <button className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" onClick={() => setProductSearch('')}>
                      <X size={15} />
                    </button>
                  )}
                </div>
              </div>

              {/* Manual Product Entry Modal */}
              {showManualEntry && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1000] p-4" onClick={() => setShowManualEntry(false)}>
                  <div className="bg-white rounded-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-xl font-bold text-cyan-800 flex items-center gap-2">
                        <Edit3 size={20} /> Add New Product
                      </h3>
                      <button onClick={() => setShowManualEntry(false)} className="text-slate-400 hover:text-slate-600">
                        <X size={24} />
                      </button>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <label className={labelCls}>Product Name <span className="text-red-500">*</span></label>
                        <input
                          className={inputCls}
                          placeholder="Enter product name"
                          value={manualProduct.name}
                          onChange={(e) => setManualProduct({ ...manualProduct, name: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className={labelCls}>Brand</label>
                        <input
                          className={inputCls}
                          placeholder="Enter brand name"
                          value={manualProduct.brand}
                          onChange={(e) => setManualProduct({ ...manualProduct, brand: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className={labelCls}>Type/Category</label>
                        <input
                          className={inputCls}
                          placeholder="Enter product type"
                          value={manualProduct.type}
                          onChange={(e) => setManualProduct({ ...manualProduct, type: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className={labelCls}>Order Quantity <span className="text-red-500">*</span></label>
                        <input
                          type="number"
                          min="1"
                          className={inputCls}
                          placeholder="Enter quantity"
                          value={manualProduct.quantity}
                          onChange={(e) => setManualProduct({ ...manualProduct, quantity: parseInt(e.target.value) || 1 })}
                        />
                      </div>
                      <div className="flex gap-3 pt-4">
                        <button
                          className="flex-1 py-2 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all"
                          onClick={() => setShowManualEntry(false)}
                        >
                          Cancel
                        </button>
                        <button
                          className="flex-1 py-2 rounded-lg bg-gradient-to-br from-emerald-600 to-emerald-500 text-white font-semibold hover:-translate-y-px transition-all"
                          onClick={addManualProduct}
                        >
                          Add to Order
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Product Table - ENLARGED ROWS AND TEXT */}
              {!showProductTable ? (
                <div className="text-center py-10 px-4 text-slate-400">
                  <Package size={44} className="mx-auto mb-2.5 opacity-20" />
                  <p className="font-semibold text-sm">No products shown</p>
                  <p className="text-xs mt-1">Use a filter or search to find products</p>
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="text-center py-10 text-slate-500">
                  <Package size={44} className="mx-auto mb-2 opacity-30" />
                  <p className="font-semibold text-sm">No products match</p>
                  <span className="text-xs">Adjust filters or search</span>
                </div>
              ) : (
                <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
                  <table className="w-full border-collapse text-sm" style={{ minWidth: '300px' }}>
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-gradient-to-r from-cyan-800 to-cyan-600">
                        <th className="px-4 py-3 text-left text-[12px] font-bold uppercase tracking-wide text-white w-[18%]">Brand</th>
                        <th className="px-4 py-3 text-left text-[12px] font-bold uppercase tracking-wide text-white">Product</th>
                        <th className="px-4 py-3 text-center text-[12px] font-bold uppercase tracking-wide text-white w-[18%]">Type</th>
                        <th className="px-4 py-3 text-center text-[12px] font-bold uppercase tracking-wide text-white w-[10%]">Stock</th>
                        <th className="px-4 py-3 text-center text-[12px] font-bold uppercase tracking-wide text-white w-[14%]">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredProducts.map((p, idx) => {
                        const isAdded = orderItems.some((i) => i.id === p.id);
                        return (
                          <tr
                            key={p.id}
                            className={`border-b border-sky-50 ${
                              isAdded ? 'bg-emerald-50' : idx % 2 === 0 ? 'bg-white' : 'bg-sky-50/40'
                            } hover:bg-sky-100 transition-colors`}
                          >
                            <td className="px-4 py-4 align-middle">
                              {p.brand
                                ? <span className="inline-block px-2 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide bg-cyan-100 text-cyan-800 whitespace-nowrap">{p.brand}</span>
                                : <span className="text-slate-300 text-sm">—</span>
                              }
                            </td>
                            <td className="px-4 py-4 align-middle">
                              <span className="font-semibold text-[15px] leading-tight block">{p.name}</span>
                            </td>
                            <td className="px-4 py-4 text-center align-middle">
                              <span className="inline-block px-2 py-1 rounded-full text-[11px] font-bold bg-violet-100 text-violet-700 whitespace-nowrap">
                                {p.type || '—'}
                              </span>
                            </td>
                            <td className="px-4 py-4 text-center align-middle">
                              <span className={`font-extrabold text-[16px] font-mono ${
                                p.stock === 0 ? 'text-red-600' : p.stock <= 5 ? 'text-amber-500' : 'text-emerald-600'
                              }`}>
                                {p.stock}
                              </span>
                            </td>
                            <td className="px-4 py-4 text-center align-middle">
                              <button
                                className={`text-[11px] px-4 py-2 rounded font-semibold flex items-center justify-center gap-1.5 mx-auto transition-all ${
                                  isAdded
                                    ? 'bg-slate-100 text-slate-500 border border-slate-300'
                                    : 'bg-gradient-to-br from-cyan-700 to-cyan-500 text-white shadow'
                                }`}
                                onClick={() => (isAdded ? removeFromOrder(p.id) : addToOrder(p))}
                              >
                                {isAdded ? <><X size={12} /> Added</> : <><Plus size={12} /> Add</>}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* ── Floating Cart Button ── */}
          {orderItems.length > 0 && (
            <button
              className="fixed bottom-6 right-6 w-16 h-16 rounded-full bg-gradient-to-br from-cyan-700 to-cyan-500 text-white flex items-center justify-center shadow-2xl shadow-cyan-900/40 z-[500] hover:scale-105 active:scale-95 transition-transform"
              onClick={() => setShowCartModal(true)}
            >
              <ShoppingCart size={26} />
              <span className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-red-500 text-white text-sm font-extrabold flex items-center justify-center border-2 border-white font-mono">
                {orderItems.length}
              </span>
            </button>
          )}

          {/* ── Cart Modal ── */}
          {showCartModal && (
            <div
              className="fixed inset-0 bg-black/65 backdrop-blur-sm flex items-end sm:items-center justify-center z-[1000] sm:p-4"
              onClick={() => setShowCartModal(false)}
            >
              <div
                className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg max-h-[90vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="flex justify-between items-center px-5 pt-5 pb-4 border-b border-sky-50 flex-shrink-0">
                  <div className="flex items-center gap-2.5 text-lg sm:text-xl font-bold">
                    <ShoppingCart size={22} /> Order Cart
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-100 text-cyan-800">{orderItems.length}</span>
                  </div>
                  <button
                    className="w-8 h-8 rounded-md bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-red-100 hover:text-red-500 transition-all"
                    onClick={() => setShowCartModal(false)}
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Cart items */}
                <div className="flex-1 overflow-y-auto min-h-0">
                  {orderItems.length === 0 ? (
                    <div className="text-center py-12 text-slate-500 px-4">
                      <ShoppingCart size={52} className="mx-auto mb-4 opacity-30" />
                      <p className="text-lg font-semibold mb-1.5">No items added</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse" style={{ minWidth: '380px' }}>
                        <thead>
                          <tr className="bg-gradient-to-r from-cyan-800 to-cyan-600">
                            <th className="px-4 py-3 text-left text-[12px] font-bold uppercase tracking-wide text-white w-[22%]">Brand</th>
                            <th className="px-4 py-3 text-left text-[12px] font-bold uppercase tracking-wide text-white">Name</th>
                            <th className="px-4 py-3 text-center text-[12px] font-bold uppercase tracking-wide text-white w-[20%]">Type</th>
                            <th className="px-4 py-3 text-center text-[12px] font-bold uppercase tracking-wide text-white w-[15%]">Qty</th>
                            <th className="px-4 py-3 text-center text-[12px] font-bold uppercase tracking-wide text-white w-[8%]"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {orderItems.map((item, idx) => (
                            <tr key={item.id} className={`border-b border-sky-50 ${idx % 2 === 1 ? 'bg-sky-50/50' : 'bg-white'}`}>
                              <td className="px-4 py-4 align-middle">
                                <span className={`font-bold text-[15px] truncate block ${item.isManual ? 'text-emerald-600' : 'text-cyan-800'}`}>
                                  {item.brand || '—'}
                                  {item.isManual && <span className="ml-1 text-[9px] bg-emerald-100 text-emerald-600 px-1.5 py-0.5 rounded">NEW</span>}
                                </span>
                              </td>
                              <td className="px-4 py-4 align-middle">
                                <span className="font-bold text-[15px] block truncate">{item.name}</span>
                              </td>
                              <td className="px-4 py-4 text-center align-middle">
                                <span className="inline-block px-2 py-1 rounded-full text-[11px] font-bold bg-violet-100 text-violet-700 whitespace-nowrap">
                                  {item.type || '—'}
                                </span>
                              </td>
                              <td className="px-4 py-4 text-center align-middle">
                                <input
                                  type="text"
                                  value={item.orderQuantity ?? ''}
                                  onChange={(e) => updateQty(item.id, e.target.value)}
                                  onBlur={() => { if (!item.orderQuantity || item.orderQuantity < 1) updateQty(item.id, 1); }}
                                  className="w-[60px] text-center border border-slate-300 rounded-md py-2 px-2 text-[15px] font-extrabold text-cyan-600 font-mono outline-none focus:border-cyan-600 focus:ring-1 focus:ring-cyan-200"
                                />
                               </td>
                              <td className="px-3 py-4 text-center align-middle">
                                <button
                                  className="text-red-500 hover:bg-red-50 p-2 rounded flex items-center justify-center transition-colors mx-auto"
                                  onClick={() => removeFromOrder(item.id)}
                                >
                                  <Trash2 size={16} />
                                </button>
                               </td>
                             </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {orderItems.length > 0 && (
                  <>
                    {/* Totals */}
                    <div className="px-5 py-3.5 border-t-2 border-cyan-600 bg-sky-50 flex-shrink-0">
                      <div className="flex justify-between mb-1.5 text-sm text-slate-500">
                        <span>Products:</span><strong>{orderItems.length}</strong>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Total Units:</span>
                        <strong className="text-cyan-600 font-mono text-lg">{totalCartQty}</strong>
                      </div>
                    </div>
                    {/* Actions */}
                    <div className="flex flex-col gap-2.5 px-5 pb-5 pt-3 border-t border-slate-100 flex-shrink-0">
                      {vendorPhone && validatePakistaniNumber(vendorPhone) ? (
                        <button
                          className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-gradient-to-br from-teal-700 to-green-500 text-white font-semibold text-sm sm:text-base shadow-md hover:-translate-y-px transition-all disabled:opacity-50"
                          onClick={() => saveOrder(true)}
                          disabled={loading}
                        >
                          {loading
                            ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Generating…</>
                            : <><MessageCircle size={18} /> Generate PDF & Send via WhatsApp</>
                          }
                        </button>
                      ) : (
                        <div className="px-3.5 py-2.5 rounded-lg text-xs sm:text-sm font-medium bg-sky-50 border-l-4 border-cyan-600 text-cyan-800 text-center">
                          📞 Enter a valid vendor phone to enable WhatsApp
                        </div>
                      )}
                      <button
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-gradient-to-br from-cyan-700 to-cyan-500 text-white font-semibold shadow hover:-translate-y-px transition-all disabled:opacity-50"
                        onClick={() => saveOrder(false)}
                        disabled={loading}
                      >
                        {loading
                          ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Saving…</>
                          : <><Download size={16} /> Save Order & Download PDF</>
                        }
                      </button>
                      <button
                        className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-slate-100 text-slate-500 border border-slate-300 hover:bg-slate-200 transition-all text-sm"
                        onClick={async () => {
                          const ok = await confirm('Clear all items?');
                          if (ok) setOrderItems([]);
                        }}
                      >
                        <Trash2 size={14} /> Clear Cart
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ════════════ ORDER HISTORY ════════════ */}
      {view === 'history' && (
        <OrderHistory orders={orders} inventory={inventory} confirm={confirm} alert={alert} />
      )}

      {/* ════════════ VENDORS MODAL ════════════ */}
      <VendorsModal
        show={showVendorsModal}
        onClose={() => setShowVendorsModal(false)}
        onSelectVendor={(v) => {
          setVendorName(v.name);
          setVendorPhone(v.phone || '');
          setVendorAddress(v.address || '');
          setView('create');
        }}
        savedVendors={savedVendors}
        loadingVendors={loadingVendors}
        onDeleteVendor={(v)          => deleteVendorFromDB(v, setSavedVendors, confirm)}
        onUpdateVendor={(v, updated) => updateVendorInDB(v, updated, setSavedVendors, alert)}
      />
    </div>
  );
}