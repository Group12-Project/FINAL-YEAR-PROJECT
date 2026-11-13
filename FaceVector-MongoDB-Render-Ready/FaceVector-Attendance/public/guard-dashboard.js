'use strict';
document.addEventListener('DOMContentLoaded', async () => {
  try {
    if (!await requireRole(['guard'])) return;
    const alerts = await api('/alerts');
    renderAlerts(alerts);
    connectSocket(() => api('/alerts').then(renderAlerts).catch(error => notice(error.message)));
  } catch (error) { notice(error.message || 'Could not load GUARDGEN.'); }
});
