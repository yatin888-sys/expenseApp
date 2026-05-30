// Service worker registration. Externalised from index.html so the CSP can
// forbid inline <script> blocks (script-src does not include 'unsafe-inline').
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(e => console.warn('SW registration failed', e));
}
