/* Workly Chat widget — opens the PIN-protected inbox inside the host website. */
(function () {
  if (window.__worklyChatLoaded) return;
  var script = document.currentScript || document.querySelector('script[src*="/widget/workly-chat.js"]');
  if (!script) return;
  var source = new URL(script.src, location.href);
  if (source.protocol !== 'https:' && source.hostname !== 'localhost') return;
  window.__worklyChatLoaded = true;
  var wid = (script.getAttribute('data-widget-id') || '').trim();
  var isEmail = script.getAttribute('data-app') === 'email';
  var label = isEmail ? 'Workly Email' : 'Workly Chat';
  var inbox = new URL(/^wgt_[a-f0-9]{24}$/.test(wid) ? '/widget-chat/' + wid + (isEmail ? '?app=email' : '') : (isEmail ? '/employer/workly-email' : '/employer/workly-chat'), source.origin).href;
  var side = script.getAttribute('data-position') === 'left' ? 'left' : 'right';
  var root = document.createElement('div');
  root.setAttribute('data-workly-chat', '');
  var shadow = root.attachShadow({ mode: 'open' });
  shadow.innerHTML = '<style>:host{all:initial;--wc-accent:#16865b;--wc-on-accent:#fff;--wc-bg:#fff;--wc-fg:#111;--wc-head-bg:#fff;--wc-head-fg:#111;--wc-border:#0002;--wc-ring:#3b82f6;--wc-shadow:0 4px 18px #0003}' +
    '@media(prefers-color-scheme:dark){:host{--wc-bg:#010816;--wc-fg:#f1f5f9;--wc-head-bg:#0b1220;--wc-head-fg:#f1f5f9;--wc-border:#fff2;--wc-shadow:0 4px 18px #0008}}' +
    '.launcher{position:fixed;bottom:max(20px,env(safe-area-inset-bottom));' + side + ':20px;width:56px;height:56px;border-radius:50%;border:0;background:var(--wc-accent);color:var(--wc-on-accent);box-shadow:var(--wc-shadow);display:grid;place-items:center;cursor:pointer;z-index:2147483646}' +
    'button:focus-visible{outline:3px solid var(--wc-ring);outline-offset:3px}' +
    '.panel{position:fixed;bottom:90px;' + side + ':20px;width:400px;height:min(640px,calc(100dvh - 110px));background:var(--wc-bg);color:var(--wc-fg);border:1px solid var(--wc-border);border-radius:16px;box-shadow:var(--wc-shadow);display:none;flex-direction:column;overflow:hidden;z-index:2147483647;font-family:system-ui,sans-serif}' +
    '.panel.open{display:flex}.head{display:none;align-items:center;gap:8px;height:52px;padding:0 8px;background:var(--wc-head-bg);color:var(--wc-head-fg);border-bottom:1px solid var(--wc-border)}.panel.nohead .head{display:none}' +
    '.back{width:40px;height:40px;border:0;border-radius:50%;background:transparent;color:inherit;display:grid;place-items:center;cursor:pointer}.title{font-size:16px;font-weight:600}' +
    'iframe{flex:1;width:100%;border:0;background:var(--wc-bg)}' +
    '@media(max-width:600px){.panel{inset:0;width:auto;height:100dvh;border-radius:0;border:0}.launcher{' + side + ':16px;bottom:max(16px,env(safe-area-inset-bottom))}}</style>' +
    '<div class="panel" role="dialog" aria-label="' + label + '"><div class="head"><button type="button" class="back" aria-label="Close ' + label + '"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5M12 19l-7-7 7-7"/></svg></button><span class="title">' + label + '</span></div></div>' +
    '<button type="button" class="launcher" aria-label="Open ' + label + '" title="' + label + '"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></button>';
  document.body.appendChild(root);
  var panel = shadow.querySelector('.panel');
  var launcher = shadow.querySelector('.launcher');
  var frame = null;
  var pushed = false;
  function open() {
    if (!frame) {
      frame = document.createElement('iframe');
      frame.src = inbox;
      frame.title = label;
      frame.allow = 'clipboard-write; microphone; camera';
      panel.appendChild(frame);
    }
    panel.classList.add('open');
    launcher.style.display = 'none';
    if (!pushed) { try { history.pushState({ worklyChat: true }, ''); pushed = true; } catch (e) { /* ignore */ } }
  }
  function hide() {
    panel.classList.remove('open');
    launcher.style.display = '';
    launcher.focus();
  }
  function close() {
    if (pushed) { pushed = false; try { history.back(); } catch (e) { /* ignore */ } }
    hide();
  }
  var backTimer = null;
  window.addEventListener('popstate', function () {
    if (!pushed || !panel.classList.contains('open')) return;
    pushed = false;
    if (!frame || !frame.contentWindow) return hide();
    frame.contentWindow.postMessage({ type: 'workly-chat:back' }, source.origin);
    backTimer = setTimeout(function () { backTimer = null; hide(); }, 400);
  });
  window.addEventListener('message', function (e) {
    if (e.origin !== source.origin || !frame || e.source !== frame.contentWindow) return;
    var d = e.data || {};
    if (d.type === 'workly-chat:back-result' && backTimer) {
      clearTimeout(backTimer); backTimer = null;
      if (d.handled) { try { history.pushState({ worklyChat: true }, ''); pushed = true; } catch (err) { /* ignore */ } }
      else hide();
    }
    if (d.type === 'workly-chat:close') close();
    if (d.type === 'workly-chat:header') panel.classList.toggle('nohead', d.show === false);
  });
  launcher.addEventListener('click', open);
  shadow.querySelector('.back').addEventListener('click', close);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && panel.classList.contains('open')) close(); });
  window.WorklyChat = { open: open, close: close };
})();
