import { useState } from 'react';
import {
  Search, Clock, CheckCircle, ChevronDown, Edit3, MessageCircle,
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
export default function OrderHistory({ orders, inventory, confirm, alert }) {
  const [historyVendor, setHistoryVendor] = useState('');
  const [historyStatus, setHistoryStatus] = useState('all');
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [loading, setLoading] = useState(false);

  // Edit order modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);
  const [editOrderItems, setEditOrderItems] = useState([]);
  const [editVendorName, setEditVendorName] = useState('');
  const [editVendorPhone, setEditVendorPhone] = useState('');
  const [editVendorAddress, setEditVendorAddress] = useState('');

  // Add Products Panel
  const [showAddProductsPanel, setShowAddProductsPanel] = useState(false);
  const [editFilterMode, setEditFilterMode] = useState([]);
  const [editCustomThreshold, setEditCustomThreshold] = useState(5);
  const [editProductSearch, setEditProductSearch] = useState('');

  // Manual Product Entry
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualProduct, setManualProduct] = useState({
    name: '', brand: '', type: '', quantity: 1,
  });

  // ── Actions ────────────────────────────────────────────────────────────────
  const deleteOrder = async (orderId, orderNo) => {
    const confirmed = await confirm(`Delete Order #${orderNo}?\n\nThis action cannot be undone.`);
    if (!confirmed) return;

    setLoading(true);
    try {
      const { error } = await supabase.from('orders').delete().eq('id', orderId);
      if (error) throw error;
      await alert(`Order #${orderNo} deleted successfully.`);
    } catch (err) {
      await alert('Error deleting order: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const markReceived = async (orderId) => {
    const confirmed = await confirm('Mark this order as received?\n\nNote: You will need to update inventory stock manually.');
    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: 'received', received_at: new Date().toISOString() })
        .eq('id', orderId);
      if (error) throw error;
    } catch (err) {
      await alert('Error: ' + err.message);
    }
  };

  const resendOrder = async (order) => {
    const orderObj = {
      orderNo: order.order_no || order.orderNo,
      vendorName: order.vendor_name || order.vendorName,
      vendorPhone: order.vendor_phone || order.vendorPhone,
      vendorAddress: order.vendor_address || order.vendorAddress,
      items: order.items,
      status: order.status,
      createdAt: order.created_at || order.createdAt,
    };

    const blob = generateOrderPDF(orderObj, true);
    const vPhone = orderObj.vendorPhone;

    if (vPhone && validatePakistaniNumber(vPhone)) {
      const file = new File([blob], `PurchaseOrder_${orderObj.orderNo}.pdf`, { type: 'application/pdf' });
      const waNum = toWaNumber(vPhone);

      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: `Purchase Order ${orderObj.orderNo}` });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `PurchaseOrder_${orderObj.orderNo}.pdf`; a.click();
        URL.revokeObjectURL(url);

        const msg = `Hello *${orderObj.vendorName}*! Resending Purchase Order *${orderObj.orderNo}* from *${SHOP.name}*. Please see the attached PDF.`;
        setTimeout(() => window.open(`https://wa.me/${waNum}?text=${encodeURIComponent(msg)}`, '_blank'), 600);
      }
    } else {
      generateOrderPDF(orderObj, false);
    }
  };

  // ── Edit Modal Helpers ─────────────────────────────────────────────────────
  const openEditModal = (order) => {
    const items = (order.items || []).map((item) => ({
      ...item,
      currentStock: inventory.find((p) => p.id === item.id)?.stock ?? item.currentStock ?? 0,
    }));

    setEditOrderItems(items);
    setEditVendorName(order.vendor_name || order.vendorName || '');
    setEditVendorPhone(order.vendor_phone || order.vendorPhone || '');
    setEditVendorAddress(order.vendor_address || order.vendorAddress || '');
    setEditingOrder(order);
    setShowEditModal(true);
    setShowAddProductsPanel(false);
    setEditFilterMode([]);
    setEditProductSearch('');
  };

  const updateEditQty = (id, qty) =>
    setEditOrderItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, orderQuantity: qty === '' ? '' : parseInt(qty) || '' } : i))
    );

  const removeEditItem = (id) =>
    setEditOrderItems((prev) => prev.filter((i) => i.id !== id));

  const addProductToEdit = (p) => {
    if (editOrderItems.find((i) => i.id === p.id)) return;
    setEditOrderItems((prev) => [
      ...prev,
      { id: p.id, name: p.name, brand: p.brand || '—', type: p.type, currentStock: p.stock, orderQuantity: 10, isManual: false },
    ]);
  };

  const addManualProductToEdit = () => {
    if (!manualProduct.name.trim()) return alert('Please enter product name');
    if (!manualProduct.quantity || manualProduct.quantity < 1) return alert('Please enter valid quantity');

    const newId = `manual_${Date.now()}`;
    setEditOrderItems((prev) => [
      ...prev,
      {
        id: newId,
        name: manualProduct.name.trim(),
        brand: manualProduct.brand.trim() || 'New',
        type: manualProduct.type.trim() || 'General',
        currentStock: 0,
        orderQuantity: manualProduct.quantity,
        isManual: true,
      },
    ]);

    setManualProduct({ name: '', brand: '', type: '', quantity: 1 });
    setShowManualEntry(false);
  };

  const toggleEditFilter = (mode) =>
    setEditFilterMode((prev) =>
      prev.includes(mode) ? prev.filter((m) => m !== mode) : [...prev, mode]
    );

  const saveEditedOrder = async () => {
    if (!editVendorName.trim()) return alert('Please enter vendor name');
    if (!editOrderItems.length) return alert('No items in order');

    setLoading(true);
    try {
      const { error } = await supabase
        .from('orders')
        .update({
          vendor_name: editVendorName.trim(),
          vendor_phone: editVendorPhone.trim(),
          vendor_address: editVendorAddress.trim(),
          items: editOrderItems,
        })
        .eq('id', editingOrder.id);

      if (error) throw error;
      setShowEditModal(false);
      setEditingOrder(null);
      setEditOrderItems([]);
      await alert('Order updated successfully!');
    } catch (err) {
      await alert('Failed to update: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Filtered Products ──────────────────────────────────────────────────────
  const editFilteredProducts = inventory
    .filter((p) => {
      const matchesFilter =
        editFilterMode.length === 0 ||
        (editFilterMode.includes('outofstock') && p.stock === 0) ||
        (editFilterMode.includes('lowstock') && p.stock > 0 && p.stock <= 5) ||
        (editFilterMode.includes('custom') && p.stock < editCustomThreshold);

      const matchesSearch =
        editProductSearch.trim() === '' ||
        [p.name, p.brand, p.type].some((f) => f?.toLowerCase().includes(editProductSearch.toLowerCase()));

      return matchesFilter && matchesSearch;
    })
    .filter((p) => !editOrderItems.find((i) => i.id === p.id));

  const editFilterConfig = [
    { key: 'outofstock', emoji: '🚫', label: 'Out of Stock', color: '#dc2626', activeClass: 'border-red-500 bg-red-50' },
    { key: 'lowstock', emoji: '⚠️', label: 'Low Stock', color: '#d97706', activeClass: 'border-amber-500 bg-amber-50' },
    { key: 'custom', emoji: '🔢', label: 'Custom', color: '#7c3aed', activeClass: 'border-violet-500 bg-violet-50' },
  ];

  // ── Filtered History ───────────────────────────────────────────────────────
  const filteredHistory = orders
    .filter((o) => {
      const nm = (o.vendor_name || o.vendorName || '').toLowerCase();
      return (
        (!historyVendor || nm.includes(historyVendor.toLowerCase())) &&
        (historyStatus === 'all' || o.status === historyStatus)
      );
    })
    .sort((a, b) => new Date(b.created_at || b.createdAt) - new Date(a.created_at || a.createdAt));

  return (
    <div>
      {/* Filters Bar */}
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
        <span className="text-sm text-slate-500">
          {filteredHistory.length} order{filteredHistory.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Order Cards */}
      {filteredHistory.length === 0 ? (
        <div className="bg-white rounded-xl border border-sky-200 shadow-sm">
          <div className="text-center py-16 text-slate-500">
            <ClipboardList size={56} className="mx-auto mb-3 opacity-30" />
            <p className="text-base font-semibold">No orders found</p>
          </div>
        </div>
      ) : (
        filteredHistory.map((order) => {
          const orderNo = order.order_no || order.orderNo;
          const vendorNm = order.vendor_name || order.vendorName || '—';
          const vendorPh = order.vendor_phone || order.vendorPhone || '';
          const createdAt = order.created_at || order.createdAt;
          const receivedAt = order.received_at || order.receivedAt;
          const isExpanded = expandedOrder === order.id;
          const isPending = order.status === 'pending';
          const totalQty = (order.items || []).reduce((s, i) => s + (i.orderQuantity || 0), 0);

          return (
            <div key={order.id} className={`mb-4 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow border ${isPending ? 'border-amber-200' : 'border-emerald-200'}`}>
              <div className={`px-4 sm:px-5 py-4 cursor-pointer ${isPending ? 'bg-gradient-to-r from-amber-50 to-yellow-50' : 'bg-gradient-to-r from-emerald-50 to-green-50'}`} onClick={() => setExpandedOrder(isExpanded ? null : order.id)}>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
                    <span className="font-extrabold text-base sm:text-lg text-cyan-800 truncate">{vendorNm}</span>
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${isPending ? 'bg-amber-100 text-amber-700 border-amber-300' : 'bg-emerald-100 text-emerald-600 border-emerald-300'}`}>
                      {isPending ? <Clock size={11} /> : <CheckCircle size={11} />}
                      {isPending ? 'Pending' : 'Received'}
                    </span>
                  </div>
                  <ChevronDown size={18} className={`text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs sm:text-sm text-slate-500 mb-3">
                  <span><strong>🧾</strong> <span className="font-mono">{orderNo}</span></span>
                  <span><strong>📅</strong> {formatDate(createdAt)}</span>
                  <span><strong>📦</strong> {(order.items || []).length} products</span>
                  <span><strong>🔢</strong> <span className="font-bold text-slate-800">{totalQty} units</span></span>
                  {vendorPh && <span><strong>📞</strong> {vendorPh}</span>}
                  {receivedAt && <span className="text-emerald-600"><strong>✓</strong> {formatDate(receivedAt)}</span>}
                </div>

                <div className="flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
                  <button className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gradient-to-br from-amber-500 to-amber-400 text-white text-xs font-semibold shadow hover:-translate-y-px transition-all" onClick={() => openEditModal(order)}>
                    <Edit3 size={12} /> Edit
                  </button>
                  <button className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gradient-to-br from-teal-700 to-green-500 text-white text-xs font-semibold shadow hover:-translate-y-px transition-all" onClick={() => resendOrder(order)}>
                    <MessageCircle size={12} /> Resend
                  </button>
                  <button className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gradient-to-br from-cyan-700 to-cyan-500 text-white text-xs font-semibold shadow hover:-translate-y-px transition-all" onClick={() => generateOrderPDF({ orderNo, vendorName: vendorNm, vendorPhone: vendorPh, items: order.items, status: order.status, createdAt }, false)}>
                    <Download size={12} /> PDF
                  </button>
                  {isPending && (
                    <button className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gradient-to-br from-emerald-600 to-emerald-400 text-white text-xs font-semibold shadow hover:-translate-y-px transition-all" onClick={() => markReceived(order.id)}>
                      <CheckCircle size={12} /> Received
                    </button>
                  )}
                  <button className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gradient-to-br from-red-600 to-red-500 text-white text-xs font-semibold shadow hover:-translate-y-px transition-all disabled:opacity-50" onClick={() => deleteOrder(order.id, orderNo)} disabled={loading}>
                    <Trash2 size={12} /> Delete
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse" style={{ minWidth: '340px' }}>
                    <thead>
                      <tr className="bg-gradient-to-r from-cyan-800 to-cyan-600">
                        <th className="px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wide text-white w-[22%]">Brand</th>
                        <th className="px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wide text-white">Name</th>
                        <th className="px-3 py-2.5 text-center text-[11px] font-bold uppercase tracking-wide text-white w-[20%]">Type</th>
                        <th className="px-3 py-2.5 text-center text-[11px] font-bold uppercase tracking-wide text-white w-[15%]">Qty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(order.items || []).map((item, i) => (
                        <tr key={i} className={`border-b border-sky-50 ${i % 2 ? 'bg-sky-50/50' : 'bg-white'}`}>
                          <td className="px-3 py-3"><span className="font-bold text-sm text-cyan-800 truncate block">{item.brand || '—'}</span></td>
                          <td className="px-3 py-3"><span className="font-bold text-[13px] block truncate">{item.name}</span></td>
                          <td className="px-3 py-3 text-center"><span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-violet-100 text-violet-700 whitespace-nowrap">{item.type || '—'}</span></td>
                          <td className="px-3 py-3 text-center"><span className="font-extrabold text-cyan-600 font-mono text-base">{item.orderQuantity}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })
      )}

      {/* ====================== EDIT ORDER MODAL ====================== */}
      {showEditModal && editingOrder && (
        <div className="fixed inset-0 bg-black/65 backdrop-blur-sm flex items-end sm:items-center justify-center z-[1000] sm:p-4" onClick={() => setShowEditModal(false)}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-2xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center px-5 sm:px-6 pt-5 pb-4 border-b border-sky-50 sticky top-0 bg-white z-10">
              <div className="flex items-center gap-2 text-lg sm:text-xl font-bold">
                <Edit3 size={20} /> Edit Order
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-100 text-cyan-800">
                  {editingOrder.order_no || editingOrder.orderNo}
                </span>
              </div>
              <button onClick={() => setShowEditModal(false)} className="w-8 h-8 rounded-md bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-red-100 hover:text-red-500 transition-all">
                <X size={18} />
              </button>
            </div>

            <div className="px-5 sm:px-6 py-5">
              {/* Vendor Information */}
              <div className="bg-gradient-to-r from-sky-50 to-cyan-50 border border-sky-200 rounded-lg px-4 py-4 mb-5">
                <h4 className="flex items-center gap-2 text-sm font-bold text-cyan-800 mb-3">
                  <Building2 size={16} /> Vendor Information
                </h4>
                <div className="mb-3">
                  <label className={labelCls}>Vendor Name <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                    <input className={inputCls + ' pl-10'} value={editVendorName} onChange={(e) => setEditVendorName(e.target.value)} />
                  </div>
                </div>
                <div className="mb-3">
                  <label className={labelCls}>Vendor Phone</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                    <input className={inputCls + ' pl-10'} value={editVendorPhone} onChange={(e) => setEditVendorPhone(e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Vendor Address</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                    <input className={inputCls + ' pl-10'} value={editVendorAddress} onChange={(e) => setEditVendorAddress(e.target.value)} />
                  </div>
                </div>
              </div>

              {/* Current Items */}
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm font-bold text-slate-800 uppercase tracking-wide">📦 Current Items ({editOrderItems.length})</span>
                <button onClick={() => setShowManualEntry(true)} className="flex items-center gap-1 text-emerald-600 hover:text-emerald-700 text-sm font-medium">
                  <Plus size={16} /> Add Custom Product
                </button>
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
                        <th className="px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wide text-white w-[20%]">Brand</th>
                        <th className="px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wide text-white">Name</th>
                        <th className="px-3 py-2.5 text-center text-[11px] font-bold uppercase tracking-wide text-white w-[18%]">Type</th>
                        <th className="px-3 py-2.5 text-center text-[11px] font-bold uppercase tracking-wide text-white w-[14%]">Qty</th>
                        <th className="px-3 py-2.5 text-center text-[11px] font-bold uppercase tracking-wide text-white w-[8%]"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {editOrderItems.map((item, idx) => (
                        <tr key={item.id} className={`border-b border-sky-50 ${idx % 2 ? 'bg-sky-50/50' : 'bg-white'}`}>
                          <td className="px-3 py-3">
                            <span className={`font-bold text-sm truncate block ${item.isManual ? 'text-emerald-600' : 'text-cyan-800'}`}>
                              {item.brand || '—'}
                              {item.isManual && <span className="ml-1 text-[8px] bg-emerald-100 text-emerald-600 px-1 rounded">NEW</span>}
                            </span>
                          </td>
                          <td className="px-3 py-3"><span className="font-bold text-[13px] block truncate">{item.name}</span></td>
                          <td className="px-3 py-3 text-center">
                            <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-violet-100 text-violet-700 whitespace-nowrap">{item.type || '—'}</span>
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
                            <button onClick={() => removeEditItem(item.id)} className="text-red-500 hover:bg-red-50 p-1.5 rounded">
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Add Existing Products */}
              <div className="pt-4 border-t-2 border-sky-200">
                <button onClick={() => setShowAddProductsPanel(!showAddProductsPanel)} className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-slate-100 text-slate-500 border border-slate-300 font-semibold hover:bg-slate-200 transition-all text-sm">
                  {showAddProductsPanel ? <><X size={14} /> Hide Products</> : <><Plus size={14} /> Add Existing Products</>}
                </button>

                {showAddProductsPanel && (
                  <div className="mt-4">
                    <div className="flex flex-wrap gap-2 mb-3">
                      {editFilterConfig.map((f) => {
                        const isActive = editFilterMode.includes(f.key);
                        return (
                          <div key={f.key} onClick={() => toggleEditFilter(f.key)} className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer border-2 transition-all select-none ${isActive ? f.activeClass : 'border-slate-300 bg-white hover:border-cyan-300'}`}>
                            <span className="font-bold text-xs sm:text-sm" style={{ color: isActive ? f.color : undefined }}>{f.emoji} {f.label}</span>
                          </div>
                        );
                      })}
                    </div>

                    <div className="relative mb-3">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={15} />
                      <input className="w-full pl-9 pr-9 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-200 transition-all" placeholder="Search products..." value={editProductSearch} onChange={(e) => setEditProductSearch(e.target.value)} />
                    </div>

                    <div className="max-h-72 overflow-y-auto border border-sky-200 rounded-lg overflow-x-auto">
                      {editFilteredProducts.length === 0 ? (
                        <div className="text-center py-8 text-slate-500">No products found</div>
                      ) : (
                        <table className="w-full border-collapse" style={{ minWidth: '300px' }}>
                          <thead>
                            <tr className="bg-gradient-to-r from-cyan-800 to-cyan-600 sticky top-0">
                              <th className="px-2 py-1.5 text-left text-[10px] font-bold uppercase tracking-wide text-white w-[20%]">Brand</th>
                              <th className="px-2 py-1.5 text-left text-[10px] font-bold uppercase tracking-wide text-white">Product</th>
                              <th className="px-2 py-1.5 text-center text-[10px] font-bold uppercase tracking-wide text-white w-[18%]">Type</th>
                              <th className="px-2 py-1.5 text-center text-[10px] font-bold uppercase tracking-wide text-white w-[10%]">Stock</th>
                              <th className="px-2 py-1.5 text-center text-[10px] font-bold uppercase tracking-wide text-white w-[14%]"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {editFilteredProducts.map((p, i) => (
                              <tr key={p.id} className={`border-b border-sky-50 ${i % 2 ? 'bg-sky-50/50' : 'bg-white'} hover:bg-sky-100 transition-colors`}>
                                <td className="px-2 py-1.5"><span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase bg-cyan-100 text-cyan-800">{p.brand || '—'}</span></td>
                                <td className="px-2 py-1.5"><span className="font-semibold text-[12px] block truncate">{p.name}</span></td>
                                <td className="px-2 py-1.5 text-center"><span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-violet-100 text-violet-700">{p.type || '—'}</span></td>
                                <td className="px-2 py-1.5 text-center"><span className={`font-extrabold text-[11px] font-mono ${p.stock === 0 ? 'text-red-600' : p.stock <= 5 ? 'text-amber-500' : 'text-emerald-600'}`}>{p.stock}</span></td>
                                <td className="px-2 py-1.5 text-center">
                                  <button onClick={() => addProductToEdit(p)} className="px-3 py-1 bg-gradient-to-br from-cyan-700 to-cyan-500 text-white text-[10px] font-semibold rounded flex items-center gap-1 mx-auto">
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

            {/* Footer */}
            <div className="flex flex-col gap-2.5 px-5 sm:px-6 pb-5 pt-2 border-t border-slate-100 sticky bottom-0 bg-white">
              <button onClick={saveEditedOrder} disabled={loading || !editOrderItems.length} className="w-full py-3 rounded-lg bg-gradient-to-br from-cyan-700 to-cyan-500 text-white font-semibold shadow-md hover:-translate-y-px transition-all disabled:opacity-50">
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
              <button onClick={() => setShowEditModal(false)} className="w-full py-2.5 rounded-lg bg-slate-100 text-slate-500 border border-slate-300 font-semibold hover:bg-slate-200 transition-all text-sm">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Product Modal */}
      {showManualEntry && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1100] p-4" onClick={() => setShowManualEntry(false)}>
          <div className="bg-white rounded-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-cyan-800 mb-4 flex items-center gap-2">
              <Edit3 size={20} /> Add Custom Product
            </h3>
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Product Name <span className="text-red-500">*</span></label>
                <input className={inputCls} value={manualProduct.name} onChange={(e) => setManualProduct({ ...manualProduct, name: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>Brand</label>
                <input className={inputCls} value={manualProduct.brand} onChange={(e) => setManualProduct({ ...manualProduct, brand: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>Type / Category</label>
                <input className={inputCls} value={manualProduct.type} onChange={(e) => setManualProduct({ ...manualProduct, type: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>Order Quantity <span className="text-red-500">*</span></label>
                <input type="number" min="1" className={inputCls} value={manualProduct.quantity} onChange={(e) => setManualProduct({ ...manualProduct, quantity: parseInt(e.target.value) || 1 })} />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowManualEntry(false)} className="flex-1 py-2.5 rounded-lg bg-slate-100 text-slate-600">Cancel</button>
              <button onClick={addManualProductToEdit} className="flex-1 py-2.5 rounded-lg bg-gradient-to-br from-emerald-600 to-emerald-500 text-white font-semibold">Add to Order</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}