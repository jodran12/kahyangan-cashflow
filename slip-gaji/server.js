// Slip Gaji – Kahyangan.Bali
// Jalankan : npm install && ADMIN_PASS="kata-sandi-kuat" node server.js
// Produksi : ADMIN_PASS="..." pm2 start server.js --name slip-gaji
//           lalu arahkan subdomain di nginx (proxy_pass http://127.0.0.1:3100) dan pasang HTTPS (certbot).
// Data tersimpan di data.json (backup file ini secara berkala).
const express = require('express');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Fungsi pembuat ID unik alternatif yang aman untuk Node.js versi lama
const generateId = () => Date.now().toString(36) + Math.random().toString(36).substring(2, 8);

const COMPANY = { name: 'Kahyangan.Bali', address: 'Bali, Indonesia', signer: 'Pemilik Usaha' }; // ubah sesuai usaha
const PORT = process.env.PORT || 3100;
const USER = process.env.ADMIN_USER || 'admin';
const PASS = process.env.ADMIN_PASS;
if (!PASS) { console.error('Isi ADMIN_PASS dulu, contoh: ADMIN_PASS="kata-sandi" node server.js'); process.exit(1); }

const FILE = path.join(__dirname, 'data.json');
const LOGO = path.join(__dirname, 'logoslip.png'); // taruh logo di sini (PNG), tanpa restart
const db = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : {
  employees: [ // data dummy
    { id: generateId(), name: 'Ni Luh Ayu Sari', position: 'Admin Toko' },
    { id: generateId(), name: 'I Made Putra Wijaya', position: 'Packing & Gudang' },
    { id: generateId(), name: 'Kadek Sinta Dewi', position: 'Host Live TikTok' },
  ],
  payslips: [],
};
const save = () => { fs.writeFileSync(FILE + '.tmp', JSON.stringify(db, null, 2)); fs.renameSync(FILE + '.tmp', FILE); };
save();

const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const bulan = p => `${BULAN[+p.slice(5) - 1]} ${p.slice(0, 4)}`;
const tgl = d => `${+d.slice(8)} ${BULAN[+d.slice(5, 7) - 1]} ${d.slice(0, 4)}`;
const rp = n => 'Rp ' + n.toLocaleString('id-ID');

const SAT = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas'];
function terbilang(n) {
  if (n < 12) return SAT[n];
  if (n < 20) return terbilang(n - 10) + ' belas';
  if (n < 100) return terbilang(Math.floor(n / 10)) + ' puluh' + (n % 10 ? ' ' + terbilang(n % 10) : '');
  if (n < 200) return 'seratus' + (n % 100 ? ' ' + terbilang(n % 100) : '');
  if (n < 1e3) return terbilang(Math.floor(n / 100)) + ' ratus' + (n % 100 ? ' ' + terbilang(n % 100) : '');
  if (n < 2e3) return 'seribu' + (n % 1e3 ? ' ' + terbilang(n % 1e3) : '');
  if (n < 1e6) return terbilang(Math.floor(n / 1e3)) + ' juta' + (n % 1e3 ? ' ' + terbilang(n % 1e3) : '');
  if (n < 1e9) return terbilang(Math.floor(n / 1e6)) + ' juta' + (n % 1e6 ? ' ' + terbilang(n % 1e6) : '');
  return terbilang(Math.floor(n / 1e9)) + ' miliar' + (n % 1e9 ? ' ' + terbilang(n % 1e9) : '');
}
const kata = n => { const t = n === 0 ? 'nol' : terbilang(n); return t[0].toUpperCase() + t.slice(1); };

function slipPdf(s, out) {
  const doc = new PDFDocument({ size: 'A4', margin: 50, info: { Title: `Slip Gaji ${s.name} ${bulan(s.period)}`, Author: COMPANY.name } });
  doc.pipe(out);
  const L = 50, R = 545, W = R - L, INK = '#16202a', MUTE = '#6b7683', LINE = '#d9dee4';
  const txt = (t, x, y, o = {}, f = 'Helvetica', size = 10, c = INK) => doc.font(f).fontSize(size).fillColor(c).text(t, x, y, o);

  let tx = L;
  try {
    if (fs.existsSync(LOGO)) {
      const img = doc.openImage(LOGO), k = Math.min(110 / img.width, 48 / img.height);
      doc.image(img, L, 46, { width: img.width * k, height: img.height * k });
      tx = L + img.width * k + 12;
    }
  } catch (e) { console.error('logoslip.png tidak bisa dibaca:', e.message); }
  txt(COMPANY.name, tx, 52, {}, 'Helvetica-Bold', 17);
  txt(COMPANY.address, tx, 74, {}, 'Helvetica', 9, MUTE);
  txt('Slip Gaji', L, 52, { width: W, align: 'right' }, 'Helvetica-Bold', 17);
  txt(bulan(s.period), L, 74, { width: W, align: 'right' }, 'Helvetica', 9, MUTE);
  doc.moveTo(L, 100).lineTo(R, 100).lineWidth(1).strokeColor(INK).stroke();

  const field = (k, v, x, y) => { txt(k, x, y, {}, 'Helvetica', 8.5, MUTE); txt(v, x, y + 12, { width: 220 }, 'Helvetica-Bold', 10.5); };
  field('Nama karyawan', s.name, L, 122);
  field('Jabatan', s.position || '-', L, 160);
  field('Nomor slip', s.no, 320, 122);
  field('Tanggal pembayaran', tgl(s.payDate), 320, 160);

  doc.rect(L, 214, W, 26).fill('#f1f3f6');
  txt('Keterangan', L + 12, 223, {}, 'Helvetica-Bold', 9.5);
  txt('Jumlah', L, 223, { width: W - 12, align: 'right' }, 'Helvetica-Bold', 9.5);
  let y = 252;
  const row = (label, amt) => {
    const h = doc.font('Helvetica').fontSize(10.5).heightOfString(label, { width: 340 });
    txt(label, L + 12, y, { width: 340 }, 'Helvetica', 10.5);
    txt(amt, L, y, { width: W - 12, align: 'right' }, 'Helvetica', 10.5);
    doc.moveTo(L, y + h + 6).lineTo(R, y + h + 6).lineWidth(0.5).strokeColor(LINE).stroke();
    y += h + 14;
  };
  row(`Gaji periode ${bulan(s.period)}`, rp(s.salary || s.total));
  (s.bonuses || []).forEach(b => row(`Bonus: ${b.label}`, rp(b.amount)));
  (s.deductions || []).forEach(d => row(`Pengurangan: ${d.label}`, '- ' + rp(d.amount)));

  const ty = y + 8;
  doc.rect(L, ty, W, 58).fill(INK);
  txt('Total diterima', L + 16, ty + 22, {}, 'Helvetica', 10, '#c8d0d9');
  txt(rp(s.total), L, ty + 19, { width: W - 16, align: 'right' }, 'Helvetica-Bold', 20, '#ffffff');
  txt(`Terbilang: ${kata(s.total)} rupiah`, L, ty + 72, { width: W }, 'Helvetica-Oblique', 9.5, MUTE);
  if (s.note) { txt('Catatan', L, ty + 98, {}, 'Helvetica', 8.5, MUTE); txt(s.note, L, ty + 110, { width: W }, 'Helvetica', 10); }

  const sy = Math.max(500, ty + 135);
  const sign = (label, name, title, x) => {
    txt(label, x, sy, { width: 190, align: 'center' }, 'Helvetica', 9.5, MUTE);
    doc.moveTo(x + 10, sy + 56).lineTo(x + 180, sy + 56).lineWidth(0.6).strokeColor(INK).stroke();
    txt(name, x, sy + 62, { width: 190, align: 'center' }, 'Helvetica-Bold', 10);
    if (title) txt(title, x, sy + 76, { width: 190, align: 'center' }, 'Helvetica', 9, MUTE);
  };
  sign('Diterima oleh', s.name, s.position, L);
  sign('Dikeluarkan oleh', s.issuerName || COMPANY.signer, s.issuerTitle, R - 190);
  txt('Dokumen ini diterbitkan otomatis oleh sistem dan bersifat rahasia.', L, 780, { width: W, align: 'center' }, 'Helvetica', 8, MUTE);
  doc.end();
}

const app = express();
app.use((req, res, next) => { // Basic Auth, wajib lewat HTTPS di produksi
  const t = Buffer.from((req.headers.authorization || '').slice(6), 'base64').toString();
  const i = t.indexOf(':');
  if (i > 0 && t.slice(0, i) === USER && t.slice(i + 1) === PASS) return next();
  res.set('WWW-Authenticate', 'Basic realm="Slip Gaji"').status(401).send('Login diperlukan');
});
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const bad = (res, msg) => res.status(400).json({ error: msg });
app.get('/api/employees', (q, r) => r.json(db.employees));
app.post('/api/employees', (q, r) => {
  const name = String(q.body.name || '').trim().slice(0, 80), position = String(q.body.position || '').trim().slice(0, 80);
  if (!name) return bad(r, 'Nama karyawan wajib diisi');
  const e = { id: generateId(), name, position };
  db.employees.push(e); save(); r.json(e);
});
app.delete('/api/employees/:id', (q, r) => { db.employees = db.employees.filter(e => e.id !== q.params.id); save(); r.json({ ok: true }); });
app.delete('/api/payslips/:id', (q, r) => { 
  db.payslips = db.payslips.filter(s => s.id !== q.params.id); 
  save(); 
  r.json({ ok: true }); 
});
app.get('/api/payslips', (q, r) => r.json([...db.payslips].reverse()));
const lines = (a, def) => (Array.isArray(a) ? a : []).slice(0, 5)
  .map(x => ({ label: String(x.label || '').trim().slice(0, 60) || def, amount: Math.round(Number(x.amount)) }))
  .filter(x => x.amount > 0);
const sum = a => a.reduce((t, x) => t + x.amount, 0);
app.post('/api/payslips', (q, r) => {
  const { employeeId, period, payDate, note } = q.body, salary = Math.round(Number(q.body.salary));
  const bonuses = lines(q.body.bonuses, 'Bonus'), deductions = lines(q.body.deductions, 'Pengurangan');
  const total = salary + sum(bonuses) - sum(deductions);
  const e = db.employees.find(x => x.id === employeeId);
  if (!e) return bad(r, 'Pilih karyawan terlebih dahulu');
  if (!/^\d{4}-\d{2}$/.test(period) || !/^\d{4}-\d{2}-\d{2}$/.test(payDate)) return bad(r, 'Periode atau tanggal pembayaran tidak valid');
  if (!(salary > 0)) return bad(r, 'Gaji harus lebih dari 0');
  if (!(total > 0)) return bad(r, 'Pengurangan melebihi gaji dan bonus. Periksa kembali angkanya');
  const seq = db.payslips.filter(x => x.period === period).length + 1;
  const sl = {
    id: generateId(), no: `SG-${period.replace('-', '')}-${String(seq).padStart(3, '0')}`,
    employeeId: e.id, name: e.name, position: e.position, period, payDate,
    salary, bonuses, deductions, total,
    issuerName: String(q.body.issuerName || '').trim().slice(0, 80) || COMPANY.signer,
    issuerTitle: String(q.body.issuerTitle || '').trim().slice(0, 80),
    note: String(note || '').trim().slice(0, 200), createdAt: new Date().toISOString(),
  };
  db.payslips.push(sl); save(); r.json(sl);
});
app.get('/api/payslips/:id/pdf', (q, r) => {
  const s = db.payslips.find(x => x.id === q.params.id);
  if (!s) return r.status(404).send('Slip tidak ditemukan');
  r.setHeader('Content-Type', 'application/pdf');
  r.setHeader('Content-Disposition', `inline; filename="Slip-Gaji-${s.name.replace(/[^\w]+/g, '-')}-${s.period}.pdf"`);
  slipPdf(s, r);
});

app.listen(PORT, process.env.HOST || '127.0.0.1', () => console.log(`Slip Gaji berjalan di http://127.0.0.1:${PORT}`));
