(function () {
  var counterId = 112133624;
  window.__ANNWORD_METRIKA_ID__ = counterId;

  window.ym = window.ym || function () { (window.ym.a = window.ym.a || []).push(arguments); };
  window.ym.l = window.ym.l || (1 * new Date());

  window.ym(counterId, 'init', {
    defer: true,
    ssr: true,
    webvisor: true,
    clickmap: true,
    trackLinks: true,
    accurateTrackBounce: true,
    referrer: document.referrer,
    url: window.location.href
  });

  var lastTrackedUrl = '';
  var routeTimer = null;

  function sendPageView() {
    routeTimer = null;
    var nextUrl = window.location.href;
    if (nextUrl === lastTrackedUrl) return;
    var referer = lastTrackedUrl || document.referrer || undefined;
    lastTrackedUrl = nextUrl;
    window.ym(counterId, 'hit', nextUrl, {
      referer: referer,
      title: document.title
    });
  }

  function schedulePageView() {
    if (routeTimer !== null) window.clearTimeout(routeTimer);
    routeTimer = window.setTimeout(sendPageView, 50);
  }

  ['pushState', 'replaceState'].forEach(function (method) {
    var original = window.history[method];
    if (typeof original !== 'function') return;
    window.history[method] = function () {
      var result = original.apply(this, arguments);
      schedulePageView();
      return result;
    };
  });

  window.addEventListener('popstate', schedulePageView);
  window.addEventListener('hashchange', schedulePageView);
  sendPageView();
})();
