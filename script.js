const params = new URLSearchParams(location.search);
const SEND_ID = params.get('send');
const VIEW_ID = params.get('view');
const IS_OWNER = !!VIEW_ID;
const IS_SENDER = !!SEND_ID || !VIEW_ID;

// Clé de stockage = SEND_ID (tous les messages vont dans la même boîte)
const STORAGE_KEY = `askme_box_${SEND_ID || VIEW_ID || 'temp'}`;
let msgs = IS_OWNER ? (JSON.parse(localStorage.getItem(STORAGE_KEY)) || []) : [];

// Génère un nouvel ID pour la boîte
function generateBoxId() {
  return Math.random().toString(36).substr(2, 9);
}

// Génère un VIEW_ID (clé privée)
function generateViewId() {
  return Math.random().toString(36).substr(2, 12);
}

const v = document.getElementById('visitor');
const o = document.getElementById('owner');
const input = document.getElementById('input');
const send = document.getElementById('send');
const list = document.getElementById('list');
const count = document.getElementById('count');
const share = document.getElementById('share');
const modal = document.getElementById('modal');
const full = document.getElementById('full');
const reply = document.getElementById('reply');
const sendReply = document.getElementById('sendReply');
const replies = document.getElementById('replies');
const close = document.querySelector('.close');
const install = document.getElementById('install');
const hint = document.getElementById('hint');

// === MODE VISITEUR (ENVOI) ===
if (!IS_OWNER) {
  v.classList.add('active');
  o.classList.remove('active');

  send.onclick = async () => {
    const text = input.value.trim();
    if (!text) return;

    let sendId = SEND_ID;
    let isFirstSend = false;

    // Première fois → génère la boîte
    if (!SEND_ID && !VIEW_ID) {
      sendId = generateBoxId();
      isFirstSend = true;
    } else if (VIEW_ID) {
      // Si on a un VIEW_ID → on est déjà propriétaire
      sendId = VIEW_ID;
    } else {
      sendId = SEND_ID;
    }

    const key = `askme_box_${sendId}`;
    let box = JSON.parse(localStorage.getItem(key)) || [];
    box.push({ text, t: Date.now(), r: [] });
    localStorage.setItem(key, JSON.stringify(box));

    input.value = '';
    toast('Envoyé !');

    // === PREMIER ENVOI → GÉNÈRE LIEN PRIVÉ ===
    if (isFirstSend) {
      const viewId = generateViewId();
      localStorage.setItem(`askme_view_${sendId}`, viewId); // Sauvegarde la clé privée

      const viewUrl = `${location.origin}${location.pathname}?view=${viewId}`;
      const sendUrl = `${location.origin}${location.pathname}?send=${sendId}`;

      // Copie le lien privé (seul le propriétaire le voit)
      try {
        await navigator.clipboard.writeText(viewUrl);
        toast('Lien privé copié ! (accès à tes messages)');
      } catch {
        toast('Lien privé : ' + viewUrl);
      }

      // Optionnel : affiche lien public
      setTimeout(() => {
        toast('Lien public (partage) : ?send=' + sendId);
      }, 2500);

      // Redirige vers le lien d’envoi
      history.replaceState(null, '', `?send=${sendId}`);
    }
  };
}

// === MODE PROPRIÉTAIRE (LECTURE) ===
if (IS_OWNER) {
  // Vérifie que le VIEW_ID correspond à la boîte
  const expectedViewId = localStorage.getItem(`askme_view_${VIEW_ID}`);
  if (!expectedViewId || expectedViewId !== VIEW_ID) {
    // Accès refusé → redirige vers mode envoi
    const sendId = VIEW_ID;
    window.location.href = `?send=${sendId}`;
    throw new Error('Accès refusé');
  }

  v.classList.remove('active');
  o.classList.add('active');
  render();
  updateCount();

  share.onclick = () => {
    const sendUrl = `${location.origin}${location.pathname}?send=${VIEW_ID}`;
    navigator.clipboard.writeText(sendUrl).then(() => toast('Lien public copié ! (partage)'));
  };

  sendReply.onclick = () => {
    const text = reply.value.trim();
    if (!text || !current) return;
    current.r.push({ text, t: Date.now() });
    save();
    renderReplies();
    reply.value = '';
    toast('Réponse envoyée');
  };

  close.onclick = () => modal.classList.remove('active');
  modal.onclick = e => e.target === modal && modal.classList.remove('active');
}

// === FONCTIONS COMMUNES ===
function render() {
  list.innerHTML = '';
  msgs.slice().reverse().forEach((m, i) => {
    const idx = msgs.length - 1 - i;
    const card = document.createElement('div');
    card.className = 'msg-card';
    card.innerHTML = `
      <div class="preview">${esc(m.text)}</div>
      <div class="date">${fmt(m.t)}</div>
      <button class="del" title="Supprimer">Delete</button>
    `;
    card.onclick = e => {
      if (e.target.classList.contains('del')) return;
      open(m);
    };
    card.querySelector('.del').onclick = e => {
      e.stopPropagation();
      if (confirm('Supprimer ?')) {
        msgs.splice(idx, 1);
        save();
        render();
        updateCount();
        toast('Supprimé');
      }
    };
    list.appendChild(card);
  });
}

function open(m) {
  current = m;
  full.innerHTML = esc(m.text);
  renderReplies();
  modal.classList.add('active');
}

function renderReplies() {
  replies.innerHTML = '';
  current.r.slice().reverse().forEach(r => {
    const div = document.createElement('div');
    div.className = 'resp';
    div.innerHTML = `<div>${esc(r.text)}</div><small>${fmt(r.t)}</small>`;
    replies.appendChild(div);
  });
}

function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(msgs)); }
function updateCount() { count.textContent = msgs.length === 0 ? 'Aucun message' : msgs.length === 1 ? '1 message' : `${msgs.length} messages`; }
function esc(t) { const d = document.createElement('div'); d.textContent = t; return d.innerHTML; }
function fmt(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const diff = Date.now() - ts;
  if (diff < 60000) return 'À l\'instant';
  if (diff < 3600000) return `Il y a ${Math.floor(diff/60000)} min`;
  if (diff < 86400000) return `Il y a ${Math.floor(diff/3600000)} h`;
  return d.toLocaleDateString('fr');
}
function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.style.opacity = '1');
  setTimeout(() => {
    t.style.opacity = '0';
    setTimeout(() => t.remove(), 300);
  }, 3000);
}

// PWA
let prompt;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  prompt = e;
  install.style.display = 'block';
  if (IS_OWNER) hint.style.display = 'inline';
});
install.onclick = async () => {
  if (!prompt) return;
  prompt.prompt();
  const { outcome } = await prompt.userChoice;
  if (outcome === 'accepted') {
    install.style.display = 'none';
    hint.style.display = 'none';
    toast('Installé !');
  }
  prompt = null;
};

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js');
}