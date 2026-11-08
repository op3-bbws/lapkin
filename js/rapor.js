/* ============================================================
   SIPATIR — rapor.js
   Rapor kinerja pegawai per periode (1/3/6/12 bulan) yang
   mengikuti kerangka pengelolaan kinerja ASN:
   • Hasil Kerja (bobot 70%) + Perilaku Kerja BerAKHLAK (30%)
     — mengacu Perpres No. 95/2021 & PermenPANRB No. 6/2022.
   • Predikat & ambang skor mengacu Peraturan BKN No. 3/2023:
     Sangat Baik ≥ 91,00 | Baik 76,00–90,99 | Butuh Perbaikan
     61,00–75,99 | Kurang 51,00–60,99 | Sangat Kurang ≤ 50,99.
   • Rekap kehadiran: H / DL / S / I / C / A.
   (Semua angka adalah SIMULASI untuk keperluan prototipe.)
   ============================================================ */
'use strict';

/* ---------- perhitungan ---------- */
function monthStart(d){ return new Date(d.getFullYear(), d.getMonth(), 1); }
function addMonths(d, n){ return new Date(d.getFullYear(), d.getMonth()+n, 1); }
function inRange(isoDt, start, end){
  const t = new Date(isoDt).getTime();
  return t >= start.getTime() && t <= end.getTime();
}
function attRange(uid, start, end){
  const att = { H:0, DL:0, S:0, I:0, C:0, A:0 };
  let total = 0;
  const cur = new Date(start);
  const today = new Date(); today.setHours(23,59,59,999);
  while(cur <= end && cur <= today){
    const code = attFor(uid, U.iso(cur));
    if(code){ att[code]++; total++; }
    cur.setDate(cur.getDate()+1);
  }
  return { att, total, hadir: att.H + att.DL, pct: total ? Math.round((att.H+att.DL)/total*100) : 0 };
}
function hasilForSlice(uid, start, end, months){
  const u = userById(uid);
  const isPeng = u.role==='pengamat';
  let reports, approved, judged, docs, tasks, done, hasil;
  if(isPeng){
    /* Pengamat: kinerja = verifikasi laporan tim + dokumentasi pengawasan + tugas sendiri */
    const others = S.reports.filter(r=>r.petugasId!==uid && r.status!=='dokumentasi' && inRange(r.waktu, start, end));
    approved = others.filter(r=>r.status==='disetujui');
    judged   = others.filter(r=>r.status!=='menunggu');
    docs = S.reports.filter(r=>r.petugasId===uid && r.status==='dokumentasi' && inRange(r.waktu, start, end));
    const verif = approved.filter(r=>r.feedbackAt && inRange(r.feedbackAt, start, end));
    tasks = S.tasks.filter(t=>t.petugasId===uid && inRange(t.createdAt, start, end));
    done  = tasks.filter(t=>t.status==='selesai'||t.status==='diverifikasi');
    const tugasGiven = S.tasks.filter(t=>t.dariPengamat===uid && inRange(t.createdAt, start, end));
    const den = judged.length + docs.length;
    const rasio = den ? (approved.length + docs.length)/den : 0.85;
    const kegiatan = verif.length + docs.length + done.length*0.5 + tugasGiven.length*0.2;
    hasil = 65*rasio + 35*Math.min(1, kegiatan/(2*months));
    reports = others;
  }else{
    /* PPA/Pekarya: kinerja = laporan disetujui + ketuntasan tugas */
    reports  = S.reports.filter(r=>r.petugasId===uid && r.status!=='dokumentasi' && inRange(r.waktu, start, end));
    approved = reports.filter(r=>r.status==='disetujui');
    judged   = reports.filter(r=>r.status!=='menunggu');
    docs = [];
    tasks = S.tasks.filter(t=>t.petugasId===uid && inRange(t.createdAt, start, end));
    done  = tasks.filter(t=>t.status==='selesai'||t.status==='diverifikasi');
    const rasio = judged.length ? approved.length/judged.length : 0.85;
    const kegiatan = reports.length + done.length*0.5;
    hasil = 65*rasio + 35*Math.min(1, kegiatan/(2*months));
  }
  return { reports, approved, tasks, done, docs, hasil,
    rasioSetuju: judged.length||docs.length ? (approved.length+(isPeng?docs.length:0))/((judged.length||1)+(isPeng?docs.length:0)) : 0,
    rasioTugas: tasks.length ? done.length/tasks.length : 0 };
}
function computeRapor(uid, months){
  const end = new Date(); end.setHours(23,59,59,999);
  const start = addMonths(monthStart(new Date()), -(months-1));
  const sl = hasilForSlice(uid, start, end, months);
  const u = userById(uid);
  const perilaku = Math.round(u.bakh.reduce((a,c)=>a+BAKH_NILAI[c],0) / u.bakh.length * 10)/10;
  const akhir = Math.round((0.7*sl.hasil + 0.3*perilaku)*100)/100;
  const a = attRange(uid, start, end);
  /* seri bulanan untuk grafik */
  const series = [];
  for(let i=0;i<months;i++){
    const s = addMonths(start, i);
    const e = new Date(s.getFullYear(), s.getMonth()+1, 0, 23,59,59,999);
    const ms = hasilForSlice(uid, s, e, 1);
    series.push({ label:U.monthsID[s.getMonth()].slice(0,3), skor: Math.round(ms.hasil*10)/10,
      laporan: ms.reports.length, disetujui: ms.approved.length });
  }
  /* tabel hasil kerja (SKP mini) — agregasi per jenis */
  const jenisMap = {};
  sl.tasks.forEach(t=>{ (jenisMap[t.jenis] = jenisMap[t.jenis] || { target:0, real:0, tepat:0 }); jenisMap[t.jenis].target++; });
  sl.done.forEach(t=>{ if(jenisMap[t.jenis]) jenisMap[t.jenis].real++; });
  sl.approved.forEach(r=>{ const t = S.tasks.find(x=>x.id===r.tugasId); if(t && jenisMap[t.jenis]) jenisMap[t.jenis].tepat++; });
  const skpRows = Object.entries(jenisMap).map(([j,v])=>{
    const target = Math.max(v.target, Math.ceil(v.real*1.15)||1);
    const kualitas = Math.round(v.real/target*100);
    const waktu = v.real ? Math.round((v.tepat/v.real)*100) : 0;
    return { jenis:j, target, real:v.real, kualitas: Math.min(100,kualitas), waktu: Math.min(100, waktu||Math.round(kualitas*0.9)) };
  });
  const bakh = u.bakh.map((kode,i)=>({ nama:BAKHLAK[i], kode, nilai:BAKH_NILAI[kode] }));
  return { user:u, months, start, end, ...sl, att:a.att, attTotal:a.total, attPct:a.pct,
    perilaku, akhir, predikat:predikatOf(akhir), series, skpRows, bakh,
    docs:sl.docs, menunggu: sl.reports.filter(r=>r.status==='menunggu').length };
}

/* ---------- grafik canvas ---------- */
function drawBars(cv, series){
  const dpr = window.devicePixelRatio||1;
  const W = cv.clientWidth||600, H = cv.clientHeight||230;
  cv.width = W*dpr; cv.height = H*dpr;
  const ctx = cv.getContext('2d'); ctx.scale(dpr,dpr); ctx.clearRect(0,0,W,H);
  const padL=34, padB=26, padT=14, padR=8;
  const iw = W-padL-padR, ih = H-padT-padB;
  const css = getComputedStyle(document.documentElement);
  const cText = css.getPropertyValue('--text-2').trim()||'#5A6B85';
  const cLine = css.getPropertyValue('--line').trim()||'#DFE6F1';
  const cBrand = css.getPropertyValue('--brand-2').trim()||'#2E7BE0';
  /* grid */
  ctx.strokeStyle=cLine; ctx.fillStyle=cText; ctx.font='10px Segoe UI, Arial'; ctx.textAlign='right';
  for(let g=0; g<=4; g++){
    const y = padT + ih - ih*g/4;
    ctx.beginPath(); ctx.moveTo(padL,y); ctx.lineTo(W-padR,y); ctx.stroke();
    ctx.fillText(String(g*25), padL-6, y+3);
  }
  const max = Math.max(100, ...series.map(s=>s.skor));
  const bw = Math.min(46, (iw/series.length)*0.55);
  ctx.textAlign='center';
  series.forEach((s,i)=>{
    const cx = padL + iw*(i+0.5)/series.length;
    const bh = ih * Math.min(1, s.skor/max);
    const y = padT + ih - bh;
    const grd = ctx.createLinearGradient(0,y,0,padT+ih);
    grd.addColorStop(0,cBrand); grd.addColorStop(1, cBrand+'66');
    ctx.fillStyle = grd;
    rr(ctx, cx-bw/2, y, bw, bh, 6); ctx.fill();
    ctx.fillStyle=cText; ctx.font='700 10px Segoe UI, Arial';
    ctx.fillText(String(Math.round(s.skor)), cx, y-4);
    ctx.font='10px Segoe UI, Arial';
    ctx.fillText(s.label, cx, H-8);
  });
  /* garis target 75 */
  const ty = padT + ih - ih*(75/100);
  ctx.save(); ctx.setLineDash([5,4]); ctx.strokeStyle='#D97706';
  ctx.beginPath(); ctx.moveTo(padL,ty); ctx.lineTo(W-padR,ty); ctx.stroke();
  ctx.fillStyle='#D97706'; ctx.textAlign='left'; ctx.fillText('target 75', padL+4, ty-4);
  ctx.restore();
}
function drawDonut(cv, att, pct){
  const dpr = window.devicePixelRatio||1;
  const S2 = cv.clientWidth||170;
  cv.width = S2*dpr; cv.height = S2*dpr;
  const ctx = cv.getContext('2d'); ctx.scale(dpr,dpr); ctx.clearRect(0,0,S2,S2);
  const parts = [
    ['H', att.H, '#12A15A'], ['DL', att.DL, '#2F80ED'], ['S', att.S, '#D97706'],
    ['I', att.I, '#7C5CE0'], ['C', att.C, '#8B99B0'], ['A', att.A, '#DC4437']
  ].filter(p=>p[1]>0);
  const total = parts.reduce((a,p)=>a+p[1],0) || 1;
  const cx=S2/2, cy=S2/2, R=S2/2-8, r=R-16;
  let ang = -Math.PI/2;
  parts.forEach(p=>{
    const a2 = ang + p[1]/total*Math.PI*2;
    ctx.beginPath(); ctx.arc(cx,cy,R,ang,a2); ctx.arc(cx,cy,r,a2,ang,true); ctx.closePath();
    ctx.fillStyle=p[2]; ctx.fill();
    ang = a2;
  });
  ctx.fillStyle = cssVar('--text'); ctx.textAlign='center';
  ctx.font='800 26px Segoe UI, Arial'; ctx.fillText(`${pct}%`, cx, cy+4);
  ctx.font='10px Segoe UI, Arial'; ctx.fillStyle=cssVar('--text-2');
  ctx.fillText('kehadiran', cx, cy+22);
}
function cssVar(n){ return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }

/* rincian ketidakhadiran (pengajuan I/S/C/DL) dalam periode rapor */
function absensiDetailRows(R, onlyApproved=false){
  const stMap = { menunggu:['Menunggu Persetujuan','warn'], disetujui:['Disetujui','ok'], ditolak:['Ditolak','bad'] };
  return (Array.isArray(S.absensi)?S.absensi:[])
    .filter(a=>a.userId===R.user.id
      && a.tanggal>=U.iso(R.start) && a.tanggal<=U.iso(R.end)
      && (!onlyApproved || a.status==='disetujui'))
    .sort((a,b)=>b.tanggal.localeCompare(a.tanggal))
    .map(a=>`<tr><td class="mono small">${U.fmtID(a.tanggal)}</td>
      <td><span class="chip mini">${a.kode} — ${ATT_LABEL[a.kode]}</span></td>
      <td>${U.esc(a.alasan||'—')}</td><td class="mono small">${U.esc(a.surat||'—')}</td>
      <td><span class="chip mini ${stMap[a.status][1]}">${stMap[a.status][0]}</span></td></tr>`).join('');
}

/* ---------- halaman rapor ---------- */
function renderRapor(root){
  if(!S.rapor) S.rapor = { months:3 };
  const R = computeRapor(S.session.userId, S.rapor.months);
  const periodeLabel = R.months===1
    ? `Bulan ${U.monthsID[R.start.getMonth()]} ${R.start.getFullYear()}`
    : `${U.monthsID[R.start.getMonth()]} ${R.start.getFullYear()} — ${U.monthsID[R.end.getMonth()]} ${R.end.getFullYear()}`;

  root.innerHTML = `
    <div class="card">
      <div class="card-t">
        <div><h3>Rapor Kinerja Pegawai</h3>
          <div class="sub">Periode: <b>${periodeLabel}</b> — ${U.esc(R.user.nama)}</div></div>
        <button class="btn primary sm" id="rp-print">${I('print')} Cetak / PDF</button>
      </div>
      <div class="row" style="margin-bottom:14px">
        <span class="small muted" style="font-weight:700">Periode:</span>
        <span class="seg" id="rp-per">
          <button class="seg-btn ${R.months===1?'on':''}" data-v="1">1 Bulan</button>
          <button class="seg-btn ${R.months===3?'on':''}" data-v="3">3 Bulan</button>
          <button class="seg-btn ${R.months===6?'on':''}" data-v="6">6 Bulan</button>
          <button class="seg-btn ${R.months===12?'on':''}" data-v="12">1 Tahun</button>
        </span>
      </div>
      <div class="score-hero">
        <div class="big-num">${R.akhir.toFixed(2).replace('.',',')}<span class="pred chip ${R.predikat.cls}">${R.predikat.label}</span></div>
        <div style="flex:1;min-width:230px">
          <div class="bio-row"><span class="k">Nilai hasil kerja (70%)</span><span class="v mono">${R.hasil.toFixed(2).replace('.',',')}</span></div>
          <div class="bio-row"><span class="k">Nilai perilaku kerja (30%)</span><span class="v mono">${R.perilaku.toFixed(1).replace('.',',')}</span></div>
          <div class="bio-row"><span class="k">Kehadiran (H+DL)</span><span class="v mono">${R.attPct}%</span></div>
          <div class="bio-row"><span class="k">Laporan disetujui</span><span class="v mono">${R.approved.length}/${R.reports.length}</span></div>
          <div class="bio-row"><span class="k">Tugas selesai</span><span class="v mono">${R.done.length}/${R.tasks.length}</span></div>
        </div>
      </div>
    </div>

    <div class="grid2 mt">
      <div class="card"><div class="card-t"><h3>Tren Skor Hasil Kerja</h3></div>
        <div class="chart-wrap"><canvas id="rp-bars"></canvas></div></div>
      <div class="card"><div class="card-t"><h3>Komposisi Kehadiran</h3></div>
        <div class="donut-wrap"><canvas id="rp-donut"></canvas>
          <div class="donut-legend">
            ${Object.entries(R.att).map(([k,v])=>`<div class="li"><span><i style="background:${{'H':'#12A15A','DL':'#2F80ED','S':'#D97706','I':'#7C5CE0','C':'#8B99B0','A':'#DC4437'}[k]}"></i>${k} — ${ATT_LABEL[k]}</span><b class="mono">${v} hari</b></div>`).join('')}
            <div class="li" style="border-top:1px solid var(--line);padding-top:6px"><span>Hari kerja efektif</span><b class="mono">${R.attTotal} hari</b></div>
          </div>
        </div>
      </div>
    </div>

    <div class="card mt">
      <div class="card-t"><h3>Rincian Ketidakhadiran — Izin / Sakit / Cuti</h3>
        <span class="chip mini muted">Pengajuan & persetujuan</span></div>
      <div class="tbl-wrap"><table class="tbl">
        <thead><tr><th>Tanggal</th><th>Jenis</th><th>Alasan</th><th>No. Surat / SPPD</th><th>Status</th></tr></thead>
        <tbody>
          ${absensiDetailRows(R) || `<tr><td colspan="5" class="empty">Tidak ada pengajuan ketidakhadiran pada periode ini.</td></tr>`}
        </tbody>
      </table></div>
      <p class="note mt">Logika penilaian: hanya pengajuan berstatus <b>Disetujui</b> (dasar surat dokter / cuti / SPPD) yang dihitung pada rekap H/DL/S/I/C/A di atas. Hari <b>S/I/C/A tidak dihitung</b> sebagai hari kehadiran efektif (H+DL), dan status "Tanpa Keterangan" (A) dapat terperbaiki otomatis bila surat pengajuan disetujui.</p>
    </div>

    <div class="card mt">
      <div class="card-t"><h3>Hasil Kerja Utama (Skor Kegiatan Utama — simulasi SKP)</h3></div>
      <div class="tbl-wrap"><table class="tbl">
        <thead><tr><th>Krjan / Jenis Kegiatan</th><th class="num">Target</th><th class="num">Realisasi</th><th class="num">Kualitas</th><th class="num">Ketepatan Waktu</th><th class="num">Nilai</th></tr></thead>
        <tbody>
          ${R.skpRows.length ? R.skpRows.map(r=>`<tr><td>${U.esc(r.jenis)}</td><td class="num">${r.target}</td><td class="num">${r.real}</td><td class="num">${r.kualitas}%</td><td class="num">${r.waktu}%</td><td class="num"><b>${Math.round((r.kualitas*0.6 + r.waktu*0.4))}</b></td></tr>`).join('')
          : `<tr><td colspan="6" class="empty">Belum ada kegiatan pada periode ini.</td></tr>`}
        </tbody>
      </table></div>
      <p class="note mt">Formula simulasi — Petugas: Hasil = 65% rasio laporan disetujui + 35% volume kegiatan (target 2 kegiatan/bulan). Pengamat: Hasil = 65% rasio verifikasi & dokumentasi + 35% volume pengawasan. Skor akhir = 70% × hasil + 30% × perilaku (BerAKHLAK).</p>
    </div>

    <div class="card mt">
      <div class="card-t"><h3>Perilaku Kerja — BerAKHLAK</h3></div>
      <div class="tbl-wrap"><table class="tbl">
        <thead><tr><th>Nilai Dasar</th><th>Penilaian</th><th class="num">Nilai</th></tr></thead>
        <tbody>${R.bakh.map(b=>`<tr><td>${b.nama}</td><td><span class="chip ${b.kode==='SB'?'ok':b.kode==='B'?'info':'warn'}">${b.kode} — ${BAKH_LABEL[b.kode]}</span></td><td class="num mono">${b.nilai}</td></tr>`).join('')}</tbody>
      </table></div>
    </div>

    <div class="card mt">
      <div class="card-t"><h3>Rincian Aktivitas Periode Ini</h3></div>
      <div class="tbl-wrap"><table class="tbl">
        <thead><tr><th>Tanggal</th><th>Jenis</th><th>Uraian</th><th>Status</th></tr></thead>
        <tbody>
          ${aktivitasRows(R)}
        </tbody>
      </table></div>
    </div>

    <div class="card mt">
      <div class="card-t"><h3>Skala Predikat Kinerja</h3><span class="chip mini muted">Peraturan BKN 3/2023</span></div>
      <div class="tbl-wrap"><table class="tbl">
        <thead><tr><th>Predikat</th><th class="num">Rentang Nilai</th><th>Keterangan</th></tr></thead>
        <tbody>
          <tr><td><span class="chip ok">Sangat Baik</span></td><td class="num mono">≥ 91,00</td><td>Memenuhi & melampaui ekspektasi; perilaku minimal Baik</td></tr>
          <tr><td><span class="chip info">Baik</span></td><td class="num mono">76,00 – 90,99</td><td>Memenuhi ekspektasi kinerja</td></tr>
          <tr><td><span class="chip warn">Butuh Perbaikan</span></td><td class="num mono">61,00 – 75,99</td><td>Perlu peningkatan capaian</td></tr>
          <tr><td><span class="chip bad">Kurang</span></td><td class="num mono">51,00 – 60,99</td><td>Capaian di bawah ekspektasi</td></tr>
          <tr><td><span class="chip bad">Sangat Kurang</span></td><td class="num mono">≤ 50,99</td><td>Tidak memenuhi ekspektasi</td></tr>
        </tbody>
      </table></div>
      <p class="note mt">Prototipe mengacu Perpres 95/2021, PermenPANRB 6/2022 & Peraturan BKN 3/2023. Penilaian resmi tetap melalui e-Kinerja/SKP melalui pejabat penilai.</p>
    </div>`;

  U.$$('#rp-per .seg-btn', root).forEach(b=> b.onclick = ()=>{ S.rapor.months = +b.dataset.v; save(); renderPage(); });
  U.$('#rp-print', root).onclick = ()=> buildPrintSheet(R);
  requestAnimationFrame(()=>{ drawBars(U.$('#rp-bars',root), R.series); drawDonut(U.$('#rp-donut',root), R.att, R.attPct); });
}

function aktivitasRows(R){
  const rows = [];
  R.reports.forEach(r=> rows.push({ tgl:r.waktu, jenis:'Laporan '+(r.tahap!=null?r.tahap+'%':'Dok.'), uraian:r.lokasi+' — '+r.catatan, st:r.status }));
  R.tasks.forEach(t=> rows.push({ tgl:t.createdAt, jenis:'Tugas: '+t.jenis, uraian:t.title, st:t.status }));
  rows.sort((a,b)=> new Date(b.tgl)-new Date(a.tgl));
  const map = { disetujui:['disetujui','ok'], dokumentasi:['dokumentasi','violet'], menunggu:['menunggu','warn'],
    revisi:['revisi','warn'], ditolak:['ditolak','bad'], baru:['baru','info'], dikerjakan:['dikerjakan','warn'],
    selesai:['selesai','info'], diverifikasi:['diverifikasi','ok'] };
  return rows.slice(0,30).map(r=>`<tr><td class="mono small">${U.fmtDT(r.tgl)}</td><td>${U.esc(r.jenis)}</td><td>${U.esc(r.uraian)}</td>
    <td><span class="chip mini ${map[r.st]?map[r.st][1]:''}">${r.st}</span></td></tr>`).join('') || '<tr><td colspan="4" class="empty">Tidak ada aktivitas.</td></tr>';
}

/* ---------- lembar cetak resmi ---------- */
function buildPrintSheet(R){
  const u = R.user;
  const tglCetak = U.fmtID(U.today());
  const sheet = U.$('#print-sheet');
  sheet.innerHTML = `
  <div class="print-doc">
    <div class="print-head">
      <img src="assets/icons/icon-512.png" alt="">
      <div class="p-org">Kementerian Pekerjaan Umum dan Penataan Ruang<br>
        Direktorat Jenderal Sumber Daya Air<br>
        Balai Wilayah Sungai Pemali Jratunseluna<br>
        Sektor Pengelolaan Sumber Daya Air Pekalongan</div>
      <div class="hr"></div>
    </div>
    <div class="print-title">REKAPITULASI CAPAIAN KINERJA PEGAWAI</div>
    <div class="print-sub">Periode: ${R.months===1?`Bulan ${U.monthsID[R.start.getMonth()]} ${R.start.getFullYear()}`
      : `${U.fmtID(U.iso(R.start))} s.d. ${U.fmtID(U.iso(R.end))}`} — Dicetak ${tglCetak} (simulasi)</div>

    <table class="ptbl">
      <tr><th style="width:30%">Nama</th><td>${U.esc(u.nama)}</td><th style="width:22%">NIP</th><td class="mono">${u.nip}</td></tr>
      <tr><th>Pangkat/Gol. Ruang</th><td>${U.esc(u.pangkat)} / ${U.esc(u.gol)}</td><th>Jabatan</th><td>${U.esc(u.jabatan)}</td></tr>
      <tr><th>Unit Kerja</th><td>${U.esc(u.unit)}</td><th>Status</th><td>${u.status}</td></tr>
    </table>

    <table class="ptbl">
      <tr><th style="width:34%">Nilai Hasil Kerja (70%)</th><td class="r mono">${R.hasil.toFixed(2).replace('.',',')}</td>
          <th style="width:30%">Nilai Perilaku Kerja (30%)</th><td class="r mono">${R.perilaku.toFixed(1).replace('.',',')}</td></tr>
      <tr><th>Nilai Capaian Kinerja</th><td class="r mono"><b>${R.akhir.toFixed(2).replace('.',',')}</b></td>
          <th>Predikat Kinerja</th><td><b>${R.predikat.label}</b></td></tr>
      <tr><th>Kehadiran (H + DL)</th><td class="r mono">${(R.att.H+R.att.DL)} dari ${R.attTotal} hari (${R.attPct}%)</td>
          <th>Laporan Disetujui</th><td class="r mono">${R.approved.length} dari ${R.reports.length}</td></tr>
    </table>

    <b style="font-size:10pt">1. Hasil Kerja Utama</b>
    <table class="ptbl">
      <tr><th>Krjan / Jenis Kegiatan</th><th class="c">Target</th><th class="c">Realisasi</th><th class="c">Kualitas</th><th class="c">Ketepatan Waktu</th><th class="c">Nilai</th></tr>
      ${R.skpRows.map(r=>`<tr><td>${U.esc(r.jenis)}</td><td class="c">${r.target}</td><td class="c">${r.real}</td><td class="c">${r.kualitas}%</td><td class="c">${r.waktu}%</td><td class="c">${Math.round(r.kualitas*0.6+r.waktu*0.4)}</td></tr>`).join('') || '<tr><td colspan="6" class="c">—</td></tr>'}
    </table>

    <b style="font-size:10pt">2. Perilaku Kerja (BerAKHLAK)</b>
    <table class="ptbl">
      <tr><th>Nilai Dasar</th><th class="c">Penilaian</th><th class="c">Nilai</th></tr>
      ${R.bakh.map(b=>`<tr><td>${b.nama}</td><td class="c">${b.kode} — ${BAKH_LABEL[b.kode]}</td><td class="c">${b.nilai}</td></tr>`).join('')}
    </table>

    <b style="font-size:10pt">3. Rekapitulasi Kehadiran</b>
    <table class="ptbl">
      <tr><th>H (Hadir)</th><th>DL (Dinas Luar)</th><th>S (Sakit)</th><th>I (Izin)</th><th>C (Cuti)</th><th>A (Tanpa Ket.)</th></tr>
      <tr class="c"><td class="c">${R.att.H}</td><td class="c">${R.att.DL}</td><td class="c">${R.att.S}</td><td class="c">${R.att.I}</td><td class="c">${R.att.C}</td><td class="c">${R.att.A}</td></tr>
    </table>
${absensiDetailRows(R, true) ? `
    <b style="font-size:10pt">4. Rincian Ketidakhadiran (Izin/Sakit/Cuti — disetujui)</b>
    <table class="ptbl">
      <tr><th style="width:18%">Tanggal</th><th style="width:16%">Jenis</th><th>Alasan</th><th style="width:26%">No. Surat / SPPD</th></tr>
      ${(Array.isArray(S.absensi)?S.absensi:[])
        .filter(a=>a.userId===u.id && a.tanggal>=U.iso(R.start) && a.tanggal<=U.iso(R.end) && a.status==='disetujui')
        .sort((a,b)=>b.tanggal.localeCompare(a.tanggal))
        .map(a=>`<tr><td class="c">${U.fmtID(a.tanggal)}</td><td>${a.kode} — ${ATT_LABEL[a.kode]}</td><td>${U.esc(a.alasan||'—')}</td><td>${U.esc(a.surat||'—')}</td></tr>`).join('')}
    </table>` : ''}

    <div class="psign">
      <div class="pc">
        Pegawai yang Dinilai,<div class="sp"></div>
        <b><u>${U.esc(u.nama)}</u></b><br>NIP. ${u.nip}
      </div>
      <div class="pc">
        Pejabat Penilai Kinerja,<div class="sp"></div>
        <b><u>${U.esc(userById('u-pengamat').nama)}</u></b><br>NIP. ${userById('u-pengamat').nip}
      </div>
    </div>
    <div class="pfoot">Dokumen simulasi prototipe SIPATIR — mengacu Perpres 95/2021, PermenPANRB 6/2022, dan Peraturan BKN 3/2023.
    Penilaian resmi diterbitkan melalui e-Kinerja BKN.</div>
  </div>`;
  window.print();
}
