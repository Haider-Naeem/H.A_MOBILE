import { Download, TrendingUp, DollarSign, Trash2, Send, Wrench } from 'lucide-react';
import { supabase } from '../supabase-config';
import StatsCard from './StatsCard';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function SalesTab({
  sales, salesFilter, setSalesFilter,
  customStartDate, setCustomStartDate,
  customEndDate,   setCustomEndDate,
  stats, blurredCards, toggleBlur,
  onSendBill,
  confirm, alert,
}) {
  const itemProfit = (item) => {
    const retQty = item.returnedQuantity || 0;
    return (item.soldAt - item.buyPrice) * (item.quantity - retQty);
  };

  const getFiltered = () => {
    const now = new Date();
    const sod = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sow = new Date(now); sow.setDate(now.getDate() - now.getDay());
    const som = new Date(now.getFullYear(), now.getMonth(), 1);
    return sales
      .filter(sale => {
        const d = sale.timestamp ? new Date(sale.timestamp) : null;
        if (!d) return false;
        switch (salesFilter) {
          case 'daily':   return d >= sod;
          case 'weekly':  return d >= sow;
          case 'monthly': return d >= som;
          case 'custom':
            if (!customStartDate || !customEndDate) return true;
            const s = new Date(customStartDate);
            const e = new Date(customEndDate); e.setHours(23, 59, 59, 999);
            return d >= s && d <= e;
          default: return true;
        }
      })
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  };

  const filtered   = getFiltered();
  const revenue    = filtered.reduce((s, sale) => s + sale.total, 0);
  const profit     = filtered.reduce((s, sale) =>
    s + sale.items.filter(i => !i.isRepair).reduce((a, i) => a + itemProfit(i), 0), 0);

  const serviceFees = filtered.reduce((s, sale) =>
    s + sale.items
      .filter(i => i.isRepair && (i.returnedQuantity || 0) < (i.quantity || 1))
      .reduce((a, i) => a + (i.soldAt || 0), 0), 0);

  const getLabel = () =>
    ({ daily: 'Today', weekly: 'This Week', monthly: 'This Month', custom: 'Custom Range' }[salesFilter] || 'All Time');

  // ── Per-sale delete ───────────────────────────────────────────────────────
  const deleteSale = async (sale) => {
    const custName = sale.customer_name || sale.customerName || 'Walk-in Customer';
    const total    = sale.total.toFixed(0);

    const confirmed = await confirm(
      `Delete this sale?\n\nCustomer: ${custName}\nTotal: Rs.${total}\n\nThis cannot be undone.`
    );
    if (!confirmed) return;

    const restore = await confirm(
      'Restore inventory stock?\n\nConfirm → restock products back to inventory\nCancel → delete without restocking'
    );

    try {
      if (restore) {
        const productItems = sale.items.filter(i => !i.isRepair);
        for (const item of productItems) {
          const activeQty = item.quantity - (item.returnedQuantity || 0);
          if (activeQty > 0 && item.id) {
            const { data, error } = await supabase
              .from('inventory')
              .select('stock')
              .eq('id', item.id)
              .single();
            if (!error && data) {
              await supabase.from('inventory').update({
                stock: data.stock + activeQty,
                updated_at: new Date().toISOString()
              }).eq('id', item.id);
            }
          }
        }
      }

      const { error } = await supabase.from('sales').delete().eq('id', sale.id);
      if (error) throw error;

      await alert(`✓ Sale deleted${restore ? ' and stock restored' : ''}.`);
    } catch (err) {
      await alert('Error: ' + err.message);
    }
  };

  // ── PDF icon helper ───────────────────────────────────────────────────────
  const pdfIcon = (doc, type, cx, cy, size = 2.8, color = [186, 230, 253]) => {
    const s = size;
    doc.setDrawColor(...color);
    doc.setFillColor(...color);
    doc.setLineWidth(0.42);

    switch (type) {
      case 'phone': {
        doc.roundedRect(cx - s * 0.32, cy - s * 0.5, s * 0.64, s, 0.5, 0.5, 'S');
        doc.setLineWidth(0.55);
        doc.line(cx - s * 0.12, cy - s * 0.32, cx + s * 0.12, cy - s * 0.32);
        doc.circle(cx, cy + s * 0.34, 0.5, 'F');
        doc.setLineWidth(0.42);
        break;
      }
      case 'calendar': {
        doc.rect(cx - s * 0.48, cy - s * 0.3, s * 0.96, s * 0.8, 'S');
        doc.line(cx - s * 0.48, cy - s * 0.02, cx + s * 0.48, cy - s * 0.02);
        doc.setLineWidth(0.6);
        doc.line(cx - s * 0.2, cy - s * 0.5, cx - s * 0.2, cy - s * 0.3);
        doc.line(cx + s * 0.2, cy - s * 0.5, cx + s * 0.2, cy - s * 0.3);
        doc.setLineWidth(0.42);
        break;
      }
      case 'clock': {
        doc.circle(cx, cy, s * 0.5, 'S');
        doc.line(cx, cy, cx, cy - s * 0.3);
        doc.line(cx, cy, cx + s * 0.24, cy + s * 0.08);
        break;
      }
      case 'hash': {
        doc.line(cx - s * 0.14, cy - s * 0.44, cx - s * 0.14, cy + s * 0.44);
        doc.line(cx + s * 0.14, cy - s * 0.44, cx + s * 0.14, cy + s * 0.44);
        doc.line(cx - s * 0.4, cy - s * 0.14, cx + s * 0.4, cy - s * 0.14);
        doc.line(cx - s * 0.4, cy + s * 0.14, cx + s * 0.4, cy + s * 0.14);
        break;
      }
      case 'wrench': {
        doc.setLineWidth(0.6);
        doc.line(cx - s * 0.38, cy + s * 0.42, cx + s * 0.18, cy - s * 0.18);
        doc.circle(cx + s * 0.28, cy - s * 0.28, s * 0.22, 'S');
        doc.circle(cx - s * 0.46, cy + s * 0.46, s * 0.16, 'S');
        doc.setLineWidth(0.42);
        break;
      }
    }
  };

  // ── PDF Export ────────────────────────────────────────────────────────────
  const exportPDF = async () => {
    if (!filtered.length) { await alert('No sales to export'); return; }

    const doc   = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const now   = new Date();
    const CX    = [8,  145, 178];
    const CX_DK = [6,  112, 138];
    const CX_LT = [186, 230, 253];

    doc.setFillColor(...CX);
    doc.rect(0, 0, pageW, 28, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16); doc.setFont('helvetica', 'bold');
    doc.text('H.A MOBILE', pageW / 2, 11, { align: 'center' });
    doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    doc.text('Sales Report', pageW / 2, 18, { align: 'center' });
    doc.text(
      `Period: ${getLabel()}  |  Generated: ${now.toLocaleDateString('en-GB')} ${now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`,
      pageW / 2, 24, { align: 'center' }
    );

    let y    = 34;
    const bW = (pageW - 30) / 3;
    [
      { label: 'Total Sales',   val: String(filtered.length),                         color: [15, 118, 110] },
      { label: 'Total Revenue', val: `Rs.${Math.round(revenue).toLocaleString()}`,    color: [14, 116, 144] },
      { label: 'Total Profit',  val: `Rs.${Math.round(profit).toLocaleString()}`,     color: [5,  150, 105] },
    ].forEach((b, i) => {
      const x = 10 + i * (bW + 5);
      doc.setFillColor(...b.color);
      doc.roundedRect(x, y, bW, 16, 3, 3, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(7.5); doc.setFont('helvetica', 'normal');
      doc.text(b.label.toUpperCase(), x + bW / 2, y + 5.5, { align: 'center' });
      doc.setFontSize(11); doc.setFont('helvetica', 'bold');
      doc.text(b.val, x + bW / 2, y + 12, { align: 'center' });
    });
    y += 22;

    filtered.forEach((sale, idx) => {
      const productItems = sale.items.filter(i => !i.isRepair);
      const repairItem   = sale.items.find(i => i.isRepair);
      const sp           = productItems.reduce((s, i) => s + itemProfit(i), 0);
      const receiptNo    = sale.receipt_no   || sale.receiptNo   || '—';
      const custName     = sale.customer_name || sale.customerName || 'Walk-in Customer';
      const custMob      = sale.customer_mobile || sale.customerMobile || '';
      const d            = sale.timestamp ? new Date(sale.timestamp) : new Date();
      const dateStr      = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      const timeStr      = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

      if (y > 242) { doc.addPage(); y = 14; }

      const cardX      = 10;
      const cardW      = pageW - 20;
      const cardStartY = y;
      const startPage  = doc.internal.getCurrentPageInfo().pageNumber;

      const hdrH = 26;
      doc.setFillColor(...CX);
      doc.roundedRect(cardX, y, cardW, hdrH, 2.5, 2.5, 'F');
      doc.rect(cardX, y + hdrH - 4, cardW, 4, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(11.5); doc.setFont('helvetica', 'bold');
      doc.text(custName, cardX + 4, y + 9);
      doc.setFontSize(13);
      doc.text(`Rs.${sale.total.toFixed(0)}`, cardX + cardW - 4, y + 9, { align: 'right' });

      doc.setFontSize(8); doc.setFont('helvetica', 'normal');
      doc.setTextColor(...CX_LT);

      let mx = cardX + 4;
      const my = y + 20;

      if (custMob) {
        pdfIcon(doc, 'phone', mx, my - 2.5, 5, CX_LT);
        doc.text(custMob, mx + 6.5, my);
        mx += doc.getTextWidth(custMob) + 11;
      }

      pdfIcon(doc, 'calendar', mx, my - 2.5, 5, CX_LT);
      doc.text(dateStr, mx + 6.5, my);
      mx += doc.getTextWidth(dateStr) + 11;

      pdfIcon(doc, 'clock', mx, my - 2.5, 5, CX_LT);
      doc.text(timeStr, mx + 6.5, my);
      mx += doc.getTextWidth(timeStr) + 11;

      pdfIcon(doc, 'hash', mx, my - 2.5, 5, CX_LT);
      doc.text(receiptNo, mx + 6.5, my);

      doc.setTextColor(167, 243, 208);
      doc.setFontSize(8.5); doc.setFont('helvetica', 'bold');
      doc.text(`Profit: Rs.${sp.toFixed(0)}`, cardX + cardW - 4, my, { align: 'right' });

      y += hdrH;

      const rows = productItems
        .filter(it => (it.quantity - (it.returnedQuantity || 0)) > 0)
        .map(it => {
          const rq = it.returnedQuantity || 0;
          const aq = it.quantity - rq;
          return [
            it.brand || '—',
            it.name + (rq > 0 ? ` (${rq} ret.)` : ''),
            it.type  || '—',
            String(aq),
            `Rs.${it.soldAt}`,
            `Rs.${(it.soldAt * aq).toFixed(0)}`,
            `Rs.${itemProfit(it).toFixed(0)}`,
          ];
        });

      if (repairItem && (repairItem.returnedQuantity || 0) < (repairItem.quantity || 1)) {
        rows.push([
          '—', 'Repair / Service Fees', '—', '1',
          `Rs.${repairItem.soldAt.toFixed(0)}`,
          `Rs.${repairItem.soldAt.toFixed(0)}`,
          '—',
        ]);
      }

      autoTable(doc, {
        startY: y,
        margin: { left: cardX, right: pageW - cardX - cardW },
        head: [['Brand', 'Product', 'Type', 'Qty', 'Price', 'Total', 'Profit']],
        body: rows,
        styles: { fontSize: 8.5, cellPadding: 2, font: 'helvetica', textColor: [15, 23, 42] },
        headStyles: { fillColor: [14, 116, 144], textColor: 255, fontStyle: 'bold', fontSize: 8, cellPadding: 2.2 },
        alternateRowStyles: { fillColor: [240, 249, 255] },
        columnStyles: {
          0: { cellWidth: 22, halign: 'left'   },
          1: { cellWidth: 'auto', halign: 'left' },
          2: { cellWidth: 26, halign: 'left'   },
          3: { cellWidth: 12, halign: 'center' },
          4: { cellWidth: 22, halign: 'right'  },
          5: { cellWidth: 22, halign: 'right'  },
          6: { cellWidth: 22, halign: 'right', textColor: [5, 150, 105] },
        },
        didParseCell: (data) => {
          if (data.section === 'head') {
            const aligns = ['left', 'left', 'left', 'center', 'right', 'right', 'right'];
            data.cell.styles.halign = aligns[data.column.index] ?? 'left';
          }
        },
        didDrawCell: (data) => {
          if (
            repairItem &&
            data.section === 'body' &&
            data.row.index === rows.length - 1 &&
            data.column.index === 1
          ) {
            pdfIcon(doc, 'wrench', data.cell.x + 2, data.cell.y + data.cell.height / 2, 4, [180, 120, 40]);
          }
        },
      });

      y = doc.lastAutoTable.finalY;
      const endPage = doc.internal.getCurrentPageInfo().pageNumber;

      if (startPage === endPage) {
        doc.setPage(startPage);
        doc.setDrawColor(...CX_DK);
        doc.setLineWidth(0.45);
        doc.roundedRect(cardX, cardStartY, cardW, y - cardStartY + 3, 2.5, 2.5, 'S');
      } else {
        doc.setPage(endPage);
        doc.setDrawColor(...CX_DK);
        doc.setLineWidth(0.45);
        doc.line(cardX, y + 3, cardX + cardW, y + 3);
      }

      y += 10;

      if (idx < filtered.length - 1 && y < 265) {
        doc.setDrawColor(186, 230, 253);
        doc.setLineWidth(0.25);
        doc.line(cardX, y - 4, cardX + cardW, y - 4);
      }
    });

    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.setFont('helvetica', 'normal');
      doc.text(
        `H.A MOBILE  |  Page ${i} of ${pageCount}`,
        pageW / 2, doc.internal.pageSize.getHeight() - 6,
        { align: 'center' }
      );
    }

    doc.save(`Adnan_Sales_${salesFilter}_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  // ── Delete period ─────────────────────────────────────────────────────────
  const deletePeriod = async () => {
    if (!filtered.length) { await alert('No sales in this period'); return; }
    if (salesFilter !== 'custom') {
      await alert("Select 'Custom Range' to specify a period for deletion.");
      return;
    }
    if (!customStartDate || !customEndDate) {
      await alert('Select both start and end dates');
      return;
    }

    const firstConfirm = await confirm(
      `⚠️ PERMANENT DELETION\n\nDelete ${filtered.length} sales from:\n${customStartDate} to ${customEndDate}\n\nRevenue: Rs.${revenue.toFixed(0)}\nProfit: Rs.${profit.toFixed(0)}\n\nThis cannot be undone.`
    );
    if (!firstConfirm) return;

    const finalConfirm = await confirm(
      `Final confirmation: Delete ${filtered.length} sales?\n\nThis CANNOT be undone.`
    );
    if (!finalConfirm) return;

    try {
      for (const sale of filtered) {
        const { error } = await supabase.from('sales').delete().eq('id', sale.id);
        if (error) throw error;
      }
      await alert(`✓ Deleted ${filtered.length} records.`);
    } catch (err) {
      await alert('Error: ' + err.message);
    }
  };

  const buildReceipt = (sale) => ({
    id: sale.id,
    receiptNo: sale.receipt_no || sale.receiptNo,
    customerName: sale.customer_name || sale.customerName || 'Walk-in Customer',
    customerMobile: sale.customer_mobile || sale.customerMobile || 'N/A',
    cashierName: sale.cashier_name || sale.cashierName || null,
    items: sale.items, total: sale.total, timestamp: sale.timestamp
  });

  const formatDate = (ts) => ts
    ? new Date(ts).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : 'N/A';
  const formatTime = (ts) => ts
    ? new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <div>
      {/* Stats — 2×2 on mobile, 4-col on sm+ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-5">
        <StatsCard title="Total Sales"    value={filtered.length} icon={TrendingUp} color="teal" />
        <StatsCard
          title={`Revenue (${getLabel()})`} value={revenue} isCurrency color="blue"
          blurred={blurredCards.has('revenue')} onToggleBlur={() => toggleBlur('revenue')}
        />
        <StatsCard
          title={`Profit (${getLabel()})`} value={profit} isCurrency color="green"
          blurred={blurredCards.has('profit')} onToggleBlur={() => toggleBlur('profit')} icon={DollarSign}
        />
        <StatsCard
          title="Service Fees" value={serviceFees} isCurrency color="amber" icon={Wrench}
          blurred={blurredCards.has('serviceFees')} onToggleBlur={() => toggleBlur('serviceFees')}
        />
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-5 py-3.5 bg-white border border-sky-200 rounded-xl mb-4 shadow-sm">
        <div className="flex flex-wrap gap-2 items-center w-full sm:w-auto">
          <select
            className="flex-1 sm:flex-none px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-800 bg-white outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-200 transition-all"
            value={salesFilter} onChange={e => setSalesFilter(e.target.value)}
          >
            <option value="daily">Today</option>
            <option value="weekly">This Week</option>
            <option value="monthly">This Month</option>
            <option value="custom">Custom Range</option>
          </select>
          {salesFilter === 'custom' && (
            <div className="flex flex-wrap gap-2 items-center w-full sm:w-auto">
              <input type="date"
                className="flex-1 sm:flex-none px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-cyan-600 transition-all"
                value={customStartDate} onChange={e => setCustomStartDate(e.target.value)} />
              <span className="text-slate-400 font-semibold text-sm">to</span>
              <input type="date"
                className="flex-1 sm:flex-none px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-cyan-600 transition-all"
                value={customEndDate} onChange={e => setCustomEndDate(e.target.value)} />
            </div>
          )}
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-gradient-to-br from-red-700 to-red-500 text-white text-sm font-semibold shadow-md hover:-translate-y-px transition-all"
            onClick={exportPDF}
          >
            <Download size={14} /> Export PDF
          </button>
          <button
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-gradient-to-br from-slate-600 to-slate-500 text-white text-sm font-semibold shadow-md hover:-translate-y-px transition-all"
            onClick={deletePeriod}
          >
            <Trash2 size={14} /> Delete Period
          </button>
        </div>
      </div>

      {salesFilter === 'custom' && filtered.length > 0 && (
        <div className="mb-4 px-3.5 py-2.5 rounded-lg text-sm font-medium bg-amber-50 border-l-4 border-amber-500 text-amber-700">
          ⚠️ Delete Period will permanently remove {filtered.length} records without restocking inventory. Export PDF first!
        </div>
      )}

      {/* Sales List */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-sky-200 shadow-sm">
          <div className="text-center py-16 text-slate-500">
            <TrendingUp size={56} className="mx-auto mb-3 opacity-30" />
            <p className="text-base font-semibold mb-1">No sales found</p>
            <span className="text-sm">
              {salesFilter === 'custom' && (!customStartDate || !customEndDate)
                ? 'Select a date range' : 'Try adjusting your filter'}
            </span>
          </div>
        </div>
      ) : (
        filtered.map(sale => {
          const productItems = sale.items.filter(i => !i.isRepair);
          const repairItem   = sale.items.find(i => i.isRepair);
          const sp           = productItems.reduce((s, i) => s + itemProfit(i), 0);
          const activeQty    = productItems.reduce((s, i) => s + (i.quantity - (i.returnedQuantity || 0)), 0);
          const receiptNo    = sale.receipt_no || sale.receiptNo;
          const custName     = sale.customer_name || sale.customerName || 'Walk-in Customer';
          const custMob      = sale.customer_mobile || sale.customerMobile;
          const activeRepair = repairItem && (repairItem.returnedQuantity || 0) < (repairItem.quantity || 1);

          return (
            <div key={sale.id} className="bg-sky-50 border-2 border-cyan-500 rounded-xl mb-4 overflow-hidden hover:shadow-md transition-shadow">

              {/* ── Card Header ─────────────────────────────────────────── */}
              <div className="px-4 sm:px-5 pt-4 sm:pt-5 pb-3">
                <div className="flex justify-between items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-xl sm:text-2xl font-bold text-cyan-800 mb-1 truncate">{custName}</div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500 mt-1">
                      {custMob && custMob !== 'N/A' && (
                        <span><span className="text-slate-400 font-semibold">📱 </span><span className="font-semibold">{custMob}</span></span>
                      )}
                      <span><span className="text-slate-400 font-semibold">📅 </span><span className="font-semibold">{formatDate(sale.timestamp)}</span></span>
                      <span><span className="text-slate-400 font-semibold">⏰ </span><span className="font-semibold">{formatTime(sale.timestamp)}</span></span>
                    </div>
                    <div className="mt-1.5 text-sm">
                      <span className="text-slate-400 font-semibold">🧾 </span>
                      <span className="font-bold font-mono text-cyan-600">{receiptNo}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                    <div className="text-3xl sm:text-4xl font-bold text-cyan-800 font-mono">Rs.{sale.total.toFixed(0)}</div>
                    <div className="text-base font-bold text-emerald-600">Profit: Rs.{sp.toFixed(0)}</div>
                    <div className="text-sm text-slate-400">
                      {activeQty} item{activeQty !== 1 ? 's' : ''}
                      {activeRepair && <span className="text-amber-600"> + repair</span>}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 mt-3 sm:justify-end">
                  <button
                    className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-lg bg-gradient-to-br from-red-700 to-red-500 text-white text-sm font-semibold shadow hover:-translate-y-px transition-all"
                    onClick={() => deleteSale(sale)}
                    title="Delete this sale"
                  >
                    <Trash2 size={13} /> Delete
                  </button>
                  {onSendBill && (
                    <button
                      className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-lg bg-gradient-to-br from-teal-700 to-green-500 text-white text-sm font-semibold shadow hover:-translate-y-px transition-all"
                      onClick={() => onSendBill(buildReceipt(sale))}
                    >
                      <Send size={13} /> Send Bill
                    </button>
                  )}
                </div>
              </div>

              {/* ── Items Table ─────────────────────────────────────────── */}
              {productItems.length > 0 && (
                <div className="mx-4 mb-3 bg-white rounded-lg border border-cyan-200 overflow-hidden">
                  <div className="text-xs font-bold text-cyan-700 px-3.5 pt-2.5 pb-1">📦 Items:</div>
                  <div className="overflow-x-auto border-t border-cyan-100">
                    <table className="w-full border-collapse text-base">
                      <thead>
                        <tr className="bg-gradient-to-r from-cyan-800 to-cyan-600">
                          <th className="px-2 py-1 text-left   text-[13px] font-semibold uppercase tracking-wide text-white/90 whitespace-nowrap">Brand</th>
                          <th className="px-2 py-1 text-left   text-[13px] font-semibold uppercase tracking-wide text-white/90 whitespace-nowrap">Product</th>
                          <th className="px-2 py-1 text-left   text-[13px] font-semibold uppercase tracking-wide text-white/90 whitespace-nowrap hidden sm:table-cell">Type</th>
                          <th className="px-2 py-1 text-center text-[13px] font-semibold uppercase tracking-wide text-white/90 whitespace-nowrap">Qty</th>
                          <th className="px-2 py-1 text-right  text-[13px] font-semibold uppercase tracking-wide text-white/90 whitespace-nowrap hidden sm:table-cell">Price</th>
                          <th className="px-2 py-1 text-right  text-[13px] font-semibold uppercase tracking-wide text-white/90 whitespace-nowrap">Total</th>
                          <th className="px-2 py-1 text-right  text-[13px] font-semibold uppercase tracking-wide text-white/90 whitespace-nowrap hidden md:table-cell">Profit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {productItems.map((it, i) => {
                          const rq = it.returnedQuantity || 0;
                          const aq = it.quantity - rq;
                          if (aq === 0) return null;
                          return (
                            <tr key={i} className="border-b border-sky-50 last:border-0 hover:bg-sky-50 transition-colors">
                              <td className="px-2 py-1">
                                {it.brand && it.brand !== 'N/A'
                                  ? <span className="px-2 py-0.5 rounded-full text-sm font-semibold bg-cyan-100 text-cyan-800 whitespace-nowrap">{it.brand}</span>
                                  : <span className="text-slate-300 font-mono">—</span>}
                              </td>
                              <td className="px-2 py-1">
                                <span className="font-bold text-base text-slate-800">{it.name}</span>
                                {rq > 0 && <span className="ml-2 px-1.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-600 whitespace-nowrap">{rq} returned</span>}
                              </td>
                              <td className="px-2 py-1 hidden sm:table-cell">
                                <span className="px-2 py-0.5 rounded-full text-sm font-semibold bg-violet-100 text-violet-700 whitespace-nowrap">{it.type}</span>
                              </td>
                              <td className="px-2 py-1 text-center font-bold font-mono text-base text-slate-800">{aq}</td>
                              <td className="px-2 py-1 text-right font-semibold font-mono text-base text-emerald-600 hidden sm:table-cell">Rs.{it.soldAt}</td>
                              <td className="px-2 py-1 text-right font-bold font-mono text-base text-cyan-700">RS {(it.soldAt * aq).toFixed(0)}</td>
                              <td className="px-2 py-1 text-right font-semibold text-base text-emerald-500 hidden md:table-cell">Rs.{itemProfit(it).toFixed(0)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ── Repair row ───────────────────────────────────────────── */}
              {activeRepair && (
                <div className="flex flex-wrap justify-between items-center gap-2 mx-4 mb-3 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Wrench size={15} className="text-amber-600 flex-shrink-0" />
                    <span className="font-bold text-base text-amber-800 italic">Repair / Service Fees</span>
                  </div>
                  <strong className="font-mono text-base text-amber-600">Rs.{repairItem.soldAt.toFixed(0)}</strong>
                </div>
              )}

              {/* ── Footer summary ───────────────────────────────────────── */}
              <div className="px-4 sm:px-5 py-2.5 bg-cyan-100/40 border-t border-cyan-200 flex flex-wrap gap-x-6 gap-y-1 justify-end text-sm">
                <span className="text-slate-500 font-medium">Revenue: <strong className="font-mono text-cyan-700">Rs.{sale.total.toFixed(0)}</strong></span>
                <span className="text-slate-500 font-medium">Profit: <strong className="font-mono text-emerald-600">Rs.{sp.toFixed(0)}</strong></span>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}