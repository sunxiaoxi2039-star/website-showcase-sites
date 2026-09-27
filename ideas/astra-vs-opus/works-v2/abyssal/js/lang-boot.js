// 语言引导（经典脚本，放在 <head> 里同步执行，避免首屏闪中文）。
// 决定顺序：?lang= → localStorage['avo-lang'] → navigator.language。
// 切换时：写 localStorage、设 <html lang>、同步 <title>/meta description、交换带 data-en-* 的属性、
// 在 window 上派发 'avo:lang' 事件（ES Module 里的动态界面据此重绘），不刷新页面。
(function () {
  var KEY = 'avo-lang';
  var root = document.documentElement;
  var stored = null, storageOk = true;
  try { stored = localStorage.getItem(KEY); } catch (e) { storageOk = false; }
  var q = null;
  try { q = new URLSearchParams(location.search).get('lang'); } catch (e) { /* ignore */ }
  var lang = (q === 'zh' || q === 'en') ? q
    : (stored === 'zh' || stored === 'en') ? stored
    : (/^zh/i.test(navigator.language || '') ? 'zh' : 'en');

  var ATTRS = ['aria-label', 'title', 'placeholder'];
  function swapAttrs() {
    for (var i = 0; i < ATTRS.length; i++) {
      var a = ATTRS[i];
      var els = document.querySelectorAll('[data-en-' + a + ']');
      for (var j = 0; j < els.length; j++) {
        var e = els[j];
        if (!e.hasAttribute('data-zh-' + a)) e.setAttribute('data-zh-' + a, e.getAttribute(a) || '');
        e.setAttribute(a, e.getAttribute('data-' + lang + '-' + a));
      }
    }
  }
  function head() {
    root.lang = lang === 'en' ? 'en' : 'zh-CN';
    var t = root.getAttribute('data-title-' + lang);
    if (t) document.title = t;
    var d = root.getAttribute('data-desc-' + lang);
    var m = document.querySelector('meta[name="description"]');
    if (d && m) m.setAttribute('content', d);
  }
  function button() {
    var b = document.getElementById('avoLang');
    if (!b) return;
    b.textContent = lang === 'en' ? '中' : 'EN';
    b.setAttribute('aria-label', lang === 'en' ? '切换到中文' : 'Switch to English');
    b.setAttribute('lang', lang === 'en' ? 'zh-CN' : 'en');
  }
  function links() {
    // localStorage 不可用时，给站内链接带上 ?lang=，保证跳转后语言一致
    if (storageOk) return;
    var as = document.querySelectorAll('a[data-internal]');
    for (var i = 0; i < as.length; i++) {
      var u = as[i].getAttribute('href').split('?')[0];
      as[i].setAttribute('href', u + '?lang=' + lang);
    }
  }
  function body() { swapAttrs(); button(); links(); }

  function set(l) {
    if (l !== 'zh' && l !== 'en') return;
    lang = l;
    try { localStorage.setItem(KEY, l); storageOk = true; } catch (e) { storageOk = false; }
    head(); body();
    var ev;
    try { ev = new CustomEvent('avo:lang', { detail: { lang: l } }); } catch (e) { ev = document.createEvent('CustomEvent'); ev.initCustomEvent('avo:lang', false, false, { lang: l }); }
    window.dispatchEvent(ev);
  }

  window.AVO_LANG = {
    get: function () { return lang; },
    set: set,
    toggle: function () { set(lang === 'en' ? 'zh' : 'en'); },
    refresh: body,
  };
  head();
  function ready() {
    body();
    var b = document.getElementById('avoLang');
    if (b) b.addEventListener('click', function () { window.AVO_LANG.toggle(); b.blur(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready);
  else ready();
})();
