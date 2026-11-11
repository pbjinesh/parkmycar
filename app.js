/* Park My Car – saves where you parked and guides you back. All data stays on the phone. */
(function () {
  'use strict';
  var KEY = 'pmc.v1';
  var FLOORS = ['B3', 'B2', 'B1', 'G', '1', '2', '3', '4', '5'];
  var $ = function (id) { return document.getElementById(id); };

  // ---------- storage ----------
  var state = { current: null, history: [] };
  function load() {
    try { var s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s) state = s; } catch (e) {}
    if (!state.history) state.history = [];
  }
  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); return true; }
    catch (e) {
      // storage full: drop the photo and try again
      if (state.current && state.current.photo) {
        state.current.photo = null;
        try { localStorage.setItem(KEY, JSON.stringify(state)); toast('Storage full – saved without photo'); return true; } catch (e2) {}
      }
      toast('Could not save. Free some phone storage.');
      return false;
    }
  }

  // ---------- helpers ----------
  var toastTimer;
  function toast(msg) {
    var t = $('toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2800);
  }
  function show(name) {
    ['home', 'parked', 'find', 'form'].forEach(function (s) { $(s).hidden = (s !== name); });
    window.scrollTo(0, 0);
  }
  function ago(ts) {
    var m = Math.max(0, Math.round((Date.now() - ts) / 60000));
    if (m < 1) return 'just now';
    if (m < 60) return m + ' min ago';
    var h = Math.floor(m / 60), r = m % 60;
    if (h < 24) return h + ' h ' + (r ? r + ' min ' : '') + 'ago';
    return Math.floor(h / 24) + ' d ago';
  }
  function fmtDist(m) { return m < 1000 ? Math.round(m) + ' m' : (m / 1000).toFixed(1) + ' km'; }
  function rad(d) { return d * Math.PI / 180; }
  function haversine(a, b, c, d) {
    var R = 6371000, dLat = rad(c - a), dLon = rad(d - b);
    var x = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(rad(a)) * Math.cos(rad(c)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  }
  function bearing(a, b, c, d) {
    var y = Math.sin(rad(d - b)) * Math.cos(rad(c));
    var x = Math.cos(rad(a)) * Math.sin(rad(c)) - Math.sin(rad(a)) * Math.cos(rad(c)) * Math.cos(rad(d - b));
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  }
  function describe(c) {
    var parts = [];
    if (c.floor) parts.push('Floor ' + c.floor);
    if (c.slot) parts.push('Slot ' + c.slot);
    return parts.join(' · ') || 'Spot saved';
  }

  // ---------- GPS ----------
  var gpsWatch = null, gps = null; // gps = {lat,lng,acc}
  function startGps() {
    stopGps(); gps = null; renderGps();
    if (!navigator.geolocation) { renderGps('unsupported'); return; }
    gpsWatch = navigator.geolocation.watchPosition(function (p) {
      var n = { lat: p.coords.latitude, lng: p.coords.longitude, acc: Math.round(p.coords.accuracy || 0) };
      if (!gps || n.acc <= gps.acc + 5) gps = n; // keep the best reading
      renderGps();
    }, function (err) { renderGps(err && err.code === 1 ? 'denied' : 'error'); },
    { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 });
  }
  function stopGps() { if (gpsWatch !== null) { navigator.geolocation.clearWatch(gpsWatch); gpsWatch = null; } }
  function renderGps(problem) {
    var b = $('gpsBox'); b.className = 'gps';
    if (editing) { // editing keeps the saved coordinates
      var c = state.current;
      b.className = 'gps ' + (c.lat != null ? 'good' : 'none');
      b.textContent = c.lat != null ? 'Location saved (±' + c.acc + ' m). Details below can be changed.' : 'No GPS location was saved for this spot.';
      return;
    }
    if (problem === 'denied') { b.className = 'gps none'; b.textContent = 'Location permission is off. You can still save floor, slot and photo.'; return; }
    if (problem) { b.className = 'gps none'; b.textContent = 'Could not get GPS. You can still save floor, slot and photo.'; return; }
    if (!gps) { b.textContent = 'Getting GPS location…'; return; }
    if (gps.acc <= 25) { b.className = 'gps good'; b.textContent = 'GPS locked (±' + gps.acc + ' m). Good.'; }
    else { b.className = 'gps weak'; b.textContent = 'GPS is weak (±' + gps.acc + ' m). Add floor, slot number and a photo to be safe.'; }
  }

  // ---------- form ----------
  var editing = false, formPhoto = null, formFloor = '';
  function buildChips() {
    var box = $('floorChips'); box.innerHTML = '';
    FLOORS.forEach(function (f) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.textContent = f;
      b.onclick = function () { formFloor = (formFloor === f) ? '' : f; $('floorOther').value = ''; markChips(); };
      box.appendChild(b);
    });
  }
  function markChips() {
    var kids = $('floorChips').children;
    for (var i = 0; i < kids.length; i++) kids[i].classList.toggle('on', kids[i].textContent === formFloor);
  }
  function setPhoto(data) {
    formPhoto = data;
    $('photoPreview').hidden = !data; $('removePhoto').hidden = !data;
    if (data) $('photoPreview').src = data;
  }
  function openForm(edit) {
    editing = edit;
    var c = edit ? state.current : {};
    $('formTitle').textContent = edit ? 'Edit details' : 'Save your spot';
    formFloor = c.floor && FLOORS.indexOf(c.floor) >= 0 ? c.floor : '';
    $('floorOther').value = c.floor && FLOORS.indexOf(c.floor) < 0 ? c.floor : '';
    $('slot').value = c.slot || ''; $('note').value = c.note || '';
    setPhoto(c.photo || null); markChips();
    show('form');
    if (edit) renderGps(); else startGps();
  }
  function readPhoto(file) {
    if (!file) return;
    var img = new Image(), url = URL.createObjectURL(file);
    img.onload = function () {
      var max = 900, s = Math.min(1, max / Math.max(img.width, img.height));
      var cv = document.createElement('canvas'); cv.width = Math.round(img.width * s); cv.height = Math.round(img.height * s);
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      setPhoto(cv.toDataURL('image/jpeg', 0.7)); URL.revokeObjectURL(url);
    };
    img.onerror = function () { toast('Could not read that photo'); };
    img.src = url;
  }
  function saveForm() {
    var floor = ($('floorOther').value.trim() || formFloor).toUpperCase();
    var slot = $('slot').value.trim(), note = $('note').value.trim();
    var base = editing ? state.current : { ts: Date.now(), lat: null, lng: null, acc: null };
    if (!editing && gps) { base.lat = gps.lat; base.lng = gps.lng; base.acc = gps.acc; }
    if (!floor && !slot && !formPhoto && base.lat == null) {
      toast('Add a floor, slot number or photo – no GPS yet'); return;
    }
    base.floor = floor; base.slot = slot; base.note = note; base.photo = formPhoto;
    state.current = base;
    if (persist()) { stopGps(); render(); toast('Spot saved'); }
  }

  // ---------- parked screen ----------
  var agoTimer;
  function renderParked() {
    var c = state.current;
    $('slotLine').textContent = describe(c);
    $('ago').textContent = ago(c.ts);
    $('metaLine').textContent = 'Saved ' + new Date(c.ts).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' });
    $('photoView').hidden = !c.photo; if (c.photo) $('photoView').src = c.photo;
    $('noteView').hidden = !c.note; $('noteView').textContent = c.note ? '“' + c.note + '”' : '';
    $('accView').textContent = c.lat != null ? 'GPS saved (±' + c.acc + ' m)' : 'No GPS saved – use the floor, slot and photo above.';
    clearInterval(agoTimer); agoTimer = setInterval(function () { if (state.current) $('ago').textContent = ago(state.current.ts); }, 30000);
  }
  function renderHome() {
    var h = state.history, ul = $('history'); ul.innerHTML = '';
    $('historyWrap').hidden = !h.length;
    h.forEach(function (x) {
      var li = document.createElement('li');
      var a = document.createElement('span'); a.textContent = describe(x);
      var w = document.createElement('span'); w.className = 'when'; w.textContent = new Date(x.ts).toLocaleDateString([], { day: 'numeric', month: 'short' });
      li.appendChild(a); li.appendChild(w); ul.appendChild(li);
    });
  }
  function render() {
    if (state.current) { renderParked(); show('parked'); } else { renderHome(); show('home'); }
  }

  // ---------- find my car ----------
  var findWatch = null, heading = null, pos = null;
  function onOrient(e) {
    var h = null;
    if (typeof e.webkitCompassHeading === 'number') h = e.webkitCompassHeading;
    else if (e.absolute && typeof e.alpha === 'number') h = (360 - e.alpha) % 360;
    else if (typeof e.alpha === 'number' && e.type === 'deviceorientationabsolute') h = (360 - e.alpha) % 360;
    if (h !== null) { heading = h; updateFind(); }
  }
  function startFind() {
    var c = state.current;
    show('find'); heading = null; pos = null;
    $('mapsLink').hidden = c.lat == null;
    $('findPhoto').hidden = !c.photo; if (c.photo) $('findPhoto').src = c.photo;
    if (c.lat != null) $('mapsLink').href = 'https://www.google.com/maps/dir/?api=1&destination=' + c.lat + ',' + c.lng + '&travelmode=walking';
    if (c.lat == null) {
      $('distance').textContent = describe(c); $('findStatus').textContent = 'No GPS was saved for this spot. Location was off when you parked.';
      $('compass').hidden = true; $('findHint').textContent = 'Look for the floor and slot number, and match the photo. Next time, allow location and wait for "GPS locked" before saving.'; return;
    }
    $('compass').hidden = false; $('distance').textContent = '--';
    $('findStatus').textContent = 'Getting your location…'; $('findHint').textContent = describe(c) + (c.note ? ' – ' + c.note : '');
    try {
      if (window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission === 'function') DeviceOrientationEvent.requestPermission().catch(function () {});
    } catch (e) {}
    window.addEventListener('deviceorientationabsolute', onOrient, true);
    window.addEventListener('deviceorientation', onOrient, true);
    if (!navigator.geolocation) { $('findStatus').textContent = 'Location is not supported on this device.'; return; }
    findWatch = navigator.geolocation.watchPosition(function (p) {
      pos = { lat: p.coords.latitude, lng: p.coords.longitude, acc: Math.round(p.coords.accuracy || 0) }; updateFind();
    }, function (err) {
      $('findStatus').textContent = err && err.code === 1 ? 'Location permission is off. Turn it on to see the way.' : 'Could not get your location.';
    }, { enableHighAccuracy: true, maximumAge: 1000, timeout: 20000 });
  }
  function stopFind() {
    if (findWatch !== null) { navigator.geolocation.clearWatch(findWatch); findWatch = null; }
    window.removeEventListener('deviceorientationabsolute', onOrient, true);
    window.removeEventListener('deviceorientation', onOrient, true);
  }
  function updateFind() {
    var c = state.current; if (!c || !pos || c.lat == null) return;
    var d = haversine(pos.lat, pos.lng, c.lat, c.lng), b = bearing(pos.lat, pos.lng, c.lat, c.lng);
    $('distance').textContent = d < 12 ? "You're here!" : fmtDist(d);
    $('findStatus').textContent = d < 12 ? 'Look around for your car.' : (heading === null ? 'Arrow points relative to north (compass unavailable).' : 'Walk in the direction of the arrow.');
    $('arrow').parentNode.style.transform = 'rotate(' + Math.round(b - (heading || 0)) + 'deg)';
    var weak = pos.acc > 35 || (c.acc || 0) > 35;
    $('findHint').textContent = (weak && d < 120 ? 'GPS is weak indoors – use the floor, slot and photo to finish. ' : '') + describe(c) + (c.note ? ' – ' + c.note : '');
  }

  // ---------- actions ----------
  function share() {
    var c = state.current, t = 'My car is parked at ' + describe(c) + (c.note ? ' (' + c.note + ')' : '') +
      (c.lat != null ? '. https://www.google.com/maps/search/?api=1&query=' + c.lat + ',' + c.lng : '.');
    if (navigator.share) navigator.share({ title: 'My parking spot', text: t }).catch(function () {});
    else if (navigator.clipboard) navigator.clipboard.writeText(t).then(function () { toast('Copied to clipboard'); });
    else toast(t);
  }
  function clearSpot() {
    if (!confirm('Clear this parking spot? Do this once you have found your car.')) return;
    var c = state.current; state.history.unshift({ floor: c.floor, slot: c.slot, ts: c.ts });
    state.history = state.history.slice(0, 5); state.current = null;
    if (persist()) { render(); toast('Spot cleared'); }
  }

  // ---------- wire up ----------
  if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
  }

  document.addEventListener('DOMContentLoaded', function () {
    load(); buildChips();
    $('parkBtn').onclick = function () { openForm(false); };
    $('saveBtn').onclick = saveForm;
    $('cancelBtn').onclick = function () { stopGps(); render(); };
    $('editBtn').onclick = function () { openForm(true); };
    $('shareBtn').onclick = share;
    $('clearBtn').onclick = clearSpot;
    $('findBtn').onclick = startFind;
    $('backBtn').onclick = function () { stopFind(); render(); };
    $('photoInput').onchange = function (e) { readPhoto(e.target.files[0]); e.target.value = ''; };
    $('removePhoto').onclick = function () { setPhoto(null); };
    $('floorOther').oninput = function () { if (this.value) { formFloor = ''; markChips(); } };
    render();
  });
})();
