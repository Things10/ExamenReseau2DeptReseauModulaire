<?php
/* ============================================================
   ESPACE ENSEIGNANT — KOREKSYON NOT MANUELLE + TOTAL OTOMATIK
   URL : /teacher.php
   Pwotèj : paswòd (TEACHER_PASS nan api/db.php)
   - lis etidyan ki soumèt egzamen an
   - note automatique (sèlman A + B) kalkile sou sèvè
   - antre note manuelle (C + D) → TOTAL = auto + manuel (JS live)
   - sove nan tablo `grades` (kreye otomatikman si li pa egziste)
   ============================================================ */
declare(strict_types=1);
require __DIR__ . '/api/db.php';
require __DIR__ . '/api/exam_answers.php';

if (session_status() === PHP_SESSION_NONE) { session_start(); }

/* Konstan koreksyon — DOIT koresponn ak js/exam.js */
define('AUTO_TOTAL', QCM_PTS * QCM_COUNT + MULTI_PTS * MULTI_COUNT);   // 20 pts
define('SUBJ_TOTAL', 30);                                              // Section C (5x3) + Section D (15)
define('GRAND_TOTAL', AUTO_TOTAL + SUBJ_TOTAL);                        // 50 pts
define('SEUIL', 33);

function esc(string $s): string { return htmlspecialchars($s, ENT_QUOTES, 'UTF-8'); }

function compute_auto(array $answers): float {
    $score = 0.0;
    for ($i = 0; $i < QCM_COUNT; $i++) {
        $raw = $answers[(string)$i] ?? '';
        $ua  = is_string($raw) ? trim($raw) : '';
        $good = mb_strtolower(trim($GLOBALS['QCM_ANSWERS'][$i] ?? ''));
        if ($ua !== '' && mb_strtolower($ua) === $good) { $score += QCM_PTS; }
    }
    for ($i = 0; $i < MULTI_COUNT; $i++) {
        $sel = $answers[(string)(QCM_COUNT + $i)] ?? [];
        if (!is_array($sel)) { $sel = []; }
        $us = array_values(array_unique(array_map('strval', $sel)));
        $gs = array_values(array_unique(array_map('strval', $GLOBALS['MULTI_ANSWERS'][$i] ?? [])));
        if (count($us) === count($gs) && count(array_intersect($us, $gs)) === count($gs)) { $score += MULTI_PTS; }
    }
    return round($score, 2);
}

function answer_map(PDO $pdo, int $sessionId): array {
    $map = [];
    $st = $pdo->prepare('SELECT question_key, answer FROM answers WHERE session_id = :sid');
    $st->execute([':sid' => $sessionId]);
    foreach ($st->fetchAll() as $row) {
        $val = $row['answer'];
        $dec = json_decode($val, true);
        $map[$row['question_key']] = ($dec !== null) ? $dec : $val;
    }
    return $map;
}

function ensure_grades_table(PDO $pdo): void {
    try {
        $pdo->exec(
            'CREATE TABLE IF NOT EXISTS grades (
                session_key  VARCHAR(64) PRIMARY KEY,
                auto_score   DECIMAL(6,2) NOT NULL DEFAULT 0,
                manual_score DECIMAL(6,2) NOT NULL DEFAULT 0,
                total        DECIMAL(6,2) NOT NULL DEFAULT 0,
                updated_at   DATETIME DEFAULT NULL
             ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
        );
    } catch (Throwable $e) { /* rete pare */ }
}

function ensure_email_column(PDO $pdo): void {
    try {
        $st = $pdo->prepare(
            'SELECT COUNT(*) AS c FROM information_schema.COLUMNS
              WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = "students" AND COLUMN_NAME = "email"'
        );
        $st->execute();
        $exists = (int)$st->fetch()['c'] > 0;
        if (!$exists) {
            $pdo->exec('ALTER TABLE students ADD COLUMN email VARCHAR(120) NULL');
        }
    } catch (Throwable $e) { /* rete pare */ }
}

$pdo = db();
ensure_grades_table($pdo);
ensure_email_column($pdo);

/* -- Dekonekte -- */
if (($_GET['logout'] ?? '') === '1') {
    $_SESSION = [];
    if (session_status() === PHP_SESSION_ACTIVE) { session_destroy(); }
    header('Location: teacher.php'); exit;
}

$auth = !empty($_SESSION['teacher']);
$error = '';

/* -- Konekte -- */
if (!$auth && $_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'login') {
    if (hash_equals(TEACHER_PASS, (string)($_POST['pass'] ?? ''))) {
        $_SESSION['teacher'] = 1;
        header('Location: teacher.php'); exit;
    }
    $error = 'Mot de passe incorrect.';
}

/* -- Sove note manuelle -- */
if ($auth && $_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'save') {
    $sk = trim((string)($_POST['session_key'] ?? ''));
    $manual = max(0.0, min((float)SUBJ_TOTAL, (float)($_POST['manual'] ?? 0)));
    $email = trim((string)($_POST['email'] ?? ''));
    if ($email !== '' && filter_var($email, FILTER_VALIDATE_EMAIL) === false) { $email = ''; }
    if ($sk !== '') {
        $st = $pdo->prepare('SELECT id, student_id FROM exam_sessions WHERE session_key = :sk AND submitted = 1');
        $st->execute([':sk' => $sk]);
        $row = $st->fetch();
        if ($row) {
            $auto = compute_auto(answer_map($pdo, (int)$row['id']));
            $total = round($auto + $manual, 2);
            $upsert = $pdo->prepare(
                'INSERT INTO grades (session_key, auto_score, manual_score, total, updated_at)
                 VALUES (:sk, :a, :m, :t, NOW())
                 ON DUPLICATE KEY UPDATE auto_score = VALUES(auto_score),
                                         manual_score = VALUES(manual_score),
                                         total = VALUES(total),
                                         updated_at = NOW()'
            );
            $upsert->execute([':sk' => $sk, ':a' => $auto, ':m' => $manual, ':t' => $total]);
            if ($email !== '') {
                $ue = $pdo->prepare('UPDATE students SET email = :em WHERE id = :sid');
                $ue->execute([':em' => $email, ':sid' => (int)$row['student_id']]);
            }
        }
    }
    header('Location: teacher.php?saved=1'); exit;
}

/* -- Done -- */
$rows = [];
if ($auth) {
    $page = (int)($_GET['page'] ?? 1);
    $per  = 200;
    $off  = (int)max(0, ($page - 1) * $per);

    $stmt = $pdo->prepare(
        'SELECT st.code, st.name, st.is_test, st.email,
                es.id AS session_id, es.session_key, es.started_at, es.submitted_at
           FROM exam_sessions es
           JOIN students st ON st.id = es.student_id
          WHERE es.submitted = 1
          ORDER BY es.submitted_at DESC, es.id DESC
          LIMIT :lim OFFSET :off'
    );
    $stmt->bindValue(':lim', $per, PDO::PARAM_INT);
    $stmt->bindValue(':off', $off, PDO::PARAM_INT);
    $stmt->execute();

    $grades = [];
    foreach ($pdo->query('SELECT session_key, manual_score FROM grades') as $g) {
        $grades[$g['session_key']] = (float)$g['manual_score'];
    }

    foreach ($stmt->fetchAll() as $r) {
        $auto = compute_auto(answer_map($pdo, (int)$r['session_id']));
        $manual = $grades[$r['session_key']] ?? null;
        $rows[] = $r + ['auto' => $auto, 'manual' => $manual];
    }
}
?>
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Espace enseignant — Examen Réseau 2</title>
<script src="https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js"></script>
<style>
  :root { --green:#1D9E75; --green-dk:#0B6E4F; --bg:#F4F7F6; --card:#fff; --line:#DFE7E4; --txt:#1C1A17; --muted:#6B7A75; }
  * { box-sizing: border-box; }
  body { margin:0; font-family: Arial, Helvetica, sans-serif; background:var(--bg); color:var(--txt); }
  .head { background:linear-gradient(135deg,#5DCAA5,#1D9E75); color:#fff; padding:16px 22px; display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; }
  .head h1 { margin:0; font-size:19px; }
  .head .sub { font-size:13px; opacity:.9; }
  .wrap { max-width:1080px; margin:22px auto; padding:0 16px; }
  .card { background:var(--card); border:1px solid var(--line); border-radius:10px; padding:18px 20px; }
  table { width:100%; border-collapse:collapse; font-size:13.5px; }
  th, td { border-bottom:1px solid var(--line); padding:8px 8px; text-align:left; vertical-align:middle; }
  th { background:#F0F5F2; font-size:12px; text-transform:uppercase; letter-spacing:.3px; color:var(--muted); }
  input[type=number], input[type=password] { font-size:14px; padding:6px 8px; border:1px solid #C9D8D2; border-radius:6px; width:90px; }
  .btn { background:var(--green); color:#fff; border:0; border-radius:7px; padding:8px 14px; font-size:13.5px; cursor:pointer; font-weight:bold; }
  .btn:hover { background:var(--green-dk); }
  .btn-out { background:none; border:1px solid rgba(255,255,255,.7); color:#fff; border-radius:7px; padding:7px 14px; font-size:13px; cursor:pointer; text-decoration:none; }
  .tot { font-weight:bold; font-size:15px; }
  .ok { color:#0B6E4F; font-weight:bold; }
  .ko { color:#B3402E; font-weight:bold; }
  .tag { display:inline-block; background:#FFF3D2; color:#8A6100; font-size:11px; font-weight:bold; border-radius:10px; padding:1px 8px; margin-left:6px; }
  .meta { color:var(--muted); font-size:12px; margin:-6px 0 14px; }
  .err { background:#FDECEA; color:#B3402E; border:1px solid #F2C9C2; border-radius:8px; padding:10px 14px; margin-bottom:14px; }
  .login { max-width:360px; margin:80px auto; }
  .login h2 { font-size:18px; margin:0 0 14px; }
  .login label { display:block; margin-bottom:6px; font-size:14px; color:var(--muted); }
  .login .btn { width:100%; margin-top:12px; }
  .saved { background:#E7F6EF; color:#0B6E4F; border:1px solid #BBE5CF; border-radius:8px; padding:10px 14px; margin-bottom:14px; }
  td code { font-family:Consolas,monospace; font-size:12.5px; background:#F0F5F2; padding:1px 6px; border-radius:4px; }
  .navp { margin-top:14px; display:flex; gap:10px; }
</style>
</head>
<body>

<div class="head">
  <div>
    <h1>Examen Réseau 2 — Espace enseignant</h1>
    <div class="sub">Correction manuelle (C + D) et note finale — <?= sprintf('Auto: %d pts, Manuelle: %d pts, Total: %d pts, Seuil: %d', AUTO_TOTAL, SUBJ_TOTAL, GRAND_TOTAL, SEUIL) ?></div>
  </div>
  <?php if ($auth): ?>
    <a class="btn-out" href="teacher.php?logout=1">Déconnexion</a>
  <?php endif; ?>
</div>

<div class="wrap">
<?php if (!$auth): ?>
  <form class="card login" method="post" action="teacher.php">
    <h2>Connexion enseignant</h2>
    <?php if ($error !== ''): ?><div class="err"><?= esc($error) ?></div><?php endif; ?>
    <label for="pass">Mot de passe</label>
    <input type="password" id="pass" name="pass" autocomplete="current-password" required>
    <input type="hidden" name="action" value="login">
    <button type="submit" class="btn">Se connecter</button>
  </form>
<?php else: ?>

  <?php if (isset($_GET['saved'])): ?>
    <div class="saved">Enregistrement réussi.</div>
  <?php endif; ?>

  <div class="card">
    <p class="meta"><?= count($rows) ?> soumission(s). Entrez la note manuelle de chaque élève (Note manuelle = Section C + Section D écrite) ; la note finale se calcule automatiquement.</p>
    <table>
      <thead>
        <tr>
          <th>Code</th><th>Étudiant</th><th>Note auto (/20)</th>
          <th>Note manuelle (/30)</th><th>Email étudiant</th><th>Total (/50)</th><th>État</th><th>Actions</th>
        </tr>
      </thead>
      <tbody>
      <?php if (empty($rows)): ?>
        <tr><td colspan="8" style="text-align:center;color:var(--muted);padding:24px">Aucune soumission pour l'instant.</td></tr>
      <?php endif; ?>
      <?php foreach ($rows as $r): $sk = $r['session_key']; ?>
        <tr>
          <td><code><?= esc($r['code']) ?></code> <?= ((int)$r['is_test'] === 1) ? '<span class="tag">TEST</span>' : '' ?></td>
          <td><?= esc($r['name']) ?></td>
          <td><?= number_format($r['auto'], 2, '.', ' ') ?></td>
          <td>
            <input type="number" step="0.25" min="0" max="30" name="manual"
                   id="man-<?= esc($sk) ?>" value="<?= $r['manual'] !== null ? esc(number_format($r['manual'], 2, '.', '')) : '' ?>"
                   oninput="upd('<?= esc($sk) ?>', <?= $r['auto'] ?>)">
          </td>
          <td>
            <input type="email" id="eml-<?= esc($sk) ?>" value="<?= esc($r['email'] ?? '') ?>"
                   placeholder="email@etudiant.com" style="width:200px">
          </td>
          <td class="tot" id="tot-<?= esc($sk) ?>"><?= $r['manual'] !== null ? number_format($r['auto'] + $r['manual'], 2, '.', ' ') : '—' ?> / 50</td>
          <td class="" id="st-<?= esc($sk) ?>">
            <?php if ($r['manual'] !== null): ?>
              <span class="<?= ($r['auto'] + $r['manual']) >= SEUIL ? 'ok' : 'ko' ?>"><?= ($r['auto'] + $r['manual']) >= SEUIL ? 'Réussi' : 'Échec' ?></span>
            <?php else: ?>—<?php endif; ?>
          </td>
          <td>
            <button type="button" class="btn" onclick="saveNote('<?= esc($sk) ?>', <?= $r['auto'] ?>)">Enregistrer</button>
            <button type="button" class="btn" style="background:#2E6B82;margin-left:6px"
                    onclick="notify('<?= esc($sk) ?>', <?= $r['auto'] ?>, '<?= esc($r['name']) ?>')">Envoyer l'email</button>
          </td>
        </tr>
      <?php endforeach; ?>
      </tbody>
    </table>
  </div>

  <script>
    function upd(sk, auto) {
      const inp = document.getElementById('man-' + sk);
      const totEl = document.getElementById('tot-' + sk);
      const stEl = document.getElementById('st-' + sk);
      if (!inp || !totEl || !stEl) return;
      const v = parseFloat(inp.value);
      const m = isNaN(v) ? 0 : Math.min(Math.max(v, 0), 30);
      const total = auto + m;
      totEl.textContent = total.toFixed(2).replace('.', ',') + ' / 50';
      stEl.innerHTML = total >= <?= SEUIL ?> ? '<span class="ok">Réussi</span>' : '<span class="ko">Échec</span>';
    }

    async function saveNote(sk, auto) {
      const btn = event.target;
      const inp = document.getElementById('man-' + sk);
      const old = btn.textContent;
      btn.disabled = true;
      btn.textContent = 'Enregistrement…';
      try {
        const manual = inp ? parseFloat(inp.value) : 0;
        const body = new URLSearchParams();
        body.append('action', 'save');
        body.append('session_key', sk);
        body.append('manual', isNaN(manual) ? '0' : String(manual));
        await fetch('teacher.php', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString() });
        location.reload();
      } catch (e) {
        btn.disabled = false;
        btn.textContent = old;
        alert('Échec de l\'enregistrement. Vérifiez la connexion.');
      }
    }

    /* ============ ENVOI EMAIL RESULTAT FINAL (bay etidyan an) ============ */
    const EMAILJS_SERVICE_ID = 'service_jjqlfck';
    const EMAILJS_TEMPLATE_ID = 'template_a9uazrs';
    const EMAILJS_PUBLIC_KEY = '8ZF_oJb8pHOzojn1p';
    emailjs.init(EMAILJS_PUBLIC_KEY);

    async function notify(sk, auto, sname) {
      const manInp = document.getElementById('man-' + sk);
      const emlInp = document.getElementById('eml-' + sk);
      const btn = event.target;
      const rawMan = manInp ? parseFloat(manInp.value) : 0;
      const manual = isNaN(rawMan) ? 0 : Math.min(Math.max(rawMan, 0), 30);
      const email = emlInp ? emlInp.value.trim() : '';
      if (!email) { alert('Entrez l\'email de l\'étudiant avant d\'envoyer.'); return; }

      /* 1) Sove not + email anvan tout bagay */
      try {
        const body = new URLSearchParams();
        body.append('action', 'save');
        body.append('session_key', sk);
        body.append('manual', String(manual));
        body.append('email', email);
        await fetch('teacher.php', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString() });
      } catch (e) { /* rete pare */ }

      const total = auto + manual;
      const ok = total >= 33;
      const note = (total).toFixed(2).replace('.', ',');
      const resTxt = ok ? 'Réussi' : 'Échec';

      const bodyTxt =
        'RÉSEAU 2 — RÉSULTATS D\'EXAMEN\n\n' +
        'Étudiant : ' + sname + '\n' +
        '\nNOTE FINALE\n' +
        'Note automatique (QCM + Multi) : ' + auto + ' / 20 pts\n' +
        'Note manuelle (Définir + Exercices) : ' + manual + ' / 30 pts\n' +
        'TOTAL : ' + note + ' / 50 pts\n' +
        'Seuil de réussite : 33 / 50\n' +
        'Résultat : ' + resTxt + '\n';

      const bodyHtml =
        '<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;color:#1C1A17;font-size:14px;border:1px solid #E0E0E0;border-radius:10px;overflow:hidden">' +
        '<div style="background:linear-gradient(135deg,#5DCAA5,#1D9E75);color:#fff;padding:14px 18px;text-align:center">' +
        '<h2 style="margin:0;font-size:18px">RÉSEAU 2 — RÉSULTATS D\'EXAMEN</h2></div>' +
        '<div style="padding:16px 20px">' +
        '<p style="margin:0 0 10px"><strong>Étudiant :</strong> ' + sname + '</p>' +
        '<table style="border-collapse:collapse;width:100%">' +
        '<tr><td style="padding:8px;border:1px solid #DFE7E4;background:#F4F7F6"><strong>Note automatique</strong> (QCM + Multi)</td>' +
        '<td style="padding:8px;border:1px solid #DFE7E4;text-align:center"><strong>' + auto + ' / 20</strong> pts</td></tr>' +
        '<tr><td style="padding:8px;border:1px solid #DFE7E4;background:#F4F7F6"><strong>Note manuelle</strong> (Définir + Exercices)</td>' +
        '<td style="padding:8px;border:1px solid #DFE7E4;text-align:center"><strong>' + manual + ' / 30</strong> pts</td></tr>' +
        '<tr><td style="padding:8px;border:1px solid #DFE7E4;background:#E4F5EF"><strong>TOTAL</strong></td>' +
        '<td style="padding:8px;border:1px solid #DFE7E4;text-align:center;background:#E4F5EF"><strong>' + note + ' / 50</strong> pts</td></tr>' +
        '</table>' +
        '<p style="margin:10px 0 0">Seuil de réussite : <strong>33 / 50</strong></p>' +
        '<p style="margin:6px 0 0">Résultat : <strong style="color:' + (ok ? '#0B6E4F' : '#B3402E') + '">' + resTxt + '</strong></p>' +
        '</div></div>';

      btn.disabled = true;
      btn.textContent = 'Envoi en cours…';
      try {
        await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
          to_email: email,
          to_name: sname,
          student_name: sname,
          objective_score: auto,
          detail: '',
          subjective: '',
          email_body: bodyTxt,
          html_body: bodyHtml,
        }, EMAILJS_PUBLIC_KEY);
        btn.textContent = '✓ Envoyé';
        btn.style.background = '#1D9E75';
      } catch (e) {
        btn.disabled = false;
        btn.textContent = 'Envoyer l\'email';
        alert('Échec de l\'envoi de l\'email. Réessayez.');
      }
    }
  </script>

<?php endif; ?>
</div>

</body>
</html>