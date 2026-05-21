import { useState, useRef, useEffect } from 'react';
import { Search, ShoppingCart, X, RotateCcw, Trash2, Wrench } from 'lucide-react';
import { supabase } from '../supabase-config';

export default function PosTab({
  cart, setCart, inventory,
  searchTerm, setSearchTerm,
  customerName, setCustomerName,
  customerMobile, setCustomerMobile,
  setLastReceipt, setShowReceipt,
  setShowReturnModal,
  sales
}) {
  const [showSugg, setShowSugg]       = useState(false);
  const [loading, setLoading]         = useState(false);
  const [repairFees, setRepairFees]   = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const searchRef      = useRef(null);
  const searchInputRef = useRef(null);
  const dropdownRef    = useRef(null);

  const filtered = inventory.filter(p => {
    const q = searchTerm.toLowerCase().trim();
    if (!q) return true;
    const words = q.split(' ').filter(w => w.length > 0);
    const txt = `${p.name} ${p.brand} ${p.type}`.toLowerCase();
    return words.every(w => txt.includes(w));
  });

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!showSugg || filtered.length === 0) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightedIndex(prev => { const next = prev + 1; return next >= filtered.length ? 0 : next; }); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlightedIndex(prev => { const next = prev - 1; return next < 0 ? filtered.length - 1 : next; }); }
      else if (e.key === 'Enter') { e.preventDefault(); if (highlightedIndex >= 0 && highlightedIndex < filtered.length) { const p = filtered[highlightedIndex]; if (p.stock > 0) addToCart(p); } }
      else if (e.key === 'Escape') { setShowSugg(false); setHighlightedIndex(-1); }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showSugg, filtered, highlightedIndex]);

  useEffect(() => {
    if (highlightedIndex >= 0 && dropdownRef.current) {
      const rows = dropdownRef.current.querySelectorAll('.product-row-item');
      if (rows[highlightedIndex]) rows[highlightedIndex].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [highlightedIndex]);

  const addToCart = (p) => {
    if (p.stock <= 0) return alert('Out of stock!');
    const ex = cart.find(i => i.id === p.id);
    if (ex) {
      if (ex.quantity >= p.stock) return alert(`Only ${p.stock} units available`);
      setCart(cart.map(i => i.id === p.id ? { ...i, quantity: i.quantity + 1 } : i));
    } else {
      setCart([...cart, { ...p, quantity: 1, soldAt: p.retailPrice }]);
    }
    setSearchTerm(''); setShowSugg(false); setHighlightedIndex(-1);
    searchInputRef.current?.focus();
  };

  const updateQty = (id, qty) => {
    const item = cart.find(i => i.id === id);
    if (qty === '') { setCart(cart.map(i => i.id === id ? { ...i, quantity: '' } : i)); return; }
    const num = parseInt(qty);
    if (isNaN(num)) { setCart(cart.map(i => i.id === id ? { ...i, quantity: '' } : i)); return; }
    if (num > item.stock) return alert(`Only ${item.stock} units available`);
    if (num <= 0) setCart(cart.filter(i => i.id !== id));
    else setCart(cart.map(i => i.id === id ? { ...i, quantity: num } : i));
  };

  const handleQtyBlur = (id, currentQty) => {
    if (currentQty === '' || currentQty === undefined || currentQty === null)
      setCart(cart.map(i => i.id === id ? { ...i, quantity: 1 } : i));
  };

  const updatePrice = (id, price) => {
    if (price === '') { setCart(cart.map(i => i.id === id ? { ...i, soldAt: '' } : i)); return; }
    const num = parseFloat(price);
    if (isNaN(num)) { setCart(cart.map(i => i.id === id ? { ...i, soldAt: '' } : i)); return; }
    setCart(cart.map(i => i.id === id ? { ...i, soldAt: num } : i));
  };

  const handlePriceBlur = (id, currentPrice, originalRetailPrice) => {
    if (currentPrice === '' || currentPrice === undefined || currentPrice === null)
      setCart(cart.map(i => i.id === id ? { ...i, soldAt: originalRetailPrice } : i));
  };

  const cartSubtotal = () => cart.reduce((s, i) => s + (parseFloat(i.soldAt) || 0) * (parseInt(i.quantity) || 0), 0);
  const repFees      = () => parseFloat(repairFees) || 0;
  const total        = () => cartSubtotal() + repFees();

  const completeSale = async () => {
    if (cart.length === 0 && !repFees()) return alert('Cart is empty');
    const invalidItems = cart.filter(i => !i.quantity || i.quantity === '' || !i.soldAt || i.soldAt === '');
    if (invalidItems.length > 0) { alert('Please fill in all quantities and prices before completing the sale.'); return; }
    setLoading(true);
    try {
      for (const item of cart) {
        const { error } = await supabase.from('inventory').update({ stock: item.stock - item.quantity, updated_at: new Date().toISOString() }).eq('id', item.id);
        if (error) throw error;
      }
      const receiptNo = `AMS${Date.now().toString().slice(-6)}`;
      const items = cart.map(i => ({
        id: i.id, name: i.name, brand: i.brand || 'N/A', type: i.type,
        quantity: parseInt(i.quantity), buyPrice: i.buyPrice, retailPrice: i.retailPrice,
        soldAt: parseFloat(i.soldAt), profit: (parseFloat(i.soldAt) - i.buyPrice) * parseInt(i.quantity)
      }));
      if (repFees() > 0) items.push({ id: 'repair', name: 'Repair / Service Fees', brand: null, type: 'Service', quantity: 1, buyPrice: 0, retailPrice: repFees(), soldAt: repFees(), profit: repFees(), isRepair: true });
      const saleData = { customer_name: customerName.trim() || 'Walk-in Customer', customer_mobile: customerMobile.trim() || 'N/A', receipt_no: receiptNo, items, total: total(), timestamp: new Date().toISOString() };
      const { data, error } = await supabase.from('sales').insert(saleData).select().single();
      if (error) throw error;
      setLastReceipt({ ...saleData, id: data.id, receiptNo: saleData.receipt_no, customerName: saleData.customer_name, customerMobile: saleData.customer_mobile });
      setShowReceipt(true);
      setCart([]); setCustomerName(''); setCustomerMobile(''); setRepairFees('');
    } catch (err) {
      console.error(err); alert('Sale failed: ' + err.message);
    } finally { setLoading(false); }
  };

  const clearCart = () => { if (cart.length > 0 && confirm('Clear entire cart?')) { setCart([]); setRepairFees(''); } };

  useEffect(() => {
    const handler = (e) => { if (searchRef.current && !searchRef.current.contains(e.target)) { setShowSugg(false); setHighlightedIndex(-1); } };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const lowStockCount = inventory.filter(p => p.stock <= 5 && p.stock > 0).length;

  /*
   * Desktop column definitions — BOTH tables now share Brand | Product | Type order
   * Dropdown:  Brand 1fr | Product 2fr | Type 1fr | Buy 85px | Sell 85px | Stock 65px
   * Cart:      Brand 1fr | Product 2fr | Type 1fr | QTY 72px | Price 85px | Subtotal 85px | × 32px
   */
  const ddCols   = '1fr 2fr 1fr 85px 85px 65px';
  const cartCols = '1fr 2fr 1fr 72px 85px 85px 32px';

  return (
    <div className="flex flex-col gap-4">
      {/* Action Buttons */}
      <div className="flex gap-2.5">
        <button className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-lg bg-gradient-to-br from-cyan-700 to-cyan-500 text-white font-semibold text-sm shadow-md hover:-translate-y-px transition-all">
          <ShoppingCart size={16} /> New Sale
        </button>
        <button
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-lg bg-gradient-to-br from-cyan-700 to-cyan-500 text-white font-semibold text-sm shadow-md hover:-translate-y-px transition-all"
          onClick={() => setShowReturnModal(true)}
        >
          <RotateCcw size={16} /> Process Return
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* ── Search Column ───────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-sky-200 shadow-sm flex flex-col">
          <div className="flex justify-between items-center px-5 py-2 border-b border-sky-100 bg-gradient-to-r from-sky-50 to-cyan-50 rounded-t-xl">
            <div className="flex items-center gap-2 text-lg font-bold text-cyan-800 sm:text-xl"><Search size={18} /> Search Products</div>
          </div>

          <div className="p-5 flex flex-col flex-1 min-h-0">
            {/* Search Input + Dropdown */}
            <div className="relative" ref={searchRef}>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
                <input
                  ref={searchInputRef}
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-800 bg-white outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-200 transition-all sm:text-base"
                  placeholder="Search by name, brand, model..."
                  value={searchTerm}
                  autoFocus
                  onChange={e => { setSearchTerm(e.target.value); setShowSugg(e.target.value.length > 0); setHighlightedIndex(-1); }}
                />
              </div>

              {showSugg && filtered.length > 0 && (
                <div
                  ref={dropdownRef}
                  className="absolute top-[calc(100%+6px)] left-0 right-0 bg-white border-2 border-cyan-600 rounded-xl shadow-2xl z-[300]"
                  style={{ maxHeight: '55vh', overflowY: 'auto' }}
                >
                  {/* ── Desktop header: Brand | Product | Type | Buy | Sell | Stock ── */}
                  <div
                    className="hidden sm:grid gap-2 bg-gradient-to-r from-cyan-800 to-cyan-600 text-white text-xs font-bold uppercase tracking-wide px-3.5 py-2.5 sticky top-0 rounded-t-lg"
                    style={{ gridTemplateColumns: ddCols }}
                  >
                    <span>Brand</span>
                    <span>Product</span>
                    <span>Type</span>
                    <span className="text-center">Buy Rs.</span>
                    <span className="text-center">Sell Rs.</span>
                    <span className="text-center">Stock</span>
                  </div>

                  {filtered.map((p, idx) => {
                    const hl = idx === highlightedIndex;
                    const oos = p.stock <= 0;
                    const baseRow = `product-row-item border-b border-sky-50 last:border-0 cursor-pointer transition-colors
                      ${oos ? 'opacity-50 cursor-not-allowed bg-red-50' : hl ? 'bg-cyan-50 border-l-4 border-l-cyan-600' : 'hover:bg-sky-50'}`;

                    return (
                      <div key={p.id} onClick={() => !oos && addToCart(p)}>

                        {/* ── Mobile layout: 3 rows ── */}
                        <div className={`sm:hidden px-3 py-2.5 ${baseRow}`}>
                          {/* Row 1: Brand · Type pill */}
                          <div className="flex items-center justify-between gap-1.5 mb-1">
                            <span className="font-semibold text-slate-500 text-xs">{p.brand || '—'}</span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-cyan-100 text-cyan-800 shrink-0">{p.type}</span>
                          </div>
                          {/* Row 2: Product name */}
                          <div className="mb-2">
                            <span className="font-bold text-sm text-slate-800 block">{p.name}</span>
                          </div>
                          {/* Row 3: Buy · Sell · Stock with labels */}
                          <div className="flex items-center gap-2">
                            <div className="flex flex-col items-center flex-1 bg-amber-50 rounded-md px-2 py-1">
                              <span className="text-[9px] font-bold uppercase text-amber-500 tracking-wide">Buy Rs.</span>
                              <span className="text-xs font-bold font-mono text-amber-600">Rs.{p.buyPrice}</span>
                            </div>
                            <div className="flex flex-col items-center flex-1 bg-emerald-50 rounded-md px-2 py-1">
                              <span className="text-[9px] font-bold uppercase text-emerald-500 tracking-wide">Sell Rs.</span>
                              <span className="text-xs font-bold font-mono text-emerald-600">Rs.{p.retailPrice}</span>
                            </div>
                            <div className={`flex flex-col items-center flex-1 rounded-md px-2 py-1 ${p.stock <= 5 ? 'bg-red-50' : 'bg-slate-100'}`}>
                              <span className={`text-[9px] font-bold uppercase tracking-wide ${p.stock <= 5 ? 'text-red-400' : 'text-slate-400'}`}>Stock</span>
                              <span className={`text-xs font-bold font-mono ${p.stock <= 5 ? 'text-red-600' : 'text-slate-700'}`}>{p.stock}</span>
                            </div>
                          </div>
                        </div>

                        {/* ── Desktop layout: Brand | Product | Type | Buy | Sell | Stock ── */}
                        <div
                          className={`hidden sm:grid items-center gap-2 px-3.5 py-3 text-base ${baseRow}`}
                          style={{ gridTemplateColumns: ddCols }}
                        >
                          <span className="font-semibold text-slate-500 text-sm">{p.brand || '—'}</span>
                          <span className="font-bold text-base">{p.name}</span>
                          <span><span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-cyan-100 text-cyan-800">{p.type}</span></span>
                          <span className="text-center text-amber-500 font-bold font-mono text-sm">Rs.{p.buyPrice}</span>
                          <span className="text-center text-emerald-600 font-bold font-mono text-sm">Rs.{p.retailPrice}</span>
                          <span className={`text-center font-bold font-mono text-sm ${p.stock <= 5 ? 'text-red-600' : 'text-slate-800'}`}>{p.stock}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {showSugg && searchTerm && filtered.length === 0 && (
                <div className="absolute top-[calc(100%+6px)] left-0 right-0 bg-white border-2 border-cyan-600 rounded-xl shadow-2xl p-6 text-center z-[300]">
                  <p className="text-slate-500 font-semibold">No products found</p>
                  <p className="text-xs text-slate-400 mt-1">Try different keywords</p>
                </div>
              )}
            </div>

            <div className="mt-4 px-3.5 py-2.5 rounded-lg text-sm font-medium border-l-4 bg-sky-50 border-cyan-600 text-cyan-800 sm:text-base">
              {lowStockCount > 0 ? `⚠️ ${lowStockCount} product(s) running low on stock` : '✓ All products have adequate stock'}
            </div>
          </div>
        </div>

        {/* ── Cart Column ─────────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-sky-200 shadow-sm overflow-hidden flex flex-col">
          <div className="flex justify-between items-center px-5 py-2 border-b border-sky-100 bg-gradient-to-r from-sky-50 to-cyan-50">
            <div className="flex items-center gap-2 text-lg font-bold text-cyan-800 sm:text-xl">
              <ShoppingCart size={18} /> Cart ({cart.length})
            </div>
            {cart.length > 0 && (
              <button className="p-1.5 rounded-md text-red-500 hover:bg-red-50 transition-colors" onClick={clearCart} title="Clear Cart">
                <Trash2 size={16} />
              </button>
            )}
          </div>

          <div className="p-5 flex flex-col flex-1 min-h-0">
            {/* Customer Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
  <input
    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-200 transition-all sm:text-base"
    placeholder="Customer Name (Optional)"
    value={customerName}
    onChange={e => setCustomerName(e.target.value)}
  />

  <input
    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-200 transition-all sm:text-base"
    placeholder="Mobile Number (Optional)"
    value={customerMobile}
    onChange={e => setCustomerMobile(e.target.value)}
    maxLength={15}
  />
</div>

            {/* Cart Items */}
            <div className="flex-1 overflow-y-auto mb-3 min-h-0">
              {cart.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <ShoppingCart size={44} className="mx-auto mb-2 opacity-30" />
                  <p className="font-semibold mb-0.5">Cart is empty</p>
                  <span className="text-xs">Search and click a product to add</span>
                </div>
              ) : (
                <>
                  {/* ── Desktop table (sm+): Brand | Product | Type | QTY | Price | Subtotal | × ── */}
                  <div className="hidden sm:block w-full overflow-x-auto">
                    {/* Header */}
                    <div
                      className="grid gap-2 bg-gradient-to-r from-cyan-800 to-cyan-600 text-white text-xs font-bold uppercase tracking-wide px-3 py-2.5 rounded-t-lg"
                      style={{ gridTemplateColumns: cartCols }}
                    >
                      <span>Brand</span>
                      <span>Product</span>
                      <span>Type</span>
                      <span className='text-center'>QTY</span>
                      <span className='text-center'>Price Rs.</span>
                      <span className='text-center'>Subtotal</span>
                      <span />
                    </div>
                    {/* Rows */}
                    {cart.map(item => (
                      <div
                        key={item.id}
                        className="grid items-center gap-2 px-3 py-2.5 border-b border-sky-100 bg-gradient-to-r from-sky-50 to-cyan-50"
                        style={{ gridTemplateColumns: cartCols }}
                      >
                        {/* Brand */}
                        <span className="text-sm text-slate-500 font-semibold truncate">{item.brand || '—'}</span>
                        {/* Product */}
                        <span className="font-bold text-slate-800 text-base truncate">{item.name}</span>
                        {/* Type */}
                        <span><span className="px-1.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-100 text-cyan-800">{item.type}</span></span>
                        {/* QTY */}
                        <input
                          type="text" inputMode="numeric"
                          value={item.quantity}
                          onChange={e => updateQty(item.id, e.target.value)}
                          onBlur={() => handleQtyBlur(item.id, item.quantity)}
                          className="w-full px-1 py-1.5 border border-slate-300 rounded-md text-sm font-bold text-center font-mono outline-none focus:border-cyan-600 transition-all sm:text-base"
                        />
                        {/* Price */}
                        <input
                          type="text" inputMode="decimal"
                          value={item.soldAt}
                          onChange={e => updatePrice(item.id, e.target.value)}
                          onBlur={() => handlePriceBlur(item.id, item.soldAt, item.retailPrice)}
                          className="w-full px-1 py-1.5 border border-slate-300 rounded-md text-sm font-bold text-center text-emerald-600 font-mono outline-none focus:border-cyan-600 transition-all sm:text-base"
                        />
                        {/* Subtotal */}
                        <span className="text-center font-extrabold text-cyan-600 text-base font-mono">
                          Rs.{((parseFloat(item.soldAt) || 0) * (parseInt(item.quantity) || 0)).toFixed(0)}
                        </span>
                        {/* Remove */}
                        <button
                          className="p-1 rounded text-red-500 hover:bg-red-50 transition-colors justify-self-center"
                          onClick={() => setCart(cart.filter(i => i.id !== item.id))}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* ── Mobile cards: 3 rows per item ── */}
                  <div className="sm:hidden flex flex-col divide-y divide-sky-100">
                    {cart.map(item => (
                      <div key={item.id} className="px-2 py-3 bg-gradient-to-r from-sky-50 to-cyan-50">
                        {/* Row 1: Brand · Type · × */}
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="font-semibold text-slate-500 text-xs">{item.brand || '—'}</span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-cyan-100 text-cyan-800">{item.type}</span>
                            <button
                              className="p-1 rounded text-red-500 hover:bg-red-100 transition-colors"
                              onClick={() => setCart(cart.filter(i => i.id !== item.id))}
                            >
                              <X size={14} />
                            </button>
                          </div>
                        </div>
                        {/* Row 2: Product name */}
                        <div className="mb-2">
                          <span className="font-bold text-slate-800 text-sm block">{item.name}</span>
                        </div>
                        {/* Row 3: QTY · Price · Subtotal */}
                        <div className="flex items-center gap-2">
                          <div className="flex flex-col items-center gap-0.5 w-16">
                            <span className="text-[9px] font-bold uppercase text-slate-400 tracking-wide">QTY</span>
                            <input
                              type="text" inputMode="numeric"
                              value={item.quantity}
                              onChange={e => updateQty(item.id, e.target.value)}
                              onBlur={() => handleQtyBlur(item.id, item.quantity)}
                              className="w-full px-1 py-1.5 border border-slate-300 rounded-md text-sm font-bold text-center font-mono outline-none focus:border-cyan-600"
                            />
                          </div>
                          <div className="flex flex-col items-center gap-0.5 flex-1">
                            <span className="text-[9px] font-bold uppercase text-slate-400 tracking-wide">Price Rs.</span>
                            <input
                              type="text" inputMode="decimal"
                              value={item.soldAt}
                              onChange={e => updatePrice(item.id, e.target.value)}
                              onBlur={() => handlePriceBlur(item.id, item.soldAt, item.retailPrice)}
                              className="w-full px-1 py-1.5 border border-slate-300 rounded-md text-sm font-bold text-center text-emerald-600 font-mono outline-none focus:border-cyan-600"
                            />
                          </div>
                          <div className="flex flex-col items-center gap-0.5 w-20">
                            <span className="text-[9px] font-bold uppercase text-slate-400 tracking-wide">Subtotal</span>
                            <span className="font-extrabold text-cyan-600 text-sm font-mono py-1.5">
                              Rs.{((parseFloat(item.soldAt) || 0) * (parseInt(item.quantity) || 0)).toFixed(0)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Repair Fees */}
            <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border-2 border-dashed border-amber-400 rounded-lg p-2 mb-2">
              <div className="flex items-center gap-2 mb-1">
                <Wrench size={16} className="text-amber-600" />
                <span className="font-bold text-sm text-amber-800 sm:text-base">Repair / Service Fees</span>
                <span className="text-xs text-amber-600 ml-auto sm:text-sm">Optional</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-amber-800 sm:text-base">Rs.</span>
                <input
                  type="text" inputMode="decimal" min="0" placeholder="0"
                  value={repairFees}
                  onChange={e => setRepairFees(e.target.value)}
                  className="flex-1 py-1.5 px-1 border border-amber-400 rounded-lg text-sm font-bold text-center font-mono text-amber-800 bg-amber-50 outline-none focus:ring-2 focus:ring-amber-200 transition-all sm:text-base"
                />
                {repFees() > 0 && (
                  <button className="p-1 text-amber-600 hover:bg-amber-100 rounded transition-colors" onClick={() => setRepairFees('')}>
                    <X size={14} />
                  </button>
                )}
              </div>
              {repFees() > 0 && (
                <div className="text-xs text-amber-700 mt-1.5 font-semibold sm:text-sm">
                  🔧 Repair fees: Rs.{repFees().toFixed(0)} will be added to total & saved with this bill
                </div>
              )}
            </div>

            {/* Total & Checkout */}
            {(cart.length > 0 || repFees() > 0) && (
              <>
                <div className="border-t-4 border-cyan-600 pt-3.5 mt-3.5">
                  {repFees() > 0 && cart.length > 0 && (
                    <div className="flex justify-between mb-1.5 text-sm text-slate-500 sm:text-base">
                      <span>Items Subtotal</span>
                      <span className="font-mono font-semibold">Rs.{cartSubtotal().toFixed(0)}</span>
                    </div>
                  )}
                  {repFees() > 0 && (
                    <div className="flex justify-between mb-1.5 text-sm text-amber-700 sm:text-base">
                      <span>🔧 Repair Fees</span>
                      <span className="font-mono font-semibold">Rs.{repFees().toFixed(0)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-bold sm:text-xl">Total</span>
                    <span className="text-3xl font-extrabold text-cyan-600 font-mono sm:text-4xl">Rs.{total().toFixed(0)}</span>
                  </div>
                  <div className="text-right text-xs text-slate-400 mt-0.5 sm:text-sm">
                    {cart.reduce((s, i) => s + (parseInt(i.quantity) || 0), 0)} item(s)
                    {repFees() > 0 && ' + repair fees'}
                  </div>
                </div>
                <button
                  className="w-full mt-3.5 flex items-center justify-center gap-2 py-2 rounded-lg bg-gradient-to-br from-emerald-700 to-emerald-500 text-white font-bold text-base shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:translate-y-0 disabled:cursor-not-allowed sm:text-lg"
                  onClick={completeSale}
                  disabled={loading}
                >
                  {loading ? (
                    <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin inline-block" /> Processing...</>
                  ) : '✓ Complete Sale'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}