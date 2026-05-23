import { useState } from 'react';
import { X, MessageCircle, Download, FileText } from 'lucide-react';
import { jsPDF } from 'jspdf';

const SHOP = {
  name:    'H.A MOBILE',
  tagline: `Software & Repairing
We Deal In All Kind Of Mobile Accessories & Repairing`,
  address: 'Almgir Market Railway Road, Rahim Yar Khan',
  phone:   '+92-300-6731353',
  email:   'adnanmobile@gmail.com'
};

function validatePakistaniNumber(num) {
  const cleaned = num.replace(/[\s\-]/g, '');
  return /^(03\d{9}|92\d{10}|\+92\d{10})$/.test(cleaned);
}

function toWaNumber(num) {
  const cleaned = num.replace(/[\s\-]/g, '');
  if (cleaned.startsWith('0')) return '92' + cleaned.slice(1);
  if (cleaned.startsWith('+')) return cleaned.slice(1);
  return cleaned;
}

function generateInvoicePDF(receipt, returnBlob = false) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const PW = 210, ML = 15, MR = 195, TW = 180;
  const date = new Date(receipt.timestamp || new Date());
  const dateStr = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const NAVY = [13, 51, 115], WHITE = [255, 255, 255], DARK = [40, 40, 40], LGRAY = [245, 248, 255], BORDER = [200, 210, 230];

  doc.setFillColor(...NAVY); doc.rect(0, 0, PW, 52, 'F');
  doc.setFillColor(...WHITE); doc.ellipse(PW / 2, 56, PW / 2 + 18, 11, 'F');
  doc.setTextColor(...WHITE); doc.setFontSize(34); doc.setFont('helvetica', 'bold');
  doc.text('INVOICE', ML, 34);
  doc.setFontSize(12); doc.setFont('helvetica', 'bold');
  doc.text(`NO: ${receipt.receiptNo}`, MR, 34, { align: 'right' });
  doc.setFontSize(12); doc.setFont('helvetica', 'normal');
  doc.text(SHOP.tagline.split('\n'), ML, 40);

  let y = 74;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(...NAVY);
  doc.text('Bill To:', ML, y); doc.text('From:', MR, y, { align: 'right' });
  y += 8;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...DARK);
  const custName = receipt.customerName && receipt.customerName !== 'Walk-in Customer' ? receipt.customerName : 'Walk-in Customer';
  const custMob  = receipt.customerMobile && receipt.customerMobile !== 'N/A' ? receipt.customerMobile : null;
  doc.text(custName, ML, y); doc.text(SHOP.name, MR, y, { align: 'right' }); y += 6;
  if (custMob) doc.text(custMob, ML, y);
  doc.text(SHOP.phone, MR, y, { align: 'right' }); y += 6;
  doc.text(SHOP.address, MR, y, { align: 'right' }); y += 6;
  //doc.text(SHOP.email, MR, y, { align: 'right' }); y += 12;
  doc.text(`Date: ${dateStr}`, ML, y); y += 10;

  const COL = { brand: { x: ML, w: 30 }, name: { x: ML+30, w: 55 }, type: { x: ML+85, w: 30 }, qty: { x: ML+115, w: 20 }, price: { x: ML+135, w: 25 }, total: { x: ML+160, w: 20 } };
  doc.setFillColor(...NAVY); doc.rect(ML, y, TW, 10, 'F');
  doc.setTextColor(...WHITE); doc.setFontSize(9); doc.setFont('helvetica', 'bold');
  doc.text('Brand', COL.brand.x + COL.brand.w/2, y+7, { align: 'center' });
  doc.text('Product', COL.name.x + 3, y+7);
  doc.text('Type', COL.type.x + COL.type.w/2, y+7, { align: 'center' });
  doc.text('Qty', COL.qty.x + COL.qty.w/2, y+7, { align: 'center' });
  doc.text('Price', COL.price.x + COL.price.w/2, y+7, { align: 'center' });
  doc.text('Total', COL.total.x + COL.total.w/2, y+7, { align: 'center' });
  y += 10;

  const ROW_H = 9; let itemsSubtotal = 0, repairFee = 0;
  receipt.items.forEach((item, idx) => {
    if (item.isRepair) { repairFee = item.soldAt; return; }
    const aq = item.quantity - (item.returnedQuantity || 0);
    if (aq <= 0) return;
    itemsSubtotal += item.soldAt * aq;
    doc.setFillColor(...(idx % 2 === 0 ? WHITE : LGRAY)); doc.rect(ML, y, TW, ROW_H, 'F');
    doc.setDrawColor(...BORDER); doc.setLineWidth(0.15); doc.line(ML, y+ROW_H, ML+TW, y+ROW_H);
    doc.setTextColor(...DARK); doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    doc.text(item.brand && item.brand !== 'N/A' ? item.brand : '—', COL.brand.x + COL.brand.w/2, y+6, { align: 'center' });
    const name = item.name.length > 25 ? item.name.slice(0, 22) + '...' : item.name;
    doc.text(name, COL.name.x + 3, y+6);
    doc.text(item.type || '—', COL.type.x + COL.type.w/2, y+6, { align: 'center' });
    doc.text(String(aq), COL.qty.x + COL.qty.w/2, y+6, { align: 'center' });
    doc.text(`Rs. ${item.soldAt.toFixed(0)}`, COL.price.x + COL.price.w/2, y+6, { align: 'center' });
    doc.setFont('helvetica', 'bold');
    doc.text(`Rs. ${(item.soldAt * aq).toFixed(0)}`, COL.total.x + COL.total.w/2, y+6, { align: 'center' });
    y += ROW_H;
  });

  if (repairFee > 0) {
    doc.setFillColor(...LGRAY); doc.rect(ML, y, TW, ROW_H, 'F');
    doc.setDrawColor(...BORDER); doc.line(ML, y+ROW_H, ML+TW, y+ROW_H);
    doc.setTextColor(80, 80, 160); doc.setFont('helvetica', 'italic'); doc.setFontSize(9);
    doc.text('Repair / Service Fees', COL.name.x + 3, y+6);
    doc.setFont('helvetica', 'normal'); doc.setTextColor(...DARK);
    doc.text('1', COL.qty.x + COL.qty.w/2, y+6, { align: 'center' });
    doc.text(`Rs. ${repairFee.toFixed(0)}`, COL.price.x + COL.price.w/2, y+6, { align: 'center' });
    doc.setFont('helvetica', 'bold');
    doc.text(`Rs. ${repairFee.toFixed(0)}`, COL.total.x + COL.total.w/2, y+6, { align: 'center' });
    y += ROW_H;
  }
  y += 5;

  const stX = COL.price.x, stW = COL.price.w + COL.total.w;
  doc.setFillColor(...NAVY); doc.rect(stX, y, stW, 10, 'F');
  doc.setTextColor(...WHITE); doc.setFontSize(10); doc.setFont('helvetica', 'bold');
  doc.text('Sub Total', stX + COL.price.w/2, y+7, { align: 'center' });
  doc.text(`Rs. ${receipt.total.toFixed(0)}`, stX + COL.price.w + COL.total.w/2, y+7, { align: 'center' });
  y += 18;

  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...DARK);
  doc.text('Return & Exchange Policy', ML, y); y += 7;
  [['Exchange Policy:', 'Within 7 days with receipt'], ['Return Policy:', 'No refund on opened/used items']].forEach(([label, val]) => {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.text(label, ML, y);
    doc.setFont('helvetica', 'normal'); doc.text(val, ML + 42, y); y += 6;
  });

  const barH = 20, thankY = doc.internal.pageSize.getHeight() - barH;
  doc.setFillColor(...NAVY); doc.rect(0, thankY, PW, barH, 'F');
  doc.setTextColor(...WHITE); doc.setFontSize(22); doc.setFont('helvetica', 'bold');
  doc.text('Thank You!', PW/2, thankY + 14, { align: 'center' });

  if (returnBlob) return doc.output('blob');
  doc.save(`Invoice_${receipt.receiptNo}.pdf`);
}

export default function WhatsAppBillModal({ receipt, onClose }) {
  const [phoneNo, setPhoneNo]       = useState(receipt.customerMobile || '');
  const [phoneError, setPhoneError] = useState('');
  const [sending, setSending]       = useState(false);
  const [sent, setSent]             = useState(false);

  const date    = new Date(receipt.timestamp || new Date());
  const dateStr = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  const handleDownload = () => generateInvoicePDF(receipt, false);

  const handleWhatsApp = async () => {
    const num = phoneNo.trim();
    if (!num) { setPhoneError('Please enter a mobile number'); return; }
    if (!validatePakistaniNumber(num)) { setPhoneError('Invalid Pakistani number (e.g. 0300-1234567)'); return; }
    setPhoneError(''); setSending(true);
    try {
      const blob  = generateInvoicePDF(receipt, true);
      const file  = new File([blob], `Invoice_${receipt.receiptNo}.pdf`, { type: 'application/pdf' });
      const waNum = toWaNumber(num);
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: `Invoice ${receipt.receiptNo} – ${SHOP.name}`, text: `Your invoice from ${SHOP.name}\nReceipt: ${receipt.receiptNo} | Total: Rs. ${receipt.total.toFixed(0)}` });
        setSent(true);
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `Invoice_${receipt.receiptNo}.pdf`; a.click();
        URL.revokeObjectURL(url);
        const msg = `Hello! Here is your invoice from *${SHOP.name}*.\n\n🧾 Receipt No: *${receipt.receiptNo}*\n📅 Date: ${dateStr}\n💰 Total: *Rs. ${receipt.total.toFixed(0)}*\n\n_Please see the PDF invoice that was just downloaded and attach it here._\n\n📞 ${SHOP.phone}\n📍 ${SHOP.address}`;
        setTimeout(() => { window.open(`https://wa.me/${waNum}?text=${encodeURIComponent(msg)}`, '_blank'); setSent(true); }, 600);
      }
    } catch (err) {
      if (err.name !== 'AbortError') { console.error(err); alert('Could not share: ' + err.message); }
    } finally { setSending(false); }
  };

  const isValid = phoneNo && validatePakistaniNumber(phoneNo);

  return (
    <div className="fixed inset-0 bg-black/65 backdrop-blur-sm flex items-center justify-center z-[1000] p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-slide-up">

        {/* Header */}
        <div className="flex justify-between items-center px-6 pt-5 pb-4 border-b border-sky-50">
          <div className="flex items-center gap-2 text-xl font-bold text-slate-800">
            <FileText size={20} className="text-[#0d3373]" /> Invoice & WhatsApp
          </div>
          <button
            className="w-8 h-8 rounded-md bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-red-100 hover:text-red-500 transition-all"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5">
          {/* Invoice Preview Card */}
          <div className="border border-[#d0daf0] rounded-xl overflow-hidden mb-4 bg-white shadow-md">
            {/* Mini Header */}
            <div className="bg-gradient-to-r from-[#0d3373] to-[#1a5bb5] px-4 py-3 flex justify-between items-center">
              <div>
                <div className="text-white font-extrabold text-lg tracking-wide">INVOICE</div>
                <div className="text-white/75 text-xs whitespace-pre-line"><p>
  Software & Repairing
  <br />
  We Deal In All kind Of Mobile Accessories & Repairing
</p></div>
              </div>
              <div className="text-right">
                <div className="text-white font-bold text-sm">NO: {receipt.receiptNo}</div>
                <div className="text-white/75 text-xs">{dateStr}</div>
              </div>
            </div>

            {/* Bill To / From */}
            <div className="grid grid-cols-2 gap-2 px-4 py-3 border-b border-[#e8eef8]">
              <div>
                <div className="font-bold text-[#0d3373] text-xs mb-1">Bill To:</div>
                <div className="font-semibold text-sm">{receipt.customerName || 'Walk-in Customer'}</div>
                {receipt.customerMobile && receipt.customerMobile !== 'N/A' &&
                  <div className="text-xs text-slate-500">{receipt.customerMobile}</div>
                }
              </div>
              <div className="text-right">
                <div className="font-bold text-[#0d3373] text-xs mb-1">From:</div>
                <div className="font-semibold text-xs">{SHOP.name}</div>
                <div className="text-[11px] text-slate-500">{SHOP.phone}</div>
                <div className="text-[11px] text-slate-500">{SHOP.address}</div>
              </div>
            </div>

            {/* Items Table */}
            <div className="pb-3">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-[#0d3373] text-white">
                    <th className="py-1.5 px-2 text-center font-semibold">Brand</th>
                    <th className="py-1.5 px-3 text-left font-semibold">Product</th>
                    <th className="py-1.5 px-2 text-center font-semibold">Type</th>
                    <th className="py-1.5 px-2 text-center font-semibold">Qty</th>
                    <th className="py-1.5 px-2 text-center font-semibold">Price</th>
                    <th className="py-1.5 px-3 text-right font-semibold">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {receipt.items.map((item, i) => {
                    const aq = item.quantity - (item.returnedQuantity || 0);
                    if (aq <= 0) return null;
                    return (
                      <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-[#f0f5ff]'}>
                        <td className="py-1.5 px-2 text-center text-slate-500 font-semibold">
                          {item.brand && item.brand !== 'N/A' ? item.brand : '—'}
                        </td>
                        <td className={`py-1.5 px-3 ${item.isRepair ? 'text-[#5050a0] italic' : 'text-slate-800'}`}>{item.name}</td>
                        <td className="py-1.5 px-2 text-center">
                          <span className="bg-cyan-100 text-cyan-800 px-2 py-0.5 rounded-full text-[10px] font-bold">{item.type || '—'}</span>
                        </td>
                        <td className="py-1.5 px-2 text-center text-slate-500">{aq}</td>
                        <td className="py-1.5 px-2 text-center text-slate-500">Rs. {item.soldAt.toFixed(0)}</td>
                        <td className="py-1.5 px-3 text-right font-bold text-[#0d3373]">Rs. {(item.soldAt * aq).toFixed(0)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Sub Total */}
              <div className="flex justify-end mt-0">
                <div className="bg-[#0d3373] text-white grid grid-cols-2 min-w-[200px] px-3 py-1.5 gap-2 text-sm font-bold">
                  <span>Sub Total</span>
                  <span className="text-right">Rs. {receipt.total.toFixed(0)}</span>
                </div>
              </div>
            </div>

            {/* Thank You */}
            <div className="py-2.5 px-4 bg-[#0d3373] flex justify-center items-center">
              <span className="font-extrabold text-white text-lg tracking-widest">Thank You!</span>
            </div>
          </div>

          {/* Phone Input */}
          <div className="mb-3">
            <label className="block text-xs font-semibold text-slate-800 mb-1.5 uppercase tracking-wide">Customer WhatsApp Number</label>
            <div className="flex gap-2.5">
              <input
                className={`flex-1 px-3.5 py-2.5 border rounded-lg text-sm text-slate-800 bg-white outline-none transition-all focus:ring-2 ${phoneError ? 'border-red-500 focus:ring-red-100' : isValid ? 'border-emerald-500 focus:ring-emerald-100' : 'border-slate-300 focus:border-cyan-600 focus:ring-cyan-200'}`}
                placeholder="0300-1234567 or 03001234567"
                value={phoneNo}
                onChange={e => { setPhoneNo(e.target.value); setPhoneError(''); setSent(false); }}
                maxLength={15}
              />
              <button
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-gradient-to-br from-teal-700 to-green-500 text-white font-semibold text-sm shadow-md hover:-translate-y-px transition-all disabled:opacity-50 disabled:translate-y-0 min-w-[90px] justify-center"
                onClick={handleWhatsApp}
                disabled={sending}
              >
                {sending
                  ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin inline-block" /> Sending</>
                  : <><MessageCircle size={16} /> Send PDF</>
                }
              </button>
            </div>
            {phoneError && <div className="text-red-500 text-xs mt-1">{phoneError}</div>}
            {isValid && !phoneError && <div className="text-emerald-600 text-xs mt-1">✓ Valid Pakistani number</div>}
            {sent && <div className="text-emerald-600 text-xs mt-1">✅ PDF downloaded — attach it in WhatsApp!</div>}
          </div>

          <div className="text-xs text-slate-400 bg-[#f0f5ff] rounded-lg px-3 py-2">
            💡 On mobile: PDF will be shared directly to WhatsApp. On desktop: PDF downloads automatically, then attach it in WhatsApp chat.
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-col gap-2.5 px-6 pb-5 pt-2 border-t border-slate-100">
          <button
            className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-gradient-to-br from-teal-700 to-green-500 text-white font-semibold text-base shadow-md hover:-translate-y-px transition-all disabled:opacity-50"
            onClick={handleWhatsApp}
            disabled={sending}
          >
            <MessageCircle size={18} /> {sending ? 'Preparing PDF...' : 'Open WhatsApp & Send PDF'}
          </button>
          <button
            className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-gradient-to-br from-cyan-700 to-cyan-500 text-white font-semibold text-base shadow-md hover:-translate-y-px transition-all"
            onClick={handleDownload}
          >
            <Download size={18} /> Download Invoice PDF
          </button>
          <button
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-slate-100 text-slate-500 border border-slate-300 font-semibold hover:bg-slate-200 transition-all"
            onClick={onClose}
          >
            <X size={16} /> Close
          </button>
        </div>
      </div>
    </div>
  );
}