'use strict';
document.addEventListener('DOMContentLoaded', async () => {
  try {
    if (!await requireRole(['admin', 'guard', 'teacher'])) return;
    renderAlerts(await api('/alerts'));
    const form = el('alertForm');
    if (form) form.addEventListener('submit', async event => {
      event.preventDefault();
      const values = Object.fromEntries(new FormData(form).entries());
      try {
        await api('/alerts', { method: 'POST', body: JSON.stringify(values) });
        form.reset();
        notice('Security alert submitted and shared with authorized staff.');
        renderAlerts(await api('/alerts'));
      } catch (error) { notice(error.message); }
    });
    connectSocket(() => api('/alerts').then(renderAlerts).catch(error => notice(error.message)));
  } catch (error) { notice(error.message || 'Could not load security alerts.'); }
});
