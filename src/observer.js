window.GhostGuard = window.GhostGuard || {};

GhostGuard.observer = (function () {

  let mo = null;
  let debounceTimer = null;

  function debounce(fn, ms) {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(fn, ms);
  }

  function isExternalMutation(mutations) {
    return mutations.some(m =>
      Array.from(m.addedNodes).some(n => !n.classList?.contains('gg-badge-host'))
    );
  }

  function start(processCardsFn) {
    if (mo) return;

    // 1. MutationObserver — catches new cards as React renders them
    mo = new MutationObserver((mutations) => {
      if (isExternalMutation(mutations)) {
        debounce(() => processCardsFn(false), 50);
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });

    // 2. URL poller — catches SPA navigations (pushState)
    let lastHref = location.href;
    setInterval(() => {
      if (location.href !== lastHref) {
        lastHref = location.href;
        processCardsFn(true);
      }
    }, 400);

    // 3. Heartbeat — catches anything the above two miss
    //    processCard bails instantly on already-scored cards, so this is cheap
    setInterval(() => processCardsFn(false), 2000);

    // 4. popstate (back/forward button)
    window.addEventListener('popstate', () => processCardsFn(true));

    // Initial run
    processCardsFn(false);
  }

  function stop() {
    if (mo) { mo.disconnect(); mo = null; }
    clearTimeout(debounceTimer);
  }

  return { start, stop };
}());
