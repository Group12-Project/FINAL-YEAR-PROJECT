/* FaceVector API URL configuration.
   GitHub Pages is static hosting and cannot run the Node/MongoDB API.
   Set the repository Actions secret FV_SERVER_URL to your deployed HTTPS API URL.
*/
(function () {
  const current = window.location;
  const isLocalHost = ['localhost', '127.0.0.1'].includes(current.hostname);
  const isLocalPreview = isLocalHost && current.port && current.port !== '3000';
  const isGitHubPages = current.hostname.endsWith('.github.io');
  const defaultApi = isLocalPreview ? 'http://127.0.0.1:3000' : '';
  window.FV_SERVER_URL = (window.FV_SERVER_URL || defaultApi).replace(/\/$/, '');
  window.FV_SERVER_CONFIG_ERROR = isGitHubPages && !window.FV_SERVER_URL
    ? 'GitHub Pages only hosts the website files. Deploy the FaceVector Node API to a backend host, then add its HTTPS URL as the GitHub repository Actions secret FV_SERVER_URL and redeploy.'
    : '';
})();
