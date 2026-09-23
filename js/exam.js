
/* ============================================================
   CONFIGURATION
   ============================================================ */
const TEACHER_EMAIL = "stevengauchier@gmail.com";
const EMAILJS_SERVICE_ID = "service_jjqlfck";
const EMAILJS_TEMPLATE_ID = "template_a9uazrs";
const EMAILJS_PUBLIC_KEY = "8ZF_oJb8pHOzojn1p";
const EXAM_DURATION_SECONDS = 150 * 60; // 150 minutes
const DEADLINE = new Date("2026-07-10T23:59:59"); // Egzamen fini

/* Lis kòd aksè ak non etidyan yo — modifye selon lis klas ou */
const STUDENTS = [
  { code: "2025RES01", name: "GAUCHIER Steven" },
  { code: "2025RES02", name: "Deshley REJOUIS" },
  { code: "2025RES03", name: "FLERIVAL Wiselet" },
  { code: "2025RES04", name: "Ezechiel EXUME" },
  { code: "2025RES05", name: "CLERVILLE Stephania" },
  { code: "2025RES06", name: "Belando DESIR" },
  { code: "2025RES07", name: "OVIDE Samuel" },
  { code: "2025RES08", name: "Frederic Schnyder" },
  { code: "2025RES09", name: "Verna Josephine Angella" },
  { code: "2025RES10", name: "Einstein Medjuvens LAFONTANT" },
  { code: "2025RES11", name: "Miralus Kervens" },
  { code: "2025RES12", name: "Lovinsky FEDNA" },
  { code: "2025RES13", name: "ETIDYAN 13" },
  { code: "2025RES14", name: "ETIDYAN 14" },
  { code: "2025RES15", name: "ETIDYAN 15" },
];

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
   SECTION A — QCM (11 x 2 pts = 22 pts)
   ============================================================ */
const QCM = [
  { q: "Que peut-on placer dans ou sur un colis pour en assurer le suivi ?", opts: ["Déclencheur", "Capteur", "Carte d'interface de réseau", "Étiquette RFID"], hash: "" },
  { q: "Lorsque vous utilisez votre carte bancaire pour effectuer des achats à plusieurs endroits, la société émettrice de la carte peut utiliser ces informations pour connaître votre emplacement et vos préférences. Ce type de données personnelles est connu sous le nom de :", opts: ["Données fournies", "Données observées", "Données déduites", "Données secrètes"], hash: "" },
  { q: "Reportez-vous à l'illustration (schéma de réseau A — nuage — B). Quel terme identifie correctement le type de périphérique inclus dans la zone B ?", opts: ["Intermédiaire", "Source", "Fin", "Transférer"], img: "schema-reseau", hash: "" },
  { q: "Quelle adresse ne peut jamais être attribuée à un hôte ?", opts: ["192.168.1.1", "192.168.1.0", "192.168.1.10", "192.168.1.5"], hash: "" },
  { q: "Combien de bits y a-t-il dans un octet ?", opts: ["4", "8", "16", "32"], hash: "" },
  { q: "Quel câble réseau utilise des fils de cuivre torsadés par paires ?", opts: ["Câble coaxial", "Câble à paires torsadées (RJ-45)", "Fibre optique", "Câble HDMI"], hash: "" },
  { q: "Quel port standard utilise le protocole HTTP ?", opts: ["21", "25", "80", "443"], hash: "" },
  { q: "Quelle topologie réseau relie tous les postes à un point central unique ?", opts: ["Bus", "Étoile", "Anneau", "Maillée"], hash: "" },
  { q: "Quelle technologie est utilisée pour l'identification sans contact par radiofréquence, courante en domotique ?", opts: ["Bluetooth", "RFID", "NFC", "Zigbee"], hash: "" },
  { q: "Dans le modèle TCP/IP (4 couches), quelle couche correspond aux couches 5, 6 et 7 du modèle OSI combinées ?", opts: ["Couche Accès réseau", "Couche Internet", "Couche Transport", "Couche Application"], hash: "" },
  /* Nouvo kesyon A.11 sou IPv6 ajoute -- examen_reseau_v2 */
  { q: "Reportez-vous à l'illustration. Combien de bits sont représentés par chaque groupe de quatre valeurs hexadécimales contenues entre les deux points dans une adresse IPv6 ?", opts: ["8", "4", "64", "32", "16"], img: "ipv6", hash: "" },
];
const QCM_ANSWERS = [
  "Étiquette RFID", "Données déduites", "Intermédiaire", "192.168.1.0", "8",
  "Câble à paires torsadées (RJ-45)", "80", "Étoile", "RFID", "Couche Application",
  /* Repons kesyon A.11 IPv6 -- examen_reseau_v2 */
  "16"
];

/* ============================================================
   SECTION B — Vrai/Faux (10 x 2 pts = 20 pts) — B1 à B8 réécrites
   plus difficiles, B9 et B10 conservées
   ============================================================ */
const VF = [
  { q: "Si deux trames sont transmises simultanément sur un même segment de réseau partagé, une collision se produit nécessairement, quel que soit le protocole d'accès utilisé.", ans: "Faux" },
  { q: "Un paquet IP peut atteindre sa destination même si un seul routeur intermédiaire tombe en panne, à condition qu'un chemin alternatif existe.", ans: "Vrai" },
  { q: "Le port source d'une connexion TCP est presque toujours un port standard et fixe, identique à chaque nouvelle connexion.", ans: "Faux" },
  { q: "Une adresse IP privée comme 192.168.1.10 peut être directement routée sur Internet sans aucune traduction.", ans: "Faux" },
  { q: "Dans le modèle OSI, une couche ne peut lire que l'en-tête qu'elle a elle-même ajouté côté émetteur, jamais celui d'une autre couche.", ans: "Vrai" },
  { q: "Un switch (commutateur) doit consulter une table d'adresses IP pour décider sur quel port envoyer une trame.", ans: "Faux" },
  { q: "Le protocole UDP est préférable à TCP lorsque la rapidité de transmission importe davantage que la garantie de livraison de chaque paquet.", ans: "Vrai" },
  { q: "Deux machines sur le même réseau local peuvent communiquer directement par leur adresse MAC sans jamais avoir besoin de connaître leur adresse IP respective.", ans: "Faux" },
  { q: "Un capteur (sensor) en domotique collecte des données de l'environnement.", ans: "Vrai" },
  { q: "DNS traduit un nom de domaine en adresse IP.", ans: "Vrai" },
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
   SECTION E — Choix multiples, plusieurs bonnes réponses
   (2 x 4 pts = 8 pts)
   ============================================================ */
const MULTI = [
  {
    q: "Quels sont les rôles principaux d'une carte réseau (NIC) ?",
    opts: ["Convertir les données en signaux électriques ou radio", "Fournir une adresse MAC unique", "Gérer la communication entre l'ordinateur et le réseau", "Servir de pare-feu matériel", "Assurer la transmission et la réception des paquets"],
    ans: ["Convertir les données en signaux électriques ou radio", "Fournir une adresse MAC unique", "Gérer la communication entre l'ordinateur et le réseau", "Assurer la transmission et la réception des paquets"]
  },
  {
    q: "Quels sont les avantages d'une topologie en maillage (mesh) ?",
    opts: ["Haute tolérance aux pannes", "Redondance des chemins de communication", "Coût réduit en câblage", "Performance stable même en cas de panne d'un lien", "Complexité de gestion faible"],
    ans: ["Haute tolérance aux pannes", "Redondance des chemins de communication", "Performance stable même en cas de panne d'un lien"]
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
let examSubmitted = false;
let studentName = "";

/* ============================================================
   VÉRIFICATION DE LA DATE LIMITE
   ============================================================ */
function checkDeadline() {
  const params = new URLSearchParams(window.location.search);
  if (params.has('admin')) return false; // bypass pou pwofesè a
  if (new Date() > DEADLINE) {
    document.getElementById('screen-expired').classList.add('show');
    document.getElementById('screen-intro').style.display = 'none';
    return true;
  }
  return false;
}

/* ============================================================
   INITIALISATION DES HASHES
   ============================================================ */
async function initHashes() {
  for (let i = 0; i < QCM.length; i++) QCM[i].hash = await sha256(QCM_ANSWERS[i]);
  for (let i = 0; i < VF.length; i++) VF[i].hash = await sha256(VF[i].ans);
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
QCM.forEach((q, i) => QUESTIONS.push({ ...q, section: 'A', type: 'qcm', sIdx: i, pts: 2 }));
VF.forEach((q, i) => QUESTIONS.push({ ...q, section: 'B', type: 'vf', sIdx: i, pts: 2 }));
DD.forEach((q, i) => QUESTIONS.push({ ...q, section: 'C', type: 'dd', sIdx: i, pts: 2 }));
DND.forEach((q, i) => QUESTIONS.push({ ...q, section: 'D', type: 'dnd', sIdx: i, pts: 2 }));
MULTI.forEach((q, i) => QUESTIONS.push({ ...q, section: 'E', type: 'multi', sIdx: i, pts: 4 }));
SUBJ.forEach((q, i) => QUESTIONS.push({ ...q, section: 'F', type: 'subj', sIdx: i }));

const SECTIONS = ['A','B','C','D','E','F'];
let currentSectionIdx = 0;
let userAnswers = {};

const SECTION_LABELS = {
  A: 'Section A \u2014 Questions \u00e0 choix multiple (2 pts chacune)',
  B: 'Section B \u2014 Vrai ou Faux (2 pts chacune)',
  C: 'Section C \u2014 Liste d\u00e9roulante (2 pts chacune)',
  D: 'Section D \u2014 Glisser-d\u00e9poser : \u00e9quipement et concepts r\u00e9seau (2 pts chacun)',
  E: 'Section E \u2014 Choix multiples (4 pts chacun)',
  F: 'Section F \u2014 Questions de d\u00e9finition et de r\u00e9flexion (15 pts chacune, 2 sur 3 obligatoires)',
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
}
function ansDD(idx, val) { userAnswers[idx] = val || ''; }
function ansSubj(idx, val) { userAnswers[idx] = val; }

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
}

/* F�men modal pop-up la -- examen_reseau_v2 */
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
  document.querySelector('.modal-msg').innerHTML = 'Vous devez r�pondre � au moins une question avant de soumettre.';
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
   DÉMARRAGE DE L'EXAMEN
   ============================================================ */
function startExam() {
  const codeInput = document.getElementById('access-code');
  const enteredCode = codeInput.value.trim().toUpperCase();

  /* Tcheke kòd aksè a */
  const student = STUDENTS.find(s => s.code.toUpperCase() === enteredCode);
  if (!student) {
    document.querySelector('.modal-icon').textContent = '!';
    document.querySelector('.modal-title').textContent = 'Code invalide';
    document.querySelector('.modal-msg').textContent = 'Le code d\'accès que vous avez entré n\'est pas reconnu. Veuillez vérifier auprès de votre enseignant.';
    document.getElementById('modal-overlay').classList.add('show');
    return;
  }
  if (student.name.startsWith('ETIDYAN')) {
    document.querySelector('.modal-icon').textContent = '!';
    document.querySelector('.modal-title').textContent = 'Code non attribué';
    document.querySelector('.modal-msg').textContent = 'Ce code n\'est pas encore attribué à un étudiant. Veuillez contacter votre enseignant.';
    document.getElementById('modal-overlay').classList.add('show');
    return;
  }

  studentName = student.name;

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
  startTimer();
  setTimeout(() => {
    const card = document.querySelector('#q-container .q-card');
    if (card) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 100);
}

/* ============================================================
   CHRONOMÈTRE
   ============================================================ */
let remainingSeconds = EXAM_DURATION_SECONDS;

function startTimer() {
  updateTimerDisplay();
  timerInterval = setInterval(() => {
    remainingSeconds--;
    updateTimerDisplay();
    if (remainingSeconds <= 0) { clearInterval(timerInterval); submitExam(true); }
  }, 1000);
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
    if (correct) score += 2; // QCM 2 pts chak
    detail.push(`A.${i+1}: ${userAns || '(sans r�ponse)'} ${correct ? '[correct]' : '[incorrect]'}`);
  }
  for (let i = 0; i < VF.length; i++, qi++) {
    const userAns = userAnswers[qi] || null;
    const userHash = userAns ? await sha256(userAns) : null;
    const correct = userHash === VF[i].hash;
    if (correct) score += 2;
    detail.push(`B.${i+1}: ${userAns || '(sans r�ponse)'} ${correct ? '[correct]' : '[incorrect]'}`);
  }
  for (let i = 0; i < DD.length; i++, qi++) {
    const userAns = userAnswers[qi] || null;
    const userHash = userAns ? await sha256(userAns) : null;
    const correct = userHash === DD[i].hash;
    if (correct) score += 2; // Liste 2 pts chak
    detail.push(`C.${i+1}: ${userAns || '(sans r�ponse)'} ${correct ? '[correct]' : '[incorrect]'}`);
  }
  for (let i = 0; i < DND.length; i++, qi++) {
    const userAns = userAnswers[qi] || null;
    const userHash = userAns ? await sha256(userAns) : null;
    const correct = userHash === DND[i].hash;
    if (correct) score += 2; // Glisser 2 pts chak
    detail.push(`D (${DND[i].target}): ${userAns || '(sans r�ponse)'} ${correct ? '[correct]' : '[incorrect]'}`);
  }
  for (let qi2 = 0; qi2 < MULTI.length; qi2++, qi++) {
    const userSelected = Array.isArray(userAnswers[qi]) ? userAnswers[qi] : [];
    const correctSet = new Set(MULTI[qi2].ans);
    const userSet = new Set(userSelected);
    const isExactMatch = correctSet.size === userSet.size && [...correctSet].every(a => userSet.has(a));
    if (isExactMatch) score += 4; // Multi 4 pts chak
    detail.push(`E.${qi2+1}: ${userSelected.join(', ') || '(sans r�ponse)'} ${isExactMatch ? '[correct]' : '[incorrect]'}`);
  }

  return { score, detail };
}

function collectSubjective() {
  let answers = [];
  let qi = QCM.length + VF.length + DD.length + DND.length + MULTI.length;
  SUBJ.forEach((item, i) => {
    const val = userAnswers[qi + i] || '';
    answers.push(`F.${i+1} (${item.pts} pts) ${item.q}\n${val || '(sans r�ponse)'}`);
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
    /* Montre modal pop-up olye alert() -- examen_reseau_v2 */
    document.querySelector('.modal-icon').textContent = '!';
    document.querySelector('.modal-title').textContent = 'Attention';
    document.querySelector('.modal-msg').innerHTML = 'Vous devez r�pondre � au moins une question avant de soumettre.';
    document.getElementById('modal-overlay').classList.add('show');
    return;
  }
  examSubmitted = true;
  if (timerInterval) clearInterval(timerInterval);

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
  lastEmailSubject = `Résultats Réseau 1 — ${studentName}`;

  let body = '';
  body += `╔══════════════════════════════════════════════════════════╗\n`;
  body += `║            RÉSEAU 1 — RÉSULTATS D'EXAMEN              ║\n`;
  body += `╚══════════════════════════════════════════════════════════╝\n\n`;
  body += `Étudiant : ${studentName}\n`;
  body += `${'─'.repeat(60)}\n\n`;
  body += `NOTE AUTOMATIQUE (A+B+C+D+E) : ${objectiveScore} / 70\n`;
  body += `${'─'.repeat(60)}\n`;
  body += ` Détail des réponses automatiques\n`;
  body += `${'─'.repeat(60)}\n`;
  detail.forEach(line => {
    const display = line.replace('[correct]', '✓').replace('[incorrect]', '✗');
    body += ` ${display}\n`;
  });
  body += `\n${'═'.repeat(60)}\n`;
  body += ` SECTION F — Questions subjectives (30 pts, 2/3 obligatoires)\n`;
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
  body += ` Note automatique        : ${objectiveScore} / 70\n`;
  body += ` Note manuelle (Section F) : ____ / 30\n`;
  body += ` ───────────────────────────\n`;
  body += ` TOTAL                   : ____ / 100\n`;
  body += ` Seuil de réussite        : 65 / 100\n\n`;
  body += `${'─'.repeat(60)}\n`;
  body += ` Document généré automatiquement — Examen Réseau 1\n`;

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
(async function init() {
  emailjs.init(EMAILJS_PUBLIC_KEY);
  if (checkDeadline()) return;
  await initHashes();
})();
