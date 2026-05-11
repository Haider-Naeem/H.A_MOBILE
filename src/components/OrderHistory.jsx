import { useState } from 'react';
import {
  History, Search, Clock, CheckCircle, ChevronDown, Edit3, MessageCircle,
  Download, Trash2, X, Plus, AlertTriangle, Building2, ClipboardList,
  Phone, MapPin,
} from 'lucide-react';
import { supabase } from '../supabase-config';
import { generateOrderPDF, validatePakistaniNumber, toWaNumber, SHOP } from './orderUtils';

const labelCls =
  'block text-xs font-semibold text-slate-800 mb-1.5 uppercase tracking-wide';
const inputCls =
  'w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-800 bg-white ' +
  'outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-200 transition-all';

// ── helpers ──────────────────────────────────────────────────────────────────
const formatDate = (ts) =>
  ts ? new Date(ts).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A';

// ── OrderHistory ─────────────────────────────────────────────────────────────
// Props:
//   orders     Order[]     — live from parent (realtime)
//   inventory  Product[]   — for stock lookups in edit modal
export default function OrderHistory({ orders, inventory }) {
  const [historyVendor, setHistoryVendor] = useState('');
  const [historyStatus, setHistoryStatus] = useState('all');
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [loading, setLoading]             = useState(false);

  // Edit order modal state
  const [showEditModal, setShowEditModal]             = useState(false);
  const [editingOrder, setEditingOrder]               = useState(null);
  const [editOrderItems, setEditOrderItems]           = useState([]);
  const [editVendorName, setEditVendorName]           = useState('');
  const [editVendorPhone, setEditVendorPhone]         = useState('');
  const [editVendorAddress, setEditVendorAddress]     = useState('');
  const [showAddProductsPanel, setShowAddProductsPanel] = useState(false);
  const [editFilterMode, setEditFilterMode]           = useState([]);
  const [editCustomThreshold, setEditCustomThreshold] = useState(5);
  const [editProductSearch, setEditProductSearch]     = useState('');

  // ── History actions ────────────────────────────────────────────────────────
  const markReceived = async (orderId) => {
    if (!confirm('Mark this order as received?\n\nNote: You will need to update inventory stock manually.')) return;
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: 'received', received_at: new Date().toISOString() })
        .eq('id', orderId);
      if (error) throw error;
    } catch (err) { alert('Error: ' + err.message); }
  };

  const deleteOrder = async (orderId, orderNo) => {
    if (!confirm(`Delete Order #${orderNo}?\n\nThis cannot be undone.`)) return;
    try {
      const { error } = await supabase.from('orders').delete().eq('id', orderId);
      if (error) throw error;
    } catch (err) { alert('Error: ' + err.message); }
  };

  const resendOrder = async (order) => {
    const orderObj = {
      orderNo:       order.order_no    || order.orderNo,
      vendorName:    order.vendor_name || order.vendorName,
      vendorPhone:   order.vendor_phone || order.vendorPhone,
      vendorAddress: order.vendor_address || order.vendorAddress,
      items:         order.items,
      status:        order.status,
      createdAt:     order.created_at  || order.createdAt,
    };
    const blob   = generateOrderPDF(orderObj, true);
    const vPhone = orderObj.vendorPhone;
    if (vPhone && validatePakistaniNumber(vPhone)) {
      const file  = new File([blob], `PurchaseOrder_${orderObj.orderNo}.pdf`, { type: 'application/pdf' });
      const waNum = toWaNumber(vPhone);
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: `Purchase Order ${orderObj.orderNo}` });
      } else {
        const url = URL.createObjectURL(blob);
        const a   = document.createElement('a'); a.href = url; a.download = `PurchaseOrder_${orderObj.orderNo}.pdf`; a.click();
        URL.revokeObjectURL(url);
        const msg = `Hello *${orderObj.vendorName}*! Resending Purchase Order *${orderObj.orderNo}* from *${SHOP.name}*. Please see the attached PDF.`;
        setTimeout(() => window.open(`https://wa.me/${waNum}?text=${encodeURIComponent(msg)}`, '_blank'), 600);
      }
    } else {
      generateOrderPDF(orderObj, false);
    }
  };

  // ── Edit modal helpers ─────────────────────────────────────────────────────
  const openEditModal = (order) => {
    const items = (order.items || []).map((item) => ({
      ...item,
      currentStock: inventory.find((p) => p.id === item.id)?.stock ?? item.currentStock ?? 0,
    }));
    setEditOrderItems(items);
    setEditVendorName(order.vendor_name    || order.vendorName    || '');
    setEditVendorPhone(order.vendor_phone  || order.vendorPhone   || '');
    setEditVendorAddress(order.vendor_address || order.vendorAddress || '');
    setEditingOrder(order);
    setShowEditModal(true);
    setShowAddProductsPanel(false);
    setEditFilterMode([]);
    setEditProductSearch('');
  };

  const updateEditQty = (id, qty) =>
    setEditOrderItems((prev) =>
      prev.map((i) => {
        if (i.id !== id) return i;
        if (qty === '') return { ...i, orderQuantity: '' };
        const num = parseInt(qty);
        return { ...i, orderQuantity: isNaN(num) ? '' : num };
      }),
    );

  const removeEditItem = (id) => setEditOrderItems((prev) => prev.filter((i) => i.id !== id));

  const addProductToEdit = (p) => {
    if (editOrderItems.find((i) => i.id === p.id)) return;
    setEditOrderItems((prev) => [
      ...prev,
      { id: p.id, name: p.name, brand: p.brand || '—', type: p.type, currentStock: p.stock, orderQuantity: 10 },
    ]);
  };

  const toggleEditFilter = (mode) =>
    setEditFilterMode((prev) =>
      prev.includes(mode) ? prev.filter((m) => m !== mode) : [...prev, mode],
    );

  const saveEditedOrder = async () => {
    if (!editVendorName.trim()) return alert('Please enter vendor name');
    if (!editOrderItems.length) return alert('No items in order');
    setLoading(true);
    try {
      const { error } = await supabase
        .from('orders')
        .update({
          vendor_name:    editVendorName.trim(),
          vendor_phone:   editVendorPhone.trim(),
          vendor_address: editVendorAddress.trim(),
          items:          editOrderItems,
        })
        .eq('id', editingOrder.id);
      if (error) throw error;
      setShowEditModal(false);
      setEditingOrder(null);
      setEditOrderItems([]);
      alert('Order updated successfully!');
    } catch (err) { alert('Failed to update: ' + err.message); }
    finally { setLoading(false); }
  };

  // ── Filtered products for add-products panel ───────────────────────────────
  const editFilteredProducts = inventory
    .filter((p) => {
      const matchesFilter = (() => {
        if (editFilterMode.length === 0) return true;
        if (editFilterMode.includes('outofstock') && p.stock === 0) return true;
        if (editFilterMode.includes('lowstock') && p.stock > 0 && p.stock <= 5) return true;
        if (editFilterMode.includes('custom') && p.stock < editCustomThreshold) return true;
        return false;
      })();
      const matchesSearch =
        editProductSearch.trim() === '' ||
        [p.name, p.brand, p.type].some((f) => f?.toLowerCase().includes(editProductSearch.toLowerCase()));
      return matchesFilter && matchesSearch;
    })
    .filter((p) => !editOrderItems.find((i) => i.id === p.id));

  const editFilterConfig = [
    { key: 'outofstock', emoji: '🚫', label: 'Out of Stock', color: '#dc2626', activeClass: 'border-red-500 bg-red-50' },
    { key: 'lowstock',   emoji: '⚠️', label: 'Low Stock',   color: '#d97706', activeClass: 'border-amber-500 bg-amber-50' },
    { key: 'custom',     emoji: '🔢', label: 'Custom',       color: '#7c3aed', activeClass: 'border-violet-500 bg-violet-50' },
  ];

  // ── Filtered history ───────────────────────────────────────────────────────
  const filteredHistory = orders
    .filter((o) => {
      const nm  = (o.vendorName || o.vendor_name || '').toLowerCase();
      const ok1 = !historyVendor || nm.includes(historyVendor.toLowerCase());
      const ok2 = historyStatus === 'all' || o.status === historyStatus;
      return ok1 && ok2;
    })
    .sort((a, b) => new Date(b.created_at || b.createdAt) - new Date(a.created_at || a.createdAt));

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* ── Filters bar ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-5 py-3.5 bg-white border border-sky-200 rounded-xl mb-5 shadow-sm">
        <div className="flex gap-2 sm:gap-3 items-center flex-wrap w-full sm:w-auto">
          <div className="relative flex-1 sm:w-56 sm:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={15} />
            <input
              className="w-full pl-8 pr-4 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-200 transition-all"
              placeholder="Filter by vendor…"
              value={historyVendor}
              onChange={(e) => setHistoryVendor(e.target.value)}
            />
          </div>
          <select
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-cyan-600 transition-all flex-shrink-0"
            value={historyStatus}
            onChange={(e) => setHistoryStatus(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="pending">⏳ Pending</option>
            <option value="received">✓ Received</option>
          </select>
        </div>
        <span className="text-sm text-slate-500 flex-shrink-0">
          {filteredHistory.length} order{filteredHistory.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* ── Order cards ── */}
      {filteredHistory.length === 0 ? (
        <div className="bg-white rounded-xl border border-sky-200 shadow-sm">
          <div className="text-center py-16 text-slate-500">
            <ClipboardList size={56} className="mx-auto mb-3 opacity-30" />
            <p className="text-base font-semibold mb-1">No orders found</p>
          </div>
        </div>
      ) : (
        filteredHistory.map((order) => {
          const orderNo    = order.order_no    || order.orderNo;
          const vendorNm   = order.vendor_name || order.vendorName    || '—';
          const vendorPh   = order.vendor_phone|| order.vendorPhone   || '';
          const createdAt  = order.created_at  || order.createdAt;
          const receivedAt = order.received_at || order.receivedAt;
          const isExpanded = expandedOrder === order.id;
          const isPending  = order.status === 'pending';
          const totalQty   = (order.items || []).reduce((s, i) => s + i.orderQuantity, 0);
          const orderObj   = {
            orderNo, vendorName: vendorNm, vendorPhone: vendorPh,
            items: order.items, status: order.status, createdAt,
          };

          return (
            <div
              key={order.id}
              className={`mb-4 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow border ${
                isPending ? 'border-amber-200' : 'border-emerald-200'
              }`}
            >
              {/* Card header */}
              <div
                className={`px-4 sm:px-5 py-4 cursor-pointer ${
                  isPending
                    ? 'bg-gradient-to-r from-amber-50 to-yellow-50'
                    : 'bg-gradient-to-r from-emerald-50 to-green-50'
                }`}
                onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
              >
                {/* Vendor + status */}
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
                    <span className="font-extrabold text-base sm:text-lg text-cyan-800 truncate">{vendorNm}</span>
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border flex-shrink-0 ${
                        isPending
                          ? 'bg-amber-100 text-amber-700 border-amber-300'
                          : 'bg-emerald-100 text-emerald-600 border-emerald-300'
                      }`}
                    >
                      {isPending ? <Clock size={11} /> : <CheckCircle size={11} />}
                      {isPending ? 'Pending' : 'Received'}
                    </span>
                  </div>
                  <ChevronDown
                    size={18}
                    className={`text-slate-400 transition-transform duration-200 flex-shrink-0 mt-1 ${isExpanded ? 'rotate-180' : ''}`}
                  />
                </div>

                {/* Meta */}
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs sm:text-sm text-slate-500 mb-3">
                  <span><strong>🧾</strong> <span className="font-mono">{orderNo}</span></span>
                  <span><strong>📅</strong> {formatDate(createdAt)}</span>
                  <span><strong>📦</strong> {(order.items || []).length} products</span>
                  <span><strong>🔢</strong> <span className="font-bold text-slate-800">{totalQty} units</span></span>
                  {vendorPh    && <span><strong>📞</strong> {vendorPh}</span>}
                  {receivedAt  && <span className="text-emerald-600"><strong>✓</strong> {formatDate(receivedAt)}</span>}
                </div>

                {/* Action buttons */}
                <div className="flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
                  <button
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gradient-to-br from-amber-500 to-amber-400 text-white text-xs font-semibold shadow hover:-translate-y-px transition-all"
                    onClick={() => openEditModal(order)}
                  >
                    <Edit3 size={12} /> Edit
                  </button>
                  <button
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gradient-to-br from-teal-700 to-green-500 text-white text-xs font-semibold shadow hover:-translate-y-px transition-all"
                    onClick={() => resendOrder(order)}
                  >
                    <MessageCircle size={12} /> Resend
                  </button>
                  <button
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gradient-to-br from-cyan-700 to-cyan-500 text-white text-xs font-semibold shadow hover:-translate-y-px transition-all"
                    onClick={() => generateOrderPDF(orderObj, false)}
                  >
                    <Download size={12} /> PDF
                  </button>
                  {isPending && (
                    <button
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gradient-to-br from-emerald-600 to-emerald-400 text-white text-xs font-semibold shadow hover:-translate-y-px transition-all"
                      onClick={() => markReceived(order.id)}
                    >
                      <CheckCircle size={12} /> Received
                    </button>
                  )}
                  <button
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gradient-to-br from-red-600 to-red-500 text-white text-xs font-semibold shadow hover:-translate-y-px transition-all"
                    onClick={() => deleteOrder(order.id, orderNo)}
                  >
                    <Trash2 size={12} /> Delete
                  </button>
                </div>
              </div>

              {/* ── Expanded items table ── */}
              {isExpanded && (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse" style={{ minWidth: '340px' }}>
                    <thead>
                      <tr className="bg-gradient-to-r from-cyan-800 to-cyan-600">
                        {/* Desktop: wider type column — mobile: type always visible but tighter */}
                        <th className="px-3 py-2.5 text-left   text-[11px] font-bold uppercase tracking-wide text-white w-[22%]">Brand</th>
                        <th className="px-3 py-2.5 text-left   text-[11px] font-bold uppercase tracking-wide text-white">Name</th>
                        <th className="px-3 py-2.5 text-center text-[11px] font-bold uppercase tracking-wide text-white w-[20%] sm:w-[22%]">Type</th>
                        <th className="px-3 py-2.5 text-center text-[11px] font-bold uppercase tracking-wide text-white w-[15%]">Qty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(order.items || []).map((item, i) => (
                        <tr key={i} className={`border-b border-sky-50 ${i % 2 ? 'bg-sky-50/50' : 'bg-white'}`}>
                          <td className="px-3 py-3">
                            <span className="font-bold text-sm text-cyan-800 truncate block">{item.brand || '—'}</span>
                          </td>
                          <td className="px-3 py-3">
                            <span className="font-bold text-[13px] block truncate">{item.name}</span>
                          </td>
                          <td className="px-3 py-3 text-center">
                            <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-violet-100 text-violet-700 whitespace-nowrap">
                              {item.type || '—'}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-center">
                            <span className="font-extrabold text-cyan-600 font-mono text-base">{item.orderQuantity}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-sky-50 border-t border-sky-200">
                        <td colSpan={2} className="px-3 py-3 text-sm font-semibold text-slate-500">
                          {(order.items || []).length} products
                        </td>
                        <td colSpan={2} className="px-3 py-3 text-right text-sm font-bold text-cyan-600">
                          Total: {totalQty} units
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          );
        })
      )}

      {/* ══════════ EDIT ORDER MODAL ══════════ */}
      {showEditModal && editingOrder && (
        <div
          className="fixed inset-0 bg-black/65 backdrop-blur-sm flex items-end sm:items-center justify-center z-[1000] sm:p-4"
          onClick={() => setShowEditModal(false)}
        >
          <div
            className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-2xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex justify-between items-center px-5 sm:px-6 pt-5 pb-4 border-b border-sky-50 sticky top-0 bg-white z-10">
              <div className="flex items-center gap-2 text-lg sm:text-xl font-bold">
                <Edit3 size={20} /> Edit Order
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-100 text-cyan-800">
                  {editingOrder.order_no || editingOrder.orderNo}
                </span>
              </div>
              <button
                className="w-8 h-8 rounded-md bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-red-100 hover:text-red-500 transition-all"
                onClick={() => setShowEditModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="px-5 sm:px-6 py-5">
              {/* Vendor info */}
              <div className="bg-gradient-to-r from-sky-50 to-cyan-50 border border-sky-200 rounded-lg px-4 py-4 mb-5">
                <h4 className="flex items-center gap-2 text-sm font-bold text-cyan-800 mb-3">
                  <Building2 size={16} /> Vendor Information
                </h4>
                <div className="mb-3">
                  <label className={labelCls}>Vendor Name <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                    <input className={inputCls + ' pl-10'} value={editVendorName} onChange={(e) => setEditVendorName(e.target.value)} placeholder="Vendor name" />
                  </div>
                </div>
                <div className="mb-3">
                  <label className={labelCls}>Vendor Phone</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                    <input className={inputCls + ' pl-10'} value={editVendorPhone} onChange={(e) => setEditVendorPhone(e.target.value)} placeholder="0300-1234567" />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Vendor Address</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                    <input className={inputCls + ' pl-10'} value={editVendorAddress} onChange={(e) => setEditVendorAddress(e.target.value)} placeholder="Optional address" />
                  </div>
                </div>
              </div>

              {/* Current items */}
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-bold text-slate-800 uppercase tracking-wide">
                  📦 Current Items ({editOrderItems.length})
                </span>
              </div>

              {editOrderItems.length === 0 ? (
                <div className="text-center py-10 text-slate-500 mb-5">
                  <AlertTriangle size={40} className="mx-auto mb-2.5 opacity-40" />
                  <p className="text-base font-semibold">No items in this order</p>
                </div>
              ) : (
                <div className="border border-sky-200 rounded-lg overflow-hidden mb-5 overflow-x-auto">
                  <table className="w-full border-collapse" style={{ minWidth: '340px' }}>
                    <thead>
                      <tr className="bg-gradient-to-r from-cyan-800 to-cyan-600">
                        <th className="px-3 py-2.5 text-left   text-[11px] font-bold uppercase tracking-wide text-white w-[20%]">Brand</th>
                        <th className="px-3 py-2.5 text-left   text-[11px] font-bold uppercase tracking-wide text-white">Name</th>
                        <th className="px-3 py-2.5 text-center text-[11px] font-bold uppercase tracking-wide text-white w-[18%] sm:w-[20%]">Type</th>
                        <th className="px-3 py-2.5 text-center text-[11px] font-bold uppercase tracking-wide text-white w-[14%]">Qty</th>
                        <th className="px-3 py-2.5 text-center text-[11px] font-bold uppercase tracking-wide text-white w-[10%]"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {editOrderItems.map((item, idx) => (
                        <tr key={item.id} className={`border-b border-sky-50 ${idx % 2 ? 'bg-sky-50/50' : 'bg-white'}`}>
                          <td className="px-3 py-3">
                            <span className="font-bold text-sm text-cyan-800 block truncate">{item.brand || '—'}</span>
                          </td>
                          <td className="px-3 py-3">
                            <span className="font-bold text-[13px] block truncate">{item.name}</span>
                          </td>
                          <td className="px-3 py-3 text-center">
                            <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-violet-100 text-violet-700 whitespace-nowrap">
                              {item.type || '—'}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-center">
                            <input
                              type="text"
                              value={item.orderQuantity ?? ''}
                              onChange={(e) => updateEditQty(item.id, e.target.value)}
                              onBlur={() => { if (!item.orderQuantity || item.orderQuantity < 1) updateEditQty(item.id, 1); }}
                              className="w-[52px] text-center border border-slate-300 rounded-md py-1.5 px-1 text-sm font-extrabold text-cyan-600 font-mono outline-none focus:border-cyan-600 focus:ring-1 focus:ring-cyan-200"
                            />
                          </td>
                          <td className="px-2 py-3 text-center">
                            <button
                              className="text-red-500 hover:bg-red-50 p-1.5 rounded flex items-center justify-center mx-auto transition-colors"
                              onClick={() => removeEditItem(item.id)}
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Add more products */}
              <div className="pt-4 border-t-2 border-sky-200">
                <button
                  className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-slate-100 text-slate-500 border border-slate-300 font-semibold hover:bg-slate-200 transition-all text-sm"
                  onClick={() => setShowAddProductsPanel(!showAddProductsPanel)}
                >
                  {showAddProductsPanel ? <><X size={14} /> Hide Products</> : <><Plus size={14} /> Add More Products</>}
                </button>

                {showAddProductsPanel && (
                  <div className="mt-4">
                    {/* Filter chips */}
                    <div className="flex flex-wrap gap-2 mb-3">
                      {editFilterConfig.map((f) => {
                        const on = editFilterMode.includes(f.key);
                        return (
                          <div
                            key={f.key}
                            onClick={() => toggleEditFilter(f.key)}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer border-2 transition-all select-none ${
                              on ? f.activeClass : 'border-slate-300 bg-white hover:border-cyan-300'
                            }`}
                          >
                            <span className="font-bold text-xs sm:text-sm" style={{ color: on ? f.color : undefined }}>
                              {f.emoji} {f.label}
                            </span>
                            <div
                              className="w-4 h-4 sm:w-5 sm:h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                              style={{ background: on ? f.color : undefined, borderColor: on ? f.color : '#cbd5e1' }}
                            >
                              {on && (
                                <svg viewBox="0 0 10 8" width="9" height="9">
                                  <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      {editFilterMode.includes('custom') && (
                        <div className="flex items-center gap-2">
                          <label className="text-xs font-semibold text-violet-700">Below:</label>
                          <input
                            type="number" min="1" value={editCustomThreshold}
                            onChange={(e) => setEditCustomThreshold(Math.max(1, parseInt(e.target.value) || 1))}
                            className="max-w-[60px] text-center font-mono font-bold border-2 border-violet-500 rounded-lg px-2 py-1 text-sm outline-none"
                          />
                        </div>
                      )}
                    </div>

                    {/* Search */}
                    <div className="relative mb-3">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={15} />
                      <input
                        className="w-full pl-9 pr-9 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-200 transition-all"
                        placeholder="Search by name, brand or type…"
                        value={editProductSearch}
                        onChange={(e) => setEditProductSearch(e.target.value)}
                      />
                      {editProductSearch && (
                        <button className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" onClick={() => setEditProductSearch('')}>
                          <X size={14} />
                        </button>
                      )}
                    </div>

                    {/* Product table */}
                    <div className="max-h-72 overflow-y-auto border border-sky-200 rounded-lg overflow-x-auto">
                      {editFilteredProducts.length === 0 ? (
                        <div className="text-center py-5 text-slate-500 text-sm">
                          <p className="font-semibold">No products available</p>
                          <p className="text-xs mt-1">Use a filter or search above</p>
                        </div>
                      ) : (
                        <table className="w-full border-collapse" style={{ minWidth: '300px' }}>
                          <thead>
                            <tr className="bg-gradient-to-r from-cyan-800 to-cyan-600 sticky top-0">
                              <th className="px-2 py-1.5 text-left   text-[10px] font-bold uppercase tracking-wide text-white w-[20%]">Brand</th>
                              <th className="px-2 py-1.5 text-left   text-[10px] font-bold uppercase tracking-wide text-white">Product</th>
                              <th className="px-2 py-1.5 text-center text-[10px] font-bold uppercase tracking-wide text-white w-[18%]">Type</th>
                              <th className="px-2 py-1.5 text-center text-[10px] font-bold uppercase tracking-wide text-white w-[10%]">Qty</th>
                              <th className="px-2 py-1.5 text-center text-[10px] font-bold uppercase tracking-wide text-white w-[14%]"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {editFilteredProducts.map((p, i) => (
                              <tr key={p.id} className={`border-b border-sky-50 ${i % 2 ? 'bg-sky-50/50' : 'bg-white'} hover:bg-sky-100 transition-colors`}>
                                <td className="px-2 py-1.5">
                                  {p.brand
                                    ? <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase bg-cyan-100 text-cyan-800 whitespace-nowrap">{p.brand}</span>
                                    : <span className="text-slate-300 text-xs">—</span>
                                  }
                                </td>
                                <td className="px-2 py-1.5">
                                  <span className="font-semibold text-[12px] leading-tight block truncate">{p.name}</span>
                                </td>
                                <td className="px-2 py-1.5 text-center">
                                  <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-violet-100 text-violet-700 whitespace-nowrap">{p.type || '—'}</span>
                                </td>
                                <td className="px-2 py-1.5 text-center">
                                  <span className={`font-extrabold text-[11px] font-mono ${p.stock === 0 ? 'text-red-600' : p.stock <= 5 ? 'text-amber-500' : 'text-emerald-600'}`}>
                                    {p.stock}
                                  </span>
                                </td>
                                <td className="px-2 py-1.5 text-center">
                                  <button
                                    className="flex items-center justify-center gap-0.5 px-1.5 py-1 rounded bg-gradient-to-br from-cyan-700 to-cyan-500 text-white text-[10px] font-semibold shadow mx-auto"
                                    onClick={() => addProductToEdit(p)}
                                  >
                                    <Plus size={10} /> Add
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Modal footer */}
            <div className="flex flex-col gap-2.5 px-5 sm:px-6 pb-5 pt-2 border-t border-slate-100 sticky bottom-0 bg-white">
              <button
                className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-gradient-to-br from-cyan-700 to-cyan-500 text-white font-semibold text-base shadow-md hover:-translate-y-px transition-all disabled:opacity-50"
                onClick={saveEditedOrder}
                disabled={loading || !editOrderItems.length}
              >
                {loading
                  ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Saving…</>
                  : <><CheckCircle size={16} /> Save Changes</>
                }
              </button>
              <button
                className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-slate-100 text-slate-500 border border-slate-300 font-semibold hover:bg-slate-200 transition-all text-sm"
                onClick={() => setShowEditModal(false)}
              >
                <X size={14} /> Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}