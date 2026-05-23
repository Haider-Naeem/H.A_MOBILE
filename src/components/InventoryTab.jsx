import { useState } from 'react';
import { Search, Plus, Edit2, Trash2, Package, ArrowUpDown, X, FileDown } from 'lucide-react';
import { supabase } from '../supabase-config';
import StatsCard from './StatsCard';

export default function InventoryTab({
  inventory, searchTerm, setSearchTerm,
  setShowAddProductModal, setEditingProduct,
  form, setForm, productTypes,
  setShowAddStockModal, setStockProduct, setStockAmount,
  stats, blurredCards, toggleBlur,
  confirm, alert,   // ✅ custom dialog props
}) {
  const [sortField,  setSortField]  = useState('stock');
  const [sortDir,    setSortDir]    = useState('asc');
  const [activeType, setActiveType] = useState('All');
  const [exporting,  setExporting]  = useState(false);
  const [mobileView, setMobileView] = useState(window.innerWidth < 768);

  useState(() => {
    const handleResize = () => setMobileView(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const typeOptions = [
    'All',
    ...Array.from(new Set(inventory.map(p => p.type).filter(Boolean))).sort(),
  ];

  const filtered = inventory.filter(p => {
    const q = searchTerm.toLowerCase();
    const matchSearch =
      (p.name  || '').toLowerCase().includes(q) ||
      (p.brand || '').toLowerCase().includes(q) ||
      (p.type  || '').toLowerCase().includes(q);
    const matchType = activeType === 'All' || p.type === activeType;
    return matchSearch && matchType;
  });

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

  // ✅ Replaced native confirm/alert with custom dialog
  const handleDelete = async (id, name) => {
    const ok = await confirm(`Delete "${name}" permanently?\nThis cannot be undone.`);
    if (!ok) return;
    try {
      const { error } = await supabase.from('inventory').delete().eq('id', id);
      if (error) throw error;
    } catch (err) {
      await alert('Failed to delete: ' + err.message);
    }
  };

  const exportPDF = async () => {
    setExporting(true);
    try {
      const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable'),
      ]);

      const doc   = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageW = doc.internal.pageSize.getWidth();
      const now   = new Date();
      const dateStr = now.toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' });
      const timeStr = now.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' });

      doc.setFillColor(4, 96, 132);
      doc.rect(0, 0, pageW, 18, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(255, 255, 255);
      doc.text('H.A MOBILE — Inventory Report', 10, 11);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(`${dateStr}  ${timeStr}`, pageW - 10, 11, { align: 'right' });

      doc.setTextColor(80, 80, 80);
      doc.setFontSize(8);
      doc.text(
        `Filter: ${activeType}   Search: "${searchTerm || 'none'}"   Sorted: ${sortField} (${sortDir})`,
        10, 24,
      );

      const totalUnits = sorted.reduce((s, p) => s + (p.stock || 0), 0);
      const lowCount   = sorted.filter(p => p.stock <= 5).length;
      doc.setFont('helvetica', 'bold');
      doc.text(
        `Products: ${sorted.length}   Total Units: ${totalUnits}   Low / Out of Stock: ${lowCount}`,
        10, 30,
      );

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
          data.cell.styles.halign = COL_ALIGN[data.column.index];
          if (data.section === 'body') {
            const p = sorted[data.row.index];
            if (data.column.index === 7) {
              data.cell.styles.fontStyle = 'bold';
              if (p.stock === 0)      data.cell.styles.textColor = [185, 28, 28];
              else if (p.stock <= 5)  data.cell.styles.textColor = [180, 83, 9];
              else                    data.cell.styles.textColor = [21, 128, 61];
            }
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
      // ✅ Replaced native alert
      await alert('PDF export failed.\n\nMake sure the packages are installed:\nnpm i jspdf jspdf-autotable');
    } finally {
      setExporting(false);
    }
  };

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

  const MobileProductCard = ({ product }) => (
    <div className={`border rounded-lg p-4 mb-3 shadow-sm ${
      product.stock === 0 ? 'bg-red-50 border-red-200' :
      product.stock <= 5 ? 'bg-orange-50 border-orange-200' :
      'bg-white border-sky-200'
    }`}>
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <h3 className="font-bold text-slate-800 text-base">{product.name}</h3>
          <p className="text-sm text-slate-500">{product.brand || '—'}</p>
        </div>
        <div className="flex gap-1">
          <button
            className="p-2 rounded-md text-emerald-600 hover:bg-emerald-50 transition-colors"
            onClick={() => { setStockProduct(product); setStockAmount(''); setShowAddStockModal(true); }}
          >
            <Plus size={16} />
          </button>
          <button
            className="p-2 rounded-md text-cyan-600 hover:bg-cyan-50 transition-colors"
            onClick={() => openEdit(product)}
          >
            <Edit2 size={16} />
          </button>
          <button
            className="p-2 rounded-md text-red-500 hover:bg-red-50 transition-colors"
            onClick={() => handleDelete(product.id, product.name)}
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <span className="text-slate-500 text-xs">Type</span>
          <p className="font-semibold text-slate-700">
            <span className="inline-block px-2 py-0.5 rounded-full text-xs bg-cyan-100 text-cyan-800">
              {product.type}
            </span>
          </p>
        </div>
        <div>
          <span className="text-slate-500 text-xs">Buy Price</span>
          <p className="font-bold text-amber-500">Rs.{product.buyPrice?.toLocaleString() || 0}</p>
        </div>
        <div>
          <span className="text-slate-500 text-xs">Sell Price</span>
          <p className="font-bold text-emerald-600">Rs.{product.retailPrice?.toLocaleString() || 0}</p>
        </div>
        <div>
          <span className="text-slate-500 text-xs">Stock</span>
          <p className={`font-extrabold ${
            product.stock === 0 ? 'text-red-600' :
            product.stock <= 5 ? 'text-amber-500' :
            'text-slate-800'
          }`}>
            {product.stock} {product.stock <= 5 && (
              <span className="text-[10px] ml-1">
                {product.stock === 0 ? '(Out)' : '(Low)'}
              </span>
            )}
          </p>
        </div>
      </div>
    </div>
  );

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

      {/* Search + Export + Add */}
      <div className="bg-white rounded-xl border border-sky-200 shadow-sm mb-4">
        <div className="px-4 sm:px-5 py-3.5 flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 sm:items-center">
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

          {/* Type filter pills */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 shrink-0 pr-1">
              Filter:
            </span>
            <div className="flex flex-wrap gap-2">
              {typeOptions.slice(0, mobileView ? 5 : typeOptions.length).map(type => {
                const isActive = activeType === type;
                const count = type === 'All'
                  ? inventory.length
                  : inventory.filter(p => p.type === type).length;
                return (
                  <button
                    key={type}
                    onClick={() => setActiveType(type)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold
                      transition-all active:scale-95 border whitespace-nowrap"
                    style={isActive
                      ? { background: 'linear-gradient(135deg,#155e75,#0891b2)', color: '#fff', borderColor: 'transparent', boxShadow: '0 2px 8px #0891b240' }
                      : { background: '#f0f9ff', color: '#0e7490', borderColor: '#bae6fd' }}
                  >
                    {type.length > 12 && mobileView ? type.slice(0, 10) + '...' : type}
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
              {mobileView && typeOptions.length > 5 && (
                <select
                  className="px-2 py-1 rounded-full text-xs font-bold border border-cyan-200 bg-cyan-50 text-cyan-700"
                  onChange={(e) => setActiveType(e.target.value)}
                  value={activeType}
                >
                  {typeOptions.map(type => (
                    <option key={type} value={type}>
                      {type} ({type === 'All' ? inventory.length : inventory.filter(p => p.type === type).length})
                    </option>
                  ))}
                </select>
              )}
            </div>
            {activeType !== 'All' && (
              <button
                onClick={() => setActiveType('All')}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold
                  text-red-500 border border-red-200 bg-red-50 hover:bg-red-100 transition-all active:scale-95"
              >
                <X size={10} /> Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Table / Card */}
      {sorted.length === 0 ? (
        <div className="bg-white rounded-xl border border-sky-200 shadow-sm text-center py-16 px-5 text-slate-500">
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
      ) : mobileView ? (
        <div className="space-y-3">
          {sorted.map(product => (
            <MobileProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-sky-200 shadow-sm overflow-x-auto">
          <div className="overflow-x-auto" style={{ minWidth: '800px' }}>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-gradient-to-r from-cyan-800 to-cyan-600" style={{ height: 42 }}>
                  <th className="px-3 py-2 text-left w-[15%]"><SortBtn field="brand">Brand</SortBtn></th>
                  <th className="px-3 py-2 text-left w-[25%]"><SortBtn field="name">Product</SortBtn></th>
                  <th className="px-3 py-2 text-left w-[12%]"><SortBtn field="type">Type</SortBtn></th>
                  <th className="px-3 py-2 text-center w-[12%]"><SortBtn field="buyPrice" center>Buy Rs.</SortBtn></th>
                  <th className="px-3 py-2 text-center w-[12%]"><SortBtn field="retailPrice" center>Sell Rs.</SortBtn></th>
                  <th className="px-3 py-2 text-center w-[10%]"><SortBtn field="stock" center>Stock</SortBtn></th>
                  <th className="px-3 py-2 text-center w-[14%]">
                    <span className="text-[11px] font-bold uppercase tracking-wide text-white/90">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(p => (
                  <tr
                    key={p.id}
                    className={`border-b border-sky-50 transition-colors hover:bg-sky-50/80
                      ${p.stock === 0 ? 'bg-red-50' : p.stock <= 5 ? 'bg-orange-50/50' : ''}`}
                  >
                    <td className="px-3 py-2 align-middle">
                      <span className="block truncate font-semibold text-slate-500">{p.brand || '—'}</span>
                    </td>
                    <td className="px-3 py-2 align-middle">
                      <span className="block truncate font-bold text-slate-800" title={p.name}>{p.name}</span>
                    </td>
                    <td className="px-3 py-2 align-middle">
                      <span className="inline-block max-w-full truncate px-2 py-0.5 rounded-full text-xs font-semibold bg-cyan-100 text-cyan-800">
                        {p.type}
                      </span>
                    </td>
                    <td className="px-3 py-2 align-middle text-center">
                      <span className="font-bold font-mono text-amber-500">Rs.{(p.buyPrice || 0).toLocaleString()}</span>
                    </td>
                    <td className="px-3 py-2 align-middle text-center">
                      <span className="font-bold font-mono text-emerald-600">Rs.{(p.retailPrice || 0).toLocaleString()}</span>
                    </td>
                    <td className="px-3 py-2 align-middle text-center">
                      <span className={`block font-extrabold font-mono ${
                        p.stock === 0 ? 'text-red-600' : p.stock <= 5 ? 'text-amber-500' : 'text-slate-800'
                      }`}>{p.stock}</span>
                      {p.stock <= 5 && (
                        <span className="text-[10px] font-semibold text-red-500 leading-none">
                          {p.stock === 0 ? 'Out' : 'Low'}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 align-middle">
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
        </div>
      )}

      {/* Footer */}
      {sorted.length > 0 && (
        <div className="mt-3 flex flex-wrap justify-between gap-2 text-sm text-slate-500 px-1">
          <span>
            Showing <strong className="text-cyan-600">{sorted.length}</strong> of{' '}
            <strong>{inventory.length}</strong> products
            {activeType !== 'All' && (
              <span className="ml-1.5 px-2 py-0.5 rounded-full text-xs font-bold bg-cyan-100 text-cyan-700">
                {activeType}
              </span>
            )}
          </span>
          <span className="flex flex-wrap items-center gap-3">
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