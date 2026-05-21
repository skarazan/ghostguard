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
        debounce(() => processCardsFn(false), 150);
      }
    });

    mo.observe(document.body, { childList: true, subtree: true });

    // P5: SPA navigation — intercept history.pushState and popstate
    const _push = history.pushState.bind(history);
    history.pushState = function (...args) {
      _push(...args);
      // Pass resetNav=true so content.js clears lastDetailId
      debounce(() => processCardsFn(true), 300);
    };

    const _replace = history.replaceState.bind(history);
    history.replaceState = function (...args) {
      _replace(...args);
      debounce(() => processCardsFn(true), 300);
    };

    window.addEventListener('popstate', () => debounce(() => processCardsFn(true), 300));

    // Initial run
    processCardsFn(false);
  }

  function stop() {
    if (mo) { mo.disconnect(); mo = null; }
    clearTimeout(debounceTimer);
  }

  return { start, stop };
}());
