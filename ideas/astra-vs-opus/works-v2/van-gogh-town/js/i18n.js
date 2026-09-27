/* 中英切换（classic script，先于模块执行，避免首帧闪中文）
 * 初始语言：?lang= → localStorage['avo-lang'] → navigator.language
 * 静态文字：元素上写 data-en="English HTML"，中文取元素原有 innerHTML
 * 属性：data-en-title / data-en-aria-label / data-en-placeholder / data-en-alt
 * 标题与描述：<html data-title-en data-desc-en>
 * 动态内容：window.I18N.t(zh, en) / I18N.L({zh, en}) / I18N.on(fn) 在切换时重绘
 * 按钮：放进 [data-lang-slot]（顶栏右侧），没有则 fixed 右上角
 */
(function () {
  'use strict';
  var KEY = 'avo-lang';
  var root = document.documentElement;
  var storeOK = true;
  function readStore() { try { return localStorage.getItem(KEY); } catch (e) { storeOK = false; return null; } }
  function writeStore(v) { try { localStorage.setItem(KEY, v); } catch (e) { storeOK = false; } }
  var qs = null;
  try { qs = new URLSearchParams(location.search); } catch (e) { qs = null; }
  var q = qs && qs.get('lang');
  var lang = q === 'zh' || q === 'en' ? q : null;
  if (!lang) { var s = readStore(); if (s === 'zh' || s === 'en') lang = s; }
  if (!lang) lang = /^zh/i.test(navigator.language || '') ? 'zh' : 'en';
  if (q === 'zh' || q === 'en') writeStore(lang);

  var metaDesc = document.querySelector('meta[name="description"]');
  var META = {
    zh: { title: document.title, desc: metaDesc ? metaDesc.getAttribute('content') : '' },
    en: { title: root.getAttribute('data-title-en') || document.title, desc: root.getAttribute('data-desc-en') || (metaDesc ? metaDesc.getAttribute('content') : '') },
  };
  var ATTRS = ['title', 'aria-label', 'placeholder', 'alt'];
  var subs = [];

  var css = document.createElement('style');
  css.textContent =
    '.avo-lang{position:fixed;top:max(12px,env(safe-area-inset-top));right:12px;z-index:50;' +
    'display:inline-flex;align-items:center;justify-content:center;min-width:44px;height:44px;padding:0 14px;' +
    'border-radius:999px;border:1px solid rgba(255,255,255,.2);background:rgba(10,12,18,.62);color:#f2f4f7;' +
    'font:600 13px/1 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;letter-spacing:.04em;' +
    'backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);cursor:pointer;-webkit-tap-highlight-color:transparent;' +
    'transition:background .2s,border-color .2s,transform .15s}' +
    '.avo-lang:hover{background:rgba(30,34,46,.8);border-color:rgba(255,255,255,.42)}' +
    '.avo-lang:active{transform:scale(.96)}' +
    '.avo-lang:focus-visible{outline:2px solid #c3a6ff;outline-offset:2px}' +
    '.avo-lang.in-bar{position:relative;top:auto;right:auto;z-index:auto;flex:0 0 auto;min-width:38px;height:24px;padding:0 10px;font-size:12px}' +
    '.avo-lang.in-bar::before{content:"";position:absolute;left:-4px;right:-4px;top:50%;height:44px;transform:translateY(-50%)}' +
    'html[lang=en] [data-only=zh],html[lang^=zh] [data-only=en]{display:none!important}';
  document.head.appendChild(css);

  var btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'avo-lang';
  var slot = document.querySelector('[data-lang-slot]');
  if (slot) { btn.classList.add('in-bar'); slot.appendChild(btn); } else document.body.appendChild(btn);
  btn.addEventListener('click', function (e) { e.stopPropagation(); set(lang === 'en' ? 'zh' : 'en'); btn.blur(); });
  // 不让快捷键 / 画布拖拽误吃按钮事件
  ['pointerdown', 'mousedown', 'touchstart', 'keydown'].forEach(function (ev) {
    btn.addEventListener(ev, function (e) { e.stopPropagation(); }, { passive: true });
  });

  function swap() {
    var en = lang === 'en';
    var list = document.querySelectorAll('[data-en]');
    for (var i = 0; i < list.length; i++) {
      var el = list[i];
      if (el.__zh == null) el.__zh = el.innerHTML;
      var v = en ? el.getAttribute('data-en') : el.__zh;
      if (el.innerHTML !== v) el.innerHTML = v;
    }
    ATTRS.forEach(function (a) {
      var ls = document.querySelectorAll('[data-en-' + a + ']');
      for (var j = 0; j < ls.length; j++) {
        var e2 = ls[j], k = '__zh_' + a;
        if (e2[k] == null) e2[k] = e2.getAttribute(a) || '';
        e2.setAttribute(a, en ? e2.getAttribute('data-en-' + a) : e2[k]);
      }
    });
  }
  function fixLinks() {
    if (storeOK) return;
    var as = document.querySelectorAll('a[href]');
    for (var i = 0; i < as.length; i++) {
      var h = as[i].getAttribute('href');
      if (!h || /^([a-z]+:|#|\/\/)/i.test(h)) continue;
      try {
        var u = new URL(h, location.href);
        u.searchParams.set('lang', lang);
        as[i].href = u.href;
      } catch (e) { /* ignore */ }
    }
  }
  function apply() {
    var en = lang === 'en';
    root.lang = en ? 'en' : 'zh-CN';
    document.title = META[lang].title;
    if (metaDesc) metaDesc.setAttribute('content', META[lang].desc);
    btn.textContent = en ? '中' : 'EN';
    btn.setAttribute('aria-label', en ? '切换到中文' : 'Switch to English');
    btn.title = en ? '切换到中文' : 'Switch to English';
    swap();
    fixLinks();
    for (var i = 0; i < subs.length; i++) { try { subs[i](lang); } catch (e) { console.error(e); } }
  }
  function set(l) {
    if (l !== 'zh' && l !== 'en') return;
    lang = l;
    writeStore(l);
    if (qs && qs.has('lang')) {
      try { qs.set('lang', l); history.replaceState(history.state, '', location.pathname + '?' + qs.toString() + location.hash); } catch (e) { /* ignore */ }
    }
    apply();
  }

  window.I18N = {
    get lang() { return lang; },
    t: function (zh, en) { return lang === 'en' ? en : zh; },
    L: function (o) { return o == null || typeof o !== 'object' ? o : (o[lang] != null ? o[lang] : o.zh); },
    on: function (fn) { subs.push(fn); },
    set: set,
    refresh: swap,
  };
  apply();
})();
