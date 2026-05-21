window.GhostGuard = window.GhostGuard || {};

GhostGuard.observer = (function () {

  let mo = null;
  let debounceTimer = null;
  let _processCardsFn = null;

  function debounce(fn, ms) {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(fn, ms);
  }

  // Filter out mutations caused by our own badge injections
  function isExternalMutation(mutations) {
    return mutations.some(m =>
      Array.from(m.addedNodes).some(n => !n.classList?.contains('gg-badge-host'))
    );
  }

  function start(processCardsFn) {
    if (mo) return;
    _processCardsFn = processCardsFn;

    mo = new MutationObserver((mutations) => {
      if (isExternalMutation(mutations)) {
        debounce(() => processCardsFn(false), 50);
      }
    });

    mo.observe(document.body, { childList: true, subtree: true });

    // SPA nav fallback — background.js handles this via webNavigation API
    // but keep a lightweight URL poller as belt-and-suspenders
    let lastHref = location.href;
    setInterval(() => {
      if (location.href !== lastHref) {
        lastHref = location.href;
        debounce(() => processCardsFn(true), 100);
      }
    }, 500);

    window.addEventListener('popstate', () => debounce(() => processCardsFn(true), 100));

    // Initial run
    processCardsFn(false);
  }

  function stop() {
    if (mo) { mo.disconnect(); mo = null; }
    clearTimeout(debounceTimer);
  }

  return { start, stop };
}());
