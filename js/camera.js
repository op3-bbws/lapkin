/* ============================================================
   SIPATIR — camera.js
   Modul kamera: getUserMedia, kamera depan/belakang, countdown
   3/5/10 detik, watermark (GPS, waktu, alamat, kompas, identitas),
   rantai progres 0% → 50% → 100%, antrian offline (IndexedDB),
   fallback unggah foto, dan generator foto simulasi untuk seed.
   ============================================================ */
'use strict';

const CAM = {
  stream:null, facing:'environment', timerSel:5, timerOn:false,
  gps:null, heading:null, pending:null, taskId:null, watchId:null,
  tick:null
};

/* ---------- util gambar ---------- */
function rr(ctx,x,y,w,h,r){
  r = Math.min(r, w/2, h/2);
  ctx.beginPath();
  ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath();
}
function compassLetter(h){
  if(h==null || isNaN(h)) return '—';
  const dirs = ['U','TL','T','TG','S','BD','B','BL'];
  return dirs[Math.round(((h%360)+360)%360/45)%8];
}
function camGPS(){
  if(CAM.gps) return CAM.gps;
  const j = Math.abs(U.hash(String(new Date().getHours())))*0.0007;
  return { lat:GEO.center[0]+(j-0.0004), lng:GEO.center[1]+(j*0.6), acc:12, sim:true };
}
function watchGPS(){
  if(CAM.watchId!=null || !navigator.geolocation) return;
  CAM.watchId = navigator.geolocation.getCurrentPosition(
    (p)=>{ CAM.gps = { lat:p.coords.latitude, lng:p.coords.longitude, acc:Math.round(p.coords.accuracy||10) }; },
    ()=>{ CAM.gps = null; },
    { enableHighAccuracy:true, timeout:6000, maximumAge:15000 }
  );
  window.addEventListener('deviceorientation', (e)=>{
    const h = (e.webkitCompassHeading!=null) ? e.webkitCompassHeading : (e.alpha!=null ? 360-e.alpha : null);
    if(h!=null && !isNaN(h)) CAM.heading = h;
  }, { passive:true });
}
function stopCam(){
  if(CAM.stream){ CAM.stream.getTracks().forEach(t=>t.stop()); CAM.stream=null; }
  if(CAM.tick){ clearInterval(CAM.tick); CAM.tick=null; }
}

/* ---------- WATERMARK (adaptif orientasi) ---------- */
function drawWatermark(ctx, w, h, meta){
  const fs = Math.max(13, Math.round(Math.sqrt(w*h) * 0.018));
  const lh = Math.round(fs*1.5), pad = Math.round(fs*0.9);
  const dt = meta.dt instanceof Date ? meta.dt : new Date(meta.dt||Date.now());
  const g = meta.gps || camGPS();
  const tgl = `${U.daysID[(dt.getDay()+6)%7]}, ${U.pad(dt.getDate())}/${U.pad(dt.getMonth()+1)}/${dt.getFullYear()}`;
  const jam = `${U.pad(dt.getHours())}.${U.pad(dt.getMinutes())} WIB`;
  const nama = `${meta.user.nama} — ${meta.user.roleLabel}`;
  const gpsTxt = `GPS ${g.lat.toFixed(6)}, ${g.lng.toFixed(6)} (±${g.acc} m)${g.sim?' ~':''} • Arah ${meta.heading!=null?Math.round(meta.heading)+'° '+compassLetter(meta.heading):'—'}`;
  const locTxt = `Lokasi: ${meta.lokasi}${meta.tahap!=null?` • Tahap: ${meta.tahap}%`:''}`;

  let lines;
  if(h > w){   // potret
    lines = [
      'SIPATIR • Ditjen SDA — Kementerian PU',
      nama, `${tgl} — ${jam}`, gpsTxt,
      (meta.addr||'') , locTxt
    ];
  }else{       // lanskap
    lines = [
      `SIPATIR • ${nama}`,
      `${tgl} ${jam}  |  ${gpsTxt}`,
      `${meta.addr||''}  |  ${locTxt}`
    ];
  }
  ctx.font = `600 ${fs}px 'Segoe UI', Arial, sans-serif`;
  const maxW = Math.max(...lines.map(l=>ctx.measureText(l).width));
  const boxW = Math.min(w - pad*2, maxW + pad*2);
  const boxH = lines.length*lh + pad*1.5;
  const bx = pad, by = h - boxH - pad;

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 4;
  ctx.fillStyle = 'rgba(8,14,26,.55)';
  rr(ctx, bx, by, boxW, boxH, Math.round(fs*0.8)); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#FFFFFF';
  ctx.textBaseline = 'top';
  lines.forEach((l,i)=>{
    ctx.fillText(l, bx+pad, by + Math.round(pad*0.75) + i*lh, boxW - pad*2);
  });
  ctx.restore();
}

/* ---------- generator foto simulasi (untuk data awal) ---------- */
function makeSimPhoto(caption, hue=205, meta={}){
  const c = document.createElement('canvas');
  const portrait = U.hash(caption)%2===0;
  c.width = portrait?480:640; c.height = portrait?640:480;
  const ctx = c.getContext('2d');
  const w=c.width, h=c.height;
  const sky = ctx.createLinearGradient(0,0,0,h);
  sky.addColorStop(0, `hsl(${hue} 55% 66%)`); sky.addColorStop(1, `hsl(${hue} 40% 88%)`);
  ctx.fillStyle = sky; ctx.fillRect(0,0,w,h);
  ctx.fillStyle = `hsl(95 30% 48%)`; ctx.fillRect(0, h*0.62, w, h*0.38);
  ctx.fillStyle = `hsl(200 55% 50%)`; ctx.fillRect(0, h*0.62, w, h*0.10);
  ctx.fillStyle = '#9AA7B8';
  ctx.fillRect(w*0.18, h*0.30, w*0.07, h*0.34);
  ctx.fillRect(w*0.75, h*0.30, w*0.07, h*0.34);
  ctx.fillRect(w*0.13, h*0.26, w*0.74, h*0.07);
  ctx.fillStyle = 'rgba(255,255,255,.85)';
  ctx.font = `800 ${Math.round(w*0.075)}px 'Segoe UI', Arial`;
  ctx.textAlign='center';
  ctx.fillText('FOTO SIMULASI', w/2, h*0.16);
  ctx.font = `600 ${Math.round(w*0.042)}px 'Segoe UI', Arial`;
  ctx.fillText(caption, w/2, h*0.225);
  ctx.textAlign='left';
  const m = Object.assign({
    user:userById('u-pengamat'), lokasi:caption, tahap:null,
    dt:new Date(), gps:null, heading:null,
    addr:simAddr(GEO.center[0],GEO.center[1])
  }, meta);
  drawWatermark(ctx, w, h, m);
  return c.toDataURL('image/jpeg', .82);
}

/* ---------- HALAMAN KAMERA ---------- */
function renderKamera(root){
  stopCam(); watchGPS();
  const user = userById(S.session.userId);
  const isPeng = user.role==='pengamat';
  const opts = lokasiOptions(user.role);
  const pre = window.__camPrefill || {};
  window.__camPrefill = null;
  const locSel = pre.lokasiId && opts.some(o=>o.id===pre.lokasiId) ? pre.lokasiId : (opts[0] && opts[0].id);
  CAM.taskId = pre.taskId || null;
  if(!S.cam) S.cam = { lokasiId:locSel, tahap:isPeng?null:0 };
  else {
    S.cam.lokasiId = locSel || S.cam.lokasiId;
    if(isPeng) S.cam.tahap = null;
  }
  if(pre.lokasiId) S.cam.lokasiId = locSel;

  const chain = chainFor(S.cam.lokasiId);
  const nextTahap = isPeng ? null : ([0,50,100].find(t=>!chain.some(c=>c.tahap===t)) ?? null);

  root.innerHTML = `
    <div class="card">
      <div class="card-t">
        <div><h3>Kamera Lapangan</h3><div class="sub">Foto geotag dengan watermark otomatis (waktu, GPS, alamat, kompas)</div></div>
        <span class="chip mini ${navigator.onLine?'ok':'warn'}">${navigator.onLine?'Daring':'Luring — masuk antrian'}</span>
      </div>
      <div class="cam-preview" id="cam-prev">
        <div class="cam-off" id="cam-off">${I('camera')}<div>Kamera belum aktif.<br>Tekan <b>Nyalakan Kamera</b>, atau gunakan <b>Unggah Foto</b> bila perangkat tidak memiliki kamera.</div></div>
        <video id="cam-video" autoplay playsinline muted class="user-face"></video>
        <div class="cam-rec" id="cam-rec"></div>
        <div class="count-ov" id="cam-count" hidden></div>
      </div>
      <div class="cam-bar">
        <button class="btn primary sm" id="cam-start">${I('camera')} Nyalakan Kamera</button>
        <button class="btn sm" id="cam-flip" disabled>${I('sync')} Ganti Kamera</button>
        <button class="btn sm" id="cam-upload">${I('img')} Unggah Foto</button>
        <input type="file" id="cam-file" accept="image/png,image/jpeg,image/webp" hidden>
        <span class="seg" id="cam-timer-seg">
          <button class="seg-btn ${CAM.timerSel===3?'on':''}" data-v="3">3s</button>
          <button class="seg-btn ${CAM.timerSel===5?'on':''}" data-v="5">5s</button>
          <button class="seg-btn ${CAM.timerSel===10?'on':''}" data-v="10">10s</button>
        </span>
        <button class="btn sm ${CAM.timerOn?'ok':''}" id="cam-timer-toggle">${I('clock')} Timer ${CAM.timerOn?'AKTIF':'nonaktif'}</button>
        <button class="cam-shutter" id="cam-shot" title="Ambil foto" aria-label="Ambil foto"></button>
      </div>
      <p class="note center" id="cam-gps">Mendapatkan posisi GPS…</p>
    </div>

    <div class="card mt">
      <div class="card-t"><div><h3>Data Foto</h3>
        <div class="sub">${isPeng?'Dokumentasi pengawasan — tersimpan otomatis sebagai dokumentasi pengamat':'Laporan akan dikirim ke Staf Pengamat untuk disetujui'}</div></div>
      </div>
      <div class="field"><label>Lokasi / Objek</label>
        <select id="cam-lokasi">${opts.map(o=>`<option value="${o.id}" ${o.id===S.cam.lokasiId?'selected':''}>${U.esc(o.label)} — ${o.kind}</option>`).join('')}</select>
      </div>
      ${isPeng ? `<div class="chip violet">${I('shield')} Mode dokumentasi pengawasan</div>` : `
      <div class="field"><label>Tahap Progres (rantai foto)</label>
        <span class="seg" id="cam-tahap">
          <button class="seg-btn ${S.cam.tahap===0?'on':''}" data-v="0">0% Awal</button>
          <button class="seg-btn ${S.cam.tahap===50?'on':''}" data-v="50">50% Proses</button>
          <button class="seg-btn ${S.cam.tahap===100?'on':''}" data-v="100">100% Selesai</button>
        </span>
      </div>
      <div class="chain" id="cam-chain">${chainHTML(chain, S.cam.tahap)}</div>`}
      <div class="field mt"><label>Catatan laporan</label>
        <textarea id="cam-note" placeholder="Contoh: pintu dibuka 50 cm, TMA normal, tidak ada temuan…">${U.esc(pre.note||'')}</textarea>
      </div>
    </div>`;

  const $p = (s)=>U.$(s, root);
  const video = $p('#cam-video'), prev = $p('#cam-prev'), off = $p('#cam-off');
  video.style.display = 'none';   /* sembunyikan sampai kamera aktif */

  /* GPS info line */
  const gpsLine = ()=>{
    const g = camGPS();
    const el = $p('#cam-gps');
    if(el) el.innerHTML = `${I('pin')} GPS: <b class="mono">${g.lat.toFixed(6)}, ${g.lng.toFixed(6)}</b> (±${g.acc} m${g.sim?', perkiraan':''}) • Kompas: <b>${CAM.heading!=null?Math.round(CAM.heading)+'° '+compassLetter(CAM.heading):'—'}</b> • ${U.hari(new Date())}, ${U.fmtID(U.today())}`;
  };
  gpsLine();
  CAM.tick = setInterval(gpsLine, 4000);

  /* nyalakan kamera */
  const start = async ()=>{
    try{
      stopTracksOnly();
      CAM.stream = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:CAM.facing, width:{ideal:1920} }, audio:false });
      video.srcObject = CAM.stream; video.style.display='block';
      video.classList.toggle('user-face', CAM.facing==='user');
      off.hidden = true;
      $p('#cam-flip').disabled = false;
      $p('#cam-rec').innerHTML = `<span class="chip mini ok">● LIVE</span><span class="chip mini ${CAM.facing==='user'?'violet':'brand'}">${CAM.facing==='user'?'Depan':'Belakang'}</span>`;
    }catch(err){
      off.innerHTML = `${I('info')}<div>Kamera tidak tersedia / izin ditolak.<br>Gunakan <b>Unggah Foto</b> — watermark tetap ditambahkan otomatis.</div>`;
      toast('Kamera tidak dapat diakses: '+err.name, 'warn');
    }
  };
  function stopTracksOnly(){ if(CAM.stream){ CAM.stream.getTracks().forEach(t=>t.stop()); CAM.stream=null; } }

  $p('#cam-start').onclick = start;
  $p('#cam-flip').onclick = ()=>{ CAM.facing = CAM.facing==='environment'?'user':'environment'; start(); };
  $p('#cam-upload').onclick = ()=> $p('#cam-file').click();
  $p('#cam-file').onchange = (e)=>{
    const f = e.target.files[0]; if(!f) return;
    const img = new Image();
    img.onload = ()=>{
      const c = document.createElement('canvas');
      const sc = Math.min(1, 1600/Math.max(img.width, img.height));
      c.width = Math.round(img.width*sc); c.height = Math.round(img.height*sc);
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0, c.width, c.height);
      applyPending(c);
      URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(f);
  };
  U.$$('#cam-timer-seg .seg-btn', root).forEach(b=> b.onclick = ()=>{
    CAM.timerSel = +b.dataset.v;
    U.$$('#cam-timer-seg .seg-btn', root).forEach(x=>x.classList.toggle('on', x===b));
  });
  $p('#cam-timer-toggle').onclick = ()=>{ CAM.timerOn = !CAM.timerOn; renderPage(); };

  U.$$('#cam-tahap .seg-btn', root).forEach(b=> b.onclick = ()=>{
    S.cam.tahap = +b.dataset.v;
    U.$$('#cam-tahap .seg-btn', root).forEach(x=>x.classList.toggle('on', x===b));
  });
  $p('#cam-lokasi').onchange = (e)=>{
    S.cam.lokasiId = e.target.value;
    $p('#cam-chain').innerHTML = chainHTML(chainFor(S.cam.lokasiId), user.role==='pengamat'?null:S.cam.tahap);
  };
  $p('#cam-shot').onclick = ()=>{
    if(CAM.pending){ saveShot(); return; }
    if(!CAM.stream){ toast('Nyalakan kamera terlebih dahulu, atau gunakan Unggah Foto.','warn'); return; }
    if(!CAM.timerOn){ capture(); return; }
    const ov = $p('#cam-count'); let n = CAM.timerSel;
    ov.hidden = false; ov.textContent = n;
    const iv = setInterval(()=>{
      n--;
      if(n<=0){ clearInterval(iv); ov.hidden = true; capture(); }
      else ov.textContent = n;
    }, 1000);
  };

  function capture(){
    if(!video.videoWidth){ toast('Kamera belum siap…','warn'); return; }
    const c = document.createElement('canvas');
    c.width = video.videoWidth; c.height = video.videoHeight;
    const ctx = c.getContext('2d');
    ctx.drawImage(video, 0, 0);
    applyPending(c);
  }
  function applyPending(c){
    const user2 = userById(S.session.userId);
    const g = camGPS();
    const meta = {
      user:user2, dt:new Date(), gps:g, heading:CAM.heading,
      lokasi:lokasiLabel(S.cam.lokasiId), tahap:user2.role==='pengamat'?null:S.cam.tahap,
      addr:simAddr(g.lat, g.lng)
    };
    drawWatermark(c.getContext('2d'), c.width, c.height, meta);
    CAM.pending = { canvas:c, dataUrl:c.toDataURL('image/jpeg', .85), w:c.width, h:c.height, meta };
    showPending();
  }
  function showPending(){
    prev.querySelectorAll('.shot-live').forEach(x=>x.remove());
    const img = document.createElement('img');
    img.className = 'shot shot-live'; img.src = CAM.pending.dataUrl; img.alt='Pratinjau foto';
    video.style.display='none'; off.hidden = true;
    prev.appendChild(img);
    $p('#cam-rec').innerHTML = `<span class="chip mini warn">Pratinjau — tekan tombol bulat untuk <b>&nbsp;Simpan</b></span>`;
    const bar = $p('.cam-bar', root);
    if(!U.$('#cam-save-row', root)){
      const row = document.createElement('div');
      row.id = 'cam-save-row'; row.className = 'row center mt';
      row.innerHTML = `<button class="btn ok" id="cam-save">${I('check')} Simpan ke Antrian</button>
        <button class="btn ghost" id="cam-retake">${I('sync')} Ambil Ulang</button>
        <button class="btn ghost" id="cam-cancel">${I('x')} Batal</button>`;
      prev.parentElement.insertBefore(row, prev.nextSibling);
      U.$('#cam-save', row).onclick = saveShot;
      U.$('#cam-retake', row).onclick = ()=>{ CAM.pending=null; renderPage(); };
      U.$('#cam-cancel', row).onclick = ()=>{ CAM.pending=null; renderPage(); };
    }
  }

  function saveShot(){
    if(!CAM.pending) return;
    const user2 = userById(S.session.userId);
    const p = CAM.pending;
    const fullId = U.uid('ph'), thumbId = U.uid('th');
    /* buat thumbnail dari kanvas yang sudah tersedia (sinkron) */
    const tc = document.createElement('canvas');
    const sc = Math.min(1, 480/Math.max(p.w,p.h));
    tc.width = Math.round(p.w*sc); tc.height = Math.round(p.h*sc);
    tc.getContext('2d').drawImage(p.canvas, 0, 0, tc.width, tc.height);
    const thumb = tc.toDataURL('image/jpeg', .72);

    IDB.put({ id:fullId, dataUrl:p.dataUrl, createdAt:Date.now() });
    IDB.put({ id:thumbId, dataUrl:thumb, thumbFor:fullId, createdAt:Date.now() });
    window.PHOTO_CACHE[thumbId] = thumb;

    S.reports.unshift({
      id:U.uid('r'), petugasId:user2.id, tugasId:CAM.taskId||null,
      lokasi:lokasiLabel(S.cam.lokasiId), lokasiId:S.cam.lokasiId,
      tahap:user2.role==='pengamat'?null:S.cam.tahap,
      waktu:new Date().toISOString(), catatan:(U.$('#cam-note',root)||{}).value||'',
      status:user2.role==='pengamat'?'dokumentasi':'menunggu',
      foto:thumb, fotoFull:fullId, feedback:'', feedbackAt:null
    });
    if(CAM.taskId){
      const t = S.tasks.find(x=>x.id===CAM.taskId);
      if(t) t.status='selesai';
    }
    save();
    CAM.pending = null; CAM.taskId = null;
    if(navigator.onLine){
      S.lastSync = Date.now(); save();
      setTimeout(()=>toast('1 foto & laporan tersinkron ke server (simulasi).','ok'), 1500);
    }else{
      toast('Tersimpan di antrian offline — akan disinkron saat daring.','warn');
    }
    renderPage();
  }
}

/* rantai progres untuk satu lokasi */
function chainFor(locId){
  const rows = [0,50,100].map(t=>{
    const r = S.reports.find(x=>x.lokasiId===locId && x.tahap===t);
    return { tahap:t, report:r||null };
  });
  return rows;
}
function chainHTML(chain, activeTahap){
  return chain.map(c=>{
    const cls = c.report ? (c.report.status==='disetujui'||c.report.status==='dokumentasi' ? 'done' : '') : (c.tahap===activeTahap?'next':'');
    const txt = c.report
      ? `${c.report.status==='disetujui'?'Disetujui':c.report.status==='dokumentasi'?'Terverifikasi':'Menunggu'} • ${U.fmtID(c.report.waktu.slice(0,10))}`
      : (c.tahap===activeTahap ? 'Tahap aktif — ambil foto' : 'Belum ada foto');
    return `<div class="chain-step ${cls}"><b>${c.tahap===0?'0% — Awal':c.tahap===50?'50% — Proses':'100% — Selesai'}</b>${txt}</div>`;
  }).join('');
}
