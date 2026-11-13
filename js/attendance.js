/* Multi-face scan with the original local-storage flow and optional server-verified MongoDB attendance. */
(function () {
  const REQUIRED = 2;
  const video = $('video'), overlay = $('overlay');
  let running = false, ready = false, streaks = new Map(), unknownStreaks = new Map();
  let serverUser = null, serverSocket = null, geoConfig = null, latestGps = null, gpsWatch = null, teacherReady = false;
  const pendingServer = new Set(), lastAttempt = new Map(), remoteLabels = new Map(), liveRows = new Map();
  const say = (message, type) => setStatus($('status'), message, type || '');
  const session = () => 'General';
  const serverSessionId = () => $('serverSession')?.value || '';
  const onlineMode = () => Boolean(serverUser && serverSessionId());
  const todayKolkata = () => {
    const parts = new Intl.DateTimeFormat('en', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
    const value = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${value.year}-${value.month}-${value.day}`;
  };

  function render() {
    const localRows = DB.logs().filter(row => row.date === DB.today()).reverse().map(row => ({
      key: `local:${row.id}:${row.session || 'General'}`, name: row.name, roll: row.roll, session: row.session || 'General', time: row.time
    }));
    const serverRows = [...liveRows.values()].filter(row => row.date === todayKolkata()).map(row => ({
      key: `server:${row._id}`, name: row.student?.name || 'Student', roll: row.student?.roll || '',
      session: row.session?.label || row.session?.className || 'Server session',
      time: row.checkIn ? new Date(row.checkIn).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }) : ''
    }));
    const rows = [...serverRows, ...localRows];
    const distinct = new Set(rows.map(row => row.roll || row.name));
    $('present').textContent = `${distinct.size} present`;
    const batch = $('batchStatus'); if (batch) batch.textContent = `Today's verified attendance: ${distinct.size} student(s). Multiple faces can be processed during one camera session.`;
    $('list').innerHTML = rows.length
      ? rows.map(row => `<tr data-row="${esc(row.key)}"><td>${esc(row.name)}</td><td>${esc(row.roll)}</td><td>${esc(row.session)}</td><td>${esc(row.time)}</td></tr>`).join('')
      : '<tr><td colspan="4">No one marked yet.</td></tr>';
  }

  function result(kind, best, serverStudent) {
    const node = $('result');
    const person = serverStudent || best?.person;
    const pct = best ? Math.round(best.similarity * 100) : 0;
    const info = best ? `<div class="muted">Distance ${best.distance.toFixed(2)} · cosine similarity ${pct}%</div>` : '';
    if (kind === 'new' || kind === 'dup') {
      node.className = 'result ok';
      node.innerHTML = `<span class="badge ok">${kind === 'new' ? 'Marked present' : 'Already present'}</span><div class="big">${esc(person?.name || 'Student')}</div><div class="muted">Roll ${esc(person?.roll || '')}${person?.className || person?.cls ? ` · ${esc(person.className || person.cls)}` : ''}</div>${info}`;
    } else if (kind === 'ambiguous') {
      node.className = 'result bad';
      node.innerHTML = '<span class="badge warn">Not sure</span><div class="big">Two people look similar</div><div class="muted">Move closer, face the camera and try again.</div>';
    } else if (kind === 'unknown') {
      node.className = 'result bad';
      node.innerHTML = `<span class="badge bad">Not recognised</span><div class="big">Unknown face</div><div class="muted">${onlineMode() ? 'GUARDGEN has received a review notification. An unknown face does not imply wrongdoing.' : 'Register this person first, or try better light.'}</div>`;
    } else if (kind === 'error') {
      node.className = 'result bad';
      node.innerHTML = `<span class="badge bad">Server attendance not saved</span><div class="muted">${esc(String(serverStudent || 'Request failed'))}</div>`;
    }
  }

  function markLocal(best, serverStudent) {
    const localPerson = best.person;
    const serverName = serverStudent?.name || localPerson.name;
    const serverRoll = serverStudent?.roll || localPerson.roll;
    const selected = $('serverSession')?.selectedOptions?.[0];
    const sessionName = onlineMode() ? `${selected.textContent}` : session();
    const logs = DB.logs();
    if (logs.some(row => row.id === localPerson.id && row.date === DB.today() && row.session === sessionName)) return 'dup';
    const now = new Date();
    logs.push({ id: localPerson.id, name: serverName, roll: serverRoll, cls: localPerson.cls || '', session: sessionName, date: DB.today(),
      time: now.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }), timestamp: now.toISOString(),
      distance: +best.distance.toFixed(3), similarity: +best.similarity.toFixed(3), verificationMethod: onlineMode() ? 'face-server' : 'face-local', gps: null });
    if (!DB.save('logs', logs)) return 'dup';
    render(); beep(); toast(`Attendance saved for ${serverName}`);
    return 'new';
  }

  async function postToServer(embedding, key, best) {
    if (!onlineMode() || pendingServer.has(key) || remoteLabels.has(key)) return;
    const now = Date.now();
    if (now - (lastAttempt.get(key) || 0) < 2500) return;
    pendingServer.add(key); lastAttempt.set(key, now);
    try {
      let gps = latestGps;
      if (!gps) {
        say('Location is required for verified server attendance. Allow location access and wait for a GPS fix.', 'bad');
        if (gpsWatch === null) startAttendanceGps();
        return;
      }
      const response = await api('/attendance/recognize', { method: 'POST', body: JSON.stringify({ sessionId: serverSessionId(), embedding, ...(gps ? { gps } : {}) }) });
      if (response.status === 'marked') {
        const kind = 'new';
        if (response.attendance) { liveRows.set(response.attendance._id, response.attendance); render(); }
        result(kind, best, response.student);
        remoteLabels.set(key, `${response.student.name} · Present`);
      } else if (response.status === 'duplicate') {
        result('dup', best, response.student);
        const currentRows = await api(`/attendance?date=${encodeURIComponent(todayKolkata())}&sessionId=${encodeURIComponent(serverSessionId())}`);
        currentRows.forEach(row => liveRows.set(row._id, row)); render();
        remoteLabels.set(key, `${response.student.name} · Already present`);
      } else if (response.status === 'ambiguous') {
        result('ambiguous'); remoteLabels.set(key, 'Ambiguous server match');
      } else {
        result('unknown'); remoteLabels.set(key, 'Unknown · GUARDGEN notified');
      }
    } catch (error) {
      result('error', null, error.message);
      remoteLabels.set(key, 'Server error');
      say(error.message, 'bad');
    } finally {
      pendingServer.delete(key);
      setTimeout(() => remoteLabels.delete(key), 30000);
    }
  }

  async function setupServerAttendance() {
    if (typeof token === 'undefined' || !token || typeof api !== 'function') {
      say('Teacher sign-in is required. Redirecting to teacher login…', 'bad');
      location.replace('teacher-login.html?next=attendance.html');
      return false;
    }
    try {
      const meResponse = await api('/me');
      if (meResponse.user?.role !== 'teacher') {
        say('Access denied. Only an authenticated teacher can take attendance.', 'bad');
        location.replace(meResponse.user?.role === 'admin' ? 'admin-dashboard.html' : 'teacher-login.html?reason=teacher-only');
        return false;
      }
      serverUser = meResponse.user;
      const wrapper = $('serverAttendance');
      wrapper.hidden = false;
      const selector = $('serverSession');
      const loadSessions = async (selectId) => {
        const sessions = await api('/sessions?status=open');
        selector.innerHTML = '<option value="">Select an open class session…</option>' + sessions.map(item => `<option value="${esc(item._id)}">${esc(item.className)} · ${esc(item.label || 'Session')}</option>`).join('');
        const wanted = selectId || (sessions.length === 1 ? sessions[0]._id : '');
        if (wanted && sessions.some(item => item._id === wanted)) selector.value = wanted;
        $('endSession').disabled = !selector.value;
        return sessions;
      };
      selector.onchange = () => {
        streaks.clear(); unknownStreaks.clear(); remoteLabels.clear(); lastAttempt.clear();
        $('endSession').disabled = !selector.value;
        say(selector.value ? 'Class session selected. Multi-face camera attendance is ready.' : 'Select an open class session to continue.');
      };
      await loadSessions();
      const classes = [...new Set((serverUser.classes || []).filter(Boolean))].sort((a, b) => a.localeCompare(b));
      $('newSessionBox').hidden = false;
      $('newClass').innerHTML = '<option value="">Choose your class…</option>' + classes.map(name => `<option value="${esc(name)}">${esc(name)}</option>`).join('');
      if (classes.length === 1) $('newClass').value = classes[0];
      if (!classes.length) say('No classes are assigned to your account yet. Ask an administrator to assign a class.', 'bad');
      $('newSession').onclick = async () => {
        const className = $('newClass').value;
        if (!className) return say('Choose one of your assigned classes first.', 'bad');
        $('newSession').disabled = true;
        try {
          const created = await api('/sessions', { method: 'POST', body: JSON.stringify({ className, label: $('newLabel').value.trim() }) });
          await loadSessions(created._id); $('newLabel').value = '';
          streaks.clear(); unknownStreaks.clear(); remoteLabels.clear(); lastAttempt.clear();
          say(`Session started for ${className}. Press Start class scan.`, 'ok');
        } catch (error) { say(error.message, 'bad'); }
        finally { $('newSession').disabled = false; }
      };
      $('endSession').onclick = async () => {
        if (!selector.value) return;
        try {
          if (running) stopAll();
          await api(`/sessions/${encodeURIComponent(selector.value)}/stop`, { method: 'PATCH', body: '{}' });
          await loadSessions(); say('Session ended.', 'ok');
        } catch (error) { say(error.message, 'bad'); }
      };
      const config = await api('/geofence'); geoConfig = config;
      const existing = await api(`/attendance?date=${encodeURIComponent(todayKolkata())}`);
      existing.forEach(row => liveRows.set(row._id, row)); render();
      $('enableAttendanceGps').onclick = startAttendanceGps;
      if (typeof connectSocket === 'function') serverSocket = connectSocket(row => {
        if (row.date === todayKolkata()) { liveRows.set(row._id, row); render(); }
      });
      teacherReady = true;
      say(`Teacher verified: ${serverUser.name || serverUser.email}. Select your open class session to begin batch attendance.`);
      return true;
    } catch (error) {
      say(error.message || 'Teacher authentication failed. Please sign in again.', 'bad');
      localStorage.removeItem('fv-token');
      location.replace('teacher-login.html?next=attendance.html');
      return false;
    }
  }

  function startAttendanceGps() {
    if (!navigator.geolocation) return $('attendanceGpsStatus').textContent = 'This browser does not support GPS.';
    if (gpsWatch !== null) return;
    $('attendanceGpsStatus').textContent = 'Waiting for a GPS fix…';
    gpsWatch = navigator.geolocation.watchPosition(position => {
      latestGps = { lat: position.coords.latitude, lng: position.coords.longitude, accuracy: position.coords.accuracy };
      $('attendanceGpsStatus').textContent = `Live fix ±${Math.round(latestGps.accuracy)} m · updated ${new Date(position.timestamp).toLocaleTimeString()}`;
    }, error => {
      if (error.code === 1) {
        $('attendanceGpsStatus').textContent = 'Location permission was blocked. Allow location for this site in the browser address bar, then press Enable GPS.';
        say('Location access is required to save attendance. Allow it in the browser settings and try again.', 'bad');
        if (gpsWatch !== null) navigator.geolocation.clearWatch(gpsWatch);
        gpsWatch = null; latestGps = null;
      } else {
        $('attendanceGpsStatus').textContent = 'Still looking for a GPS fix… move near a window or outdoors if this takes long.';
      }
    }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 5000 });
  }

  async function scan() {
    if (!running) return;
    const context = overlay.getContext('2d');
    overlay.width = video.videoWidth || 640; overlay.height = video.videoHeight || 480;
    context.clearRect(0, 0, overlay.width, overlay.height);
    try {
      const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.45 }))
        .withFaceLandmarks().withFaceDescriptors();
      const seen = new Set(), seenUnknown = new Set();
      let recognized = 0, unknown = 0;
      for (let index = 0; index < detections.length; index++) {
        const detection = detections[index], embedding = Array.from(detection.descriptor), box = detection.detection.box;
        const quality = faceQuality({ box, embedding, score: detection.detection.score }, video);
        const match = quality.ok ? findMatch(embedding) : { status: 'uncertain' };
        let color = '#d99a2b', label = 'Verification pending';
        if (!quality.ok) label = quality.msg || 'Face not clear';
        else if (match.status === 'match') {
          const person = match.best.person; recognized++; color = '#14866d'; label = `${person.name} · ${person.roll} · ${Math.round(match.best.similarity * 100)}%`;
          const key = `known:${person.id}`; seen.add(key);
          const count = (streaks.get(key) || 0) + 1; streaks.set(key, count);
          if (onlineMode()) {
            const remoteKey = `${serverSessionId()}:student:${person.id}`;
            if (count >= REQUIRED) { label = remoteLabels.get(remoteKey) || 'Server verification pending'; postToServer(embedding, remoteKey, match.best); }
          } else if (count >= REQUIRED) {
            const kind = markLocal(match.best); label = `${person.name} · ${kind === 'dup' ? 'Already present' : 'Present'}`;
            if (kind === 'new') result('new', match.best);
          }
        } else {
          unknown++; color = '#c8432b'; label = match.status === 'ambiguous' ? 'Ambiguous match' : 'Unknown face';
          if (onlineMode()) {
            const indexKey = `unknown:${index}`; seenUnknown.add(indexKey);
            const count = (unknownStreaks.get(indexKey) || 0) + 1; unknownStreaks.set(indexKey, count);
            const remoteKey = `${serverSessionId()}:unknown:${index}`;
            if (count >= REQUIRED) { label = remoteLabels.get(remoteKey) || 'Checking server roster…'; postToServer(embedding, remoteKey, null); }
          }
        }
        context.strokeStyle = color; context.lineWidth = 3; context.strokeRect(box.x, box.y, box.width, box.height);
        context.fillStyle = color; context.fillRect(box.x, Math.max(0, box.y - 24), Math.min(box.width, 260), 22);
        context.fillStyle = '#fff'; context.font = '13px sans-serif'; context.fillText(label, box.x + 5, Math.max(15, box.y - 8));
      }
      for (const key of [...streaks.keys()]) if (!seen.has(key)) streaks.delete(key);
      for (const key of [...unknownStreaks.keys()]) if (!seenUnknown.has(key)) unknownStreaks.delete(key);
      say(`Faces: ${detections.length} · Recognized locally: ${recognized} · Unknown/ambiguous: ${unknown} · GPS: ${latestGps ? `ready ±${Math.round(latestGps.accuracy)} m` : 'waiting for location'}`);
      if (!detections.length) say('Looking for faces…');
    } catch { say('Detection frame skipped.'); }
    if (running) setTimeout(scan, 350);
  }

  function stopAll() {
    running = false; stopCamera(video);
    overlay.getContext('2d').clearRect(0, 0, overlay.width, overlay.height);
    $('start').textContent = 'Start class scan'; $('flip').disabled = true; say('Stopped.');
    if (gpsWatch !== null && navigator.geolocation) navigator.geolocation.clearWatch(gpsWatch);
    gpsWatch = null;
    if (serverSocket) { serverSocket.disconnect(); serverSocket = null; }
    if (window.__fvSocket) { window.__fvSocket.disconnect(); window.__fvSocket = null; }
  }

  loadModels().then(() => { ready = true; say('Models ready. Press Start scanning.'); })
    .catch(() => say('Could not load the face models. Check your internet connection and reload.', 'bad'));
  $('start').onclick = async () => {
    if (running) return stopAll();
    if (!teacherReady || serverUser?.role !== 'teacher') return say('Only a signed-in teacher can operate the attendance camera.', 'bad');
    if (!serverSessionId()) return say('Select an open class session before starting the camera.', 'bad');
    if (!ready) return say('Face models are still loading…');
    startAttendanceGps(); // asks for location permission together with the camera
    try { await startCamera(video); } catch (error) { return say(cameraError(error), 'bad'); }
    running = true; streaks.clear(); unknownStreaks.clear();
    $('start').textContent = 'Stop scanning'; $('flip').disabled = false; scan();
  };
  document.addEventListener('camerastopped', () => { if (running) stopAll(); });
  $('flip').onclick = async () => { try { await flipCamera(video); } catch (error) { say(cameraError(error), 'bad'); } };
  window.addEventListener('pagehide', () => { if (gpsWatch !== null && navigator.geolocation) navigator.geolocation.clearWatch(gpsWatch); });
  setupServerAttendance();
  render();
})();
