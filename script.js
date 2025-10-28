const params = new URLSearchParams(location.search);
const SEND_ID = params.get('send');
const VIEW_ID = params.get('view');
const IS_SENDER = !!SEND_ID || (!SEND_ID && !VIEW_ID);
const IS_OWNER = !!VIEW_ID;

const BOXES_KEY = 'askme_my_boxes';
let myBoxes = JSON.parse(localStorage.getItem(BOXES_KEY)) || [];

// Éléments
const boxesView = document.getElementById('boxes');
const visitor = document.getElementById('visitor');
const owner = document.getElementById('owner');
const boxList = document.getElementById('boxList');
const newBoxBtn = document.getElementById('newBox');
const backBtn = document.getElementById('back');

// === FONCTIONS BOÎTES ===
function saveBoxes() {
  localStorage.setItem(BOXES_KEY, JSON.stringify(myBoxes));
}

function addBox(boxId, viewKey, title = 'Boîte anonyme') {
  if (myBoxes.find(b => b.boxId === boxId)) return;
  myBoxes.push({ boxId, viewKey, title, pinned: false, created: Date.now() });
  saveBoxes();
  renderBoxes();
}

function togglePin(boxId) {
  const box = myBoxes.find(b => b.boxId === boxId);
  if (box) {
    box.pinned = !box.pinned;
    saveBoxes();
    renderBoxes();
  }
}

function openBox(viewKey) {
  window.location.href = `?view=${viewKey}`;
}

function renderBoxes() {
  boxList.innerHTML = '';
  if (myBoxes.length === 0) {
    boxList.innerHTML = '<div style="text-align:center; opacity:0.7; padding:20px;">Aucune boîte. Crée-en une !</div>';
    return;
  }

  // Tri : épinglées d'abord
  const sorted = [...myBoxes].sort((a, b) => b.pinned - a.pinned || b.created - a.created);

  sorted.forEach(box => {
    const div = document.createElement('div');
    div.className = 'box-item';
    div.innerHTML = `
      <div class="box-info">
        <div class="box-title">${esc(box.title)}</div>
        <div class="box-meta">Créée ${fmt(box.created)}</div>
      </div>
      <button class="pin ${box.pinned ? 'pinned' : ''}" title="Épingler">Star</button>
    `;
    div.onclick = e => {
      if (e.target.classList.contains('pin')) {
        e.stopPropagation();
        togglePin(box.boxId);
      } else {
        openBox(box.viewKey);
      }
    };
    boxList.appendChild(div);
  });
}

// === NOUVELLE BOÎTE ===
newBoxBtn.onclick = () => {
  const boxId = genId();
  const viewKey = genViewKey();
  addBox(boxId, viewKey, 'Nouvelle boîte');
  window.location.href = `?view=${viewKey}`;
};

// === MODE ENVOI ===
if (IS_SENDER && !VIEW_ID) {
  boxesView.classList.remove('active');
  visitor.classList.add('active');

  const boxId = SEND_ID || genId();
  const storageKey = `askme_box_${boxId}`;
  let msgs = JSON.parse(localStorage.getItem(storageKey)) || [];

  document.getElementById('send').onclick = async () => {
    const text = input.value.trim();
    if (!text) return;
    msgs.push({ text, t: Date.now(), r: [] });
    localStorage.setItem(storageKey, JSON.stringify(msgs));
    input.value = '';
    toast('Envoyé !');

    if (!SEND_ID) {
      const viewKey = genViewKey();
      localStorage.setItem(`askme_box_for_${viewKey}`, boxId);
      addBox(boxId, viewKey);
      const viewUrl = `${location.origin}${location.pathname}?view=${viewKey}`;
      await navigator.clipboard.writeText(viewUrl);
      toast('Lien privé copié !');
      history.replaceState(null, '', `?send=${boxId}`);
    }
  };
}

// === MODE PROPRIÉTAIRE ===
if (IS_OWNER) {
  const boxId = localStorage.getItem(`askme_box_for_${VIEW_ID}`);
  if (!boxId) { toast('Lien invalide'); setTimeout(() => location.href = '/', 2000); }
  const storageKey = `askme_box_${boxId}`;
  let msgs = JSON.parse(localStorage.getItem(storageKey)) || [];
  let current = null;

  visitor.classList.remove('active');
  owner.classList.add('active');
  backBtn.onclick = () => location.href = '/';
  renderOwner();
  updateCount();

  document.getElementById('share').onclick = () => {
    const url = `${location.origin}${location.pathname}?send=${boxId}`;
    navigator.clipboard.writeText(url).then(() => toast('Lien public copié !'));
  };

  document.getElementById('sendReply').onclick = () => {
    const text = reply.value.trim();
    if (!text || !current) return;
    current.r.push({ text, t: Date.now() });
    saveOwner();
    renderReplies();
    reply.value = '';
    toast('Réponse envoyée');
  };

  function renderOwner() {
    const list = document.getElementById('list');
    list.innerHTML = '';
    if (msgs.length === 0) {
      list.innerHTML = '<div style="text-align:center; opacity:0.7; padding:20px;">Aucun message...</div>';
      return;
    }
    msgs.slice().reverse().forEach((m, i) => {
      const idx = msgs.length - 1 - i;
      const card = document.createElement('div');
      card.className = 'msg-card';
      card.innerHTML = `<div class="preview">${esc(m.text)}</div><div class="date">${fmt(m.t)}</div><button class="del">Delete</button>`;
      card.onclick = e => { if (!e.target.classList.contains('del')) open(m); };
      card.querySelector('.del').onclick = e => {
        e.stopPropagation();
        if (confirm('Supprimer ?')) {
          msgs.splice(idx, 1);
          saveOwner();
          renderOwner();
          updateCount();
        }
      };
      list.appendChild(card);
    });
  }

  function open(m) { current = m; full.innerHTML = esc(m.text); renderReplies(); modal.classList.add('active'); }
  function renderReplies() {
    replies.innerHTML = '';
    if (!current.r?.length) {
      replies.innerHTML = '<div style="opacity:0.6; font-size:0.9em;">Aucune réponse</div>';
      return;
    }
    current.r.slice().reverse().forEach(r => {
      const div = document.createElement('div');
      div.className = 'resp';
      div.innerHTML = `<div>${esc(r.text)}</div><small>${fmt(r.t)}</small>`;
      replies.appendChild(div);
    });
  }
  function saveOwner() { localStorage.setItem(storageKey, JSON.stringify(msgs)); }
  function updateCount() { count.textContent = msgs.length ? `${msgs.length} message${msgs.length > 1 ? 's' : ''}` : 'Aucun message'; }
}

// === PAGE D'ACCUEIL (LISTE) ===
if (!SEND_ID && !VIEW_ID) {
  renderBoxes();
}

// === FONCTIONS UTILITAIRES ===
function genId() { return Math.random().toString(36).substr(2, 9); }
function genViewKey() { return Math.random().toString(36).substr(2, 15); }
function esc(t) { const d = document.createElement('div'); d.textContent = t; return d.innerHTML; }
function fmt(ts) {
  const diff = Date.now() - ts;
  if (diff < 60000) return 'À l\'instant';
  if (diff < 3600000) return `Il y a ${Math.floor(diff/60000)} min`;
  if (diff < 86400000) return `Il y a ${Math.floor(diff/3600000)} h`;
  return new Date(ts).toLocaleDateString('fr');
}
function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.style.opacity = '1');
  setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 3000);
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
