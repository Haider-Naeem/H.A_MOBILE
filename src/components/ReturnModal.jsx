import { useState } from 'react';
import { X, RotateCcw, Search, Plus, Minus } from 'lucide-react';
import { supabase } from '../supabase-config';

export default function ReturnModal({
  showReturnModal, setShowReturnModal,
  returnSearch, setReturnSearch,
  sales = [], inventory = []
}) {
  const [processing, setProcessing] = useState(false);
  const [selected, setSelected]     = useState({});
  const [returnQtys, setReturnQtys] = useState({});

  if (!showReturnModal) return null;

  const filteredSales = sales.filter(sale =>
    returnSearch.length > 0 && (
      (sale.customer_name || sale.customerName || '').toLowerCase().includes(returnSearch.toLowerCase()) ||
      (sale.customer_mobile || sale.customerMobile || '').includes(returnSearch) ||
      (sale.receipt_no || sale.receiptNo || '').toLowerCase().includes(returnSearch.toLowerCase())
    )
  );

  const toggleItem = (saleId, idx, item) => {
    const key = `${saleId}-${idx}`;
    const wasSelected = selected[key];
    setSelected(prev => ({ ...prev, [key]: !wasSelected }));
    if (!wasSelected) {
      const remaining = item.quantity - (item.returnedQuantity || 0);
      setReturnQtys(prev => ({ ...prev, [key]: remaining }));
    } else {
      setReturnQtys(prev => { const n = { ...prev }; delete n[key]; return n; });
    }
  };

  const adjustQty = (saleId, idx, change, max) => {
    const key = `${saleId}-${idx}`;
    setReturnQtys(prev => ({ ...prev, [key]: Math.max(1, Math.min(max, (prev[key] || 1) + change)) }));
  };

  const getSelectedItems = (sale) =>
    sale.items
      .map((item, idx) => {
        const key = `${sale.id}-${idx}`;
        if (selected[key]) return { ...item, itemIndex: idx, returnQty: returnQtys[key] || 1 };
        return null;
      })
      .filter(Boolean);

  const processReturn = async (sale) => {
    const itemsToReturn = getSelectedItems(sale);
    if (!itemsToReturn.length) return alert('Select at least one item to return');

    const returnTotal = itemsToReturn.reduce((s, i) => s + i.soldAt * i.returnQty, 0);
    const receiptNo = sale.receipt_no || sale.receiptNo;
    const custName  = sale.customer_name || sale.customerName;

    const list = itemsToReturn.map(i => `${i.name} — Qty: ${i.returnQty} — Rs.${(i.soldAt * i.returnQty).toFixed(0)}`).join('\n');
    if (!confirm(`Process return?\n\nReceipt: ${receiptNo}\nCustomer: ${custName}\n\n${list}\n\nRefund: Rs.${returnTotal.toFixed(0)}`)) return;

    setProcessing(true);
    try {
      for (const item of itemsToReturn) {
        const product = inventory.find(p => p.id === item.id);
        if (product) {
          await supabase.from('inventory').update({
            stock: product.stock + item.returnQty,
            updated_at: new Date().toISOString()
          }).eq('id', item.id);
        }
      }

      const updatedItems = sale.items.map((item, idx) => {
        const ri = itemsToReturn.find(x => x.itemIndex === idx);
        if (!ri) return item;
        const newReturned = (item.returnedQuantity || 0) + ri.returnQty;
        return { ...item, returnedQuantity: newReturned, returned: newReturned >= item.quantity, lastReturnedAt: new Date().toISOString() };
      });

      const allReturned = updatedItems.every(i => i.returned);
      if (allReturned) {
        await supabase.from('sales').delete().eq('id', sale.id);
      } else {
        const newTotal = updatedItems.reduce((s, i) => {
          const aq = i.quantity - (i.returnedQuantity || 0);
          return s + (i.soldAt * aq);
        }, 0);
        await supabase.from('sales').update({
          items: updatedItems, total: newTotal, updated_at: new Date().toISOString()
        }).eq('id', sale.id);
      }

      alert('✓ Return processed successfully!');
      const clS = { ...selected }, clQ = { ...returnQtys };
      sale.items.forEach((_, i) => { const k = `${sale.id}-${i}`; delete clS[k]; delete clQ[k]; });
      setSelected(clS); setReturnQtys(clQ);
    } catch (err) {
      console.error(err); alert('Failed: ' + err.message);
    } finally { setProcessing(false); }
  };

  const resetAndClose = () => {
    setShowReturnModal(false);
    setReturnSearch('');
    setSelected({});
    setReturnQtys({});
  };

  /*
   * Desktop grid columns:
   * cb(28px) | Brand(1fr) | Product(2fr) | Type(1fr) | Orig(52px) | Ret'd(60px) | Left(52px) | Price(76px) | Subtotal(80px) | Status(84px)
   */
  const dtCols = '28px 1fr 2fr 1fr 52px 60px 52px 76px 80px 84px';

  return (
    <div className="fixed inset-0 bg-black/65 backdrop-blur-sm flex items-end sm:items-center justify-center z-[1000] sm:p-4 animate-fade-in">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-4xl max-h-[92vh] sm:max-h-[90vh] overflow-y-auto animate-slide-up">

        {/* Header */}
        <div className="flex justify-between items-center px-6 pt-5 pb-4 border-b border-sky-50">
          <div className="flex items-center gap-2 text-xl font-bold text-red-600">
            <RotateCcw size={20} /> Process Return
          </div>
          <button
            className="w-8 h-8 rounded-md bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-red-100 hover:text-red-500 transition-all"
            onClick={resetAndClose}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">

          {/* Search */}
          <div className="relative mb-5">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
            <input
              className="w-full pl-10 pr-4 py-2.5 border-2 border-red-400 rounded-lg text-sm text-slate-800 bg-white outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100 transition-all"
              placeholder="Search by Name, Mobile, or Receipt #"
              value={returnSearch}
              onChange={e => setReturnSearch(e.target.value)}
              autoFocus
            />
          </div>

          {returnSearch.length === 0 ? (
            <div className="text-center py-16 text-slate-500">
              <RotateCcw size={52} className="mx-auto mb-3 opacity-30" />
              <p className="text-base font-semibold mb-1">Search for a sale to return</p>
              <span className="text-sm">Enter customer name, mobile, or receipt number</span>
            </div>
          ) : filteredSales.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <p className="text-base font-semibold text-red-500">No sales found</p>
              <span className="text-sm">Try a different search term</span>
            </div>
          ) : (
            filteredSales.map(sale => {
              const canReturn = sale.items.some(i => (i.returnedQuantity || 0) < i.quantity);
              const receiptNo = sale.receipt_no || sale.receiptNo;
              const custName  = sale.customer_name || sale.customerName;
              const custMob   = sale.customer_mobile || sale.customerMobile;
              const ts        = sale.timestamp ? new Date(sale.timestamp) : null;

              return (
                <div key={sale.id} className="bg-red-50 border-2 border-red-500 rounded-xl p-4 mb-4">

                  {/* ── Sale meta ── */}
                  <div className="flex flex-wrap justify-between items-start gap-3 mb-4">
                    <div className="flex-1 min-w-[180px]">
                      <div className="text-lg font-bold mb-1.5">{custName}</div>
                      <div className="text-xs text-slate-500 flex flex-col gap-0.5">
                        {custMob && custMob !== 'N/A' && <span>📱 {custMob}</span>}
                        {ts && (
                          <span>📅 {ts.toLocaleDateString('en-GB')} {ts.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                        )}
                        <span className="font-mono text-red-600 font-bold">🧾 #{receiptNo}</span>
                      </div>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <div className="text-2xl font-extrabold text-red-600 font-mono">Rs.{sale.total.toFixed(0)}</div>
                      {canReturn && (
                        <button
                          className="mt-2 px-3 py-1.5 rounded-lg bg-gradient-to-br from-red-600 to-red-500 text-white text-sm font-semibold shadow-md hover:-translate-y-px transition-all disabled:opacity-50"
                          onClick={() => processReturn(sale)}
                          disabled={processing}
                        >
                          {processing ? 'Processing...' : '↩️ Process Return'}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* ── Items container ── */}
                  <div className="bg-white rounded-lg border border-red-200 overflow-hidden">
                    <div className="text-xs font-bold text-red-600 px-3.5 pt-3 pb-1.5">📦 Items:</div>

                    {/* ════════════════════════════════════════
                        DESKTOP — header + single-row per item
                    ════════════════════════════════════════ */}
                    <div className="hidden sm:block overflow-x-auto">

                      {/* Header */}
                      <div
                        className="grid items-center gap-2 bg-gradient-to-r from-red-700 to-red-500 text-white text-[11px] font-bold uppercase tracking-wide px-3 py-2.5"
                        style={{ gridTemplateColumns: dtCols }}
                      >
                        <span />
                        <span>Brand</span>
                        <span>Product</span>
                        <span>Type</span>
                        <span className="text-center">Orig</span>
                        <span className="text-center">Ret'd</span>
                        <span className="text-center">Left</span>
                        <span className="text-center">Price Rs.</span>
                        <span className="text-center">Subtotal</span>
                        <span className="text-center">Status</span>
                      </div>

                      {/* Item rows */}
                      {sale.items.map((item, idx) => {
                        const key       = `${sale.id}-${idx}`;
                        const isSel     = !!selected[key];
                        const rq        = item.returnedQuantity || 0;
                        const remaining = item.quantity - rq;
                        const full      = rq >= item.quantity;
                        const rQty      = returnQtys[key] || remaining;

                        return (
                          <div key={idx} className="border-b border-red-50 last:border-0">
                            {/* Main row */}
                            <div
                              className={`grid items-center gap-2 px-3 py-3 transition-colors
                                ${full ? 'opacity-50 bg-slate-50' : isSel ? 'bg-red-50' : 'hover:bg-red-50/40'}`}
                              style={{ gridTemplateColumns: dtCols }}
                            >
                              {/* Checkbox */}
                              <div className="flex justify-center">
                                {!full && (
                                  <input
                                    type="checkbox"
                                    checked={isSel}
                                    onChange={() => toggleItem(sale.id, idx, item)}
                                    className="accent-red-500"
                                    style={{ width: 16, height: 16 }}
                                  />
                                )}
                              </div>
                              {/* Brand */}
                              <span className="text-sm font-semibold text-slate-500 truncate">
                                {item.brand && item.brand !== 'N/A' ? item.brand : '—'}
                              </span>
                              {/* Product */}
                              <span className="text-sm font-bold text-slate-800 truncate">{item.name}</span>
                              {/* Type */}
                              <span>
                                {item.type && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-cyan-100 text-cyan-800">{item.type}</span>
                                )}
                              </span>
                              {/* Orig */}
                              <span className="text-center font-bold font-mono text-sm text-slate-700">{item.quantity}</span>
                              {/* Ret'd */}
                              <span className={`text-center font-bold font-mono text-sm ${rq > 0 ? 'text-amber-500' : 'text-slate-300'}`}>
                                {rq > 0 ? rq : '—'}
                              </span>
                              {/* Left */}
                              <span className={`text-center font-bold font-mono text-sm ${full ? 'text-slate-300' : 'text-emerald-600'}`}>
                                {full ? '—' : remaining}
                              </span>
                              {/* Price */}
                              <span className="text-center font-bold font-mono text-sm text-emerald-600">Rs.{item.soldAt}</span>
                              {/* Subtotal */}
                              <span className="text-center font-extrabold font-mono text-sm text-cyan-700">
                                {full ? '—' : `Rs.${(item.soldAt * remaining).toFixed(0)}`}
                              </span>
                              {/* Status */}
                              <div className="flex justify-center">
                                {full
                                  ? <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-600 whitespace-nowrap">✓ Returned</span>
                                  : rq > 0
                                    ? <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-600">Partial</span>
                                    : null
                                }
                              </div>
                            </div>

                            {/* Qty-control sub-row (desktop) */}
                            {isSel && !full && (
                              <div className="flex flex-wrap items-center gap-3 px-5 py-3 bg-red-50 border-t border-red-100">
                                <span className="text-sm font-semibold text-slate-700 whitespace-nowrap">Return Qty:</span>
                                <div className="flex items-center gap-2">
                                  <button
                                    className="w-8 h-8 rounded-md bg-red-600 text-white flex items-center justify-center hover:bg-red-800 disabled:opacity-40 transition-colors"
                                    onClick={() => adjustQty(sale.id, idx, -1, remaining)}
                                    disabled={rQty <= 1}
                                  ><Minus size={14} /></button>
                                  <span className="font-extrabold text-xl font-mono text-red-600 min-w-[36px] text-center">{rQty}</span>
                                  <button
                                    className="w-8 h-8 rounded-md bg-red-600 text-white flex items-center justify-center hover:bg-red-800 disabled:opacity-40 transition-colors"
                                    onClick={() => adjustQty(sale.id, idx, 1, remaining)}
                                    disabled={rQty >= remaining}
                                  ><Plus size={14} /></button>
                                </div>
                                <span className="text-sm text-slate-500">/ {remaining}</span>
                                <span className="ml-auto font-bold text-cyan-700 font-mono text-base whitespace-nowrap">
                                  Refund: Rs.{(item.soldAt * rQty).toFixed(0)}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* ════════════════════════════════════════
                        MOBILE — 3 rows, row-3 split into 3a + 3b
                    ════════════════════════════════════════ */}
                    <div className="sm:hidden flex flex-col divide-y divide-red-100">
                      {sale.items.map((item, idx) => {
                        const key       = `${sale.id}-${idx}`;
                        const isSel     = !!selected[key];
                        const rq        = item.returnedQuantity || 0;
                        const remaining = item.quantity - rq;
                        const full      = rq >= item.quantity;
                        const rQty      = returnQtys[key] || remaining;

                        return (
                          <div
                            key={idx}
                            className={`px-3 py-3 transition-colors
                              ${full ? 'opacity-50 bg-slate-50' : isSel ? 'bg-red-50' : 'bg-white'}`}
                          >
                            <div className="flex gap-2 items-start">
                              {/* Checkbox */}
                              {!full && (
                                <input
                                  type="checkbox"
                                  checked={isSel}
                                  onChange={() => toggleItem(sale.id, idx, item)}
                                  className="flex-shrink-0 mt-1 accent-red-500"
                                  style={{ width: 17, height: 17 }}
                                />
                              )}

                              <div className="flex-1 min-w-0">
                                {/* ── Row 1: Brand · Type pill · status ── */}
                                <div className="flex items-center justify-between gap-1.5 mb-1">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <span className="text-xs font-semibold text-slate-500 shrink-0">
                                      {item.brand && item.brand !== 'N/A' ? item.brand : '—'}
                                    </span>
                                    {item.type && (
                                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-cyan-100 text-cyan-800 shrink-0">
                                        {item.type}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex gap-1 shrink-0">
                                    {full && <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-600">✓ Returned</span>}
                                    {rq > 0 && !full && <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-600">Partial</span>}
                                  </div>
                                </div>

                                {/* ── Row 2: Product name ── */}
                                <div className="mb-2">
                                  <span className="font-bold text-sm text-slate-800 block">{item.name}</span>
                                </div>

                                {/* ── Row 3a: Orig · Ret'd · Left ── */}
                                <div className="flex gap-2 mb-1.5">
                                  <div className="flex flex-col items-center flex-1 bg-slate-100 rounded-md px-2 py-1.5">
                                    <span className="text-[9px] font-bold uppercase text-slate-400 tracking-wide leading-none mb-0.5">Orig</span>
                                    <span className="text-sm font-extrabold font-mono text-slate-700">{item.quantity}</span>
                                  </div>
                                  <div className={`flex flex-col items-center flex-1 rounded-md px-2 py-1.5 ${rq > 0 ? 'bg-amber-50' : 'bg-slate-50'}`}>
                                    <span className={`text-[9px] font-bold uppercase tracking-wide leading-none mb-0.5 ${rq > 0 ? 'text-amber-400' : 'text-slate-300'}`}>Ret'd</span>
                                    <span className={`text-sm font-extrabold font-mono ${rq > 0 ? 'text-amber-600' : 'text-slate-300'}`}>{rq > 0 ? rq : '—'}</span>
                                  </div>
                                  <div className={`flex flex-col items-center flex-1 rounded-md px-2 py-1.5 ${full ? 'bg-slate-50' : 'bg-emerald-50'}`}>
                                    <span className={`text-[9px] font-bold uppercase tracking-wide leading-none mb-0.5 ${full ? 'text-slate-300' : 'text-emerald-400'}`}>Left</span>
                                    <span className={`text-sm font-extrabold font-mono ${full ? 'text-slate-300' : 'text-emerald-600'}`}>{full ? '—' : remaining}</span>
                                  </div>
                                </div>

                                {/* ── Row 3b: Price · Subtotal ── */}
                                <div className="flex gap-2">
                                  <div className="flex flex-col items-center flex-1 bg-sky-50 rounded-md px-2 py-1.5">
                                    <span className="text-[9px] font-bold uppercase text-sky-400 tracking-wide leading-none mb-0.5">Price Rs.</span>
                                    <span className="text-sm font-extrabold font-mono text-emerald-600">Rs.{item.soldAt}</span>
                                  </div>
                                  <div className="flex flex-col items-center flex-1 bg-cyan-50 rounded-md px-2 py-1.5">
                                    <span className="text-[9px] font-bold uppercase text-cyan-500 tracking-wide leading-none mb-0.5">Subtotal</span>
                                    <span className="text-sm font-extrabold font-mono text-cyan-700">
                                      {full ? '—' : `Rs.${(item.soldAt * remaining).toFixed(0)}`}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Qty control (mobile, when selected) */}
                            {isSel && !full && (
                              <div className="flex flex-wrap items-center gap-2.5 mt-3 px-3 py-2.5 rounded-lg border-2 border-red-500 bg-white">
                                <span className="text-sm font-semibold text-slate-700 whitespace-nowrap">Return Qty:</span>
                                <div className="flex items-center gap-2">
                                  <button
                                    className="w-8 h-8 rounded-md bg-red-600 text-white flex items-center justify-center hover:bg-red-800 disabled:opacity-40 transition-colors"
                                    onClick={() => adjustQty(sale.id, idx, -1, remaining)}
                                    disabled={rQty <= 1}
                                  ><Minus size={14} /></button>
                                  <span className="font-extrabold text-xl font-mono text-red-600 min-w-[32px] text-center">{rQty}</span>
                                  <button
                                    className="w-8 h-8 rounded-md bg-red-600 text-white flex items-center justify-center hover:bg-red-800 disabled:opacity-40 transition-colors"
                                    onClick={() => adjustQty(sale.id, idx, 1, remaining)}
                                    disabled={rQty >= remaining}
                                  ><Plus size={14} /></button>
                                </div>
                                <span className="text-sm text-slate-500">/ {remaining}</span>
                                <span className="ml-auto font-bold text-cyan-700 font-mono text-base whitespace-nowrap">
                                  Refund: Rs.{(item.soldAt * rQty).toFixed(0)}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Footer hints */}
                  {!canReturn && (
                    <div className="mt-2.5 px-3.5 py-2.5 rounded-lg text-sm font-medium bg-emerald-50 border-l-4 border-emerald-500 text-emerald-600">
                      ✓ All items fully returned
                    </div>
                  )}
                  {canReturn && (
                    <div className="mt-2.5 px-3.5 py-2.5 rounded-lg text-sm font-medium bg-amber-50 border-l-4 border-amber-500 text-amber-600">
                      ⚠️ Select items and quantities to return. Stock will be restored.
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 pb-5 pt-2 border-t border-slate-100">
          <button
            className="flex-1 py-2.5 rounded-lg bg-slate-100 text-slate-500 border border-slate-300 font-semibold hover:bg-slate-200 transition-all disabled:opacity-50"
            onClick={resetAndClose}
            disabled={processing}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}