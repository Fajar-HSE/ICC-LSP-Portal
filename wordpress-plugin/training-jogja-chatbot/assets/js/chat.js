/* TJ Chatbot — floating kanan bawah, Bahasa Indonesia. Tanpa dependensi.
   Tahan optimizer/cache: tunggu window.TJCB + div #tj-chat (buat sendiri bila belum ada). */
(function () {
  var TRIES = 0;
  function boot() {
    if (window.__TJCB_DONE) return;
    var root = document.getElementById('tj-chat');
    if (!root) {
      root = document.createElement('div');
      root.id = 'tj-chat';
      (document.body || document.documentElement).appendChild(root);
    }
    if (!window.TJCB) {
      if (++TRIES < 40) setTimeout(boot, 250);
      return;
    }
    window.__TJCB_DONE = true;
    init(root, window.TJCB);
  }
  function init(root, C) {
  var sid = null, token = null;
  try { sid = localStorage.getItem('tjcb_sid'); token = localStorage.getItem('tjcb_tok'); } catch (e) {}
  function api(path, body) {
    return fetch(C.api + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { if (!r.ok) throw 0; return r.json(); });
  }
  function ensureSession(cb) {
    if (sid && token) return cb();
    api('/session', {}).then(function (j) {
      sid = j.session_id; token = j.token;
      try { localStorage.setItem('tjcb_sid', sid); localStorage.setItem('tjcb_tok', token); } catch (e) {}
      cb();
    }).catch(function () { cb(); });
  }
  function escA(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  var avaHtml = C.avatar_img
    ? '<img class="tj-ava" src="' + escA(C.avatar) + '" alt="">'
    : '<span class="tj-ava-emoji">' + escA(C.avatar || '💬') + '</span>';
  var botName = escA(C.bot_name || 'Asisten Training Jogja');
  var presets = (C.presets || []).map(function (p) { return '<button>' + escA(p) + '</button>'; }).join('');
  root.innerHTML =
    '<div id="tj-panel" hidden><div id="tj-head">' + avaHtml + '<div><b>' + botName + '</b><br><small>Online &bull; Sen&ndash;Jum 08&ndash;17</small></div><button id="tj-x" aria-label="Tutup">&#10005;</button></div>' +
    '<div id="tj-msgs"></div><div id="tj-quick">' + presets + '</div>' +
    '<form id="tj-form"><input id="tj-in" placeholder="Ketik pertanyaan..." autocomplete="off" maxlength="2000"><button>Kirim</button></form>' +
    '<div id="tj-foot"><a href="' + C.daftar + '" target="_blank" rel="noopener">Daftar resmi</a> &bull; <a href="' + C.wa + '" target="_blank" rel="noopener">Chat CS via WhatsApp</a> &bull; <a href="#" id="tj-del">Hapus riwayat</a></div></div>' +
    '<button id="tj-fab" aria-label="Buka chat">' + avaHtml + ' Butuh info pelatihan?</button>';
  var panel = root.querySelector('#tj-panel'), msgs = root.querySelector('#tj-msgs'),
      form = root.querySelector('#tj-form'), inp = root.querySelector('#tj-in');
  function bub(html, cls) { var d = document.createElement('div'); d.className = cls; d.innerHTML = html; msgs.appendChild(d); msgs.scrollTop = msgs.scrollHeight; return d; }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
  function fmt(s) { return esc(s).replace(/\n/g, '<br>').replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>'); }
  root.querySelector('#tj-fab').onclick = function () {
    panel.hidden = !panel.hidden;
    if (!panel.hidden && !msgs.children.length) bub(fmt(C.welcome), 'bot');
    if (!panel.hidden) setTimeout(function () { inp.focus(); }, 50);
  };
  root.querySelector('#tj-x').onclick = function () { panel.hidden = true; };
  root.querySelectorAll('#tj-quick button').forEach(function (b) { b.onclick = function () { inp.value = b.textContent; form.requestSubmit(); }; });
  root.querySelector('#tj-del').onclick = function (e) {
    e.preventDefault();
    ensureSession(function () { api('/history/delete', { session_id: sid, token: token }).then(function () { msgs.innerHTML = ''; }); });
  };
  form.onsubmit = function (e) {
    e.preventDefault();
    var q = inp.value.trim(); if (!q) return; inp.value = '';
    var u = document.createElement('div'); u.className = 'user'; u.textContent = q; msgs.appendChild(u);
    var b = bub('Mengetik...', 'bot'); msgs.scrollTop = msgs.scrollHeight;
    ensureSession(function () {
      api('/chat', { session_id: sid, token: token, message: q, page_url: location.href })
        .then(function (j) {
          if (j.code) { b.textContent = 'Maaf, terjadi gangguan. Coba lagi atau hubungi CS via WhatsApp.'; return; }
          b.innerHTML = fmt(j.reply || 'Maaf, coba lagi.');
          msgs.scrollTop = msgs.scrollHeight;
        })
        .catch(function () { b.textContent = 'Koneksi terputus. Coba lagi.'; });
    });
  };
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
