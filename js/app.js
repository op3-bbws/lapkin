/* ============================================================
   SIPATIR — app.js
   Status aplikasi, persistensi, cangkang (sidebar rounded +
   pill nav), router, beranda (hero popout + kalender), tugas,
   persetujuan (Staf Pengamat), profil (biodata kepegawaian,
   dua foto, setelan tampilan), sinkronisasi offline, PWA.
   ============================================================ */
'use strict';

const LS = 'sipatir_v1';
let S = null;
window.PHOTO_CACHE = {};

/* ---------------- STATUS & PERSISTENSI ---------------- */
function defaultState(){
  return {
    session:null, route:'beranda',
    settings:{ theme:'light', accent:'biru', font:'md', density:'cozy', anim:true },
    tasks:seedTasks(), reports:seedReports(), absensi:seedAbsensi(),
    overrides:{ photos:{}, profile:{} },
    cam:null, mapMode:null, rapor:null, lastSync:null
  };
}
function loadState(){
  let st = null;
  try{ st = JSON.parse(localStorage.getItem(LS)); }catch(_){}
  S = Object.assign(defaultState(), st||{});
  S.settings = Object.assign({ theme:'light', accent:'biru', font:'md', density:'cozy', anim:true }, (st&&st.settings)||{});
  S.overrides = Object.assign({ photos:{}, profile:{} }, S.overrides||{});
  if(!S.tasks.length) S.tasks = seedTasks();
  if(!S.reports.length) S.reports = seedReports();
  if(!Array.isArray(S.absensi)) S.absensi = seedAbsensi();
  return S;
}
function save(){
  try{ localStorage.setItem(LS, JSON.stringify(S)); }
  catch(e){ console.warn('Penyimpanan penuh', e); }
}
function curUser(){
  const u = userById(S.session.userId);
  return Object.assign({}, u, S.overrides.profile[u.id]||{});
}
function avaSrc(u, kind='hero'){
  const ph = S.overrides.photos[u.id]||{};
  return kind==='resmi' ? (ph.resmi||u.fotoResmi) : (ph.hero||u.avatar);
}

/* ---------------- TOAST / MODAL / SHEET ---------------- */
function toast(msg, type=''){
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `${I(type==='ok'?'check':type==='err'?'x':type==='warn'?'info':'info')}<span>${U.esc(msg)}</span>`;
  U.$('#toast-root').appendChild(t);
  setTimeout(()=>{ t.style.opacity='0'; t.style.transition='opacity .3s'; setTimeout(()=>t.remove(), 320); }, 2900);
}
function modal(html){
  const ov = document.createElement('div');
  ov.className = 'modal-ov';
  ov.innerHTML = `<div class="modal">${html}</div>`;
  U.$('#modal-root').appendChild(ov);
  const close = ()=>ov.remove();
  ov.addEventListener('click', e=>{ if(e.target===ov) close(); });
  ov.querySelectorAll('[data-close]').forEach(b=>b.onclick=close);
  return { ov, close };
}
function confirmMod(title, msg, yesLabel, cb, danger=true){
  const m = modal(`<h3>${U.esc(title)}</h3><p class="muted small">${U.esc(msg)}</p>
    <div class="m-actions"><button class="btn ghost" data-close>Batal</button>
    <button class="btn ${danger?'danger':'primary'}" id="cf-yes">${U.esc(yesLabel)}</button></div>`);
  m.ov.querySelector('#cf-yes').onclick = ()=>{ m.close(); cb(); };
}

/* ---------------- KOMPONEN KECIL ---------------- */
const ST = {
  baru:['Baru','info'], dikerjakan:['Dikerjakan','warn'], selesai:['Selesai','info'],
  diverifikasi:['Terverifikasi','ok'], revisi:['Perlu Revisi','warn'], ditolak:['Ditolak','bad'],
  menunggu:['Menunggu Persetujuan','warn'], disetujui:['Disetujui','ok'], dokumentasi:['Dokumentasi','violet']
};
const stChip = (st)=>`<span class="chip mini ${ST[st]?ST[st][1]:''}">${ST[st]?ST[st][0]:st}</span>`;
const priChip = (p)=>`<span class="chip mini ${p==='Tinggi'?'bad':p==='Sedang'?'warn':'muted'}">Prioritas ${p||'Sedang'}</span>`;
function ava(u, cls='sm', kind='hero'){
  const src = avaSrc(u, kind);
  return `<img class="avatar ${cls}" src="${src}" alt="${U.esc(u.nama)}" onerror="this.style.visibility='hidden'">`;
}
function lateChip(t){
  const late = t.tenggat < U.today() && !['selesai','diverifikasi'].includes(t.status);
  return `<span class="chip mini ${late?'bad':'muted'}">${I('cal')} Tenggat ${U.fmtID(t.tenggat)}${late?' • terlambat':''}</span>`;
}

/* ---------------- SETELAN TAMPILAN ---------------- */
function applySettings(){
  const st = S.settings;
  const eff = st.theme==='system'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : st.theme;
  document.documentElement.dataset.theme = eff;
  document.documentElement.dataset.accent = st.accent;
  document.documentElement.dataset.font = st.font;
  document.documentElement.dataset.density = st.density;
  document.documentElement.dataset.anim = st.anim ? 'on' : 'off';
  const meta = document.querySelector('meta[name="theme-color"]:not([media])') || document.querySelector('meta[name="theme-color"]');
  if(meta) meta.setAttribute('content', eff==='dark' ? '#0D1420' : '#14458F');
  $$themeBtns();
}
function $$themeBtns(){
  const dark = document.documentElement.dataset.theme==='dark';
  const lab = dark ? 'Tema Gelap' : 'Tema Terang';
  const ic = I(dark?'moon':'sun');
  const sb = U.$('#sb-theme'), tb = U.$('#tb-theme');
  if(sb) sb.innerHTML = `${ic}<span>${lab}</span>`;
  if(tb) tb.innerHTML = ic;
}
function toggleTheme(){
  S.settings.theme = document.documentElement.dataset.theme==='dark' ? 'light' : 'dark';
  save(); applySettings();
}

/* ---------------- NAVIGASI ---------------- */
function navItems(){
  const u = curUser();
  const nav = [
    { id:'beranda', ic:'home', l:'Beranda' },
    { id:'kamera', ic:'camera', l:'Kamera' },
    { id:'peta', ic:'map', l:'Peta' },
    { id:'tugas', ic:'task', l:'Tugas' }
  ];
  if(u.role==='pengamat') nav.push({ id:'setuju', ic:'check', l:'Persetujuan' });
  nav.push({ id:'rapor', ic:'report', l:'Rapor Kinerja' }, { id:'profil', ic:'user', l:'Profil' });
  return nav;
}
function badgeCounts(){
  const u = curUser();
  if(u.role==='pengamat'){
    return { setuju: S.reports.filter(r=>r.status==='menunggu').length
                    + S.absensi.filter(a=>a.status==='menunggu').length };
  }
  return { tugas: S.tasks.filter(t=>t.petugasId===u.id && ['baru','revisi'].includes(t.status)).length };
}
function renderNav(){
  const u = curUser(); if(!u) return;
  const nav = navItems(), bc = badgeCounts();
  U.$('#sb-nav').innerHTML = nav.map(n=>`
    <button class="sb-item ${S.route===n.id?'on':''}" data-route="${n.id}">
      ${I(n.ic)}<span>${n.l}</span>
      ${n.id==='setuju'&&bc.setuju?`<span class="sb-badge">${bc.setuju}</span>`:''}
      ${n.id==='tugas'&&bc.tugas?`<span class="sb-badge">${bc.tugas}</span>`:''}
    </button>`).join('');
  U.$$('#sb-nav .sb-item').forEach(b=>b.onclick=()=>setRoute(b.dataset.route));

  const pill = [
    { id:'beranda', ic:'home', l:'Beranda' },
    { id:'peta', ic:'map', l:'Peta' },
    { fab:true, id:'kamera', ic:'camera', l:'Kamera' },
    { id:'tugas', ic:'task', l:'Tugas' },
    { id:'__more', ic:'dots', l:'Lainnya' }
  ];
  U.$('#pillnav').innerHTML = pill.map(n=> n.fab
    ? `<button class="pn-fab" data-route="${n.id}" aria-label="Kamera">${I(n.ic)}</button>`
    : `<button class="pn-item ${S.route===n.id?'on':''}" data-route="${n.id}">
         ${I(n.ic)}<span>${n.l}</span>
         ${n.id==='tugas'&&bc.tugas?`<span class="sb-badge">${bc.tugas}</span>`:''}
       </button>`).join('');
  U.$$('#pillnav [data-route]').forEach(b=>b.onclick=()=>{
    if(b.dataset.route==='__more') openSheet();
    else setRoute(b.dataset.route);
  });

  const u2 = curUser();
  U.$('#sb-user').innerHTML = `${ava(u2,'md')}<span class="uinfo"><b>${U.esc(u2.nama)}</b><span>${U.esc(u2.roleLabel)}</span></span>`;
  U.$('#sb-user').onclick = ()=>setRoute('profil');
  U.$('#sb-logout').innerHTML = I('out');
  U.$('#sb-logout').onclick = ()=>askLogout();
  const tbAva = U.$('#tb-ava img'); if(tbAva){ tbAva.src = avaSrc(u2); tbAva.alt = u2.nama; }
}
function openSheet(){
  const u = curUser(), bc = badgeCounts();
  const ov = document.createElement('div');
  ov.className = 'sheet-ov';
  ov.innerHTML = `<div class="sheet"><div class="grab"></div><h4>Menu Lainnya</h4>
    <button class="sheet-item" data-go="rapor">${I('report')} Rapor Kinerja</button>
    ${u.role==='pengamat'?`<button class="sheet-item" data-go="setuju">${I('check')} Persetujuan ${bc.setuju?`<span class="sb-badge">${bc.setuju}</span>`:''}</button>`:''}
    <button class="sheet-item" data-go="profil">${I('user')} Profil & Setelan</button>
    <button class="sheet-item" id="sh-theme">${I(document.documentElement.dataset.theme==='dark'?'sun':'moon')} Ganti ke Tema ${document.documentElement.dataset.theme==='dark'?'Terang':'Gelap'}</button>
    <button class="sheet-item danger" id="sh-out">${I('out')} Keluar / Ganti Peran</button>
  </div>`;
  U.$('#sheet-root').appendChild(ov);
  ov.addEventListener('click', e=>{ if(e.target===ov) ov.remove(); });
  ov.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>{ ov.remove(); setRoute(b.dataset.go); });
  ov.querySelector('#sh-theme').onclick = ()=>{ toggleTheme(); ov.remove(); };
  ov.querySelector('#sh-out').onclick = ()=>{ ov.remove(); askLogout(); };
}
function askLogout(){
  confirmMod('Keluar / Ganti Peran', 'Sesi akan diakhiri. Data demo tetap tersimpan di perangkat ini.', 'Keluar', ()=>{
    S.session = null; save(); enterLogin();
  });
}

/* ---------------- ROUTER ---------------- */
function setRoute(id){
  if(S.route==='kamera' && id!=='kamera') stopCam();
  S.route = id; save();
  U.$$('#sb-nav .sb-item').forEach(b=>b.classList.toggle('on', b.dataset.route===id));
  U.$$('#pillnav .pn-item').forEach(b=>b.classList.toggle('on', b.dataset.route===id));
  const title = (navItems().find(n=>n.id===id)||{}).l || 'SIPATIR';
  U.$('#tb-title').textContent = title;
  document.title = `${title} — SIPATIR`;
  renderPage();
}
function renderPage(){
  const m = U.$('#main');
  m.className = 'page';
  const u = curUser();
  if(u.role!=='pengamat' && S.route==='setuju') S.route='tugas';
  switch(S.route){
    case 'kamera': renderKamera(m); break;
    case 'peta':   renderPeta(m); break;
    case 'tugas':  renderTugas(m); break;
    case 'setuju': renderSetuju(m); break;
    case 'rapor':  renderRapor(m); break;
    case 'profil': renderProfil(m); break;
    default:       renderBeranda(m);
  }
  updateNet();
}

/* ---------------- LOGIN ---------------- */
function renderLogin(){
  U.$('#shell').hidden = true;
  const el = U.$('#screen-login');
  el.hidden = false;
  let picked = 'u-ppa';
  el.innerHTML = `
    <div class="login-wrap">
      <div class="login-hero">
        <div class="lg"><img src="assets/icons/icon-192.png" alt="Logo SIPATIR">
          <div><b>SIPATIR</b><span>Sistem Informasi Pemantauan & Pelaporan Irigasi</span></div></div>
        <h2>Digitalisasi inspeksi & operasi irigasi untuk petugas lapangan.</h2>
        <div class="login-feat">
          <div class="feat"><span class="fic">${I('camera')}</span><div><b>Kamera ber-watermark</b><span>Waktu, GPS, alamat & kompas otomatis pada setiap foto progres 0%–100%</span></div></div>
          <div class="feat"><span class="fic">${I('map')}</span><div><b>Peta sesuai peran</b><span>D.I. untuk pengamat, pintu air untuk PPA, ruas saluran untuk Pekarya</span></div></div>
          <div class="feat"><span class="fic">${I('report')}</span><div><b>Rapor kinerja ASN</b><span>Periode 1/3/6/12 bulan mengacu Perpres 95/2021 & Peraturan BKN 3/2023</span></div></div>
          <div class="feat"><span class="fic">${I('sync')}</span><div><b>Siap luring</b><span>Foto tersimpan di antrian offline & tersinkron saat daring</span></div></div>
        </div>
        <div class="foot">Prototipe v1.2 • Data simulasi — Kementerian PU & Penataan Ruang, Ditjen Sumber Daya Air</div>
      </div>
      <div class="login-card">
        <button class="btn icon ghost login-theme" id="lg-theme" aria-label="Ganti tema">${I(document.documentElement.dataset.theme==='dark'?'sun':'moon')}</button>
        <h2>Masuk</h2>
        <p class="sub">Pilih peran Anda (identitas demo — klik kartu lalu tekan Masuk):</p>
        <div id="lg-roles"></div>
        <button class="btn primary block" id="lg-go">Masuk sebagai ${U.esc(userById(picked).roleLabel)}</button>
        <p class="note">Tip: data foto & laporan demo tersimpan lokal (localStorage). Bisa diganti di menu Profil → Setelan.</p>
      </div>
    </div>`;
  const roles = U.$('#lg-roles', el);
  roles.innerHTML = USERS.map(u=>`
    <button class="role-card ${u.id===picked?'sel':''}" data-u="${u.id}" style="width:100%;margin-bottom:10px">
      ${ava(u,'md')}
      <span style="flex:1;min-width:0"><b>${U.esc(u.nama)}</b><span>${U.esc(u.roleLabel)} — ${U.esc(u.ringkas)}</span></span>
      <span class="rc-check">${I('check')}</span>
    </button>`).join('');
  const upd = ()=>{
    U.$$('#lg-roles .role-card', el).forEach(b=>b.classList.toggle('sel', b.dataset.u===picked));
    U.$('#lg-go', el).textContent = 'Masuk sebagai ' + userById(picked).roleLabel;
  };
  U.$$('#lg-roles .role-card', el).forEach(b=>b.onclick=()=>{ picked=b.dataset.u; upd(); });
  U.$('#lg-go', el).onclick = ()=>{
    S.session = { userId:picked, at:Date.now() };
    save(); enterApp();
    toast(`Selamat datang, ${userById(picked).nama.split(',')[0]}!`, 'ok');
  };
  U.$('#lg-theme', el).onclick = ()=>{ toggleTheme(); renderLogin(); };
}
function enterApp(){
  U.$('#screen-login').hidden = true;
  U.$('#shell').hidden = false;
  renderNav();
  setRoute(S.route && navItems().some(n=>n.id===S.route) ? S.route : 'beranda');
}
function enterLogin(){
  stopCam();
  U.$('#shell').hidden = true;
  renderLogin();
}

/* ---------------- BERANDA ---------------- */
function renderBeranda(m){
  const u = curUser();
  const peng = u.role==='pengamat';
  const bc = badgeCounts();
  const now = new Date();
  const bulanIni = `${now.getFullYear()}-${U.pad(now.getMonth()+1)}`;
  const myReports = S.reports.filter(r=>r.petugasId===u.id && r.waktu.slice(0,7)===bulanIni);
  const myTasks = S.tasks.filter(t=>t.petugasId===u.id);
  const aktif = myTasks.filter(t=>['baru','dikerjakan','revisi'].includes(t.status));
  const attPct = attRange(u.id, new Date(now.getFullYear(), now.getMonth(), 1), now).pct;
  const pendingAll = peng ? S.reports.filter(r=>r.status==='menunggu') : [];
  const teamTasks = peng ? S.tasks.filter(t=>t.petugasId!==u.id && ['baru','dikerjakan','revisi'].includes(t.status)) : [];

  m.innerHTML = `
    <section class="hero">
      <img class="hero-avatar pop" id="hero-ava" src="${avaSrc(u)}" alt="Foto profil ${U.esc(u.nama)}">
      <div class="hero-top">
        <div class="hero-greet">${U.greet()}, selamat bertugas 👋</div>
        <h1 class="hero-name">${U.esc(u.nama)}</h1>
        <div class="hero-chips">
          <span class="chip">${I('shield')} ${U.esc(u.roleLabel)}</span>
          <span class="chip">NIP ${U.esc(u.nip)}</span>
          <span class="chip">${U.esc(u.unit.split('—')[0].trim())}</span>
        </div>
      </div>
      <div class="hero-stats">
        ${peng ? `
          <div class="hstat"><b>${bc.setuju}<span class="dot-badge"></span></b><span>Laporan menunggu persetujuan</span></div>
          <div class="hstat"><b>${teamTasks.length}</b><span>Tugas tim sedang berjalan</span></div>
          <div class="hstat"><b>${S.reports.filter(r=>r.status==='disetujui'&&r.feedbackAt&&r.feedbackAt.slice(0,7)===bulanIni).length}</b><span>Laporan diverifikasi bulan ini</span></div>
          <div class="hstat"><b>2</b><span>Anggota tim (PPA & Pekarya)</span></div>
        ` : `
          <div class="hstat"><b>${aktif.length}</b><span>Tugas aktif</span></div>
          <div class="hstat"><b>${myReports.length}</b><span>Laporan bulan ini</span></div>
          <div class="hstat"><b>${myReports.filter(r=>r.status==='disetujui').length}</b><span>Disetujui pengamat</span></div>
          <div class="hstat"><b>${attPct}%</b><span>Kehadiran bulan ini</span></div>
        `}
      </div>
    </section>

    <div class="qa-grid mt">
      <button class="qa" data-go="kamera"><span class="qic c1">${I('camera')}</span>Kamera</button>
      <button class="qa" data-go="tugas"><span class="qic c2">${I('task')}</span>Tugas ${bc.tugas?`<span class="sb-badge">${bc.tugas}</span>`:''}</button>
      <button class="qa" data-go="peta"><span class="qic c3">${I('map')}</span>Peta</button>
      <button class="qa" data-go="rapor"><span class="qic c4">${I('report')}</span>Rapor</button>
      <button class="qa" data-act="absen"><span class="qic c3">${I('cal')}</span>Absensi</button>
      ${peng?`<button class="qa" data-go="setuju"><span class="qic c6">${I('check')}</span>Persetujuan ${bc.setuju?`<span class="sb-badge">${bc.setuju}</span>`:''}</button>`:''}
      <button class="qa" data-go="profil"><span class="qic c5">${I('user')}</span>Profil</button>
    </div>

    <div id="abs-card" class="mt"></div>

    <div class="dash-cols mt">
      <div class="card" id="cal-card"></div>
      <div id="cal-detail"></div>
    </div>

    <div id="beranda-extra" class="mt"></div>`;

  U.$$('[data-go]', m).forEach(b=>b.onclick=()=>setRoute(b.dataset.go));
  U.$$('[data-act="absen"]', m).forEach(b=>b.onclick=()=>absensiModal());
  U.$('#hero-ava', m).onclick = ()=>setRoute('profil');
  if(!S.cal) S.cal = { y:now.getFullYear(), m:now.getMonth(), sel:U.today() };
  renderCalendar();
  renderDayDetail();
  renderAbsensiCard();
  renderBerandaExtra();
}

/* ---- kalender bulanan + detail hari (riwayat/tugas/rekap) ---- */
function renderCalendar(){
  const card = U.$('#cal-card'); if(!card) return;
  const { y, m } = S.cal;
  const first = new Date(y, m, 1);
  const startIdx = (first.getDay()+6)%7;
  const dim = new Date(y, m+1, 0).getDate();
  const prevDim = new Date(y, m, 0).getDate();
  const ev = {};
  const put = (iso,k)=>{ (ev[iso]=ev[iso]||[]).push(k); };
  S.tasks.forEach(t=>{ if(t.tenggat.startsWith(`${y}-${U.pad(m+1)}`)) put(t.tenggat,'task'); });
  S.reports.forEach(r=>{
    const d = r.waktu.slice(0,10);
    if(d.startsWith(`${y}-${U.pad(m+1)}`)) put(d, (r.status==='disetujui'||r.status==='dokumentasi')?'ok':'rep');
  });
  for(let d=1; d<=dim; d++){
    const iso = `${y}-${U.pad(m+1)}-${U.pad(d)}`;
    const a = attFor(curUser().id, iso);
    if(a && !['H','DL'].includes(a)) put(iso,'off');
  }
  let cells = '';
  for(let i=0;i<startIdx;i++) cells += `<button class="cal-cell out" disabled>${prevDim-startIdx+1+i}</button>`;
  for(let d=1; d<=dim; d++){
    const iso = `${y}-${U.pad(m+1)}-${U.pad(d)}`;
    const dots = (ev[iso]||[]).slice(0,3);
    cells += `<button class="cal-cell ${iso===U.today()?'today':''} ${iso===S.cal.sel?'sel':''}" data-d="${iso}">
      ${d}<span class="cal-dots">${dots.map(k=>`<i class="dot-t-${k}"></i>`).join('')}</span></button>`;
  }
  const rest = (startIdx+dim)%7;
  if(rest) for(let i=1;i<=7-rest;i++) cells += `<button class="cal-cell out" disabled>${i}</button>`;

  card.innerHTML = `
    <div class="card-t"><div><h3>Kalender Kegiatan</h3><div class="sub">${U.monthsID[m]} ${y} — riwayat, tugas & laporan</div></div>
      <div class="cal-nav">
        <button class="btn icon ghost" id="cal-prev" aria-label="Bulan sebelumnya">‹</button>
        <button class="btn icon ghost" id="cal-next" aria-label="Bulan berikutnya">›</button>
      </div></div>
    <div class="cal-grid">
      ${U.daysID.map(d=>`<div class="cal-dow">${d.slice(0,3)}</div>`).join('')}
      ${cells}
    </div>
    <div class="cal-legend">
      <span><i class="dot-t-task"></i>Tenggat tugas</span>
      <span><i class="dot-t-rep"></i>Laporan dibuat</span>
      <span><i class="dot-t-ok"></i>Disetujui/dok.</span>
      <span><i class="dot-t-off"></i>S/I/C/A</span>
    </div>`;
  U.$('#cal-prev').onclick = ()=>{ S.cal.m--; if(S.cal.m<0){ S.cal.m=11; S.cal.y--; } save(); renderCalendar(); };
  U.$('#cal-next').onclick = ()=>{ S.cal.m++; if(S.cal.m>11){ S.cal.m=0; S.cal.y++; } save(); renderCalendar(); };
  U.$$('.cal-cell[data-d]', card).forEach(b=>b.onclick=()=>{ S.cal.sel=b.dataset.d; save(); renderCalendar(); renderDayDetail(); });
}
function renderDayDetail(){
  const box = U.$('#cal-detail'); if(!box) return;
  const iso = S.cal.sel || U.today();
  const u = curUser();
  const d = new Date(iso+'T00:00:00');
  const a = attFor(u.id, iso);
  const ab = absensiReq(u.id, iso);
  const tasksToday = S.tasks.filter(t=>t.petugasId===u.id && (t.tenggat===iso || t.createdAt.slice(0,10)===iso));
  const repsToday = S.reports.filter(r=>r.waktu.slice(0,10)===iso && (r.petugasId===u.id || u.role==='pengamat'));
  const apprToday = u.role==='pengamat' ? S.reports.filter(r=>r.feedbackAt && r.feedbackAt.slice(0,10)===iso) : [];
  box.innerHTML = `
    <div class="card" style="height:100%">
      <div class="card-t"><div><h3>${U.hari(d)}, ${U.fmtID(iso)}</h3><div class="sub">Riwayat & rekap kerja hari itu</div></div>
        ${a?`<span class="chip mini ${a==='H'?'ok':a==='DL'?'info':'bad'}">${a} — ${ATT_LABEL[a]}</span>`:`<span class="chip mini muted">Bukan hari kerja</span>`}
      </div>
      ${ab?`<div class="dd-row"><span class="dd-ic" style="background:${ABS_BG[ab.kode]||'var(--surface-3)'};color:${ABS_IC[ab.kode]||'var(--text-2)'}"><b style="font-size:.68rem">${ab.kode}</b></span>
          <div style="flex:1;min-width:0"><b>Pengajuan ${ATT_LABEL[ab.kode]}${ab.status==='menunggu'?' (menunggu persetujuan)':''}</b><span>${U.esc(ab.alasan||'—')}${ab.surat?` • ${U.esc(ab.surat)}`:''}</span></div>${stChip(ab.status)}</div>`:''}
      ${tasksToday.length?tasksToday.map(t=>`
        <div class="dd-row"><span class="dd-ic" style="background:var(--warn-soft);color:var(--warn)">${I('task')}</span>
          <div style="flex:1;min-width:0"><b>${U.esc(t.title)}</b><span>${U.esc(t.jenis)} • ${U.esc(t.lokasi)}</span></div>${stChip(t.status)}</div>`).join('')
        :`<div class="empty">${I('cal')}<div>Tidak ada tugas pada tanggal ini.</div></div>`}
      ${repsToday.length?`<hr class="sep">`+repsToday.map(r=>`
        <div class="dd-row"><span class="dd-ic" style="background:var(--info-soft);color:var(--info)">${I('camera')}</span>
          <div style="flex:1;min-width:0"><b>${U.esc(r.lokasi)}${r.tahap!=null?` — ${r.tahap}%`:''}</b><span>${U.esc(userById(r.petugasId).nama)} • ${U.fmtDT(r.waktu)}</span></div>${stChip(r.status)}</div>`).join('')
        :''}
      ${apprToday.length?`<hr class="sep">`+apprToday.map(r=>`
        <div class="dd-row"><span class="dd-ic" style="background:var(--ok-soft);color:var(--ok)">${I('check')}</span>
          <div style="flex:1;min-width:0"><b>Verifikasi: ${U.esc(r.lokasi)}</b><span>${U.esc(userById(r.petugasId).nama)}</span></div>${stChip(r.status)}</div>`).join('')
        :''}
    </div>`;
}
/* ---------------- KEHADIRAN & PENGAJUAN IZIN/SAKIT/CUTI/DL ---------------- */
const ABS_IC  = { H:'var(--ok)', DL:'var(--info)', S:'var(--warn)', I:'var(--violet)', C:'var(--text-3)', A:'var(--bad)' };
const ABS_BG  = { H:'var(--ok-soft)', DL:'var(--info-soft)', S:'var(--warn-soft)', I:'var(--violet-soft)', C:'var(--surface-3)', A:'var(--bad-soft)' };
function renderAbsensiCard(){
  const box = U.$('#abs-card'); if(!box) return;
  const u = curUser();
  const now = new Date();
  const att = attRange(u.id, new Date(now.getFullYear(), now.getMonth(), 1), now).att;
  const mine = S.absensi.filter(a=>a.userId===u.id).sort((a,b)=>b.tanggal.localeCompare(a.tanggal));
  const today = U.today();
  const aToday = attFor(u.id, today);
  const tReq = absensiReq(u.id, today);
  const peng = u.role==='pengamat';
  box.innerHTML = `
    <div class="card">
      <div class="card-t">
        <div><h3>Kehadiran & Pengajuan Izin</h3>
          <div class="sub">Status hari ini, rekap bulan berjalan & pengajuan S/I/C/DL</div></div>
        <button class="btn primary sm" id="ab-add">${I('plus')} Ajukan</button>
      </div>
      <div class="row" style="gap:8px;margin-bottom:12px">
        ${aToday?`<span class="chip ok">${I('check')} Hari ini: ${aToday} — ${ATT_LABEL[aToday]}</span>`
                :`<span class="chip muted">${I('cal')} Hari ini: belum ada rekap</span>`}
        ${tReq&&tReq.status==='menunggu'?`<span class="chip warn">${I('clock')} Pengajuan ${tReq.kode} menunggu persetujuan</span>`:''}
      </div>
      <div class="att-mini">
        ${['H','DL','I','S','C','A'].map(k=>`<div class="am"><b class="mono">${att[k]}</b><span>${k}</span></div>`).join('')}
      </div>
      <div class="small muted" style="margin:7px 2px 0">H hadir • DL dinas luar • I izin • S sakit • C cuti • A tanpa keterangan — bulan berjalan.</div>
      ${mine.length?`<hr class="sep"><div class="list">${mine.slice(0,4).map(absRow).join('')}</div>`
                  :`<hr class="sep"><div class="empty">${I('check')}<div>Belum ada pengajuan kehadiran.</div></div>`}
      ${peng?`<p class="note mt">${I('info')} Pengajuan Izin/Sakit/Cuti PPA & Pekarya diverifikasi di menu <b>Persetujuan → tab Kehadiran</b>.</p>`
            :`<p class="note mt">${I('info')} Pengajuan diverifikasi Staf Pengamat. Setelah <b>disetujui</b>, status otomatis menggantikan rekap pada kalender & rapor kinerja (surat sakit/cuti menjadi dasar perubahan status).</p>`}
    </div>`;
  U.$('#ab-add', box).onclick = ()=>absensiModal();
  U.$$('[data-abcan]', box).forEach(b=>b.onclick=()=>{
    const ab = S.absensi.find(x=>x.id===b.dataset.abcan); if(!ab) return;
    confirmMod('Batalkan Pengajuan?', `Pengajuan ${ab.kode} — ${U.fmtID(ab.tanggal)} akan dihapus dari daftar.`, 'Batalkan', ()=>{
      S.absensi = S.absensi.filter(x=>x.id!==ab.id); save(); renderPage(); toast('Pengajuan dibatalkan.','warn');
    }, false);
  });
}
function absRow(ab){
  return `
    <div class="dd-row">
      <span class="dd-ic" style="background:${ABS_BG[ab.kode]||'var(--surface-3)'};color:${ABS_IC[ab.kode]||'var(--text-2)'}"><b style="font-size:.68rem">${ab.kode}</b></span>
      <div style="flex:1;min-width:0"><b>${ab.kode} — ${ATT_LABEL[ab.kode]} • ${U.fmtID(ab.tanggal)}</b>
        <span>${U.esc(ab.alasan||'—')}${ab.surat?` • No. surat: ${U.esc(ab.surat)}`:''}</span></div>
      ${stChip(ab.status)}
      ${ab.status==='menunggu'?`<button class="btn sm ghost" data-abcan="${ab.id}">Batalkan</button>`:''}
    </div>`;
}
function absensiModal(){
  const u = curUser();
  const isPeng = u.role==='pengamat';
  const suratLabel = { I:'No. surat izin (opsional)', S:'No. surat keterangan dokter (opsional)', C:'No. surat cuti — form CUTI-1 (opsional)', DL:'No. SPPD / SPT dinas (opsional)' };
  const m2 = modal(`
    <h3>${isPeng?'Catat Kehadiran':'Pengajuan Kehadiran'}</h3>
    <p class="muted small">${isPeng
      ?'Catat Izin, Sakit, Cuti, atau Dinas Luar Anda — langsung masuk rekap kehadiran (simulasi persetujuan atasan).'
      :'Ajukan Izin, Sakit, Cuti, atau catat Dinas Luar. Setelah disetujui Staf Pengamat, status pada tanggal itu otomatis diperbarui di kalender & rapor kinerja.'}</p>
    <div class="field"><label>Jenis pengajuan</label><span class="seg" id="ab-kind">
      <button class="seg-btn on" data-v="I">Izin</button>
      <button class="seg-btn" data-v="S">Sakit</button>
      <button class="seg-btn" data-v="C">Cuti</button>
      <button class="seg-btn" data-v="DL">Dinas Luar</button>
    </span></div>
    <div class="field"><label>Tanggal</label><input type="date" id="ab-tgl" value="${U.today()}" min="${U.isoOff(-30)}" max="${U.isoOff(60)}"></div>
    <div class="field"><label>Alasan / keterangan</label><textarea id="ab-al" placeholder="Contoh: demam 2 hari, surat keterangan dokter terlampir…"></textarea></div>
    <div class="field"><label id="ab-sl">${suratLabel.I}</label><input id="ab-surat" placeholder="Contoh: SND/RSD-PKL/2026/0412"></div>
    <div class="m-actions"><button class="btn ghost" data-close>Batal</button>
      <button class="btn primary" id="ab-ok">${I('check')} ${isPeng?'Simpan':'Kirim Pengajuan'}</button></div>`);
  let kode = 'I';
  const kindEl = m2.ov.querySelector('#ab-kind');
  U.$$('.seg-btn', kindEl).forEach(b=>b.onclick=()=>{
    kode = b.dataset.v;
    U.$$('.seg-btn', kindEl).forEach(x=>x.classList.toggle('on',x===b));
    m2.ov.querySelector('#ab-sl').textContent = suratLabel[kode];
  });
  m2.ov.querySelector('#ab-ok').onclick = ()=>{
    const tgl = m2.ov.querySelector('#ab-tgl').value;
    const alasan = m2.ov.querySelector('#ab-al').value.trim();
    const surat = m2.ov.querySelector('#ab-surat').value.trim();
    if(!tgl){ toast('Tanggal wajib dipilih.','warn'); return; }
    if(!alasan){ toast('Alasan / keterangan wajib diisi.','warn'); return; }
    if(S.absensi.some(a=>a.userId===u.id && a.tanggal===tgl)){ toast('Sudah ada pengajuan kehadiran pada tanggal itu. Batalkan dulu jika ingin mengubah.','err'); return; }
    S.absensi.unshift({ id:U.uid('ab'), userId:u.id, tanggal:tgl, kode, alasan, surat,
      status: isPeng?'disetujui':'menunggu',
      feedback: isPeng?'Tercatat langsung oleh pejabat penyelia (simulasi).':'',
      createdAt:new Date().toISOString(),
      decidedAt: isPeng?new Date().toISOString():null,
      decidedBy: isPeng?u.id:null });
    save(); m2.close();
    toast(isPeng?'Kehadiran tercatat & masuk rekap.':'Pengajuan terkirim ke Staf Pengamat.', 'ok');
    renderPage();
  };
}

function renderBerandaExtra(){
  const box = U.$('#beranda-extra'); if(!box) return;
  const u = curUser();
  if(u.role==='pengamat'){
    const pending = S.reports.filter(r=>r.status==='menunggu').slice(0,3);
    const now = new Date();
    const team = USERS.filter(x=>x.role!=='pengamat').map(x=>{
      const R = computeRapor(x.id, 1);
      const aktif = S.tasks.filter(t=>t.petugasId===x.id && ['baru','dikerjakan','revisi'].includes(t.status)).length;
      return `<div class="dd-row">${ava(x,'md')}
        <div style="flex:1;min-width:0"><b>${U.esc(x.nama)}</b><span>${U.esc(x.roleLabel)} • ${aktif} tugas aktif • ${R.approved.length} laporan disetujui bln ini</span></div>
        <span class="chip ${R.predikat.cls}">${R.akhir.toFixed(1).replace('.',',')} — ${R.predikat.label}</span></div>`;
    }).join('');
    box.innerHTML = `
      <div class="grid2">
        <div class="card">
          <div class="card-t"><h3>Menunggu Persetujuan</h3><button class="btn soft sm" data-go="setuju">Buka Semua</button></div>
          ${pending.length?pending.map(r=>`
            <div class="dd-row">${ava(userById(r.petugasId),'md')}
              <div style="flex:1;min-width:0"><b>${U.esc(r.lokasi)}${r.tahap!=null?` — ${r.tahap}%`:''}</b>
              <span>${U.esc(userById(r.petugasId).nama)} • ${U.fmtDT(r.waktu)}</span></div>
              ${stChip(r.status)}</div>`).join('')
            :`<div class="empty">${I('check')}<div>Semua laporan sudah diverifikasi. 🎉</div></div>`}
        </div>
        <div class="card">
          <div class="card-t"><h3>Ringkasan Tim (bulan ini)</h3></div>
          ${team}
        </div>
      </div>`;
  }else{
    const next = S.tasks.filter(t=>t.petugasId===u.id && ['baru','dikerjakan','revisi'].includes(t.status))
      .sort((a,b)=>a.tenggat.localeCompare(b.tenggat)).slice(0,3);
    box.innerHTML = `
      <div class="card">
        <div class="card-t"><h3>Tugas Terdekat</h3><button class="btn soft sm" data-go="tugas">Lihat Semua</button></div>
        ${next.length?next.map(t=>`
          <div class="dd-row"><span class="dd-ic" style="background:var(--brand-soft);color:var(--brand)">${I('task')}</span>
            <div style="flex:1;min-width:0"><b>${U.esc(t.title)}</b><span>${U.esc(t.jenis)} • ${U.esc(t.lokasi)}</span></div>
            ${lateChip(t)}</div>`).join('')
          :`<div class="empty">${I('check')}<div>Tidak ada tugas aktif. Mantap!</div></div>`}
      </div>`;
  }
  U.$$('#beranda-extra [data-go]').forEach(b=>b.onclick=()=>setRoute(b.dataset.go));
}

/* ---------------- TUGAS ---------------- */
function renderTugas(m){
  const u = curUser();
  const peng = u.role==='pengamat';
  const tasks = peng
    ? S.tasks.filter(t=>t.dariPengamat===u.id)
    : S.tasks.filter(t=>t.petugasId===u.id);
  const aktif = tasks.filter(t=>['baru','dikerjakan','revisi'].includes(t.status));
  const selesai = tasks.filter(t=>['selesai','diverifikasi'].includes(t.status));
  if(!S.tugasFilter) S.tugasFilter = 'semua';
  const shown = S.tugasFilter==='aktif'?aktif:S.tugasFilter==='selesai'?selesai:tasks;

  m.innerHTML = `
    <div class="card">
      <div class="card-t">
        <div><h3>${peng?'Tugas yang Saya Berikan':'Tugas Saya'}</h3>
          <div class="sub">${peng?'Kelola penugasan untuk PPA & Pekarya':'Daftar tugas dari Staf Pengamat'}</div></div>
        ${peng?`<button class="btn primary sm" id="tg-add">${I('plus')} Buat Tugas</button>`:''}
      </div>
      <div class="row" style="margin-bottom:12px">
        <span class="seg" id="tg-filter">
          <button class="seg-btn ${S.tugasFilter==='semua'?'on':''}" data-v="semua">Semua (${tasks.length})</button>
          <button class="seg-btn ${S.tugasFilter==='aktif'?'on':''}" data-v="aktif">Aktif (${aktif.length})</button>
          <button class="seg-btn ${S.tugasFilter==='selesai'?'on':''}" data-v="selesai">Selesai (${selesai.length})</button>
        </span>
      </div>
      <div class="list">${shown.length?shown.map(t=>taskCard(t,u)).join(''):`<div class="empty">${I('task')}<div>Belum ada tugas pada filter ini.</div></div>`}</div>
    </div>`;

  U.$$('#tg-filter .seg-btn', m).forEach(b=>b.onclick=()=>{ S.tugasFilter=b.dataset.v; save(); renderPage(); });
  const add = U.$('#tg-add', m); if(add) add.onclick = ()=>tugasFormModal();
  bindTaskActions(m, u);
}
function taskCard(t, viewer){
  const petugas = userById(t.petugasId);
  const peng = viewer.role==='pengamat';
  const fb = t.status==='revisi'
    ? (S.reports.filter(r=>r.tugasId===t.id && r.status==='revisi').slice(-1)[0])
    : null;
  let actions = '';
  if(!peng){
    if(t.status==='baru') actions += `<button class="btn sm primary" data-act="mulai" data-id="${t.id}">${I('chev')} Mulai Kerjakan</button>`;
    if(t.status==='dikerjakan'){
      actions += `<button class="btn sm primary" data-act="kamera" data-id="${t.id}">${I('camera')} Laporan Kamera</button>
        <button class="btn sm ghost" data-act="selesai" data-id="${t.id}">${I('check')} Selesai (tanpa foto)</button>`;
    }
    if(t.status==='revisi') actions += `<button class="btn sm warn" data-act="kamera" data-id="${t.id}">${I('camera')} Perbaiki & Laporkan Ulang</button>`;
    if(t.status==='selesai') actions += `<span class="chip mini warn">${I('clock')} Menunggu verifikasi Pengamat</span>`;
  }else{
    actions += `<button class="btn sm ghost" data-act="ingat" data-id="${t.id}">${I('bell')} Ingatkan</button>
      <button class="btn sm ghost" data-act="hapus" data-id="${t.id}">${I('trash')}</button>`;
  }
  return `
    <div class="tcard">
      ${ava(petugas,'md')}
      <div class="tc-body">
        <h4>${U.esc(t.title)}</h4>
        <div class="meta">
          ${stChip(t.status)} ${priChip(t.prioritas)}
          <span class="chip mini violet">${U.esc(t.jenis)}</span>
          ${lateChip(t)}
        </div>
        <div class="small muted">${I('pin')} ${U.esc(t.lokasi)} • Dibuat ${U.fmtDT(t.createdAt)}</div>
        ${t.catatan?`<div class="small muted" style="margin-top:4px">${I('info')} ${U.esc(t.catatan)}</div>`:''}
        ${fb&&fb.feedback?`<div class="fb-box">${I('info')} Catatan Pengamat: ${U.esc(fb.feedback)}</div>`:''}
        <div class="foot">${actions}</div>
      </div>
    </div>`;
}
function bindTaskActions(root, u){
  U.$$('[data-act]', root).forEach(b=>b.onclick=()=>{
    const t = S.tasks.find(x=>x.id===b.dataset.id); if(!t) return;
    switch(b.dataset.act){
      case 'mulai': t.status='dikerjakan'; save(); toast('Tugas dimulai. Semangat!','ok'); renderPage(); break;
      case 'kamera':
        window.__camPrefill = { lokasiId:t.lokasiId, taskId:t.id, note:'' };
        setRoute('kamera'); break;
      case 'selesai': finishTaskModal(t); break;
      case 'ingat': toast(`Notifikasi terkirim ke ${userById(t.petugasId).nama} (simulasi).`,'ok'); break;
      case 'hapus':
        confirmMod('Hapus Tugas?', `"${t.title}" akan dihapus dari daftar.`, 'Hapus', ()=>{
          S.tasks = S.tasks.filter(x=>x.id!==t.id); save(); renderPage();
        }); break;
    }
  });
}
function finishTaskModal(t){
  const m2 = modal(`<h3>Selesaikan Tugas</h3>
    <p class="muted small">${U.esc(t.title)} — laporan ringkas akan dikirim ke Staf Pengamat (tanpa foto).</p>
    <div class="field"><label>Catatan penyelesaian</label><textarea id="ft-note" placeholder="Contoh: pekerjaan selesai 100%, tidak ada temuan."></textarea></div>
    <div class="m-actions"><button class="btn ghost" data-close>Batal</button>
      <button class="btn ok" id="ft-ok">${I('check')} Kirim Laporan</button></div>`);
  m2.ov.querySelector('#ft-ok').onclick = ()=>{
    S.reports.unshift({
      id:U.uid('r'), petugasId:t.petugasId, tugasId:t.id, lokasi:t.lokasi, lokasiId:t.lokasiId,
      tahap:null, waktu:new Date().toISOString(), catatan:m2.ov.querySelector('#ft-note').value||'',
      status:'menunggu', foto:null, fotoFull:null, feedback:'', feedbackAt:null
    });
    t.status='selesai'; save(); m2.close();
    toast('Laporan ringkas dikirim ke Staf Pengamat.','ok'); renderPage();
  };
}
function tugasFormModal(prefLoc){
  const petugasOpts = USERS.filter(x=>x.role!=='pengamat')
    .map(x=>`<option value="${x.id}">${U.esc(x.nama)} — ${U.esc(x.roleLabel)}</option>`).join('');
  const lokOpts = [
    `<optgroup label="Pintu Air">${GEO.pintu.map(p=>`<option value="${p.id}">${U.esc(p.nama)}</option>`).join('')}</optgroup>`,
    `<optgroup label="Saluran">${GEO.saluran.map(s=>`<option value="${s.id}">${U.esc(s.nama)}</option>`).join('')}</optgroup>`,
    `<optgroup label="Daerah Irigasi">${GEO.dis.map(d=>`<option value="${d.id}">${U.esc(d.nama)}</option>`).join('')}</optgroup>`
  ].join('');
  const m2 = modal(`
    <h3>Buat Tugas Baru</h3>
    <p class="muted small">Tugas akan muncul di aplikasi petugas terkait (simulasi).</p>
    <div class="field"><label>Petugas</label><select id="tf-petugas">${petugasOpts}</select></div>
    <div class="field"><label>Jenis tugas</label><select id="tf-jenis">${JENIS.map(j=>`<option>${j}</option>`).join('')}</select></div>
    <div class="field"><label>Lokasi / objek</label><select id="tf-lok">${lokOpts}</select></div>
    <div class="field"><label>Judul tugas</label><input id="tf-title" placeholder="Contoh: Operasi pintu air BA-3 tahap I"></div>
    <div class="field"><label>Tenggat</label><input id="tf-tg" type="date" min="${U.today()}" value="${U.isoOff(2)}"></div>
    <div class="field"><label>Prioritas</label><span class="seg" id="tf-prio">
      <button class="seg-btn" data-v="Rendah">Rendah</button>
      <button class="seg-btn on" data-v="Sedang">Sedang</button>
      <button class="seg-btn" data-v="Tinggi">Tinggi</button></span></div>
    <div class="field"><label>Catatan (opsional)</label><textarea id="tf-note" placeholder="Instruksi tambahan…"></textarea></div>
    <div class="m-actions"><button class="btn ghost" data-close>Batal</button>
      <button class="btn primary" id="tf-ok">${I('task')} Terbitkan Tugas</button></div>`);
  let prio = 'Sedang';
  U.$$('.seg-btn', m2.ov.querySelector('#tf-prio')).forEach(b=>b.onclick=()=>{
    prio = b.dataset.v;
    U.$$('.seg-btn', m2.ov.querySelector('#tf-prio')).forEach(x=>x.classList.toggle('on',x===b));
  });
  if(prefLoc) m2.ov.querySelector('#tf-lok').value = prefLoc;
  m2.ov.querySelector('#tf-ok').onclick = ()=>{
    const title = m2.ov.querySelector('#tf-title').value.trim();
    if(!title){ toast('Judul tugas wajib diisi.','warn'); return; }
    const locId = m2.ov.querySelector('#tf-lok').value;
    S.tasks.unshift({
      id:U.uid('t'), title, jenis:m2.ov.querySelector('#tf-jenis').value,
      petugasId:m2.ov.querySelector('#tf-petugas').value, dariPengamat:S.session.userId,
      lokasiId:locId, lokasi:lokasiLabel(locId), prioritas:prio,
      tenggat:m2.ov.querySelector('#tf-tg').value||U.isoOff(2),
      status:'baru', catatan:m2.ov.querySelector('#tf-note').value||'',
      createdAt:new Date().toISOString()
    });
    save(); m2.close();
    toast('Tugas diterbitkan ke petugas.','ok');
    if(S.route==='tugas') renderPage();
  };
}

/* ---------------- PERSETUJUAN (STAF PENGAMAT) ---------------- */
function renderSetuju(m){
  const u = curUser();
  if(u.role!=='pengamat'){ setRoute('tugas'); return; }
  if(!S.apprTab || (S.apprTab!=='kehadiran' && !['menunggu','disetujui','revisi','ditolak'].includes(S.apprTab))) S.apprTab = 'menunggu';
  const all = S.reports.filter(r=>r.status!=='dokumentasi');
  const groups = {
    menunggu: all.filter(r=>r.status==='menunggu'),
    disetujui: all.filter(r=>r.status==='disetujui'),
    revisi: all.filter(r=>r.status==='revisi'),
    ditolak: all.filter(r=>r.status==='ditolak')
  };
  const shown = groups[S.apprTab] || [];
  const absAll = S.absensi.slice().sort((a,b)=>
    (a.status==='menunggu'?0:1)-(b.status==='menunggu'?0:1) ||
    b.tanggal.localeCompare(a.tanggal) || b.createdAt.localeCompare(a.createdAt));
  const absPending = S.absensi.filter(a=>a.status==='menunggu').length;
  m.innerHTML = `
    <div class="card">
      <div class="card-t">
        <div><h3>Persetujuan Laporan Lapangan</h3>
          <div class="sub">Verifikasi laporan PPA & Pekarya — foto, tahap progres, catatan & kehadiran</div></div>
        <button class="btn primary sm" id="ap-add">${I('plus')} Buat Tugas</button>
      </div>
      <div class="tabs">
        ${Object.entries(groups).map(([k,v])=>`<button class="tab ${S.apprTab===k?'on':''}" data-t="${k}">${ST[k][0]} <span class="cnt">${v.length}</span></button>`).join('')}
        <button class="tab ${S.apprTab==='kehadiran'?'on':''}" data-t="kehadiran">Kehadiran <span class="cnt">${absPending}</span></button>
      </div>
      ${S.apprTab==='menunggu' && shown.length?`<p class="note mb" style="margin-bottom:12px">${I('info')} Laporan disetujui otomatis masuk ke rapor kinerja petugas & kalender.</p>`:''}
      ${S.apprTab==='kehadiran'
        ? `<p class="note mb" style="margin-bottom:12px">${I('info')} Setujui/menolak pengajuan Izin, Sakit, Cuti & Dinas Luar PPA/Pekarya. Yang <b>disetujui</b> langsung menggantikan status tanggal tsb pada kalender & rekap rapor (dasar: surat dokter/cuti/SPPD).</p>
           <div class="list">${absAll.length?absAll.map(absReqCard).join(''):`<div class="empty">${I('check')}<div>Belum ada pengajuan kehadiran.</div></div>`}</div>`
        : `<div class="list">${shown.length?shown.map(r=>apprCard(r)).join(''):`<div class="empty">${I('check')}<div>Tidak ada laporan pada tab ini.</div></div>`}</div>`}
    </div>`;
  U.$$('.tab', m).forEach(b=>b.onclick=()=>{ S.apprTab=b.dataset.t; save(); renderPage(); });
  U.$('#ap-add', m).onclick = ()=>tugasFormModal();
  U.$$('.thumb', m).forEach(img=>img.onclick=()=>lightbox(img.dataset.full||img.src, img.dataset.cap));
  U.$$('[data-ract]', m).forEach(b=>b.onclick=()=>reportAction(b.dataset.rid, b.dataset.ract));
  U.$$('[data-abact]', m).forEach(b=>b.onclick=()=>absensiAction(b.dataset.abid, b.dataset.abact));
}
function absReqCard(ab){
  const usr = userById(ab.userId);
  const act = ab.status==='menunggu'
    ? `<button class="btn sm ok" data-abact="setuju" data-abid="${ab.id}">${I('check')} Setujui</button>
       <button class="btn sm danger" data-abact="tolak" data-abid="${ab.id}">${I('x')} Tolak</button>`
    : (ab.feedback?`<div class="fb-box ${ab.status==='disetujui'?'okb':'badb'}">${I('info')} ${U.esc(ab.feedback)} — ${ab.decidedAt?U.fmtDT(ab.decidedAt):''}</div>`:'');
  return `
    <div class="tcard">
      ${ava(usr,'md')}
      <div class="tc-body">
        <div class="row" style="gap:8px"><b style="font-size:.9rem">${U.esc(usr.nama)}</b><span class="chip mini muted">${U.esc(usr.roleLabel)}</span></div>
        <h4 style="margin-top:8px">${ab.kode} — ${ATT_LABEL[ab.kode]} • ${U.fmtID(ab.tanggal)}</h4>
        <div class="meta">${stChip(ab.status)}
          ${ab.surat?`<span class="chip mini violet">${I('report')} ${U.esc(ab.surat)}</span>`:''}
          <span class="chip mini muted">${I('clock')} Diajukan ${U.fmtDT(ab.createdAt)}</span></div>
        <div class="small muted">${U.esc(ab.alasan||'—')}</div>
        ${act?`<div class="foot">${act}</div>`:''}
      </div>
    </div>`;
}
function absensiAction(id, act){
  const ab = S.absensi.find(x=>x.id===id); if(!ab) return;
  if(act==='setuju'){
    ab.status='disetujui';
    ab.feedback = ab.feedback || 'Pengajuan kehadiran disetujui — rekap & rapor pegawai telah diperbarui.';
    ab.decidedAt = new Date().toISOString(); ab.decidedBy = S.session.userId;
    save(); toast(`Pengajuan ${ATT_LABEL[ab.kode]} ${userById(ab.userId).nama.split(',')[0]} disetujui.`,'ok');
    renderPage(); renderNav();
  }else{
    const m2 = modal(`<h3>Tolak Pengajuan Kehadiran</h3>
      <p class="muted small">${U.esc(userById(ab.userId).nama)} — ${ab.kode} • ${U.fmtID(ab.tanggal)}. Alasan akan tampil di aplikasi petugas.</p>
      <div class="field"><label>Alasan penolakan</label><textarea id="ab-note" placeholder="Contoh: surat keterangan dokter belum dilampirkan…"></textarea></div>
      <div class="m-actions"><button class="btn ghost" data-close>Batal</button>
        <button class="btn danger" id="ab-no">${I('x')} Tolak</button></div>`);
    m2.ov.querySelector('#ab-no').onclick = ()=>{
      const note = m2.ov.querySelector('#ab-note').value.trim();
      if(!note){ toast('Alasan wajib diisi.','warn'); return; }
      ab.status='ditolak'; ab.feedback=note; ab.decidedAt=new Date().toISOString(); ab.decidedBy=S.session.userId;
      save(); m2.close(); toast('Pengajuan ditolak.','err'); renderPage(); renderNav();
    };
  }
}
function apprCard(r){
  const pet = userById(r.petugasId);
  const src = r.foto || window.PHOTO_CACHE[r.fotoFull] || null;
  const t = r.tugasId ? S.tasks.find(x=>x.id===r.tugasId) : null;
  const act = r.status==='menunggu'
    ? `<button class="btn sm ok" data-ract="setuju" data-rid="${r.id}">${I('check')} Setujui</button>
       <button class="btn sm warn" data-ract="revisi" data-rid="${r.id}">${I('edit')} Minta Revisi</button>
       <button class="btn sm danger" data-ract="tolak" data-rid="${r.id}">${I('x')} Tolak</button>`
    : (r.feedback?`<div class="fb-box ${r.status==='disetujui'?'okb':r.status==='ditolak'?'badb':''}">${I('info')} ${U.esc(r.feedback)} — ${r.feedbackAt?U.fmtDT(r.feedbackAt):''}</div>`:'');
  return `
    <div class="tcard">
      ${src?`<img class="thumb" src="${src}" data-cap="${U.esc(pet.nama)} — ${U.esc(r.lokasi)}" alt="Foto laporan">`
           :`<div class="thumb-ph">${I('img')}<span>Foto dalam antrian offline</span></div>`}
      <div class="tc-body">
        <div class="row" style="gap:8px">${ava(pet,'sm')}<b style="font-size:.9rem">${U.esc(pet.nama)}</b><span class="chip mini muted">${U.esc(pet.roleLabel)}</span></div>
        <h4 style="margin-top:8px">${U.esc(r.lokasi)}${r.tahap!=null?` — Tahap ${r.tahap}%`:' — Laporan Umum'}</h4>
        <div class="meta">${stChip(r.status)}<span class="chip mini muted">${I('clock')} ${U.fmtDT(r.waktu)}</span>${t?`<span class="chip mini violet">${U.esc(t.jenis)}</span>`:''}</div>
        ${r.catatan?`<div class="small muted">“${U.esc(r.catatan)}”</div>`:''}
        ${act?`<div class="foot">${act}</div>`:''}
      </div>
    </div>`;
}
function lightbox(src, cap){
  const m2 = modal(`<img src="${src}" alt="${U.esc(cap||'Foto')}" style="border-radius:16px;width:100%">
    <p class="center small muted" style="margin-top:10px">${U.esc(cap||'')} — foto ber-watermark GPS & waktu</p>
    <div class="m-actions"><button class="btn ghost" data-close>Tutup</button></div>`);
  return m2;
}
function reportAction(id, act){
  const r = S.reports.find(x=>x.id===id); if(!r) return;
  if(act==='setuju'){
    r.status='disetujui'; r.feedback = r.feedback || 'Laporan diverifikasi & disetujui.'; r.feedbackAt=new Date().toISOString();
    const t = S.tasks.find(x=>x.id===r.tugasId); if(t) t.status='diverifikasi';
    save(); toast('Laporan disetujui — masuk ke rapor petugas.','ok'); renderPage(); renderNav();
  }else{
    const label = act==='revisi' ? 'Minta Revisi' : 'Tolak Laporan';
    const m2 = modal(`<h3>${label}</h3>
      <p class="muted small">Alasan akan tampil di aplikasi ${U.esc(userById(r.petugasId).nama)}.</p>
      <div class="field"><label>Alasan / instruksi</label><textarea id="ra-note" placeholder="${act==='revisi'?'Contoh: tambahkan foto kondisi hilir pintu…':'Contoh: foto tidak sesuai lokasi tugas…'}"></textarea></div>
      <div class="m-actions"><button class="btn ghost" data-close>Batal</button>
        <button class="btn ${act==='revisi'?'warn':'danger'}" id="ra-ok">${I('edit')} Kirim</button></div>`);
    m2.ov.querySelector('#ra-ok').onclick = ()=>{
      const note = m2.ov.querySelector('#ra-note').value.trim();
      if(!note){ toast('Alasan wajib diisi.','warn'); return; }
      r.status = act==='revisi' ? 'revisi' : 'ditolak';
      r.feedback = note; r.feedbackAt = new Date().toISOString();
      const t = S.tasks.find(x=>x.id===r.tugasId);
      if(t) t.status = act==='revisi' ? 'revisi' : 'dikerjakan';
      save(); m2.close();
      toast(act==='revisi'?'Petugas diminta merevisi laporan.':'Laporan ditolak.', act==='revisi'?'warn':'err');
      renderPage(); renderNav();
    };
  }
}

/* ---------------- PROFIL: BIODATA, 2 FOTO, SETELAN ---------------- */
function renderProfil(m){
  const u = curUser();
  const raw = userById(u.id);
  m.innerHTML = `
    <div class="card">
      <div class="profil-head">
        <div style="text-align:center">
          <img class="resmi-photo" id="pf-resmi" src="${avaSrc(u,'resmi')}" alt="Foto resmi pegawai">
          <div class="small muted" style="margin-top:6px">Foto Resmi Pegawai</div>
        </div>
        <div style="flex:1;min-width:230px">
          <h2 style="font-size:1.25rem">${U.esc(u.nama)}</h2>
          <p class="muted" style="margin:4px 0 10px">${U.esc(u.jabatan)}</p>
          <div class="row" style="gap:7px;margin-bottom:12px">
            <span class="chip brand">${u.status}</span>
            <span class="chip">${U.esc(u.pangkat)} / ${U.esc(u.gol)}</span>
            <span class="chip violet">${U.esc(u.roleLabel)}</span>
          </div>
          <div class="bio-row"><span class="k">NIP / NIPPP</span><span class="v mono">${U.esc(u.nip)}</span></div>
          <div class="bio-row"><span class="k">Unit Kerja</span><span class="v">${U.esc(u.unit)}</span></div>
          <div class="bio-row"><span class="k">Instansi</span><span class="v">${U.esc(u.instansi)}</span></div>
        </div>
      </div>
    </div>

    <div class="card mt">
      <div class="card-t"><h3>Foto Aplikasi (2 foto)</h3></div>
      <div class="photo-card">
        <div class="pc">
          <img class="avatar" style="width:96px;height:96px;border:none" id="pf-hero" src="${avaSrc(u,'hero')}" alt="Foto profil hero">
          <p><b>Foto 1 — Hero (popout)</b><br>Tampil melayang di Beranda & login (png/webp).</p>
          <button class="btn sm soft" data-photo="hero">${I('edit')} Ganti</button>
        </div>
        <div class="pc">
          <img class="resmi-photo" style="width:110px;height:140px" src="${avaSrc(u,'resmi')}" alt="Foto resmi">
          <p><b>Foto 2 — Resmi</b><br>Gaya foto karpeg, tampil di halaman ini (png/webp).</p>
          <button class="btn sm soft" data-photo="resmi">${I('edit')} Ganti</button>
        </div>
      </div>
      <input type="file" id="pf-file" accept="image/png,image/jpeg,image/webp" hidden>
    </div>

    <div class="card mt">
      <div class="card-t"><h3>Biodata Kepegawaian</h3>
        <button class="btn sm soft" id="pf-edit">${I('edit')} Ubah Kontak</button></div>
      <div class="bio-grid">
        ${[
          ['Tempat, Tgl Lahir', u.lahir],['Jenis Kelamin', u.kelamin],
          ['Agama', u.agama],['Pendidikan Terakhir', u.pendidikan],
          ['Status Kepegawaian', u.status],['TMT CPNS/P3K', u.tmtCpns],
          ['TMT PNS', u.tmtPns],['TMT Pangkat', u.tmtPangkat],
          ['TMT Jabatan', u.tmtJabatan],['No. Karpeg', u.karpeg],
          ['No. Taspen', u.taspen],['NPWP', u.npwp],
          ['No. HP', u.hp],['Email', u.email],
          ['Alamat', u.alamat]
        ].map(([k,v])=>`<div class="bio-row"><span class="k">${k}</span><span class="v">${U.esc(v)}</span></div>`).join('')}
      </div>
      <hr class="sep">
      <div class="grid2">
        <div><b class="small">Riwayat Jabatan</b>
          ${u.riwayatJabatan.map(r=>`<div class="bio-row"><span class="v" style="text-align:left">${U.esc(r.j)}</span><span class="k">${r.t}</span></div>`).join('')}
        </div>
        <div><b class="small">Diklat / Sertifikasi</b>
          ${u.diklat.map(d=>`<div class="bio-row"><span class="v" style="text-align:left">${U.esc(d)}</span></div>`).join('')}
        </div>
      </div>
    </div>

    <div class="card mt">
      <div class="card-t"><h3>Setelan Tampilan Aplikasi</h3></div>
      <div class="set-row"><div class="lab"><b>Tema</b><span>Terang (baru), gelap, atau ikuti sistem</span></div>
        <span class="seg" id="se-theme">
          <button class="seg-btn ${S.settings.theme==='light'?'on':''}" data-v="light">Terang</button>
          <button class="seg-btn ${S.settings.theme==='dark'?'on':''}" data-v="dark">Gelap</button>
          <button class="seg-btn ${S.settings.theme==='system'?'on':''}" data-v="system">Sistem</button>
        </span></div>
      <div class="set-row"><div class="lab"><b>Warna aksen</b><span>Menentukan warna menu & tombol</span></div>
        <div class="swatches">
          <button class="sw ${S.settings.accent==='biru'?'on':''}" data-a="biru" style="background:linear-gradient(135deg,#14458F,#2E7BE0)" aria-label="Biru"></button>
          <button class="sw ${S.settings.accent==='oranye'?'on':''}" data-a="oranye" style="background:linear-gradient(135deg,#C05A0C,#F59E0B)" aria-label="Oranye"></button>
          <button class="sw ${S.settings.accent==='hijau'?'on':''}" data-a="hijau" style="background:linear-gradient(135deg,#0B6B4F,#14A374)" aria-label="Hijau"></button>
        </div></div>
      <div class="set-row"><div class="lab"><b>Ukuran huruf</b><span>Sesuaikan keterbacaan di lapangan</span></div>
        <span class="seg" id="se-font">
          <button class="seg-btn ${S.settings.font==='sm'?'on':''}" data-v="sm">Kecil</button>
          <button class="seg-btn ${S.settings.font==='md'?'on':''}" data-v="md">Sedang</button>
          <button class="seg-btn ${S.settings.font==='lg'?'on':''}" data-v="lg">Besar</button>
        </span></div>
      <div class="set-row"><div class="lab"><b>Kepadatan tampilan</b><span>Nyaman atau kompak</span></div>
        <span class="seg" id="se-den">
          <button class="seg-btn ${S.settings.density==='cozy'?'on':''}" data-v="cozy">Nyaman</button>
          <button class="seg-btn ${S.settings.density==='compact'?'on':''}" data-v="compact">Kompak</button>
        </span></div>
      <div class="set-row"><div class="lab"><b>Animasi</b><span>Nonaktifkan untuk perangkat lawas</span></div>
        <button class="switch ${S.settings.anim?'on':''}" id="se-anim"><span class="knob"></span></button></div>
    </div>

    <div class="card mt">
      <div class="card-t"><h3>Sinkronisasi & Penyimpanan</h3></div>
      <div class="set-row"><div class="lab"><b>Antrian foto offline</b><span>Foto tersimpan aman di perangkat (IndexedDB)</span></div>
        <span class="chip" id="pf-queue">Menghitung…</span></div>
      <div class="set-row"><div class="lab"><b>Sinkron terakhir</b><span>${S.lastSync?U.fmtDT(new Date(S.lastSync).toISOString()):'Belum pernah (simulasi)'}</span></div>
        <button class="btn sm primary" id="pf-sync">${I('sync')} Sinkron Sekarang</button></div>
    </div>

    <div class="card mt">
      <div class="card-t"><h3>Akun & Data</h3></div>
      <div class="set-row"><div class="lab"><b>Keluar / ganti peran</b><span>Kembali ke layar pilih peran</span></div>
        <button class="btn sm ghost" id="pf-out">${I('out')} Keluar</button></div>
      <div class="set-row"><div class="lab"><b>Reset data demo</b><span>Kembalikan tugas, laporan & setelan ke awal</span></div>
        <button class="btn sm danger" id="pf-reset">${I('trash')} Reset</button></div>
      <p class="note mt">SIPATIR Prototipe v1.2 • PWA vanilla HTML/CSS/JS • Data simulasi. Terpasang sebagai aplikasi: ${window.matchMedia('(display-mode: standalone)').matches?'Ya':'Buka menu browser → "Tambahkan ke layar utama"'}.</p>
    </div>`;

  /* foto 1 & 2 */
  let photoKind = 'hero';
  U.$$('[data-photo]', m).forEach(b=>b.onclick=()=>{
    photoKind = b.dataset.photo;
    U.$('#pf-file', m).click();
  });
  U.$('#pf-file', m).onchange = (e)=>{
    const f = e.target.files[0]; if(!f) return;
    const img = new Image();
    img.onload = ()=>{
      const c = document.createElement('canvas');
      const max = photoKind==='hero' ? 512 : 640;
      const sc = Math.min(1, max/Math.max(img.width, img.height));
      c.width = Math.round(img.width*sc); c.height = Math.round(img.height*sc);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      (S.overrides.photos[u.id] = S.overrides.photos[u.id]||{})[photoKind] = c.toDataURL('image/webp', .85);
      save(); renderPage();
      toast('Foto diperbarui.','ok');
      URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(f);
  };
  /* kontak */
  U.$('#pf-edit', m).onclick = ()=>{
    const m2 = modal(`<h3>Ubah Kontak Pribadi</h3>
      <p class="muted small">Data kepegawaian inti (NIP, pangkat, jabatan) hanya dapat diubah admin kepegawaian (simulasi).</p>
      <div class="field"><label>No. HP</label><input id="pe-hp" value="${U.esc(u.hp)}"></div>
      <div class="field"><label>Email</label><input id="pe-em" value="${U.esc(u.email)}"></div>
      <div class="field"><label>Alamat</label><input id="pe-al" value="${U.esc(u.alamat)}"></div>
      <div class="m-actions"><button class="btn ghost" data-close>Batal</button>
        <button class="btn primary" id="pe-ok">${I('check')} Simpan</button></div>`);
    m2.ov.querySelector('#pe-ok').onclick = ()=>{
      (S.overrides.profile[u.id] = S.overrides.profile[u.id]||{}).hp = m2.ov.querySelector('#pe-hp').value;
      S.overrides.profile[u.id].email = m2.ov.querySelector('#pe-em').value;
      S.overrides.profile[u.id].alamat = m2.ov.querySelector('#pe-al').value;
      save(); m2.close(); toast('Kontak diperbarui.','ok'); renderPage();
    };
  };
  /* setelan */
  const segBind = (sel, key, cast=(v)=>v)=>{
    U.$$(sel+' .seg-btn', m).forEach(b=>b.onclick=()=>{
      S.settings[key] = cast(b.dataset.v); save(); applySettings(); renderPage();
    });
  };
  segBind('#se-theme','theme'); segBind('#se-font','font'); segBind('#se-den','density');
  U.$$('.swatches .sw', m).forEach(b=>b.onclick=()=>{ S.settings.accent=b.dataset.a; save(); applySettings(); renderPage(); });
  U.$('#se-anim', m).onclick = ()=>{ S.settings.anim=!S.settings.anim; save(); applySettings(); renderPage(); };
  /* sinkron */
  IDB.all().then(rows=>{
    const el = U.$('#pf-queue', m);
    if(el) el.innerHTML = `<b>${rows.filter(x=>!x.thumbFor).length}</b>&nbsp;foto menunggu`;
  });
  U.$('#pf-sync', m).onclick = ()=>{
    if(!navigator.onLine){ toast('Sedang luring — sinkron dibatalkan.','err'); return; }
    toast('Menyinkronkan antrian… (simulasi)');
    setTimeout(()=>{ S.lastSync=Date.now(); save(); toast('Semua foto tersinkron (simulasi).','ok'); renderPage(); }, 1600);
  };
  U.$('#pf-out', m).onclick = askLogout;
  U.$('#pf-reset', m).onclick = ()=>confirmMod('Reset Data Demo?','Seluruh tugas, laporan, foto & setelan akan dikembalikan ke kondisi awal.','Reset', ()=>{
    localStorage.removeItem(LS); location.reload();
  });
}

/* ---------------- JARINGAN & PWA ---------------- */
function updateNet(){
  const el = U.$('#tb-net'); if(!el) return;
  const on = navigator.onLine;
  el.className = 'chip mini';
  el.innerHTML = `<i class="net-dot ${on?'ok':'bad'}"></i><span>${on?'Daring':'Luring'}</span>`;
}
window.addEventListener('online', ()=>{ updateNet(); toast('Kembali daring — menyinkronkan antrian…','ok');
  setTimeout(()=>{ S.lastSync=Date.now(); save(); }, 1200); });
window.addEventListener('offline', ()=>{ updateNet(); toast('Mode luring — foto & laporan masuk antrian.','warn'); });

/* ---------------- BOOT ---------------- */
async function boot(){
  loadState();
  applySettings();
  await IDB.open();
  const rows = await IDB.all();
  rows.forEach(r=>{ if(r.thumbFor) window.PHOTO_CACHE[r.id] = r.dataUrl; });
  /* foto simulasi untuk data awal */
  let seeded = false;
  S.reports.forEach(r=>{
    if(!r.foto){
      r.foto = makeSimPhoto(`${r.lokasi}${r.tahap!=null?` — tahap ${r.tahap}%`:''}`,
        U.hash(r.id)%360,
        { user:userById(r.petugasId), lokasi:r.lokasi, tahap:r.tahap, dt:new Date(r.waktu) });
      seeded = true;
    }
  });
  if(seeded) save();

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', ()=>{
    if(S.settings.theme==='system') applySettings();
  });
  U.$('#sb-theme').onclick = toggleTheme;
  U.$('#tb-theme').onclick = toggleTheme;
  U.$('#tb-ava').onclick = ()=>{ if(S.session) setRoute('profil'); };

  if(S.session && userById(S.session.userId)) enterApp();
  else renderLogin();
  updateNet();

  if('serviceWorker' in navigator && (location.protocol==='https:' || ['localhost','127.0.0.1'].includes(location.hostname))){
    navigator.serviceWorker.register('sw.js').catch(()=>{});
  }
}
document.addEventListener('DOMContentLoaded', boot);
