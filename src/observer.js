window.GhostGuard = window.GhostGuard || {};

GhostGuard.observer = (function () {

  let mo = null;
  let debounceTimer = null;

  function debounce(fn, ms) {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(fn, ms);
  }

  function start(processCardsFn) {
    if (mo) return;

    mo = new MutationObserver(() => {
      debounce(processCardsFn, 150);
    });

    mo.observe(document.body, { childList: true, subtree: true });

    // Initial run
    processCardsFn();
  }

  function stop() {
    if (mo) { mo.disconnect(); mo = null; }
    clearTimeout(debounceTimer);
  }

  return { start, stop };
}());
