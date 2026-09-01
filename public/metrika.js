(function () {
  var counterId = 112133624;
  window.__ANNWORD_METRIKA_ID__ = counterId;

  (function (m, e, t, r, i, k, a) {
    m[i] = m[i] || function () { (m[i].a = m[i].a || []).push(arguments); };
    m[i].l = 1 * new Date();
    for (var j = 0; j < document.scripts.length; j += 1) {
      if (document.scripts[j].src === r) return;
    }
    k = e.createElement(t);
    a = e.getElementsByTagName(t)[0];
    k.async = 1;
    k.src = r;
    a.parentNode.insertBefore(k, a);
  })(window, document, 'script', 'https://mc.yandex.ru/metrika/tag.js?id=' + counterId, 'ym');

  window.ym(counterId, 'init', {
    defer: true,
    ssr: true,
    webvisor: true,
    clickmap: true,
    trackLinks: true,
    accurateTrackBounce: true
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
