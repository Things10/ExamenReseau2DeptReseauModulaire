
/* ============================================================
   CONFIGURATION
   ============================================================ */
const TEACHER_EMAIL = "stevengauchier@gmail.com";
const EMAILJS_SERVICE_ID = "service_jjqlfck";
const EMAILJS_TEMPLATE_ID = "template_a9uazrs";
const EMAILJS_PUBLIC_KEY = "8ZF_oJb8pHOzojn1p";
const API_BASE = "api/";          // endpoint PHP lokal
const EXAM_DURATION_SECONDS = 150 * 60; // sekou si server pa reponn

/* Sesyon aktyèl la (gade ak PHP validation) */
let sessionKey = null;
let remainingSeconds = EXAM_DURATION_SECONDS;
let saveTimer = null;
let isSaving = false;

/* ============================================================
   HACHAGE SHA-256 (les bonnes réponses ne sont jamais en clair)
   ============================================================ */
async function sha256(text) {
  const normalized = text.trim().toLowerCase();
  const enc = new TextEncoder().encode(normalized);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/* ============================================================
   SECTION 1 — Choisir la bonne réponse (8 x 1.25 pts = 10 pts)
   ============================================================ */
const QCM_PTS = 1.25;
const QCM = [
  { q: "Quelle adresse IP ne fait pas partie des plages privées RFC 1918 ?", opts: ["10.25.10.5", "172.20.5.10", "192.168.1.50", "200.4.126.3"], hash: "" },
  { q: "Une organisation possède le bloc 10.20.0.0/16 et doit créer des sous-réseaux prenant en charge au moins 500 hôtes utilisables chacun. Quel préfixe fournit la capacité requise tout en minimisant le gaspillage d'adresses ?", opts: ["/23", "/22", "/24", "/25", "/27"], hash: "" },
  { q: "Un ordinateur a une adresse IP de 127.0.0.1 qu'est-ce-que cela indique ?", opts: ["APIPA", "DHCP Failure", "Default Gateway", "Loopback", "DNS"], hash: "" },
  { q: "Un administrateur réseau dispose du réseau 192.168.10.0/24 et doit créer au moins 6 sous-réseaux de taille égale. Quel préfixe CIDR doit être utilisé ?", opts: ["/21", "/25", "/26", "/27", "/28"], hash: "" },
  { q: "Une entreprise s'est vu attribuer le réseau IPv4 192.168.50.0/26 pour un nouveau département. Combien d'adresses d'hôtes utilisables sont disponibles dans ce sous-réseau ?", opts: ["30", "128", "98", "64", "62"], hash: "" },
  { q: "Quelle commande Cisco permet de configurer une route statique vers le réseau 192.168.10.0/24 via le prochain saut 10.0.0.1 ?", opts: ["Ip route 192.168.10.0 255.255.255.0 10.0.0.1", "Ip route 10.0.0.1 192.168.10.0 255.255.255.0", "Ip static-route 192.168.10.0/24 10.0.0.1", "Route add 192.168.10.0 via 10.0.0.1"], hash: "" },
  { q: "Soit cette topologie ci-dessous. Le lien entre R2 et R3 a été annulé. Quelle route principale doit-on emprunter comme route de secours pour atteindre le réseau Bureautique ?", opts: ["Ip route 192.168.10.0 255.255.255.0 10.1.1.6", "Ip route 192.168.20.0 255.255.255.0 10.1.1.0", "Ip route 192.168.30.0 255.255.255.0 10.1.1.6", "Ip route 192.168.30.0 255.255.255.0 10.1.1.2", "Ip route 192.168.30.0 255.255.255.0 10.1.1.10 5"], img: "q7-topologie", hash: "" },
  { q: "Parmi toutes ces commandes, laquelle est utilisée pour afficher un résumé des interfaces actives en OSPF ?", opts: ["router ospf <ID-processus>", "network <réseau> <wildcard> area <n>", "show ip ospf neighbor", "show ip ospf interface brief", "passive-interface <intf>"], hash: "" },
];
const QCM_ANSWERS = [
  "200.4.126.3", "/23", "Loopback", "/27", "62",
  "Ip route 192.168.10.0 255.255.255.0 10.0.0.1",
  "Ip route 192.168.30.0 255.255.255.0 10.1.1.10 5",
  "show ip ospf interface brief"
];

/* ============================================================
   SECTION C — Liste déroulante (6 x 2 pts = 12 pts)
   1 seule question OSI conservée, 5 nouvelles questions techniques
   ============================================================ */
const DD = [
  {
    q: "Quel processus consiste à placer un format de message à l'intérieur d'un autre format de message ?",
    options: ["Codage", "Contrôle de flux", "Segmentation", "Encapsulation"],
    ans: "Encapsulation"
  },
  {
    q: "Quelle bande RF sans fil les appareils IEEE 802.11b/g utilisent-ils ?",
    options: ["60 GHz", "2,4 GHz", "5 GHz", "3900 MHz"],
    ans: "2,4 GHz"
  },
  {
    q: "Quel type de modèle de réseau décrit les fonctions qui doivent intervenir sur une couche particulière sans indiquer comment chaque protocole doit fonctionner ?",
    options: ["Modèle de protocole", "Modèle TCP/IP", "Modèle de référence", "Modèle de conception hiérarchique"],
    ans: "Modèle de référence"
  },
  {
    q: "Quelle commande un technicien doit-il utiliser pour afficher les connexions réseau sur un ordinateur hôte ?",
    options: ["tracert", "netstat", "nslookup", "ipconfig"],
    ans: "netstat"
  },
  {
    q: "Quelle technologie de codage des données est utilisée dans les câbles en cuivre ?",
    options: ["Modulation de fréquences spécifiques d'ondes électromagnétiques", "Impulsions électriques", "Impulsions lumineuses", "Modulation des rayons lumineux"],
    ans: "Impulsions électriques"
  },
  {
    q: "Protocole HTTP — à quelle couche du modèle OSI appartient-il ?",
    options: ["Physique", "Liaison de données", "Réseau", "Transport", "Application"],
    ans: "Application"
  },
];

/* ============================================================
   SECTION D — Glisser-déposer (4 x 2 pts = 8 pts)
   Chaque question a son propre jeu de 6 chips
   ============================================================ */
const DND = [
  {
    target: "Hub",
    q: "Quel est le rôle de ce périphérique réseau ?",
    chips: [
      "Diffuse les données reçues vers tous les autres ports, sans aucune distinction de destinataire",
      "Un répéteur multiport qui nettoie et régénère le signal sur tous les ports",
      "Un équipement qui filtre le trafic en fonction des adresses MAC",
      "Un concentrateur qui connecte deux réseaux de types différents",
      "Un appareil qui convertit le signal numérique en signal analogique",
      "Un dispositif qui attribue des adresses IP aux machines du réseau"
    ]
  },
  {
    target: "Rôle du modèle OSI",
    q: "Pourquoi le modèle OSI est-il organisé en couches ?",
    chips: [
      "Pour diviser la communication réseau en étapes indépendantes et faciliter l'interopérabilité",
      "Pour augmenter la vitesse de transmission en réduisant le nombre de protocoles",
      "Pour permettre à chaque fabricant de créer ses propres protocoles propriétaires",
      "Pour centraliser tout le traitement réseau dans une seule couche matérielle",
      "Pour remplacer complètement la suite TCP/IP dans les réseaux modernes",
      "Pour garantir que tous les équipements utilisent le même système d'exploitation"
    ]
  },
  {
    target: "TCP vs UDP",
    q: "Quelle est la différence fondamentale entre TCP et UDP ?",
    chips: [
      "TCP est orienté connexion et fiable, UDP est sans connexion et plus rapide",
      "UDP garantit la livraison des paquets alors que TCP ne le fait pas",
      "TCP est utilisé pour le streaming vidéo car il sacrifie la fiabilité pour la vitesse",
      "TCP et UDP sont deux versions du même protocole, UDP étant plus récent",
      "UDP établit une connexion avant d'envoyer des données, contrairement à TCP",
      "TCP ne peut pas détecter les paquets perdus et ne les renvoie jamais"
    ]
  },
  {
    target: "Adresse MAC / IP",
    q: "Quelle est la différence entre une adresse MAC et une adresse IP ?",
    chips: [
      "La MAC est une adresse physique unique attribuée par le fabricant; l'IP est une adresse logique variable",
      "La MAC est attribuée par le fournisseur d'accès alors que l'IP est fixe et universelle",
      "La MAC et l'IP sont identiques mais exprimées dans des formats différents",
      "L'adresse IP est unique au monde tandis que la MAC peut être modifiée",
      "La MAC sert à router les paquets entre réseaux; l'IP sert à la communication locale",
      "Une adresse IP est permanente alors qu'une adresse MAC change à chaque connexion"
    ]
  }
];

/* ============================================================
   SECTION 2 — Cochez toutes les réponses correctes
   (8 x 1.25 pts = 10 pts)
   ============================================================ */
const MULTI_PTS = 1.25;
const MULTI = [
  {
    q: "Quelles sont les caractéristiques d'une route flottante (floating static route) ?",
    opts: ["Elle a une distance administrative plus élevée que la route principale", "Elle prend effet uniquement quand la route principale est indisponible", "Elle est apprise via un protocole de routage dynamique", "Elle est utilisée comme route de secours", "Elle a toujours une distance administrative de 1"],
    ans: ["Elle a une distance administrative plus élevée que la route principale", "Elle prend effet uniquement quand la route principale est indisponible", "Elle est utilisée comme route de secours"]
  },
  {
    q: "Quels éléments peut-on configurer sur un serveur DHCP d'un routeur Cisco ?",
    opts: ["L'adresse IP de la passerelle par défaut", "Le masque de sous-réseau", "L'adresse du serveur DNS", "Le protocole de routage à utiliser", "La durée du bail (lease time)"],
    ans: ["L'adresse IP de la passerelle par défaut", "Le masque de sous-réseau", "L'adresse du serveur DNS", "La durée du bail (lease time)"]
  },
  {
    q: "Parmi ces ports, lesquels sont associés à des protocoles utilisant TCP ?",
    opts: ["Port 80 (HTTP)", "Port 443 (HTTPS)", "Port 69 (TFTP)", "Port 22 (SSH)"],
    ans: ["Port 80 (HTTP)", "Port 443 (HTTPS)", "Port 22 (SSH)"]
  },
  {
    q: "Parmi les caractéristiques suivantes, lesquelles s'appliquent à OSPF ?",
    opts: ["Protocole à état de lien (link-state)", "Utilise l'algorithme de Dijkstra (SPF)", "Protocole propriétaire Cisco", "Élit un routeur désigné (DR) sur les réseaux multi-accès"],
    ans: ["Protocole à état de lien (link-state)", "Utilise l'algorithme de Dijkstra (SPF)", "Élit un routeur désigné (DR) sur les réseaux multi-accès"]
  },
  {
    q: "Parmi les fonctions suivantes, lesquelles sont propres à un switch de niveau 3 (et non à un switch L2 classique) ?",
    opts: ["Apprentissage des adresses MAC", "Création de SVI (Switch Virtual Interface)", "Routage inter-VLAN sans routeur externe", "Table de routage IP"],
    ans: ["Création de SVI (Switch Virtual Interface)", "Routage inter-VLAN sans routeur externe", "Table de routage IP"]
  },
  {
    q: "Concernant le « router on a stick », quelles affirmations sont exactes ?",
    opts: ["Il nécessite une sous-interface par VLAN sur le routeur", "Il nécessite un lien trunk entre le switch et le routeur", "Il remplace l'utilisation du protocole 802.1Q", "Il permet le routage inter-VLAN avec une seule interface physique"],
    ans: ["Il nécessite une sous-interface par VLAN sur le routeur", "Il nécessite un lien trunk entre le switch et le routeur", "Il permet le routage inter-VLAN avec une seule interface physique"]
  },
  {
    q: "Sur un switch multicouche (L3) avec routage inter-VLAN par SVI, quelles conditions sont nécessaires pour que le trafic soit correctement routé entre VLAN 10 et VLAN 30 ?",
    opts: ["La commande globale « ip routing » doit être activée", "Les SVI (interface vlan 10 et interface vlan 30) doivent être en état « up/up »", "Un port physique doit être configuré en mode trunk vers chaque hôte", "Les VLAN 10 et 30 doivent exister et avoir au moins un port actif associé"],
    ans: ["La commande globale « ip routing » doit être activée", "Les SVI (interface vlan 10 et interface vlan 30) doivent être en état « up/up »", "Les VLAN 10 et 30 doivent exister et avoir au moins un port actif associé"]
  },
  {
    q: "En comparant OSPF et EIGRP, quelles affirmations sont vraies ?",
    opts: ["OSPF calcule le coût selon la bande passante de l'interface, EIGRP utilise une métrique composite (bande passante et délai par défaut)", "EIGRP converge généralement plus vite grâce à l'algorithme DUAL et aux routes de secours (feasible successor)", "OSPF et EIGRP ont la même distance administrative par défaut", "EIGRP est un protocole à vecteur de distance avancé, OSPF un protocole à état de lien"],
    ans: ["OSPF calcule le coût selon la bande passante de l'interface, EIGRP utilise une métrique composite (bande passante et délai par défaut)", "EIGRP converge généralement plus vite grâce à l'algorithme DUAL et aux routes de secours (feasible successor)", "EIGRP est un protocole à vecteur de distance avancé, OSPF un protocole à état de lien"]
  },
];

/* ============================================================
   SECTION F — Questions subjectives (30 pts, 3 questions)
   2 des 3 questions sont obligatoires
   ============================================================ */
const SUBJ = [
  { q: "Définissez ce qu'est un réseau informatique et expliquez la différence entre un réseau LAN et un réseau WAN.", pts: 15 },
  { q: "Expliquez le rôle du modèle OSI. Pourquoi un modèle en couches est-il utile pour comprendre les réseaux ?", pts: 15 },
  { q: "Expliquez la différence entre TCP et UDP. Dans quel cas utiliserait-on plutôt UDP malgré son manque de fiabilité ?", pts: 15 },
];
const SUBJ_NOTE = "2 des 3 questions subjectives sont obligatoires";

let timerInterval = null;
let syncTimerInterval = null;
let examSubmitted = false;
let studentName = "";

/* ============================================================
   APPEL API PHP (local)
   ============================================================ */
async function apiPost(endpoint, payload) {
  const res = await fetch(API_BASE + endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return res.json();
}

/* ============================================================
   INDICATEUR AUTO-SAVE
   ============================================================ */
function setSaveStatus(state, msg) {
  const el = document.getElementById('save-status');
  if (!el) return;
  el.className = 'save-status ' + state;
  el.textContent = msg || {
    saving: 'Enregistrement...',
    saved: 'Enregistré',
    error: 'Échec de l\'enregistrement'
  }[state];
}

function scheduleSave() {
  if (!sessionKey || examSubmitted) return;
  if (saveTimer) clearTimeout(saveTimer);
  setSaveStatus('saving');
  saveTimer = setTimeout(saveAnswers, 1200);
}

function showExpired() {
  document.getElementById('screen-exam').classList.remove('show');
  document.getElementById('screen-intro').style.display = 'none';
  document.getElementById('screen-expired').classList.add('show');
}

async function saveAnswers() {
  if (!sessionKey || examSubmitted || isSaving) return;
  isSaving = true;
  try {
    const res = await apiPost('save_answers.php', {
      session_key: sessionKey,
      answers: userAnswers
    });
    if (res.ok) {
      setSaveStatus('saved');
      if (res.remaining_seconds) remainingSeconds = res.remaining_seconds;
      if (res.submitted) { location.reload(); return; }
    } else if (res.expired) {
      showExpired();
      return;
    } else {
      setSaveStatus('error');
      if (res.submitted) { location.reload(); return; }
    }
  } catch (e) {
    setSaveStatus('error');
  } finally {
    isSaving = false;
  }
}

async function loadSavedAnswers() {
  try {
    const res = await apiPost('get_answers.php', { session_key: sessionKey });
    if (res.ok && res.answers) {
      Object.keys(res.answers).forEach(k => {
        const a = res.answers[k];
        userAnswers[parseInt(k, 10)] = typeof a === 'string' ? a : (Array.isArray(a) ? a : String(a ?? ''));
      });
    }
    if (res.remaining_seconds) remainingSeconds = res.remaining_seconds;
    if (res.submitted) { location.reload(); return; }
  } catch (e) { /* silansye */ }
}

/* ============================================================
   INITIALISATION DES HASHES
   ============================================================ */
async function initHashes() {
  for (let i = 0; i < QCM.length; i++) QCM[i].hash = await sha256(QCM_ANSWERS[i]);
  for (let i = 0; i < DD.length; i++) DD[i].hash = await sha256(DD[i].ans);
  for (let i = 0; i < DND.length; i++) DND[i].hash = await sha256(DND[i].chips[0]);
}

/* ============================================================
   IMAGE DU SCHÉMA RÉSEAU (intégrée en SVG, reconstitution du schéma fourni)
   ============================================================ */
/* SVG adrès IPv6 pou kesyon A.11 -- examen_reseau_v2 */
const IPV6_DIAGRAM_SVG = `
<svg viewBox="0 0 520 70" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:520px;background:#fff;border-radius:8px;padding:12px 0">
  <text x="10" y="28" font-family="Courier New,monospace" font-size="18" font-weight="bold" fill="#333">
    <tspan fill="#2E6B82">2001</tspan><tspan fill="#888">:</tspan>
    <tspan fill="#2E6B82">0db8</tspan><tspan fill="#888">:</tspan>
    <tspan fill="#2E6B82">85a3</tspan><tspan fill="#888">:</tspan>
    <tspan fill="#2E6B82">0000</tspan><tspan fill="#888">:</tspan>
    <tspan fill="#2E6B82">0000</tspan><tspan fill="#888">:</tspan>
    <tspan fill="#2E6B82">8a2e</tspan><tspan fill="#888">:</tspan>
    <tspan fill="#2E6B82">0370</tspan><tspan fill="#888">:</tspan>
    <tspan fill="#2E6B82">7334</tspan>
  </text>
</svg>`;

const NETWORK_DIAGRAM_SVG = `
<svg viewBox="0 0 360 200" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:420px;background:#fff;border-radius:8px">
  <ellipse cx="60" cy="100" rx="50" ry="75" fill="#F4D9A0"/>
  <ellipse cx="180" cy="100" rx="65" ry="85" fill="#BFE3C4"/>
  <ellipse cx="300" cy="100" rx="50" ry="75" fill="#AFD8E8"/>
  <text x="60" y="32" text-anchor="middle" font-family="Arial" font-size="13" font-weight="bold" fill="#333">A</text>
  <text x="300" y="32" text-anchor="middle" font-family="Arial" font-size="13" font-weight="bold" fill="#333">C</text>
  <text x="60" y="180" text-anchor="middle" font-family="Arial" font-size="11" fill="#333">Source du paquet</text>
  <text x="300" y="180" text-anchor="middle" font-family="Arial" font-size="11" fill="#333">Destination du paquet</text>
  <g fill="#2E6B82">
    <rect x="40" y="55" width="20" height="14" rx="2"/>
    <rect x="40" y="95" width="20" height="14" rx="2"/>
    <rect x="40" y="135" width="20" height="14" rx="2"/>
  </g>
  <g fill="#2E6B82">
    <rect x="280" y="55" width="20" height="14" rx="2"/>
    <rect x="280" y="95" width="20" height="14" rx="2"/>
    <rect x="280" y="135" width="20" height="14" rx="2"/>
  </g>
  <g stroke="#B23B2E" stroke-width="1.5" fill="none">
    <line x1="60" y1="62" x2="150" y2="80"/>
    <line x1="60" y1="102" x2="150" y2="100"/>
    <line x1="60" y1="142" x2="150" y2="120"/>
    <line x1="150" y1="80" x2="210" y2="80"/>
    <line x1="150" y1="120" x2="210" y2="120"/>
    <line x1="150" y1="80" x2="150" y2="120"/>
    <line x1="210" y1="80" x2="210" y2="120"/>
    <line x1="210" y1="80" x2="300" y2="62"/>
    <line x1="210" y1="100" x2="300" y2="102"/>
    <line x1="210" y1="120" x2="300" y2="142"/>
  </g>
  <g fill="#3C8FA8" stroke="#1F5A6E" stroke-width="1">
    <circle cx="150" cy="80" r="11"/>
    <circle cx="210" cy="80" r="11"/>
    <circle cx="150" cy="120" r="11" />
    <circle cx="210" cy="120" r="11"/>
  </g>
  <text x="226" y="135" text-anchor="start" font-family="Arial" font-size="14" font-weight="bold" fill="#1a1a1a">B</text>
</svg>`;

/* ============================================================
   NAVIGATION PA SEKSYON (tout kesyon nan seksyon an vizib)
   ============================================================ */
const QUESTIONS = [];
QCM.forEach((q, i) => QUESTIONS.push({ ...q, section: 'A', type: 'qcm', sIdx: i, pts: QCM_PTS }));
MULTI.forEach((q, i) => QUESTIONS.push({ ...q, section: 'B', type: 'multi', sIdx: i, pts: MULTI_PTS }));
DD.forEach((q, i) => QUESTIONS.push({ ...q, section: 'C', type: 'dd', sIdx: i, pts: 2 }));
DND.forEach((q, i) => QUESTIONS.push({ ...q, section: 'D', type: 'dnd', sIdx: i, pts: 2 }));
SUBJ.forEach((q, i) => QUESTIONS.push({ ...q, section: 'E', type: 'subj', sIdx: i }));

const SECTIONS = ['A','B','C','D','E'];
let currentSectionIdx = 0;
let userAnswers = {};

const SECTION_LABELS = {
  A: 'Section 1 \u2014 Choisir la bonne r\u00e9ponse (1.25 pts chacune)',
  B: 'Section 2 \u2014 Cochez toutes les r\u00e9ponses correctes (1.25 pts chacune)',
  C: 'Section 3 \u2014 Liste d\u00e9roulante (2 pts chacune)',
  D: 'Section 4 \u2014 Glisser-d\u00e9poser : \u00e9quipement et concepts r\u00e9seau (2 pts chacun)',
  E: 'Section 5 \u2014 Questions de d\u00e9finition et de r\u00e9flexion (15 pts chacune, 2 sur 3 obligatoires)',
};

function updateProgress() {
  const fill = document.getElementById('progress-fill');
  if (fill) fill.style.width = ((currentSectionIdx + 1) / SECTIONS.length * 100) + '%';
}

function updateNavButtons() {
  const prevBtn = document.getElementById('prev-btn');
  const nextBtn = document.getElementById('next-btn');
  if (prevBtn) prevBtn.disabled = currentSectionIdx === 0;
  if (nextBtn) {
    nextBtn.disabled = false;
    nextBtn.textContent = currentSectionIdx === SECTIONS.length - 1
      ? 'Voir le r\u00e9sum\u00e9'
      : 'Section suivante';
  }
}

function buildQuestionHTML(idx, q) {
  let html = `<div class="q-card">`;
  html += `<div class="q-num">${q.section}.${q.sIdx + 1}</div>`;
  html += `<div class="q-text">${q.q} <span class="q-points">${q.pts || 0} pts</span></div>`;
  if (q.img === 'schema-reseau') {
    html += `<div style="margin-bottom:16px;text-align:center">${NETWORK_DIAGRAM_SVG}</div>`;
  } else if (q.img === 'ipv6') {
    html += `<div style="margin-bottom:16px;text-align:center">${IPV6_DIAGRAM_SVG}</div>`;
  } else if (q.img === 'q7-topologie') {
    html += `<div style="margin-bottom:16px;text-align:center"><img src="img/section1-q7-topologie.png" alt="Topologie r\u00e9seau" style="max-width:100%;border-radius:8px;border:1px solid var(--border)"></div>`;
  }

  if (q.type === 'qcm' || q.type === 'vf') {
    const opts = q.type === 'vf' ? ['Vrai', 'Faux'] : q.opts;
    html += `<div class="opt-list">`;
    opts.forEach((opt, j) => {
      const ck = userAnswers[idx] === opt ? ' checked' : '';
      html += `<div class="opt-item${ck}" id="q-${idx}-${j}" onclick="selOpt(${idx},${j})">`;
      html += `<input type="radio" name="q-${idx}" value="${opt}"${ck ? ' checked' : ''}>`;
      html += `<label>${opt}</label></div>`;
    });
    html += `</div>`;
  } else if (q.type === 'dd') {
    html += `<select class="dd" id="q-${idx}" onchange="ansDD(${idx},this.value)">`;
    html += `<option value="">\u2014 Choisir une r\u00e9ponse \u2014</option>`;
    q.options.forEach(o => {
      html += `<option value="${o}"${userAnswers[idx] === o ? ' selected' : ''}>${o}</option>`;
    });
    html += `</select>`;
  } else if (q.type === 'dnd') {
    const chips = q.chips || DND[0].chips;
    const used = userAnswers[idx] || '';
    html += `<div class="dnd-layout">`;
    html += `<div class="dnd-equip">${q.target}</div>`;
    html += `<div class="dnd-pool" id="dnd-pool-${idx}">`;
    chips.forEach((chip, ci) => {
      const pl = chip === used;
      html += `<div class="dnd-chip${pl ? ' placed' : ''}" id="dnd-chip-${idx}-${ci}" draggable="${!pl}" data-text="${chip.replace(/"/g, '&quot;')}" ondragstart="dragStartSingle(event,${idx},${ci})">${chip}</div>`;
    });
    html += `</div></div>`;
    html += `<div class="dnd-slot${used ? ' filled' : ''}" id="dnd-slot-${idx}" ondragover="dragOverSingle(event)" ondrop="dropSingle(event,${idx})">${used || 'D\u00e9posez la description ici'}</div>`;
  } else if (q.type === 'multi') {
    html += `<div class="opt-list">`;
    q.opts.forEach((opt, oi) => {
      const ck = Array.isArray(userAnswers[idx]) && userAnswers[idx].includes(opt);
      html += `<div class="opt-item${ck ? ' checked' : ''}" id="q-${idx}-${oi}" onclick="selMulti(${idx},${oi})">`;
      html += `<input type="checkbox" id="cb-${idx}-${oi}" value="${opt}"${ck ? ' checked' : ''}>`;
      html += `<label>${opt}</label></div>`;
    });
    html += `</div>`;
  } else if (q.type === 'subj') {
    html += `<textarea class="subj" id="q-${idx}" oninput="ansSubj(${idx},this.value)" placeholder="Votre r\u00e9ponse...">${userAnswers[idx] || ''}</textarea>`;
  }

  html += `</div>`;
  return html;
}

function renderSection(sectionIdx) {
  const section = SECTIONS[sectionIdx];
  const container = document.getElementById('q-container');
  const label = document.getElementById('q-section-label');
  label.textContent = SECTION_LABELS[section] || '';
  container.className = '';

  let html = '';
  if (section === 'F') {
    html += `<p class="subj-note">${SUBJ_NOTE}</p>`;
  }
  QUESTIONS.forEach((q, idx) => {
    if (q.section === section) html += buildQuestionHTML(idx, q);
  });
  container.innerHTML = html;
  updateProgress();
  updateNavButtons();

  /* Woulo nan tèt paj la pou wè progress bar + premye kesyon */
  setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 50);
}

function goNext() {
  if (currentSectionIdx < SECTIONS.length - 1) {
    currentSectionIdx++;
    renderSection(currentSectionIdx);
  } else {
    showSummary();
  }
}

function goPrev() {
  if (currentSectionIdx > 0) {
    currentSectionIdx--;
    renderSection(currentSectionIdx);
  }
}

/* updatePrevBtn konsève pou compatibilité, men navigasyon pa seksyon itilize updateNavButtons */
function updatePrevBtn() {
  const btn = document.getElementById('prev-btn');
  if (!btn) return;
  btn.disabled = currentSectionIdx === 0;
}

/* === REZISTWA REPONS (itilize pa onclick/onchange nan HTML) === */
function selOpt(idx, oi) {
  const q = QUESTIONS[idx];
  const opts = q.type === 'vf' ? ['Vrai', 'Faux'] : q.opts;
  userAnswers[idx] = opts[oi];
  document.querySelectorAll(`#q-container [id^="q-${idx}-"]`).forEach(el => el.classList.remove('checked'));
  const el = document.getElementById(`q-${idx}-${oi}`);
  if (el) { el.classList.add('checked'); el.querySelector('input').checked = true; }
  scheduleSave();
}
function selMulti(idx, oi) {
  const q = QUESTIONS[idx];
  if (!Array.isArray(userAnswers[idx])) userAnswers[idx] = [];
  const opt = q.opts[oi];
  const p = userAnswers[idx].indexOf(opt);
  if (p >= 0) userAnswers[idx].splice(p, 1); else userAnswers[idx].push(opt);
  const el = document.getElementById(`q-${idx}-${oi}`);
  const cb = document.getElementById(`cb-${idx}-${oi}`);
  if (el) el.classList.toggle('checked');
  if (cb) cb.checked = !cb.checked;
  scheduleSave();
}
function ansDD(idx, val) { userAnswers[idx] = val || ''; scheduleSave(); }
function ansSubj(idx, val) { userAnswers[idx] = val; scheduleSave(); }

/* === GLISSE-DEPOZE (DND) handlers === */
let draggedSingle = null;
function dragStartSingle(ev, idx, ci) {
  if (ev.target.classList.contains('placed')) return;
  draggedSingle = { idx, ci, text: ev.target.getAttribute('data-text') };
}
function dragOverSingle(ev) { ev.preventDefault(); if (ev.currentTarget) ev.currentTarget.classList.add('over'); }
function dropSingle(ev, idx) {
  ev.preventDefault();
  const slot = document.getElementById(`dnd-slot-${idx}`);
  if (!slot) return;
  slot.classList.remove('over');
  if (!draggedSingle || draggedSingle.idx !== idx) return;
  if (userAnswers[idx]) {
    document.querySelectorAll(`#dnd-pool-${idx} .dnd-chip`).forEach(c => {
      if (c.getAttribute('data-text') === userAnswers[idx]) { c.classList.remove('placed'); c.draggable = true; }
    });
  }
  userAnswers[idx] = draggedSingle.text || '';
  slot.textContent = userAnswers[idx] || 'D\u00e9posez la description ici';
  slot.classList.add('filled');
  const chipEl = document.getElementById(`dnd-chip-${idx}-${draggedSingle.ci}`);
  if (chipEl) { chipEl.classList.add('placed'); chipEl.draggable = false; }
  draggedSingle = null;
  scheduleSave();
}

/* Fermer modal pop-up la -- examen_reseau_v2 */
function toggleCodeVis() {
  const inp = document.getElementById('access-code');
  const eye = document.getElementById('eye-btn');
  if (!inp) return;
  if (inp.type === 'password') {
    inp.type = 'text';
    eye.textContent = '\u{1F441}';
  } else {
    inp.type = 'password';
    eye.textContent = '\u{1F441}';
  }
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('show');
  document.querySelector('.modal-icon').textContent = '!';
  document.querySelector('.modal-title').textContent = 'Attention';
  document.querySelector('.modal-msg').innerHTML = 'Vous devez r\u00e9pondre \u00e0 au moins une question avant de soumettre.';
  const ni = document.getElementById('access-code');
  if (ni) { ni.focus(); ni.select(); }
}

function showSummary() {
  document.getElementById('q-section-label').style.display = 'none';
  document.getElementById('q-container').style.display = 'none';
  document.getElementById('nav-zone').style.display = 'none';
  const sum = document.getElementById('screen-summary');
  sum.style.display = 'block';
  let h = '';
  QUESTIONS.forEach((q, i) => {
    const a = userAnswers[i];
    let t = '';
    if (q.type === 'multi') t = Array.isArray(a) && a.length > 0 ? a.join(', ') : '';
    else t = (a && a.toString().trim()) || '';
    if (!t) { t = '(sans réponse)'; }
    h += `<div class="summary-q"><div class="sq-label">${q.section}.${q.sIdx + 1}</div><div class="${t === '(sans réponse)' ? 'sq-empty' : 'sq-answer'}">${t}</div></div>`;
  });
  document.getElementById('summary-content').innerHTML = h;
  updateProgress();
}

/* ============================================================
   DÉMARRAGE DE L'EXAMEN (validation côté serveur)
   ============================================================ */
function showModal(title, msg) {
  document.querySelector('.modal-icon').textContent = '!';
  document.querySelector('.modal-title').textContent = title;
  document.querySelector('.modal-msg').textContent = msg;
  document.getElementById('modal-overlay').classList.add('show');
}

function setLoginStatus(state, msg) {
  const el = document.getElementById('login-status');
  if (!el) return;
  el.className = 'login-status ' + state;
  el.textContent = msg;
}

async function startExam() {
  const codeInput = document.getElementById('access-code');
  const nameInput = document.getElementById('student-name');
  const enteredCode = codeInput.value.trim().toUpperCase();
  const enteredName = nameInput.value.trim();

  if (!enteredCode || !enteredName) {
    showModal('Champs requis', 'Veuillez entrer votre code d\'accès et votre nom complet.');
    return;
  }

  const btn = document.getElementById('start-btn');
  btn.disabled = true;
  btn.textContent = 'Vérification...';
  setLoginStatus('wait', 'Vérification du code...');

  try {
    const res = await apiPost('validate_code.php', {
      code: enteredCode,
      name: enteredName
    });

    if (!res.ok) {
      btn.disabled = false;
      btn.textContent = 'Commencer l\'examen';
      setLoginStatus('err', '');
      showModal(res.title || 'Accès refusé', res.message || 'Impossible de vous connecter.');
      return;
    }

    sessionKey = res.session_key;
    studentName = res.name || enteredName;
    remainingSeconds = res.remaining_seconds;

    document.getElementById('student-label').textContent = studentName;

    document.getElementById('screen-intro').style.display = 'none';
    document.getElementById('screen-exam').classList.add('show');

    currentSectionIdx = 0;
    userAnswers = {};
    document.getElementById('q-section-label').style.display = 'block';
    document.getElementById('q-container').style.display = 'block';
    document.getElementById('q-container').className = '';
    document.getElementById('nav-zone').style.display = 'block';
    document.getElementById('screen-summary').style.display = 'none';

    renderSection(0);
    await loadSavedAnswers();
    renderSection(currentSectionIdx); // re-render avèk repons rezime yo
    startTimer();
    setSaveStatus('saved', 'Enregistré');
    setTimeout(() => {
      const card = document.querySelector('#q-container .q-card');
      if (card) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  } catch (e) {
    console.error(e);
    btn.disabled = false;
    btn.textContent = 'Commencer l\'examen';
    const host = window.location.host;
    const directFile = window.location.protocol === 'file:';
    if (directFile) {
      setLoginStatus('err', 'Erreur : fichier ouvert directement. Utilisez http://localhost/ExamenReseau2DeptReseauModulaire/');
    } else if (host.indexOf('github') !== -1) {
      setLoginStatus('err', 'Cette version (GitHub) ne fonctionne pas : elle n\'a pas de base de données ni de PHP. Utilisez l\'adresse donnée par l\'enseignant (http://localhost/ExamenReseau2DeptReseauModulaire/).');
    } else if (host !== 'localhost' && host !== '127.0.0.1') {
      setLoginStatus('err', 'Serveur injoignable via ' + window.location.href + ' — vérifiez la connexion réseau.');
    } else {
      setLoginStatus('err', 'Serveur injoignable — vérifiez que MySQL et Apache sont démarrés.');
    }
  }
}

/* ============================================================
   CHRONOMÈTRE
   ============================================================ */
function startTimer() {
  updateTimerDisplay();
  timerInterval = setInterval(() => {
    remainingSeconds--;
    updateTimerDisplay();
    if (remainingSeconds <= 0) { clearInterval(timerInterval); submitExam(true); }
  }, 1000);
  syncTimerInterval = setInterval(() => { scheduleSave(); }, 30000);
}

function updateTimerDisplay() {
  const h = Math.floor(remainingSeconds / 3600);
  const m = Math.floor((remainingSeconds % 3600) / 60);
  const s = remainingSeconds % 60;
  const display = `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
  const timerEl = document.getElementById('timer');
  timerEl.textContent = display;
  if (remainingSeconds <= 300) timerEl.className = 'danger';
  else if (remainingSeconds <= 900) timerEl.className = 'warn';
}

/* ============================================================
   CORRECTION AUTOMATIQUE
   ============================================================ */
async function gradeObjective() {
  let score = 0;
  let detail = [];
  let qi = 0;

for (let i = 0; i < QCM.length; i++, qi++) {
    const userAns = userAnswers[qi] || null;
    const userHash = userAns ? await sha256(userAns) : null;
    const correct = userHash === QCM[i].hash;
    if (correct) score += QCM_PTS; // QCM 1.25 pts chak
    detail.push(`A.${i+1}: ${userAns || '(sans r\u00e9ponse)'} ${correct ? '[correct]' : '[incorrect]'}`);
  }
for (let i = 0; i < MULTI.length; i++, qi++) {
    const userSelected = Array.isArray(userAnswers[qi]) ? userAnswers[qi] : [];
    const correctSet = new Set(MULTI[i].ans);
    const userSet = new Set(userSelected);
    const isExactMatch = correctSet.size === userSet.size && [...correctSet].every(a => userSet.has(a));
    if (isExactMatch) score += MULTI_PTS; // Multi 1.25 pts chak
    detail.push(`B.${i+1}: ${userSelected.join(', ') || '(sans r\u00e9ponse)'} ${isExactMatch ? '[correct]' : '[incorrect]'}`);
  }
  for (let i = 0; i < DD.length; i++, qi++) {
    const userAns = userAnswers[qi] || null;
    const userHash = userAns ? await sha256(userAns) : null;
    const correct = userHash === DD[i].hash;
    if (correct) score += 2; // Liste 2 pts chak
    detail.push(`C.${i+1}: ${userAns || '(sans réponse)'} ${correct ? '[correct]' : '[incorrect]'}`);
  }
  for (let i = 0; i < DND.length; i++, qi++) {
    const userAns = userAnswers[qi] || null;
    const userHash = userAns ? await sha256(userAns) : null;
    const correct = userHash === DND[i].hash;
    if (correct) score += 2; // Glisser 2 pts chak
    detail.push(`D (${DND[i].target}): ${userAns || '(sans réponse)'} ${correct ? '[correct]' : '[incorrect]'}`);
  }

  return { score, detail };
}

function collectSubjective() {
  let answers = [];
  let qi = QCM.length + MULTI.length + DD.length + DND.length;
  SUBJ.forEach((item, i) => {
    const val = userAnswers[qi + i] || '';
    answers.push(`E.${i+1} (${item.pts} pts) ${item.q}\n${val || '(sans réponse)'}`);
  });
  return answers;
}

/* ============================================================
   SOUMISSION DE L'EXAMEN
   ============================================================ */
let lastEmailBody = '';
let lastEmailSubject = '';

/* Tcheke si etidyan an reponn omwen 1 kesyon -- examen_reseau_v2 */
function hasAnyAnswer() {
  for (let i = 0; i < QUESTIONS.length; i++) {
    const a = userAnswers[i];
    if (a !== undefined && a !== null && a !== '' && !(Array.isArray(a) && a.length === 0)) return true;
  }
  return false;
}

async function submitExam(autoSubmit) {
  if (examSubmitted) return;
  if (!autoSubmit && !hasAnyAnswer()) {
    showModal('Attention', 'Vous devez répondre à au moins une question avant de soumettre.');
    return;
  }
  examSubmitted = true;
  if (timerInterval) clearInterval(timerInterval);
  if (syncTimerInterval) clearInterval(syncTimerInterval);

  /* Voye repons yo + make submitted sou server anvan tout bagay */
  try {
    if (sessionKey) {
      await apiPost('save_answers.php', { session_key: sessionKey, answers: userAnswers });
      await apiPost('submit_exam.php', { session_key: sessionKey });
    }
  } catch (e) { /* rete pare */ }

  const { score: objectiveScore, detail } = await gradeObjective();
  const subjectiveAnswers = collectSubjective();

  document.getElementById('screen-exam').classList.remove('show');
  document.getElementById('screen-done').classList.add('show');

  if (autoSubmit) {
    document.getElementById('done-msg').textContent =
      "Le temps imparti est écoulé. Vos réponses ont été soumises automatiquement. Cliquez sur un des boutons ci-dessous pour transmettre vos résultats à l'enseignant.";
  }

  buildEmailContent(objectiveScore, detail, subjectiveAnswers);
  setupSubmitButtons(objectiveScore, detail, subjectiveAnswers);
}

function buildEmailContent(objectiveScore, detail, subjectiveAnswers) {
  lastEmailSubject = `Résultats Réseau 2 — ${studentName}`;

  const autoTotal = QUESTIONS.reduce((s, q) => q.type === 'subj' ? s : s + (q.pts || 0), 0);
  const subjTotal = QUESTIONS.filter(q => q.type === 'subj').reduce((s, q) => s + (q.pts || 0), 0);
  const grandTotal = autoTotal + subjTotal;

  let body = '';
  body += `╔══════════════════════════════════════════════════════════╗\n`;
  body += `║            RÉSEAU 2 — RÉSULTATS D'EXAMEN              ║\n`;
  body += `╚══════════════════════════════════════════════════════════╝\n\n`;
  body += `Étudiant : ${studentName}\n`;
  body += `${'─'.repeat(60)}\n\n`;
  body += `NOTE AUTOMATIQUE : ${objectiveScore} / ${autoTotal}\n`;
  body += `${'─'.repeat(60)}\n`;
  body += ` Détail des réponses automatiques\n`;
  body += `${'─'.repeat(60)}\n`;
  detail.forEach(line => {
    const display = line.replace('[correct]', '✓').replace('[incorrect]', '✗');
    body += ` ${display}\n`;
  });
  body += `\n${'═'.repeat(60)}\n`;
  body += ` QUESTIONS SUBJECTIVES (${subjTotal} pts)\n`;
  body += `${'═'.repeat(60)}\n\n`;
  subjectiveAnswers.forEach(ans => {
    const lines = ans.split('\n');
    body += ` ${lines[0]}\n`;
    body += ` ${lines.slice(1).join('\n') || '(sans réponse)'}\n`;
    body += `${'·'.repeat(60)}\n\n`;
  });
  body += `\n${'═'.repeat(60)}\n`;
  body += ` CALCUL FINAL (à compléter par l'enseignant)\n`;
  body += `${'═'.repeat(60)}\n`;
  body += ` Note automatique        : ${objectiveScore} / ${autoTotal}\n`;
  body += ` Note manuelle (subjectif) : ____ / ${subjTotal}\n`;
  body += ` ───────────────────────────\n`;
  body += ` TOTAL                   : ____ / ${grandTotal}\n`;
  body += ` Seuil de réussite        : 65 / 100\n\n`;
  body += `${'─'.repeat(60)}\n`;
  body += ` Document généré automatiquement — Examen Réseau 2\n`;

  lastEmailBody = body;
}

function setupSubmitButtons(objectiveScore, detail, subjectiveAnswers) {
  const submitBtn = document.getElementById('resend-btn');
  const copyBtn = document.getElementById('copy-btn');

  // Kache bouton copie a — pa bezwen ankò
  if (copyBtn) copyBtn.style.display = 'none';

  submitBtn.textContent = 'Envoyer les résultats';
  submitBtn.onclick = () => sendEmail(objectiveScore, detail, subjectiveAnswers);

  // Voye otomatikman
  sendEmail(objectiveScore, detail, subjectiveAnswers);
}

async function sendEmail(objectiveScore, detail, subjectiveAnswers) {
  const submitBtn = document.getElementById('resend-btn');
  submitBtn.textContent = 'Envoi en cours...';
  submitBtn.disabled = true;

  const detailText = detail.join('\n');
  const subjText = subjectiveAnswers.join('\n\n---\n\n');

  try {
    await emailjs.send(
      EMAILJS_SERVICE_ID,
      EMAILJS_TEMPLATE_ID,
      {
        to_email: TEACHER_EMAIL,
        student_name: studentName,
        objective_score: objectiveScore,
        detail: detailText,
        subjective: subjText,
        email_body: lastEmailBody,
      },
      EMAILJS_PUBLIC_KEY
    );

    submitBtn.textContent = '✓ Résultats envoyés';
    submitBtn.style.background = '#1D9E75';
    document.getElementById('copy-feedback').textContent = 'Vos résultats ont été envoyés automatiquement à l\'enseignant.';
    document.getElementById('copy-feedback').classList.add('show');

  } catch (error) {
    console.error('EmailJS error:', error);
    submitBtn.textContent = 'Réessayer l\'envoi';
    submitBtn.disabled = false;
    document.getElementById('copy-feedback').textContent = 'Erreur d\'envoi — cliquez sur "Réessayer" ou copiez manuellement.';
    document.getElementById('copy-feedback').classList.add('show');
  }
}

/* ============================================================
   INITIALISATION GÉNÉRALE
   ============================================================ */
function updateStartBtn() {
  const btn = document.getElementById('start-btn');
  if (!btn) return;
  const code = (document.getElementById('access-code').value || '').trim();
  const name = (document.getElementById('student-name').value || '').trim();
  btn.disabled = !(code && name);
}

(async function init() {
  emailjs.init(EMAILJS_PUBLIC_KEY);
  const codeInput = document.getElementById('access-code');
  const nameInput = document.getElementById('student-name');
  if (codeInput) codeInput.addEventListener('input', updateStartBtn);
  if (nameInput) nameInput.addEventListener('input', updateStartBtn);
  updateStartBtn();
  await initHashes();
})();
