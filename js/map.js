/* ============================================================
   SIPATIR — map.js
   Peta Leaflet: layer per peran (Staf Pengamat melihat D.I.,
   PPA melihat pintu air, Pekarya melihat ruas saluran) dengan
   mode pratinjau, legenda, dan aksi lapor langsung ke kamera.
   ============================================================ */
'use strict';

let _leafletReady = null;
function ensureLeaflet(){
  if(_leafletReady) return _leafletReady;
  _leafletReady = new Promise((res)=>{
    if(typeof L !== 'undefined') return res(true);
    if(window.__LEAFLET_FAIL) return res(false);
    const js = document.querySelector('script[src*="leaflet"]');
    if(!js) return res(false);
    js.addEventListener('load', ()=>res(true));
    js.addEventListener('error', ()=>res(false));
    setTimeout(()=>res(typeof L !== 'undefined'), 6000);
  });
  return _leafletReady;
}

function renderPeta(root){
  const user = userById(S.session.userId);
  const mode = S.mapMode || user.role;          // 'pengamat'|'ppa'|'pekarya'
  root.innerHTML = `
    <div class="card">
      <div class="card-t">
        <div><h3>Peta Objek Irigasi</h3>
          <div class="sub">${mode==='pengamat' ? 'Staf Pengamat: D.I., pintu air, saluran & posisi tim'
            : mode==='ppa' ? 'PPA: bangunan penakar / pintu air'
            : 'Pekarya: ruas saluran & kondisinya'}</div></div>
        <span class="chip mini ${navigator.onLine?'ok':'warn'}">${navigator.onLine?'Peta daring':'Luring — tile tidak tersedia'}</span>
      </div>
      ${user.role==='pengamat' ? `
      <div class="row mb" style="margin-bottom:12px">
        <span class="small muted" style="font-weight:700">Pratinjau sebagai:</span>
        <span class="seg" id="map-mode">
          <button class="seg-btn ${mode==='pengamat'?'on':''}" data-v="pengamat">Pengamat (semua)</button>
          <button class="seg-btn ${mode==='ppa'?'on':''}" data-v="ppa">PPA</button>
          <button class="seg-btn ${mode==='pekarya'?'on':''}" data-v="pekarya">Pekarya</button>
        </span>
      </div>` : ''}
      <div class="map-wrap">
        <div id="map"></div>
        <div class="map-legend" id="map-legend"></div>
      </div>
      <p class="note map-note">Data simulasi — koordinat & nama objek tidak menggambarkan lokasi sesungguhnya.</p>
    </div>`;

  if(user.role==='pengamat'){
    U.$$('#map-mode .seg-btn', root).forEach(b=> b.onclick = ()=>{
      S.mapMode = b.dataset.v; save(); renderPage();
    });
  }

  ensureLeaflet().then(ok=>{
    if(ok) initMap(mode);
    else{
      U.$('#map', root).outerHTML = `<div class="map-fallback">${I('info')}<br><br>
        <b>Peta tidak dapat dimuat (luring).</b><br>
        ${GEO.pintu.length} pintu air, ${GEO.saluran.length} ruas saluran, dan ${GEO.dis.length} D.I. tetap tersimpan lokal.</div>`;
    }
  });

  function initMap(mode){
    const holder = U.$('#map', root); if(!holder) return;
    if(window._lmap){ try{ window._lmap.remove(); }catch(_){} }
    const map = L.map(holder, { center:GEO.center, zoom:13, scrollWheelZoom:true });
    window._lmap = map;
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom:19, attribution:'&copy; OpenStreetMap'
    }).addTo(map);

    const showAll = mode==='pengamat';
    const layers = { di:L.layerGroup(), pintu:L.layerGroup(), saluran:L.layerGroup(), tim:L.layerGroup() };

    /* D.I. polygons */
    GEO.dis.forEach(d=>{
      const poly = L.polygon(d.coords, {
        color:'#2E7BE0', weight: showAll?2:1, opacity: showAll?0.9:0.25,
        fillColor:'#2E7BE0', fillOpacity: showAll?0.14:0.05
      }).bindPopup(popupDI(d, showAll));
      poly.on('popupopen', e=>bindPopActions(e));
      layers.di.addLayer(poly);
    });

    /* pintu air */
    GEO.pintu.forEach(p=>{
      const emph = mode==='ppa' || showAll;
      const mk = L.circleMarker(p.pos, {
        radius: emph?9:6, color:'#fff', weight:2,
        fillColor: p.kondisi==='Baik' ? '#12A15A' : '#D97706',
        fillOpacity: emph?1:0.35
      }).bindPopup(popupPintu(p, mode==='ppa'||showAll));
      mk.on('popupopen', e=>bindPopActions(e));
      layers.pintu.addLayer(mk);
    });

    /* saluran */
    GEO.saluran.forEach(s=>{
      const emph = mode==='pekarya' || showAll;
      const ln = L.polyline(s.coords, {
        color: KONDISI_COLOR[s.kondisi]||'#2F80ED',
        weight: emph?7:4, opacity: emph?0.9:0.3, lineCap:'round'
      }).bindPopup(popupSaluran(s, mode==='pekarya'||showAll));
      ln.on('popupopen', e=>bindPopActions(e));
      layers.saluran.addLayer(ln);
    });

    /* posisi tim (hanya pengamat) */
    if(showAll){
      const posTim = { 'u-ppa':[-6.917,109.656], 'u-pekarya':[-6.923,109.661] };
      USERS.filter(u=>u.role!=='pengamat').forEach(u=>{
        const m = L.circleMarker(posTim[u.id], {
          radius:8, color:'#fff', weight:2, fillColor:'#7C5CE0', fillOpacity:1
        }).bindPopup(`<div class="pop-t"><b>${U.esc(u.nama)}</b><span>${U.esc(u.roleLabel)} — posisi terakhir (simulasi)</span></div>`);
        layers.tim.addLayer(m);
      });
    }

    if(showAll){ layers.di.addTo(map); layers.pintu.addTo(map); layers.saluran.addTo(map); layers.tim.addTo(map); }
    else if(mode==='ppa'){ layers.pintu.addTo(map); layers.di.addTo(map); }
    else { layers.saluran.addTo(map); layers.di.addTo(map); }

    map.fitBounds(L.latLngBounds(GEO.dis[0].coords.concat(GEO.dis[1].coords)).pad(0.12));

    /* legenda */
    const lg = U.$('#map-legend', root);
    if(lg){
      let html = '';
      if(mode==='pengamat'||mode==='pekarya'){
        html += Object.entries({ 'Baik':'#12A15A', 'Rusak Ringan':'#D97706', 'Rusak Berat':'#DC4437' })
          .map(([k,v])=>`<div class="li"><span class="sw" style="background:${v}"></span>${k}</div>`).join('');
      }
      if(mode!=='pekarya'){
        html += `<div class="li"><span class="sw" style="background:#12A15A;border-radius:50%"></span>Pintu air (hijau=baik)</div>
                 <div class="li"><span class="sw" style="background:#D97706;border-radius:50%"></span>Pintu air (perlu perhatian)</div>`;
      }
      if(mode==='pengamat'){ html += `<div class="li"><span class="sw" style="background:#7C5CE0;border-radius:50%"></span>Posisi tim</div>
        <div class="li"><span class="sw" style="background:rgba(46,123,224,.25);border:1px solid #2E7BE0"></span>Batas D.I.</div>`; }
      lg.innerHTML = html;
    }
  }

  /* popup builders */
  function popupDI(d, showAll){
    return `<div class="pop-t"><b>${U.esc(d.nama)}</b>
      <span>Luas layanan: ${d.luas} • Sumber air: ${U.esc(d.sumber)}</span>
      <span>Status: <b>Beroperasi</b></span></div>
      ${showAll?`<button class="btn soft sm pop-btn" data-act="tugas" data-loc="${d.id}">${I('task')} Buat tugas di D.I. ini</button>`:''}`;
  }
  function popupPintu(p, emph){
    return `<div class="pop-t"><b>${U.esc(p.nama)}</b>
      <span>Bukaan: ${p.buka} • Kondisi: <b style="color:${KONDISI_COLOR[p.kondisi]}">${p.kondisi}</b></span>
      ${emph?`<button class="btn soft sm pop-btn" data-act="lapor" data-loc="${p.id}">${I('camera')} Laporkan kondisi via kamera</button>`:''}</div>`;
  }
  function popupSaluran(s, emph){
    return `<div class="pop-t"><b>${U.esc(s.nama)}</b>
      <span>Panjang: ${s.panjang} • Kondisi: <b style="color:${KONDISI_COLOR[s.kondisi]}">${s.kondisi}</b></span>
      ${emph?`<button class="btn soft sm pop-btn" data-act="lapor" data-loc="${s.id}">${I('camera')} Mulai pemeliharaan (foto progres)</button>`:''}</div>`;
  }
  function bindPopActions(e){
    const btn = e.popup.getElement().querySelector('.pop-btn');
    if(!btn) return;
    btn.onclick = ()=>{
      window.__camPrefill = { lokasiId:btn.dataset.loc, note:'' };
      if(btn.dataset.act==='tugas') tugasFormModal(btn.dataset.loc);
      else setRoute('kamera');
    };
  }
}
