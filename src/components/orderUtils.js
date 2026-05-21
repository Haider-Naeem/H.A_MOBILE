import { jsPDF } from 'jspdf';

export const SHOP = {
  name:    'H.A MOBILE',
  tagline: 'Software & Repairing',
  address: 'Almgir Market Railway Road, Rahim Yar Khan',
  phone:   '+92-300-6731353',
  email:   'adnanmobile@gmail.com',
};

export function validatePakistaniNumber(num) {
  const cleaned = num.replace(/[\s\-]/g, '');
  return /^(03\d{9}|92\d{10}|\+92\d{10})$/.test(cleaned);
}

export function toWaNumber(num) {
  const cleaned = num.replace(/[\s\-]/g, '');
  if (cleaned.startsWith('0')) return '92' + cleaned.slice(1);
  if (cleaned.startsWith('+')) return cleaned.slice(1);
  return cleaned;
}

export function generateOrderPDF(order, returnBlob = false) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const PW = 210, PH = 297, ML = 15, MR = 195, TW = 180;
  const date    = new Date(order.createdAt || new Date());
  const dateStr = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  const NAVY  = [13, 51, 115];
  const WHITE = [255, 255, 255];
  const DARK  = [40, 40, 40];
  const LGRAY = [245, 248, 255];
  const BORDER = [200, 210, 230];

  // Header
  doc.setFillColor(...NAVY); doc.rect(0, 0, PW, 52, 'F');
  doc.setFillColor(...WHITE); doc.ellipse(PW / 2, 56, PW / 2 + 18, 11, 'F');
  doc.setTextColor(...WHITE); doc.setFont('helvetica', 'bold'); doc.setFontSize(24);
  doc.text('PURCHASE ORDER', ML, 30);
  doc.setFontSize(12); doc.text(`NO: ${order.orderNo}`, MR, 30, { align: 'right' });
  doc.setFontSize(12);
doc.setFont('helvetica', 'normal');

doc.text(
  `${SHOP.name}\nSoftware & Repairing\nWe Deal In All Kinds of Mobile Accessories & Repairing`,
  ML,
  35
);
  // Vendor / Shop info
  let y = 72;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(...NAVY);
  doc.text('Order To (Vendor):', ML, y); doc.text('Order By:', MR, y, { align: 'right' });
  y += 8; doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...DARK);
  doc.text(order.vendorName || 'N/A', ML, y); doc.text(SHOP.name, MR, y, { align: 'right' }); y += 6;
  if (order.vendorPhone)   doc.text(order.vendorPhone, ML, y);
  doc.text(SHOP.phone, MR, y, { align: 'right' }); y += 6;
  if (order.vendorAddress) doc.text(order.vendorAddress, ML, y);
  doc.text(SHOP.address, MR, y, { align: 'right' }); y += 12;
  doc.text(`Date: ${dateStr}`, ML, y);
  const isPending = order.status !== 'received';
  doc.setFont('helvetica', 'bold'); doc.setTextColor(...(isPending ? [180, 100, 0] : [5, 150, 105]));
  doc.text(`Status: ${isPending ? 'Pending' : '✓ Received'}`, MR, y, { align: 'right' });
  doc.setTextColor(...DARK); y += 10;

  // Table
  const COL = {
    brand: { x: ML,       w: 40 },
    name:  { x: ML + 40,  w: 65 },
    type:  { x: ML + 105, w: 35 },
    qty:   { x: ML + 140, w: 40 },
  };
  const ROW_H = 9;
  doc.setFillColor(...NAVY); doc.rect(ML, y, TW, 10, 'F');
  doc.setTextColor(...WHITE); doc.setFontSize(9); doc.setFont('helvetica', 'bold');
  doc.text('Brand',        COL.brand.x + COL.brand.w / 2, y + 7, { align: 'center' });
  doc.text('Product Name', COL.name.x  + 3,               y + 7);
  doc.text('Type',         COL.type.x  + COL.type.w / 2,  y + 7, { align: 'center' });
  doc.text('Order Qty',    COL.qty.x   + COL.qty.w  / 2,  y + 7, { align: 'center' });
  y += 10;

  (order.items || []).forEach((item, idx) => {
    doc.setFillColor(...(idx % 2 === 0 ? WHITE : LGRAY));
    doc.rect(ML, y, TW, ROW_H, 'F');
    doc.setDrawColor(...BORDER); doc.line(ML, y + ROW_H, ML + TW, y + ROW_H);
    doc.setTextColor(...DARK); doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    doc.text(item.brand || '—', COL.brand.x + COL.brand.w / 2, y + 6, { align: 'center' });
    const nm = item.name.length > 30 ? item.name.slice(0, 27) + '...' : item.name;
    doc.text(nm, COL.name.x + 3, y + 6);
    doc.text(item.type || '—', COL.type.x + COL.type.w / 2, y + 6, { align: 'center' });
    doc.setTextColor(...NAVY); doc.setFont('helvetica', 'bold');
    doc.text(String(item.orderQuantity), COL.qty.x + COL.qty.w / 2, y + 6, { align: 'center' });
    y += ROW_H;
  });

  // Totals
  y += 10;
  const totalQty = (order.items || []).reduce((s, i) => s + i.orderQuantity, 0);
  doc.setFillColor(...NAVY); doc.rect(ML, y, TW, 10, 'F');
  doc.setTextColor(...WHITE); doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
  doc.text(`${(order.items || []).length} products`, ML + 5, y + 7);
  doc.text(`Total Qty: ${totalQty}`, MR - 5, y + 7, { align: 'right' });
  y += 15;

  // Footer
  const footerTop = PH - 40;
  doc.setTextColor(...DARK); doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
  doc.text('Contact Information:', ML, footerTop);
  doc.setFont('helvetica', 'normal');
  doc.text(`Phone: ${SHOP.phone}`,  ML, footerTop + 6);
  doc.text(`Email: ${SHOP.email}`,  ML, footerTop + 12);
  doc.setFont('helvetica', 'bold');
  doc.text('Authorized By:', MR - 60, footerTop);
  doc.setDrawColor(...BORDER); doc.line(MR - 60, footerTop + 6, MR, footerTop + 6);
  doc.setFont('helvetica', 'normal'); doc.text(SHOP.name, MR - 60, footerTop + 12);
  doc.setFillColor(...NAVY); doc.rect(0, PH - 20, PW, 20, 'F');
  doc.setTextColor(...WHITE); doc.setFontSize(16); doc.setFont('helvetica', 'bold');
  doc.text('Thank You!', PW / 2, PH - 8, { align: 'center' });

  if (returnBlob) return doc.output('blob');
  doc.save(`PurchaseOrder_${order.orderNo}.pdf`);
}

// ── Supabase SQL for vendors table ────────────────────────────────────────────
// Run this once in your Supabase SQL editor:
//
// CREATE TABLE IF NOT EXISTS vendors (
//   id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
//   name       TEXT NOT NULL UNIQUE,
//   phone      TEXT DEFAULT '',
//   address    TEXT DEFAULT '',
//   created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
//   updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
// );
//
// ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
//
// -- Allow all operations (adjust to your auth setup if needed)
// CREATE POLICY "vendors_all" ON vendors FOR ALL USING (true) WITH CHECK (true);
//
// -- Optional: auto-update updated_at on every update
// CREATE OR REPLACE FUNCTION update_updated_at()
// RETURNS TRIGGER AS $$
// BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
// $$ LANGUAGE plpgsql;
//
// CREATE TRIGGER vendors_updated_at
//   BEFORE UPDATE ON vendors
//   FOR EACH ROW EXECUTE FUNCTION update_updated_at();