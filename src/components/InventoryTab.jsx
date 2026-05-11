import { useState } from 'react';
import { Search, Plus, Edit2, Trash2, Package, ArrowUpDown, X, FileDown } from 'lucide-react';
import { supabase } from '../supabase-config';
import StatsCard from './StatsCard';

/* ─── column widths — set on <col> so header & data always align ── */
const COL_WIDTHS = ['14%', '26%', '13%', '12%', '12%', '11%', '12%'];

export default function InventoryTab({
  inventory, searchTerm, setSearchTerm,
  setShowAddProductModal, setEditingProduct,
  form, setForm, productTypes,
  setShowAddStockModal, setStockProduct, setStockAmount,
  stats, blurredCards, toggleBlur
}) {
  // Default: stock low → high so critical items surface immediately
  const [sortField,  setSortField]  = useState('stock');
  const [sortDir,    setSortDir]    = useState('asc');
  const [activeType, setActiveType] = useState('All');
  const [exporting,  setExporting]  = useState(false);

  /* ── Unique type list from live inventory ───────────────────────── */
  const typeOptions = [
    'All',
    ...Array.from(new Set(inventory.map(p => p.type).filter(Boolean))).sort(),
  ];

  /* ── Filter ─────────────────────────────────────────────────────── */
  const filtered = inventory.filter(p => {
    const q = searchTerm.toLowerCase();
    const matchSearch =
      (p.name  || '').toLowerCase().includes(q) ||
      (p.brand || '').toLowerCase().includes(q) ||
      (p.type  || '').toLowerCase().includes(q);
    const matchType = activeType === 'All' || p.type === activeType;
    return matchSearch && matchType;
  });

  /* ── Sort ───────────────────────────────────────────────────────── */
  const sorted = [...filtered].sort((a, b) => {
    let av = a[sortField], bv = b[sortField];
    if (typeof av === 'string') { av = av.toLowerCase(); bv = bv.toLowerCase(); }
    if (av < bv) return sortDir === 'asc' ? -1 : 1;
    if (av > bv) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const handleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  /* ── Open edit modal ─────────────────────────────────────────────── */
  const openEdit = (p) => {
    setEditingProduct(p);
    setForm({
      brand:       p.brand || '',
      name:        p.name  || '',
      type:        productTypes.includes(p.type) ? p.type : 'Other',
      customType:  productTypes.includes(p.type) ? '' : p.type,
      buyPrice:    String(p.buyPrice    || ''),
      retailPrice: String(p.retailPrice || ''),
      stock:       String(p.stock       || ''),
    });
    setShowAddProductModal(true);
  };

  /* ── Delete ──────────────────────────────────────────────────────── */
  const handleDelete = async (id, name) => {
    if (!confirm(`Delete "${name}" permanently? This cannot be undone.`)) return;
    try {
      const { error } = await supabase.from('inventory').delete().eq('id', id);
      if (error) throw error;
    } catch (err) { alert('Failed to delete: ' + err.message); }
  };

  /* ── PDF Export ──────────────────────────────────────────────────── */
  const exportPDF = async () => {
    setExporting(true);
    try {
      const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable'),
      ]);

      // ── Portrait A4 ──────────────────────────────────────────────
      const doc   = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageW = doc.internal.pageSize.getWidth();   // 210 mm
      const now   = new Date();
      const dateStr = now.toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' });
      const timeStr = now.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' });

      /* ── Coloured header band ── */
      doc.setFillColor(4, 96, 132);
      doc.rect(0, 0, pageW, 18, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(255, 255, 255);
      doc.text('H.A MOBILE — Inventory Report', 10, 11);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(`${dateStr}  ${timeStr}`, pageW - 10, 11, { align: 'right' });

      /* ── Meta line ── */
      doc.setTextColor(80, 80, 80);
      doc.setFontSize(8);
      doc.text(
        `Filter: ${activeType}   Search: "${searchTerm || 'none'}"   Sorted: ${sortField} (${sortDir})`,
        10, 24,
      );

      /* ── Summary line ── */
      const totalUnits = sorted.reduce((s, p) => s + (p.stock || 0), 0);
      const lowCount   = sorted.filter(p => p.stock <= 5).length;
      doc.setFont('helvetica', 'bold');
      doc.text(
        `Products: ${sorted.length}   Total Units: ${totalUnits}   Low / Out of Stock: ${lowCount}`,
        10, 30,
      );

      /* ── Table ──────────────────────────────────────────────────────
         Portrait usable width ≈ 190 mm (10 mm margins each side).
         Alignment is enforced inside didParseCell (runs for every cell)
         so fillColor / other mutations never silently reset halign.
           0:# → center | 1:Brand → left | 2:Product → left
           3:Type → center | 4:Buy → right | 5:Sell → right
           6:Stock → center | 7:Status → center
      ────────────────────────────────────────────────────────────────── */
      const COL_ALIGN = ['center','left','left','center','right','right','center','center'];

      autoTable(doc, {
        startY: 35,
        margin: { left: 10, right: 10 },
        head: [['#', 'Brand', 'Product', 'Type', 'Buy Rs.', 'Sell Rs.', 'Stock', 'Status']],
        body: sorted.map((p, i) => [
          i + 1,
          p.brand || '—',
          p.name,
          p.type,
          `Rs.${(p.buyPrice    || 0).toLocaleString()}`,
          `Rs.${(p.retailPrice || 0).toLocaleString()}`,
          p.stock,
          p.stock === 0 ? 'OUT OF STOCK' : p.stock <= 5 ? 'LOW STOCK' : 'OK',
        ]),
        headStyles: {
          fillColor: [4, 96, 132],
          textColor: 255,
          fontStyle: 'bold',
          fontSize:  8.5,
        },
        columnStyles: {
          0: { cellWidth: 8  },
          1: { cellWidth: 22 },
          2: { cellWidth: 52 },
          3: { cellWidth: 22 },
          4: { cellWidth: 20 },
          5: { cellWidth: 20 },
          6: { cellWidth: 14 },
          7: { cellWidth: 20 },
        },
        bodyStyles: { fontSize: 8, cellPadding: 2.5 },
        alternateRowStyles: { fillColor: [240, 249, 255] },
        didParseCell(data) {
          // Enforce alignment first — nothing can override it after this
          data.cell.styles.halign = COL_ALIGN[data.column.index];

          if (data.section === 'body') {
            const p = sorted[data.row.index];
            // status column colouring
            if (data.column.index === 7) {
              data.cell.styles.fontStyle = 'bold';
              if (p.stock === 0)      data.cell.styles.textColor = [185, 28, 28];
              else if (p.stock <= 5)  data.cell.styles.textColor = [180, 83, 9];
              else                    data.cell.styles.textColor = [21, 128, 61];
            }
            // row background for low / out
            if (p.stock === 0)     data.cell.styles.fillColor = [254, 226, 226];
            else if (p.stock <= 5) data.cell.styles.fillColor = [255, 247, 237];
          }
        },
        didDrawPage() {
          const pg    = doc.internal.getCurrentPageInfo().pageNumber;
          const total = doc.internal.getNumberOfPages();
          doc.setFontSize(7);
          doc.setTextColor(160);
          doc.text(
            `Page ${pg} of ${total}  ·  Adnan Mobile Shop`,
            pageW / 2,
            doc.internal.pageSize.getHeight() - 5,
            { align: 'center' },
          );
        },
      });

      doc.save(`inventory-${now.toISOString().slice(0, 10)}.pdf`);
    } catch (err) {
      console.error(err);
      alert(
        'PDF export failed.\n\nMake sure the packages are installed:\n' +
        'npm i jspdf jspdf-autotable',
      );
    } finally { setExporting(false); }
  };

  /* ── Sort button ─────────────────────────────────────────────────── */
  const SortBtn = ({ field, children, center = false }) => (
    <button
      onClick={() => handleSort(field)}
      className={`flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide
        text-white/90 hover:text-white bg-transparent border-none font-[inherit]
        cursor-pointer w-full ${center ? 'justify-center' : 'justify-start'}`}
    >
      {children}
      <ArrowUpDown size={10} className={sortField === field ? 'opacity-100' : 'opacity-40'} />
      {sortField === field && (
        <span className="text-[9px] opacity-60 ml-0.5">{sortDir === 'asc' ? '↑' : '↓'}</span>
      )}
    </button>
  );

  /* ══════════════════════════════════════════════════════════════════ */
  return (
    <div>
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
        <StatsCard title="Total Products" value={inventory.length} icon={Package} color="blue" />
        <StatsCard
          title="Inventory Cost"
          value={stats.inventoryCost}
          blurred={blurredCards.has('invCost')}
          onToggleBlur={() => toggleBlur('invCost')}
          isCurrency color="teal"
        />
        <StatsCard
          title="Retail Value"
          value={stats.retailValue}
          blurred={blurredCards.has('retailValue')}
          onToggleBlur={() => toggleBlur('retailValue')}
          isCurrency color="green"
        />
      </div>

      {/* Search + Export + Add ───────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-sky-200 shadow-sm mb-4">
        <div className="px-5 py-3.5 flex flex-col gap-3">

          {/* Row 1 */}
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 sm:items-center">
            {/* Search — full width on mobile */}
            <div className="relative flex-1">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
              />
              <input
                className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-800
                  bg-white outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-200 transition-all"
                placeholder="Search by name, brand or type..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Export PDF */}
            <button
              onClick={exportPDF}
              disabled={exporting || sorted.length === 0}
              className="flex items-center justify-center gap-1.5 w-full sm:w-auto
                px-4 py-2.5 rounded-lg border-2 border-cyan-600 text-cyan-700 text-sm font-semibold
                hover:bg-cyan-50 active:scale-95 transition-all
                disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {exporting ? (
                <>
                  <span className="w-4 h-4 border-2 border-cyan-400/40 border-t-cyan-600 rounded-full animate-spin" />
                  Exporting…
                </>
              ) : (
                <><FileDown size={15} /> Export PDF</>
              )}
            </button>

            {/* Add Product */}
            <button
              className="flex items-center justify-center gap-1.5 w-full sm:w-auto
                px-4 py-2.5 rounded-lg bg-gradient-to-br from-cyan-700 to-cyan-500
                text-white text-sm font-semibold shadow-md hover:-translate-y-px active:scale-95 transition-all whitespace-nowrap"
              onClick={() => {
                setEditingProduct(null);
                setForm({
                  brand: '', name: '', type: 'Screen Protector',
                  customType: '', buyPrice: '', retailPrice: '', stock: '',
                });
                setShowAddProductModal(true);
              }}
            >
              <Plus size={15} /> Add Product
            </button>
          </div>

          {/* Row 2: type filter pills */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 shrink-0 pr-1">
              Filter:
            </span>
            {typeOptions.map(type => {
              const isActive = activeType === type;
              const count = type === 'All'
                ? inventory.length
                : inventory.filter(p => p.type === type).length;
              return (
                <button
                  key={type}
                  onClick={() => setActiveType(type)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold
                    transition-all active:scale-95 border"
                  style={isActive
                    ? { background: 'linear-gradient(135deg,#155e75,#0891b2)', color: '#fff', borderColor: 'transparent', boxShadow: '0 2px 8px #0891b240' }
                    : { background: '#f0f9ff', color: '#0e7490', borderColor: '#bae6fd' }}
                >
                  {type}
                  <span
                    className="px-1.5 py-0.5 rounded-full text-[10px] font-extrabold"
                    style={isActive
                      ? { background: 'rgba(255,255,255,0.25)', color: '#fff' }
                      : { background: '#e0f2fe', color: '#0369a1' }}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
            {activeType !== 'All' && (
              <button
                onClick={() => setActiveType('All')}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold
                  text-red-500 border border-red-200 bg-red-50 hover:bg-red-100 transition-all active:scale-95 ml-1"
              >
                <X size={10} /> Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Table ─────────────────────────────────────────────────────────
          table-fixed + <colgroup> guarantees header and data columns
          are driven by the same width source → perfect alignment.
      ──────────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-sky-200 shadow-sm overflow-hidden">
        {sorted.length === 0 ? (
          <div className="text-center py-16 px-5 text-slate-500">
            <Package size={52} className="mx-auto mb-3 opacity-25" />
            <p className="font-semibold mb-1">No products found</p>
            <p className="text-sm">
              {activeType !== 'All'
                ? `No "${activeType}" products match your search.`
                : 'Try adjusting your search or add new products.'}
            </p>
            {activeType !== 'All' && (
              <button
                onClick={() => setActiveType('All')}
                className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg
                  bg-cyan-50 text-cyan-700 text-sm font-semibold border border-cyan-200
                  hover:bg-cyan-100 transition-all"
              >
                <X size={13} /> Clear Type Filter
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full table-fixed border-collapse text-sm min-w-[640px]">
              <colgroup>
                {COL_WIDTHS.map((w, i) => <col key={i} style={{ width: w }} />)}
              </colgroup>

              <thead>
                <tr className="bg-gradient-to-r from-cyan-800 to-cyan-600" style={{ height: 42 }}>
                  <th className="px-3 py-0 text-left align-middle">
                    <SortBtn field="brand">Brand</SortBtn>
                  </th>
                  <th className="px-3 py-0 text-left align-middle">
                    <SortBtn field="name">Product</SortBtn>
                  </th>
                  <th className="px-3 py-0 text-left align-middle">
                    <SortBtn field="type">Type</SortBtn>
                  </th>
                  <th className="px-3 py-0 align-middle">
                    <SortBtn field="buyPrice" center>Buy Rs.</SortBtn>
                  </th>
                  <th className="px-3 py-0 align-middle">
                    <SortBtn field="retailPrice" center>Sell Rs.</SortBtn>
                  </th>
                  <th className="px-3 py-0 align-middle">
                    <SortBtn field="stock" center>Stock</SortBtn>
                  </th>
                  <th className="px-3 py-0 text-center align-middle">
                    <span className="text-[11px] font-bold uppercase tracking-wide text-white/90">
                      Actions
                    </span>
                  </th>
                </tr>
              </thead>

              <tbody>
                {sorted.map(p => (
                  <tr
                    key={p.id}
                    style={{ height: 46 }}
                    className={`border-b border-sky-50 transition-colors hover:bg-sky-50/80
                      ${p.stock === 0 ? 'bg-red-50' : p.stock <= 5 ? 'bg-orange-50/50' : ''}`}
                  >
                    {/* Brand */}
                    <td className="px-3 py-0 align-middle">
                      <span className="block truncate font-semibold text-slate-500">
                        {p.brand || '—'}
                      </span>
                    </td>

                    {/* Product */}
                    <td className="px-3 py-0 align-middle">
                      <span className="block truncate font-bold text-slate-800" title={p.name}>
                        {p.name}
                      </span>
                    </td>

                    {/* Type */}
                    <td className="px-3 py-0 align-middle">
                      <span className="inline-block max-w-full truncate px-2 py-0.5
                        rounded-full text-xs font-semibold bg-cyan-100 text-cyan-800">
                        {p.type}
                      </span>
                    </td>

                    {/* Buy */}
                    <td className="px-3 py-0 align-middle text-center">
                      <span className="font-bold font-mono text-amber-500">
                        Rs.{(p.buyPrice || 0).toLocaleString()}
                      </span>
                    </td>

                    {/* Sell */}
                    <td className="px-3 py-0 align-middle text-center">
                      <span className="font-bold font-mono text-emerald-600">
                        Rs.{(p.retailPrice || 0).toLocaleString()}
                      </span>
                    </td>

                    {/* Stock */}
                    <td className="px-3 py-0 align-middle text-center">
                      <span className={`block font-extrabold font-mono ${
                        p.stock === 0 ? 'text-red-600' : p.stock <= 5 ? 'text-amber-500' : 'text-slate-800'
                      }`}>
                        {p.stock}
                      </span>
                      {p.stock <= 5 && (
                        <span className="text-[10px] font-semibold text-red-500 leading-none">
                          {p.stock === 0 ? 'Out' : 'Low'}
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-3 py-0 align-middle">
                      <div className="flex gap-1 justify-center">
                        <button
                          className="p-1.5 rounded-md text-emerald-600 hover:bg-emerald-50 transition-colors"
                          title="Add Stock"
                          onClick={() => { setStockProduct(p); setStockAmount(''); setShowAddStockModal(true); }}
                        >
                          <Plus size={14} />
                        </button>
                        <button
                          className="p-1.5 rounded-md text-cyan-600 hover:bg-cyan-50 transition-colors"
                          title="Edit"
                          onClick={() => openEdit(p)}
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          className="p-1.5 rounded-md text-red-500 hover:bg-red-50 transition-colors"
                          title="Delete"
                          onClick={() => handleDelete(p.id, p.name)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer */}
      {sorted.length > 0 && (
        <div className="mt-3 flex flex-wrap justify-between gap-2 text-sm text-slate-500 px-1">
          <span>
            Showing{' '}
            <strong className="text-cyan-600">{sorted.length}</strong> of{' '}
            <strong>{inventory.length}</strong> products
            {activeType !== 'All' && (
              <span className="ml-1.5 px-2 py-0.5 rounded-full text-xs font-bold bg-cyan-100 text-cyan-700">
                {activeType}
              </span>
            )}
          </span>
          <span className="flex items-center gap-3">
            <span>
              Total Stock:{' '}
              <strong className="text-cyan-600 font-mono">
                {sorted.reduce((s, p) => s + (p.stock || 0), 0).toLocaleString()} units
              </strong>
            </span>
            {sorted.filter(p => p.stock <= 5).length > 0 && (
              <span className="text-red-500 font-semibold">
                · {sorted.filter(p => p.stock <= 5).length} low / out
              </span>
            )}
          </span>
        </div>
      )}
    </div>
  );
}