/* ============================================================
   SIPATIR — data.js
   Utilitas global, data pegawai simulasi, GeoJSON simulasi,
   seed tugas & laporan, kehadiran, IndexedDB (antrian offline).
   ============================================================ */
'use strict';

/* ---------------- UTILITAS ---------------- */
const U = {
  $:(s,r=document)=>r.querySelector(s),
  $$:(s,r=document)=>Array.from((r||document).querySelectorAll(s)),
  esc:(s)=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
  pad:(n)=>String(n).padStart(2,'0'),
  iso:(d)=>`${d.getFullYear()}-${U.pad(d.getMonth()+1)}-${U.pad(d.getDate())}`,
  today:()=>U.iso(new Date()),
  d:(off)=>{ const x=new Date(); x.setDate(x.getDate()+off); return x; },
  isoOff:(off)=>U.iso(U.d(off)),
  dts:(off,h=8,m=0)=>{ const x=U.d(off); x.setHours(h,m,0,0); return x.toISOString(); },
  fmtID:(iso)=>{ if(!iso) return '—'; const p=iso.split('-'); return `${p[2]}/${p[1]}/${p[0]}`; },
  fmtDT:(isoDt)=>{
    if(!isoDt) return '—';
    const t=new Date(isoDt);
    return `${U.pad(t.getDate())}/${U.pad(t.getMonth()+1)}/${t.getFullYear()} ${U.pad(t.getHours())}.${U.pad(t.getMinutes())} WIB`;
  },
  monthsID:['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'],
  daysID:['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu','Minggu'],
  hari:(d)=>U.daysID[(d.getDay()+6)%7],
  uid:(p='id')=>`${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`,
  hash:(s)=>{ let h=0; for(let i=0;i<s.length;i++){ h=((h*31)+s.charCodeAt(i))>>>0; } return h; },
  clamp:(v,a,b)=>Math.min(b,Math.max(a,v)),
  greet:()=>{
    const h=new Date().getHours();
    if(h>=4&&h<11) return 'Selamat pagi';
    if(h>=11&&h<15) return 'Selamat siang';
    if(h>=15&&h<18) return 'Selamat sore';
    return 'Selamat malam';
  }
};

/* ---------------- IKON SVG (garis 24px) ---------------- */
const I = (name, cls='') => `<svg class="${cls}" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]||''}</svg>`;
const ICONS = {
  home:'<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9 21v-6h6v6"/>',
  camera:'<path d="M8 7l1.4-2.6h5.2L16 7"/><rect x="3" y="7" width="18" height="13" rx="3"/><circle cx="12" cy="13.2" r="3.4"/><circle cx="17.6" cy="10" r=".6" fill="currentColor"/>',
  map:'<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z"/><path d="M9 4v14M15 6v14"/>',
  task:'<path d="M9 4h6v3H9z"/><path d="M15 4h2a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 13.5 2 2 4-4.5"/>',
  report:'<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h6"/>',
  user:'<circle cx="12" cy="8" r="4"/><path d="M4 21c1.6-4 5-6 8-6s6.4 2 8 6"/>',
  check:'<path d="m5 13 4 4L19 7"/>',
  x:'<path d="M6 6l12 12M18 6 6 18"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon:'<path d="M21 13A8.5 8.5 0 1 1 11 3a7 7 0 0 0 10 10z"/>',
  set:'<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2.4"/><circle cx="9" cy="17" r="2.4"/>',
  sync:'<path d="M21 12a9 9 0 1 1-2.9-6.6"/><path d="M21 3v6h-6"/>',
  out:'<path d="M9 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
  menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
  cal:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  pin:'<path d="M12 21s-7-5.6-7-11a7 7 0 0 1 14 0c0 5.4-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  bell:'<path d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6"/><path d="M10.3 20a2 2 0 0 0 3.4 0"/>',
  trash:'<path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14"/>',
  edit:'<path d="M4 20h4L19 9l-4-4L4 16v4z"/>',
  print:'<path d="M7 8V3h10v5"/><rect x="4" y="8" width="16" height="8" rx="2"/><path d="M7 14h10v7H7z"/>',
  dots:'<circle cx="5" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.6" fill="currentColor" stroke="none"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 8h.01M12 11v5"/>',
  img:'<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="1.6"/><path d="m5 19 5.5-6 4 4.5L17 15l4 4"/>',
  chev:'<path d="m9 6 6 6-6 6"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  drop:'<path d="M12 3s6 6.4 6 11a6 6 0 0 1-12 0c0-4.6 6-11 6-11z"/>',
  flag:'<path d="M5 21V4"/><path d="M5 4h12l-2.5 4L17 12H5"/>',
  shield:'<path d="M12 3l8 3v6c0 5-3.4 8-8 9-4.6-1-8-4-8-9V6z"/><path d="m9 12 2 2 4-4"/>'
};

/* ---------------- PEGAWAI (DATA SIMULASI) ----------------
   Identitas & nomor bersifat fiktif untuk keperluan prototipe. */
const USERS = [
  {
    id:'u-pengamat', nama:'Ir. Hadi Susanto, M.T.', nip:'19750812 200312 1 002', role:'pengamat',
    roleLabel:'Staf Pengamat', ringkas:'Memverifikasi laporan lapangan & menugaskan PPA/Pekarya',
    status:'PNS', pangkat:'Pembina Tingkat I', gol:'IV/b', jabatan:'Staf Pengamat / Pengawas Lapangan',
    unit:'SPSDA Pekalongan — BWS Pemali Jratunseluna', instansi:'Ditjen Sumber Daya Air — Kementerian Pekerjaan Umum dan Penataan Ruang',
    lahir:'Kudus, 12-08-1975', kelamin:'Laki-laki', agama:'Islam', pendidikan:'S2 Teknik Sipil',
    tmtCpns:'01-01-2004', tmtPns:'01-01-2005', tmtPangkat:'01-10-2022', tmtJabatan:'15-02-2021',
    karpeg:'123456789', taspen:'197508122003121002', npwp:'77.123.456.8-401.000',
    hp:'+62 812-2500-1102', email:'hadi.susanto@pu.go.id', alamat:'Jl. Diponegoro No. 45, Pekalongan',
    avatar:'assets/avatars/pengamat.png', fotoResmi:'assets/avatars/resmi-pengamat.png',
    bakh:['SB','SB','SB','SB','SB','B','SB'],
    riwayatJabatan:[{j:'Kasubdit Tata Bangunan Air', t:'2016–2021'},{j:'Pengatur Teknis Bendungan', t:'2010–2016'}],
    diklat:['Diklat Kepemimpinan Tinggi IV — 2019','Pelatihan Pengawasan Konstruksi SDA — 2017','Sertifikasi K3 Konstruksi — 2021']
  },
  {
    id:'u-ppa', nama:'Sutarmin', nip:'19820305 200911 1 004', role:'ppa',
    roleLabel:'Penjaga & Pengoperasi Pintu Air', ringkas:'Mengoperasikan pintu air & mencatat tinggi muka air',
    status:'PNS', pangkat:'Pengatur', gol:'III/c', jabatan:'Penjaga Pintu Air (PPA)',
    unit:'SPSDA Pekalongan — BWS Pemali Jratunseluna', instansi:'Ditjen Sumber Daya Air — Kementerian Pekerjaan Umum dan Penataan Ruang',
    lahir:'Pekalongan, 05-03-1982', kelamin:'Laki-laki', agama:'Islam', pendidikan:'D-III Teknik Sipil',
    tmtCpns:'01-12-2009', tmtPns:'01-12-2010', tmtPangkat:'01-04-2018', tmtJabatan:'01-12-2015',
    karpeg:'987654321', taspen:'198203052009111004', npwp:'55.987.654.3-401.000',
    hp:'+62 813-8100-2204', email:'sutarmin.ppa@pu.go.id', alamat:'Dusun Gemulung RT 03 RW 02, Kec. Sragi, Pekalongan',
    avatar:'assets/avatars/ppa.png', fotoResmi:'assets/avatars/resmi-ppa.png',
    bakh:['SB','SB','B','SB','B','SB','B'],
    riwayatJabatan:[{j:'Penjaga Pintu Air BA-1', t:'2015–sekarang'},{j:'Pelaksana Pemeliharaan', t:'2010–2015'}],
    diklat:['Pelatihan Operasi & Pemeliharaan Jaringan Irigasi — 2016','Diklat Fungsional Penjaga Pintu Air — 2015']
  },
  {
    id:'u-pekarya', nama:'Slamet Riyadi', nip:'19940222 202212 1 003', role:'pekarya',
    roleLabel:'Pekarya Teknis Irigasi', ringkas:'Memelihara saluran & bangunan irigasi di lapangan',
    status:'PPPK', pangkat:'—', gol:'PPPK Gol. VII', jabatan:'Pekarya Teknis Irigasi',
    unit:'SPSDA Pekalongan — BWS Pemali Jratunseluna', instansi:'Ditjen Sumber Daya Air — Kementerian Pekerjaan Umum dan Penataan Ruang',
    lahir:'Batang, 22-02-1994', kelamin:'Laki-laki', agama:'Islam', pendidikan:'D-IV Teknik Sipil',
    tmtCpns:'01-04-2022', tmtPns:'—', tmtPangkat:'—', tmtJabatan:'01-04-2022',
    karpeg:'PPPK-2022-0447', taspen:'—', npwp:'33.222.444.1-401.000',
    hp:'+62 856-2700-3303', email:'slamet.riyadi@pu.go.id', alamat:'Jl. Pasokan No. 12, Kec. Kajen, Pekalongan',
    avatar:'assets/avatars/pekarya.png', fotoResmi:'assets/avatars/resmi-pekarya.png',
    bakh:['B','SB','B','B','SB','B','B'],
    riwayatJabatan:[{j:'Pekarya Teknis Irigasi', t:'2022–sekarang'},{j:'Tenaga Harian Lepas BWS', t:'2019–2022'}],
    diklat:['Pelatihan Pemeliharaan Saluran Irigasi — 2022','Pelatihan Pengukuran Hidrologi Dasar — 2023']
  }
];
const userById = (id) => USERS.find(u=>u.id===id) || USERS[0];

/* ---------------- GEO OBJEK (SIMULASI) ----------------
   Koordinat bersifat simulasi, tidak menggambarkan lokasi sesungguhnya. */
const GEO = {
  center:[-6.912, 109.663],
  dis:[
    { id:'di-1', nama:'D.I. Gemulung (simulasi)', luas:'1.240 ha', sumber:'Weir Gemulung',
      coords:[[-6.898,109.646],[-6.898,109.672],[-6.932,109.678],[-6.936,109.648]] },
    { id:'di-2', nama:'D.I. Bentar (simulasi)', luas:'860 ha', sumber:'Bendung Bentar',
      coords:[[-6.940,109.688],[-6.940,109.712],[-6.966,109.716],[-6.970,109.690]] }
  ],
  pintu:[
    { id:'ba-1', nama:'BA Pintu Air 1 — Km 0+000', di:'di-1', pos:[-6.916,109.658], buka:'2 × 75 cm', kondisi:'Baik' },
    { id:'ba-2', nama:'BA Pintu Air 2 — Km 0+600', di:'di-1', pos:[-6.903,109.664], buka:'1 × 100 cm', kondisi:'Baik' },
    { id:'ba-3', nama:'BA Pintu Air 3 — Km 1+400', di:'di-1', pos:[-6.927,109.662], buka:'2 × 80 cm', kondisi:'Perlu Perhatian' },
    { id:'ba-4', nama:'BA Pintu Air 4 — Km 0+300', di:'di-2', pos:[-6.949,109.700], buka:'1 × 120 cm', kondisi:'Baik' },
    { id:'ba-5', nama:'BA Pintu Air 5 — Km 1+100', di:'di-2', pos:[-6.957,109.706], buka:'2 × 75 cm', kondisi:'Perlu Perhatian' }
  ],
  saluran:[
    { id:'s-1', nama:'Saluran Primer Km 0+000–3+500', di:'di-1', kondisi:'Baik', panjang:'3,5 km',
      coords:[[-6.916,109.658],[-6.910,109.661],[-6.903,109.664]] },
    { id:'s-2', nama:'Saluran Sekunder I', di:'di-1', kondisi:'Rusak Ringan', panjang:'2,1 km',
      coords:[[-6.916,109.658],[-6.922,109.660],[-6.927,109.662]] },
    { id:'s-3', nama:'Saluran Sekunder II', di:'di-2', kondisi:'Rusak Berat', panjang:'1,4 km',
      coords:[[-6.949,109.700],[-6.952,109.703],[-6.957,109.706]] }
  ]
};
const KONDISI_COLOR = { 'Baik':'#12A15A', 'Rusak Ringan':'#D97706', 'Rusak Berat':'#DC4437', 'Perlu Perhatian':'#D97706' };

/* Lokasi opsi untuk kamera/tugas sesuai peran */
function lokasiOptions(role){
  if(role==='ppa') return GEO.pintu.map(p=>({ id:p.id, label:p.nama, kind:'Pintu Air' }));
  if(role==='pekarya') return GEO.saluran.map(s=>({ id:s.id, label:s.nama, kind:'Saluran' }));
  return [
    ...GEO.dis.map(d=>({ id:d.id, label:d.nama, kind:'Daerah Irigasi' })),
    ...GEO.pintu.map(p=>({ id:p.id, label:p.nama, kind:'Pintu Air' })),
    ...GEO.saluran.map(s=>({ id:s.id, label:s.nama, kind:'Saluran' }))
  ];
}
function lokasiLabel(id){
  for(const p of GEO.pintu) if(p.id===id) return p.nama;
  for(const s of GEO.saluran) if(s.id===id) return s.nama;
  for(const d of GEO.dis) if(d.id===id) return d.nama;
  return id || 'Lokasi umum';
}

/* ---------------- KONSTANTA LAIN ---------------- */
const JENIS = ['Operasi Pintu Air','Pemeliharaan Rutin Saluran','Perbaikan Bangunan','Patroli & Pengawasan','Pengukuran & Pencatatan','Dokumentasi Pengawasan'];
const BAKHLAK = ['Berorientasi Pelayanan','Akuntabel','Kompeten','Harmonis','Loyal','Adaptif','Kolaboratif'];
const BAKH_NILAI = { 'SB':95, 'B':80, 'MP':65, 'K':50, 'SK':35 };
const BAKH_LABEL = { 'SB':'Sangat Baik', 'B':'Baik', 'MP':'Butuh Perbaikan', 'K':'Kurang', 'SK':'Sangat Kurang' };
/* Predikat capaian kinerja — mengacu Peraturan BKN No. 3 Tahun 2023 (evaluasi kinerja ASN) */
const PREDIKAT = [
  { min:91.00, label:'Sangat Baik', cls:'ok' },
  { min:76.00, label:'Baik', cls:'info' },
  { min:61.00, label:'Butuh Perbaikan', cls:'warn' },
  { min:51.00, label:'Kurang', cls:'bad' },
  { min:0,     label:'Sangat Kurang', cls:'bad' }
];
const predikatOf = (skor) => PREDIKAT.find(p=>skor>=p.min) || PREDIKAT[PREDIKAT.length-1];
const SIM_ADDR = [
  'Jl. Raya Pekalongan–Batang Km 12, Desa Gemulung (simulasi)',
  'Jl. Irigasi Sekunder I, Desa Wonokerto (simulasi)',
  'Jl. Bendung Bentar, Desa Bojong (simulasi)',
  'Jl. Saluran Primer Km 2, Desa Kandang (simulasi)'
];
const simAddr = (lat,lng) => SIM_ADDR[Math.abs(U.hash(`${lat.toFixed(3)},${lng.toFixed(3)}`)) % SIM_ADDR.length];

/* ---------------- KEHADIRAN SIMULASI (SISTEM ABSENSI) ----------------
   Kode: H=Hadir, DL=Dinas Luar, S=Sakit, I=Izin, C=Cuti, A=Tanpa Keterangan
   Data ini mensimulasikan mesin absensi/fingerprint. Pengajuan izin/sakit/
   cuti/dinas luar yang DISetujui (S.absensi) SELALU menimpa data sistem. */
const ATT_OVERRIDE = {
  'u-ppa':     { 21:'S', 45:'I', 46:'I', 97:'A' },
  'u-pekarya': { 80:'C', 81:'C', 82:'C', 30:'S', 60:'DL' },
  'u-pengamat':{ 40:'DL', 41:'DL', 70:'I' }
};
function attFor(uid, iso){
  const d = new Date(iso+'T00:00:00');
  if(d.getDay()===0) return null;               // hari Minggu bukan hari kerja
  /* 1) Pengajuan kehadiran berstatus disetujui menimpa semua (logika surat
        masuk → status A/alpa jadi I/S/C sesuai surat) — berlaku juga untuk
        tanggal mendatang yang cutinya sudah disetujui. */
  if(typeof S!=='undefined' && S && Array.isArray(S.absensi)){
    const ab = S.absensi.find(a=>a.userId===uid && a.tanggal===iso && a.status==='disetujui');
    if(ab) return ab.kode;
  }
  const off = Math.floor((U.d(0) - d) / 86400000);
  if(off < 0) return null;
  /* 2) Data sistem absensi (simulasi fingerprint) */
  const ov = (ATT_OVERRIDE[uid]||{})[off];
  if(ov) return ov;
  const r = U.hash(uid + iso) % 100;
  if(r < 79) return 'H';
  if(r < 88) return 'DL';
  if(r < 92) return 'I';
  if(r < 95) return 'S';
  if(r < 97) return 'C';
  return 'A';
}
const ATT_LABEL = { H:'Hadir', DL:'Dinas Luar', S:'Sakit', I:'Izin', C:'Cuti', A:'Tanpa Ket.' };
/* Ambil pengajuan kehadiran milik pegawai pada satu tanggal (status apa pun) */
function absensiReq(uid, iso){
  if(typeof S==='undefined' || !S || !Array.isArray(S.absensi)) return null;
  return S.absensi.find(a=>a.userId===uid && a.tanggal===iso) || null;
}

/* ---------------- PENGAJUAN KEHADIRAN (IZIN / SAKIT / CUTI / DL) ----------------
   Alur sesuai praktik kepegawaian: pegawai mengajukan (lampiran no. surat
   dokter/cuti/SPPD) → Staf Pengamat menyetujui/menolak → rekap H/DL/S/I/C/A
   pada kalender & rapor diperbarui otomatis oleh attFor(). */
function seedAbsensi(){
  const a = (id,userId,off,kode,alasan,surat,status,feedback,fbOff)=>{
    return { id, userId, tanggal:U.isoOff(off), kode, alasan, surat:surat||'', status,
      feedback:feedback||'', createdAt:U.dts(off-1,8,5),
      decidedAt:status==='menunggu'?null:U.dts(fbOff??off,10,30),
      decidedBy:status==='menunggu'?null:'u-pengamat' };
  };
  return [
    a('ab-01','u-ppa',-2,'S','Demam dan flu — terlampir surat keterangan dokter.','SND/RSD-PKL/2026/0412','disetujui','Semoga lekas sembuh. Berkas FJK diserahkan ke Seksi Pengelolaan.',-2),
    a('ab-02','u-pekarya',-9,'C','Cuti tahunan 1 hari sesuai surat permohonan cuti.','CUTI-1/BWSPJ/2026/0087','disetujui','Cuti disetujui pejabat berwenang.',-9),
    a('ab-03','u-pekarya',1,'I','Menghadiri undangan rekonsiliasi data irigasi di Balai.','','menunggu',''),
    a('ab-04','u-ppa',3,'S','Kontrol ulang ke klinik pasca rawat jalan.','','menunggu','')
  ];
}

/* ---------------- SEED TUGAS & LAPORAN ---------------- */
function seedTasks(){
  const t = (id,title,jenis,petugas,off,status,prio,locId,catatan,dari)=>{
    return { id, title, jenis, petugasId:petugas, dariPengamat:dari||'u-pengamat',
      lokasiId:locId, lokasi:lokasiLabel(locId), prioritas:prio,
      tenggat:U.isoOff(off), status, catatan:catatan||'', createdAt:U.dts(Math.min(off-3,-1),8,30) };
  };
  return [
    t('t-01','Operasi pintu air BA-1: regulasi debit irigasi tahap II','Operasi Pintu Air','u-ppa',0,'dikerjakan','Tinggi','ba-1','Waktu operasi 07.00 & 15.00 WIB.'),
    t('t-02','Pencatatan tinggi muka air harian BA-2','Pengukuran & Pencatatan','u-ppa',-1,'diverifikasi','Sedang','ba-2',''),
    t('t-03','Kalibrasi ulang skala tinggi muka air BA-2','Perbaikan Bangunan','u-ppa',3,'baru','Sedang','ba-2','Siapkan cat kalibrasi.'),
    t('t-04','Pemeliharaan rutin Saluran Sekunder I (potong rumput)','Pemeliharaan Rutin Saluran','u-pekarya',0,'dikerjakan','Sedang','s-2','Prioritas ruas Km 0+300–1+000.'),
    t('t-05','Perbaikan pondasi bangunan bagi Km 1+250','Perbaikan Bangunan','u-pekarya',5,'baru','Tinggi','s-2','Koordinasi dengan mandor lapangan.'),
    t('t-06','Patroli saluran pasca-hujan intensitas sedang','Patroli & Pengawasan','u-pekarya',-2,'revisi','Sedang','s-3',''),
    t('t-07','Verifikasi bangunan sadap BA-4','Patroli & Pengawasan','u-ppa',-4,'diverifikasi','Rendah','ba-4',''),
    t('t-08','Pengukuran debit saluran primer (current meter)','Pengukuran & Pencatatan','u-pekarya',1,'dikerjakan','Sedang','s-1',''),
    t('t-09','Pemeriksaan lapangan D.I. Gemulung + dokumentasi','Dokumentasi Pengawasan','u-pengamat',0,'dikerjakan','Sedang','di-1','Gunakan kamera dengan watermark.'),
    t('t-10','Pembersihan kepala saluran dari sedimen','Pemeliharaan Rutin Saluran','u-pekarya',-6,'diverifikasi','Sedang','s-1',''),
    t('t-11','Verifikasi hasil pemeliharaan Saluran Sekunder I','Patroli & Pengawasan','u-pengamat',-6,'diverifikasi','Sedang','s-2',''),
    t('t-12','Patroli rutin bangunan bagi saluran primer','Patroli & Pengawasan','u-pekarya',-8,'diverifikasi','Rendah','s-1',''),
    t('t-13','Survei kondisi awal Saluran Sekunder II','Pengukuran & Pencatatan','u-pekarya',-12,'diverifikasi','Sedang','s-2','')
  ];
}
function seedReports(){
  const r = (id,petugas,tugasId,locId,tahap,off,status,catatan,feedback,fbOff)=>{
    return { id, petugasId:petugas, tugasId:tugasId||null, lokasi:lokasiLabel(locId), lokasiId:locId,
      tahap, waktu:U.dts(off,9,15), catatan,
      status, feedback:feedback||'', feedbackAt:feedback?U.dts(fbOff??off+0.4,14,0):null,
      foto:null, fotoFull:null };
  };
  return [
    r('r-01','u-ppa','t-02','ba-2',100,-1,'disetujui','TMA pukul 06.00 = +1,20 m; pintu dibuka 50 cm sesuai SOP.','Laporan lengkap. Lanjutkan pemantauan harian.',-1),
    r('r-02','u-pekarya','t-04','s-2',50,-1,'disetujui','Pemotongan rumput 60% ruas. Terdapat sedimentasi ringan Km 0+800.','Bagus, lanjutkan hingga 100%.',-1),
    r('r-03','u-pekarya','t-10','s-1',100,-5,'disetujui','Kepala saluran bersih. Estimasi tambahan debit 0,3 m³/detik.','Terima kasih, kondisi membaik.',-5),
    r('r-04','u-ppa','t-07','ba-4',100,-4,'disetujui','Bangunan sadap kondisi baik, skala terbaca jelas.','Diverifikasi, sesuai kondisi lapangan.',-3),
    r('r-05','u-pekarya','t-06','s-3',100,-2,'revisi','Patroli selesai. Temuan longsoran kecil tepi saluran.','Mohon tambahkan foto kondisi titik longsor.',-2),
    r('r-06','u-ppa',null,'ba-1',0,0,'menunggu','Kondisi awal sebelum operasi tahap II.',''),
    r('r-07','u-pengamat',null,'di-1',null,-1,'dokumentasi','Dokumentasi pengawasan berkala D.I. Gemulung.',''),
    r('r-08','u-pekarya','t-12','s-1',100,-8,'disetujui','Patroli bangunan bagi kondisi baik, tak ada kerusakan.','Sesuai prosedur patroli.',-7),
    r('r-09','u-pekarya','t-13','s-2',0,-12,'disetujui','Survei awal: lining memadai, perlu perbaikan titik lokal Km 0+400.','Survei jelas — tindak lanjut perbaikan.',-11),
    r('r-10','u-pengamat',null,'di-2',null,-12,'dokumentasi','Dokumentasi pengawasan D.I. Bentar: distribusi merata.',''),
    r('r-11','u-pengamat',null,'di-1',null,-20,'dokumentasi','Dokumentasi pengawasan: operasi pintu BA-2 masa tanam I.','')
  ];
}

/* ---------------- INDEXEDDB (ANTRIAN FOTO OFFLINE) ---------------- */
const IDB = {
  db:null,
  open(){ return new Promise((res)=>{
    try{
      const rq = indexedDB.open('sipatir', 1);
      rq.onupgradeneeded = (e)=>{ e.target.result.createObjectStore('shots', { keyPath:'id' }); };
      rq.onsuccess = (e)=>{ IDB.db = e.target.result; res(true); };
      rq.onerror = ()=>res(false);
    }catch(_){ res(false); }
  }); },
  put(obj){ return new Promise((res)=>{
    if(!IDB.db) return res(false);
    try{ const tx=IDB.db.transaction('shots','readwrite'); tx.objectStore('shots').put(obj); tx.oncomplete=()=>res(true); tx.onerror=()=>res(false); }
    catch(_){ res(false); }
  }); },
  all(){ return new Promise((res)=>{
    if(!IDB.db) return res([]);
    try{ const tx=IDB.db.transaction('shots','readonly'); const rq=tx.objectStore('shots').getAll(); rq.onsuccess=()=>res(rq.result||[]); rq.onerror=()=>res([]); }
    catch(_){ res([]); }
  }); },
  del(id){ return new Promise((res)=>{
    if(!IDB.db) return res(false);
    try{ const tx=IDB.db.transaction('shots','readwrite'); tx.objectStore('shots').delete(id); tx.oncomplete=()=>res(true); tx.onerror=()=>res(false); }
    catch(_){ res(false); }
  }); }
};
