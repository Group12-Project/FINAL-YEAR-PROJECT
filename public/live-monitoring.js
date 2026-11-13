'use strict';
document.addEventListener('DOMContentLoaded', () => { startLiveMonitoring().catch(error => notice(error.message)); });

async function startLiveMonitoring() {
  if (!await requireRole(['admin', 'teacher', 'guard'])) return;
  const video = el('cam'), start = el('start'), stop = el('stop'), status = el('cameraStatus');
  let stream = null;
  const setStatus = message => { if (status) status.textContent = message; };
  const stopCamera = () => {
    if (stream) stream.getTracks().forEach(track => track.stop());
    stream = null;
    if (video) video.srcObject = null;
    if (start) start.disabled = false;
    if (stop) stop.disabled = true;
    setStatus('Camera is off. No video is being recorded or uploaded.');
  };
  if (start) start.onclick = async () => {
    if (!navigator.mediaDevices?.getUserMedia) return notice('Camera access requires HTTPS or localhost and a supported browser.');
    start.disabled = true;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      video.srcObject = stream; await video.play(); stop.disabled = false;
      setStatus('Camera preview is active on this device only. This page does not perform CCTV recording or face recognition.');
    } catch (error) {
      start.disabled = false;
      notice(error.name === 'NotAllowedError' ? 'Camera permission was denied. Allow camera access in browser settings.' : error.message || 'Could not start camera.');
      setStatus('Camera could not start.');
    }
  };
  if (stop) { stop.disabled = true; stop.onclick = stopCamera; }
  window.addEventListener('pagehide', stopCamera);
  try {
    if (me.role === 'guard') {
      const alerts = await api('/alerts');
      if (el('monitorSummary')) el('monitorSummary').textContent = `${alerts.filter(item => item.status !== 'resolved').length} unresolved security alert(s)`;
    } else {
      const [sessions, attendance] = await Promise.all([api('/sessions?status=open'), api('/attendance')]);
      if (el('monitorSummary')) el('monitorSummary').textContent = `${sessions.length} open session(s) · ${attendance.length} attendance record(s) available`;
      if (el('monitorSessions')) el('monitorSessions').innerHTML = sessions.map(item => `<li>${esc(item.className)} · ${esc(item.label || 'Attendance session')} · ${esc(item.status)}</li>`).join('') || '<li>No open sessions.</li>';
      connectSocket(row => { if (el('monitorSummary')) el('monitorSummary').textContent = `New attendance: ${row.student?.name || 'Student'} · ${new Date(row.checkIn || Date.now()).toLocaleTimeString()}`; });
    }
  } catch (error) { notice(error.message); }
}
