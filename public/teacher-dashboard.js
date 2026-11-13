'use strict';
document.addEventListener('DOMContentLoaded', () => {
  dashboard('teacher').catch(error => notice(error.message || 'Could not load the teacher dashboard.'));
});
