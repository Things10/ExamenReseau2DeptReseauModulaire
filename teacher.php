<?php
/* ============================================================
   ESPACE ENSEIGNANT — KOREKSYON NOT MANUELLE + TOTAL OTOMATIK
   URL : /teacher.php
   Pwotèj : paswòd (TEACHER_PASS nan api/db.php)
   - lis etidyan ki soumèt egzamen an
   - note automatique (A + B) kalkile sou sèvè
   - wè repons detaye etidyan an (seksyon C + D ak tablo yo)
   - yon SÈL bouton "Enregistrer et Envoyer" : sove nòt manyèl a
     epi voye imèl rezilta konplè bay etidyan an
   - rapò Word (tout etidyan) : telechaje + voye pa imèl bay pwofesè a
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

$TEACHER_EMAIL = defined('TEACHER_EMAIL') ? TEACHER_EMAIL : 'stevengauchier@gmail.com';
$TEACHER_USER  = defined('TEACHER_USER') ? TEACHER_USER : 'steven10';

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

function ensure_results_table(PDO $pdo): void {
    try {
        $pdo->exec(
            'CREATE TABLE IF NOT EXISTS exam_results (
                session_key VARCHAR(64) PRIMARY KEY,
                html_body   LONGTEXT NULL,
                text_body   LONGTEXT NULL,
                updated_at  DATETIME DEFAULT NULL
             ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
        );
    } catch (Throwable $e) { /* rete pare */ }
}

/* Ranplase tokèn yo nan dokiman etidyan an */
function fill_doc(string $doc, float $manual, float $total, bool $ok): string {
    $num = static function (float $x): string {
        return rtrim(rtrim(number_format($x, 2, '.', ''), '0'), '.');
    };
    return str_replace(
        ['%%MANUAL%%', '%%TOTAL%%', '%%RESULT%%', '%%RESULT_COLOR%%'],
        [$num($manual), $num($total), $ok ? 'Réussi' : 'Échec', $ok ? '#0B6E4F' : '#B3402E'],
        $doc
    );
}

/* Vèsyon pou apèsi (blan pou nòt manyèl la) */
function blank_doc(string $doc): string {
    return str_replace(
        ['%%MANUAL%%', '%%TOTAL%%', '%%RESULT%%', '%%RESULT_COLOR%%'],
        ['_____', '_____', '', '#333'],
        $doc
    );
}

$pdo = db();
ensure_grades_table($pdo);
ensure_email_column($pdo);
ensure_results_table($pdo);

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
    $okUser = hash_equals($TEACHER_USER, (string)($_POST['user'] ?? ''));
    $okPass = hash_equals(TEACHER_PASS, (string)($_POST['pass'] ?? ''));
    if ($okUser && $okPass) {
        $_SESSION['teacher'] = 1;
        header('Location: teacher.php'); exit;
    }
    $error = 'Identifiant ou mot de passe incorrect.';
}

/* ============================================================
   AJAX: bay dokiman krè etidyan an (HTML ak tokèn) pou JS itilize
   ============================================================ */
if ($auth && ($_GET['action'] ?? '') === 'rawdoc') {
    header('Content-Type: application/json; charset=utf-8');
    $sk = trim((string)($_GET['sk'] ?? ''));
    $st = $pdo->prepare('SELECT html_body, text_body FROM exam_results WHERE session_key = :sk');
    $st->execute([':sk' => $sk]);
    $doc = $st->fetch();
    if (!$doc) { echo json_encode(['ok' => false]); exit; }
    echo json_encode(['ok' => true, 'html_body' => $doc['html_body'], 'text_body' => $doc['text_body']]);
    exit;
}

/* ============================================================
   TELEKCHAJE RAPÒ WORD (tout etidyan)
   ============================================================ */
if ($auth && ($_GET['action'] ?? '') === 'report') {
    $all = fetch_all_rows($pdo);
    $date = date('d/m/Y H:i');
    $html  = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">';
    $html .= '<head><meta charset="utf-8"><title>Rapport Réseau 2</title>';
    $html .= '<style>body{font-family:Arial,sans-serif;} h2{color:#0B6E4F;} table{border-collapse:collapse;width:100%;} th,td{border:1px solid #999;padding:6px 8px;font-size:13px;} th{background:#1D9E75;color:#fff;} .ok{color:#0B6E4F;font-weight:bold;} .ko{color:#B3402E;font-weight:bold;} .rt{background:#E4F5EF;font-weight:bold;}</style>';
    $html .= '</head><body>';
    $html .= '<h2>Examen Réseau 2 — Rapport des résultats</h2>';
    $html .= '<p>Généré le ' . $date . ' — ' . count($all) . ' étudiant(s). Notes sur ' . GRAND_TOTAL . ' pts (seuil ' . SEUIL . ').</p>';
    $html .= '<table><tr><th>#</th><th>Nom et prénom</th><th>Code</th><th>Email</th><th>Note auto /' . AUTO_TOTAL . '</th><th>Note manuelle /' . SUBJ_TOTAL . '</th><th>Total /' . GRAND_TOTAL . '</th><th>Résultat</th></tr>';
    $i = 0;
    foreach ($all as $r) {
        $i++;
        $has = $r['manual'] !== null;
        $total = $has ? ($r['auto'] + $r['manual']) : null;
        $res = $has ? ($total >= SEUIL ? '<span class="ok">Réussi</span>' : '<span class="ko">Échec</span>') : '—';
        $totTxt = $has ? number_format($total, 2, '.', '') : '—';
        $manTxt = $has ? number_format($r['manual'], 2, '.', '') : '—';
        $html .= '<tr>'
              . '<td>' . $i . '</td>'
              . '<td>' . esc($r['name']) . '</td>'
              . '<td>' . esc($r['code']) . '</td>'
              . '<td>' . esc($r['email'] ?? '') . '</td>'
              . '<td>' . number_format($r['auto'], 2, '.', '') . '</td>'
              . '<td>' . $manTxt . '</td>'
              . '<td class="rt">' . $totTxt . '</td>'
              . '<td>' . $res . '</td>'
              . '</tr>';
    }
    $html .= '</table></body></html>';

    header('Content-Type: application/msword; charset=utf-8');
    header('Content-Disposition: attachment; filename="Rapport_Reseau2_' . date('Y-m-d') . '.doc"');
    echo "\xEF\xBB\xBF" . $html;
    exit;
}

/* ============================================================
   EFASE SÈSYON TÈS (youn oswa tout) — pou rekòmanse pwòp
   - teacher.php?action=clearsub&sk=SESSION_KEY  -> yon sèl elèv
   - teacher.php?action=clearall                 -> tout soumisyon yo
   ============================================================ */
function delete_session_data(PDO $pdo, int $sessionId, string $sessionKey): void {
    $pdo->prepare('DELETE FROM answers WHERE session_id = :id')->execute([':id' => $sessionId]);
    $pdo->prepare('DELETE FROM grades WHERE session_key = :sk')->execute([':sk' => $sessionKey]);
    $pdo->prepare('DELETE FROM exam_results WHERE session_key = :sk')->execute([':sk' => $sessionKey]);
    $pdo->prepare('DELETE FROM exam_sessions WHERE id = :id')->execute([':id' => $sessionId]);
}

if ($auth && ($_GET['action'] ?? '') === 'clearsub') {
    $sk = trim((string)($_GET['sk'] ?? ''));
    $n = 0;
    if ($sk !== '') {
        $st = $pdo->prepare('SELECT id, session_key FROM exam_sessions WHERE session_key = :sk');
        $st->execute([':sk' => $sk]);
        if ($s = $st->fetch()) { delete_session_data($pdo, (int)$s['id'], $s['session_key']); $n = 1; }
    }
    header('Location: teacher.php?cleared=' . $n); exit;
}

if ($auth && ($_GET['action'] ?? '') === 'clearall') {
    $n = 0;
    foreach ($pdo->query('SELECT id, session_key FROM exam_sessions')->fetchAll() as $s) {
        delete_session_data($pdo, (int)$s['id'], $s['session_key']); $n++;
    }
    header('Location: teacher.php?cleared=' . $n); exit;
}

/* -- Sove nòt manyèl + email (AJAX → JSON) -- */
if ($auth && $_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'save') {
    header('Content-Type: application/json; charset=utf-8');
    $sk = trim((string)($_POST['session_key'] ?? ''));
    $manual = max(0.0, min((float)SUBJ_TOTAL, (float)($_POST['manual'] ?? 0)));
    $email = trim((string)($_POST['email'] ?? ''));
    if ($email !== '' && filter_var($email, FILTER_VALIDATE_EMAIL) === false) { $email = ''; }
    $ok = false;
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
            $ok = true;
        }
    }
    echo json_encode(['ok' => $ok]);
    exit;
}

/* ============================================================
   CHAJE TOUT LIY YO (itilize pa paj la + rapò a)
   ============================================================ */
function fetch_all_rows(PDO $pdo): array {
    $stmt = $pdo->query(
        'SELECT st.code, st.name, st.is_test, st.email,
                es.id AS session_id, es.session_key, es.started_at, es.submitted_at
           FROM exam_sessions es
           JOIN students st ON st.id = es.student_id
          WHERE es.submitted = 1
          ORDER BY es.submitted_at DESC, es.id DESC
          LIMIT 500'
    );
    $grades = [];
    foreach ($pdo->query('SELECT session_key, manual_score FROM grades') as $g) {
        $grades[$g['session_key']] = (float)$g['manual_score'];
    }
    $hasDoc = [];
    foreach ($pdo->query('SELECT session_key FROM exam_results') as $d) {
        $hasDoc[$d['session_key']] = true;
    }
    $rows = [];
    foreach ($stmt->fetchAll() as $r) {
        $auto = compute_auto(answer_map($pdo, (int)$r['session_id']));
        $manual = $grades[$r['session_key']] ?? null;
        $rows[] = $r + ['auto' => $auto, 'manual' => $manual, 'has_doc' => isset($hasDoc[$r['session_key']])];
    }
    return $rows;
}

$rows = $auth ? fetch_all_rows($pdo) : [];
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
  .wrap { max-width:1180px; margin:22px auto; padding:0 16px; }
  .card { background:var(--card); border:1px solid var(--line); border-radius:10px; padding:18px 20px; }
  .tbl-wrap { overflow-x:auto; -webkit-overflow-scrolling:touch; }
  table { width:100%; border-collapse:collapse; font-size:13.5px; min-width:1120px; }
  th, td { border-bottom:1px solid var(--line); padding:10px 8px; text-align:left; vertical-align:middle; }
  th { background:#F0F5F2; font-size:12px; text-transform:uppercase; letter-spacing:.3px; color:var(--muted); white-space:nowrap; }
  td.num, th.num { text-align:center; }
  th:last-child, td:last-child { text-align:center; }
  tbody tr:hover { background:#FAFCFB; }
  input[type=number], input[type=email], input[type=password], input[type=text] { font-size:14px; padding:7px 9px; border:1px solid #C9D8D2; border-radius:6px; height:36px; }
  input[type=number] { width:80px; text-align:center; }
  input[type=email], input[type=text] { width:190px; }
  input[type=number]:focus, input[type=email]:focus, input[type=text]:focus { outline:none; border-color:var(--green); box-shadow:0 0 0 3px rgba(29,158,117,.15); }
  .btn { background:var(--green); color:#fff; border:0; border-radius:7px; padding:8px 14px; font-size:13.5px; cursor:pointer; font-weight:bold; }
  .btn:hover { background:var(--green-dk); }
  .btn:disabled { opacity:.6; cursor:default; }
  .btn-out { background:none; border:1px solid rgba(255,255,255,.7); color:#fff; border-radius:7px; padding:7px 14px; font-size:13px; cursor:pointer; text-decoration:none; }
  .btn-alt { background:#2E6B82; }
  .btn-alt:hover { background:#245366; }
  .actions { display:flex; gap:6px; align-items:center; flex-wrap:nowrap; justify-content:center; }
  .actions .btn { white-space:nowrap; padding:6px 10px; font-size:12px; }
  .actions .meta { margin:0; }
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
  .toolbar { display:flex; gap:10px; flex-wrap:wrap; margin-bottom:14px; align-items:center; }
  .toolbar .spacer { flex:1; }
  .docbox { display:none; background:#FBFDFC; border-top:2px dashed var(--line); }
  .docbox iframe { width:100%; height:640px; border:0; background:#fff; }
  .flash { background:#E7F6EF; color:#0B6E4F; border:1px solid #BBE5CF; border-radius:8px; padding:10px 14px; margin-bottom:14px; }
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
    <label for="user">Nom d'utilisateur</label>
    <input type="text" id="user" name="user" autocomplete="username" required autofocus>
    <label for="pass" style="margin-top:12px">Mot de passe</label>
    <input type="password" id="pass" name="pass" autocomplete="current-password" required>
    <input type="hidden" name="action" value="login">
    <button type="submit" class="btn">Se connecter</button>
  </form>
<?php else: ?>

  <?php if (isset($_GET['saved'])): ?>
    <div class="flash">Enregistrement réussi.</div>
  <?php endif; ?>
  <?php if (isset($_GET['cleared'])): ?>
    <div class="flash"><?= (int)$_GET['cleared'] ?> test(s) / soumission(s) effacé(s).</div>
  <?php endif; ?>

  <div class="toolbar">
    <button type="button" class="btn btn-alt" onclick="sendReport()">Envoyer le rapport par email</button>
    <a class="btn btn-alt" style="text-decoration:none;display:inline-block" href="teacher.php?action=report">Télécharger le rapport Word (.doc)</a>
    <button type="button" class="btn" style="background:#B3402E" onclick="clearAll()">Effacer tous les tests</button>
    <span class="spacer"></span>
    <button type="button" class="btn" style="background:#6B7A75" onclick="location.reload()">Rafraîchir</button>
  </div>
  <div id="report-fb"></div>

  <div class="card">
    <p class="meta"><?= count($rows) ?> soumission(s). Cliquez sur « Voir les réponses » pour lire la copie de l'élève (sections C et D, tableaux), entrez la note manuelle, puis cliquez sur « Enregistrer et Envoyer » : la note est sauvegardée et l'email de résultat complet part vers l'élève.</p>
    <div class="tbl-wrap">
    <table>
      <thead>
        <tr>
          <th>Code</th><th>Étudiant</th><th class="num">Note auto (/20)</th>
          <th class="num">Note manuelle (/30)</th><th>Email étudiant</th><th class="num">Total (/50)</th><th class="num">État</th><th>Actions</th>
        </tr>
      </thead>
      <tbody>
      <?php if (empty($rows)): ?>
        <tr><td colspan="8" style="text-align:center;color:var(--muted);padding:24px">Aucune soumission pour l'instant.</td></tr>
      <?php endif; ?>
      <?php foreach ($rows as $r): $sk = $r['session_key']; $has = $r['manual'] !== null; $total = $has ? ($r['auto'] + $r['manual']) : null; ?>
        <tr>
          <td><code><?= esc($r['code']) ?></code> <?= ((int)$r['is_test'] === 1) ? '<span class="tag">TEST</span>' : '' ?></td>
          <td><?= esc($r['name']) ?></td>
          <td class="num"><?= number_format($r['auto'], 2, '.', ' ') ?></td>
          <td class="num">
            <input type="number" step="0.25" min="0" max="30" name="manual"
                   id="man-<?= esc($sk) ?>" value="" placeholder="0"
                   oninput="upd('<?= esc($sk) ?>', <?= $r['auto'] ?>)">
          </td>
          <td>
            <input type="email" id="eml-<?= esc($sk) ?>" value="<?= esc($r['email'] ?? '') ?>"
                   placeholder="email@etudiant.com">
          </td>
          <td class="tot num" id="tot-<?= esc($sk) ?>"><?= number_format($r['auto'], 2, '.', ' ') ?> / 50</td>
          <td class="num" id="st-<?= esc($sk) ?>">
            <span class="<?= $r['auto'] >= SEUIL ? 'ok' : 'ko' ?>"><?= $r['auto'] >= SEUIL ? 'Réussi' : 'Échec' ?></span>
          </td>
          <td>
            <div class="actions">
              <button type="button" class="btn" onclick="saveAndSend('<?= esc($sk) ?>', <?= $r['auto'] ?>, '<?= esc(addslashes($r['name'])) ?>', this)">Enregistrer et Envoyer</button>
              <?php if ($r['has_doc']): ?>
                <button type="button" class="btn btn-alt" onclick="toggleDoc('<?= esc($sk) ?>')">Voir les réponses</button>
              <?php else: ?>
                <span class="meta">(copie non transmise)</span>
              <?php endif; ?>
              <button type="button" class="btn" style="background:#8A9A95" onclick="clearOne('<?= esc($sk) ?>')">Effacer</button>
            </div>
          </td>
        </tr>
        <tr class="docbox" id="docrow-<?= esc($sk) ?>">
          <td colspan="8" style="padding:0"><iframe id="doc-<?= esc($sk) ?>" sandbox="" title="Réponses élève"></iframe></td>
        </tr>
      <?php endforeach; ?>
      </tbody>
    </table>
    </div>
  </div>

  <script>
    const SEUIL = <?= SEUIL ?>;
    const AUTO_TOTAL = <?= AUTO_TOTAL ?>;
    const SUBJ_TOTAL = <?= SUBJ_TOTAL ?>;
    const GRAND_TOTAL = <?= GRAND_TOTAL ?>;
    const TEACHER_EMAIL = <?= json_encode($TEACHER_EMAIL) ?>;
    const EMAILJS_SERVICE_ID = 'service_jjqlfck';
    const EMAILJS_TEMPLATE_ID = 'template_a9uazrs';
    const EMAILJS_PUBLIC_KEY = '8ZF_oJb8pHOzojn1p';
    const REPORT_DATA = <?= json_encode(array_map(function ($r) {
        $has = $r['manual'] !== null;
        return [
            'name' => $r['name'], 'code' => $r['code'], 'email' => (string)($r['email'] ?? ''),
            'auto' => round($r['auto'], 2), 'manual' => $has ? round($r['manual'], 2) : null,
            'total' => $has ? round($r['auto'] + $r['manual'], 2) : null,
        ];
    }, $rows), JSON_UNESCAPED_UNICODE) ?>;
    emailjs.init(EMAILJS_PUBLIC_KEY);

    function fmt(x) { return (Math.round(x * 100) / 100).toString().replace('.', ','); }

    function upd(sk, auto) {
      const inp = document.getElementById('man-' + sk);
      const totEl = document.getElementById('tot-' + sk);
      const stEl = document.getElementById('st-' + sk);
      if (!inp || !totEl || !stEl) return;
      const v = parseFloat(inp.value);
      const m = isNaN(v) ? 0 : Math.min(Math.max(v, 0), SUBJ_TOTAL);
      const total = auto + m;
      totEl.textContent = fmt(total) + ' / 50';
      stEl.innerHTML = total >= SEUIL ? '<span class="ok">Réussi</span>' : '<span class="ko">Échec</span>';
    }

    function clearAll() {
      if (!confirm('Effacer TOUTES les soumissions/tests ? Cette action est irréversible.')) return;
      location.href = 'teacher.php?action=clearall';
    }

    function clearOne(sk) {
      if (!confirm('Effacer la soumission de cet étudiant ? Cette action est irréversible.')) return;
      location.href = 'teacher.php?action=clearsub&sk=' + encodeURIComponent(sk);
    }

    function toggleDoc(sk) {
      const row = document.getElementById('docrow-' + sk);
      const frame = document.getElementById('doc-' + sk);
      if (!row || !frame) return;
      if (row.style.display === 'table-row') { row.style.display = 'none'; return; }
      row.style.display = 'table-row';
      if (!frame.dataset.loaded) {
        frame.srcdoc = '<p style="font-family:Arial;padding:20px;color:#666">Chargement…</p>';
        fetch('teacher.php?action=rawdoc&sk=' + encodeURIComponent(sk))
          .then(r => r.json())
          .then(j => {
            if (j && j.ok) {
              const blank = (j.html_body || '').split('%%MANUAL%%').join('_____').split('%%TOTAL%%').join('_____').split('%%RESULT%%').join('').split('%%RESULT_COLOR%%').join('#333');
              frame.srcdoc = blank;
              frame.dataset.loaded = '1';
            } else {
              frame.srcdoc = '<p style="font-family:Arial;padding:20px;color:#B3402E">Réponses indisponibles pour cet élève.</p>';
            }
          })
          .catch(() => { frame.srcdoc = '<p style="font-family:Arial;padding:20px;color:#B3402E">Erreur de chargement.</p>'; });
      }
    }

    async function saveAndSend(sk, auto, sname, btn) {
      const manInp = document.getElementById('man-' + sk);
      const emlInp = document.getElementById('eml-' + sk);
      const rawMan = manInp ? parseFloat(manInp.value) : NaN;
      if (isNaN(rawMan)) { alert('Entrez d\'abord la note manuelle de l\'élève.'); return; }
      const manual = Math.min(Math.max(rawMan, 0), SUBJ_TOTAL);
      const email = emlInp ? emlInp.value.trim() : '';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { alert('Email de l\'étudiant invalide ou manquant.'); return; }

      const old = btn.textContent;
      btn.disabled = true;
      btn.textContent = 'Traitement…';

      /* 1) Sove nòt manyèl + email */
      try {
        const body = new URLSearchParams();
        body.append('action', 'save');
        body.append('session_key', sk);
        body.append('manual', String(manual));
        body.append('email', email);
        const r = await fetch('teacher.php', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString() });
        const j = await r.json();
        if (!j || !j.ok) throw new Error('save');
      } catch (e) {
        btn.disabled = false; btn.textContent = old;
        alert('Échec de l\'enregistrement. Vérifiez la connexion.');
        return;
      }

      const total = auto + manual;
      const ok = total >= SEUIL;

      /* 2) Konstwi imèl konplè a (repons + rezilta final) */
      let html = '', text = '';
      try {
        const rd = await fetch('teacher.php?action=rawdoc&sk=' + encodeURIComponent(sk));
        const doc = await rd.json();
        if (doc && doc.ok) {
          html = (doc.html_body || '')
            .split('%%MANUAL%%').join(fmt(manual))
            .split('%%TOTAL%%').join(fmt(total))
            .split('%%RESULT%%').join(ok ? 'Réussi' : 'Échec')
            .split('%%RESULT_COLOR%%').join(ok ? '#0B6E4F' : '#B3402E');
          text = (doc.text_body || '')
            .split('%%MANUAL%%').join(fmt(manual))
            .split('%%TOTAL%%').join(fmt(total))
            .split('%%RESULT%%').join(ok ? 'Réussi' : 'Échec');
        }
      } catch (e) { /* html rete vid */ }

      if (!html) {
        /* repli senp si dokiman an pa disponib */
        html = '<div style="font-family:Arial;max-width:600px"><h2 style="color:#0B6E4F">RÉSEAU 2 — RÉSULTATS</h2>'
             + '<p><strong>Étudiant :</strong> ' + sname + '</p>'
             + '<p><strong>Note automatique :</strong> ' + fmt(auto) + ' / 20</p>'
             + '<p><strong>Note manuelle :</strong> ' + fmt(manual) + ' / 30</p>'
             + '<p><strong>TOTAL :</strong> ' + fmt(total) + ' / 50</p>'
             + '<p><strong>Résultat :</strong> ' + (ok ? 'Réussi' : 'Échec') + '</p></div>';
        text = 'RÉSEAU 2 — RÉSULTATS\nÉtudiant : ' + sname + '\nAuto : ' + fmt(auto) + '/20\nManuelle : ' + fmt(manual) + '/30\nTOTAL : ' + fmt(total) + '/50\nRésultat : ' + (ok ? 'Réussi' : 'Échec');
      }

      /* 3) Voye imèl bay etidyan an */
      btn.textContent = 'Envoi de l\'email…';
      try {
        await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
          to_email: email,
          to_name: sname,
          student_name: sname,
          objective_score: auto,
          detail: '',
          subjective: '',
          email_body: text,
          html_body: html
        }, EMAILJS_PUBLIC_KEY);
      } catch (e) {
        btn.disabled = false; btn.textContent = old;
        alert('Note enregistrée, mais l\'email n\'a pas pu être envoyé. Réessayez.');
        upd(sk, auto);
        return;
      }

      btn.textContent = '✓ Envoyé';
      btn.style.background = '#0B6E4F';
      upd(sk, auto);
    }

    async function sendReport() {
      const fb = document.getElementById('report-fb');
      fb.className = 'flash';
      fb.textContent = 'Génération du rapport…';
      let rows = '';
      REPORT_DATA.forEach((r, i) => {
        const has = r.manual !== null;
        const total = has ? r.total : null;
        const res = has ? (total >= SEUIL ? 'Réussi' : 'Échec') : '—';
        const col = has ? (total >= SEUIL ? '#0B6E4F' : '#B3402E') : '#666';
        rows += '<tr>'
          + '<td style="padding:6px 8px;border:1px solid #ccc">' + (i + 1) + '</td>'
          + '<td style="padding:6px 8px;border:1px solid #ccc">' + r.name + '</td>'
          + '<td style="padding:6px 8px;border:1px solid #ccc">' + r.code + '</td>'
          + '<td style="padding:6px 8px;border:1px solid #ccc">' + r.email + '</td>'
          + '<td style="padding:6px 8px;border:1px solid #ccc;text-align:center">' + fmt(r.auto) + '</td>'
          + '<td style="padding:6px 8px;border:1px solid #ccc;text-align:center">' + (has ? fmt(r.manual) : '—') + '</td>'
          + '<td style="padding:6px 8px;border:1px solid #ccc;text-align:center;font-weight:bold">' + (has ? fmt(total) : '—') + '</td>'
          + '<td style="padding:6px 8px;border:1px solid #ccc;text-align:center;color:' + col + ';font-weight:bold">' + res + '</td>'
          + '</tr>';
      });
      const html = '<div style="font-family:Arial;max-width:820px">'
        + '<h2 style="color:#0B6E4F">Examen Réseau 2 — Rapport des résultats</h2>'
        + '<p>' + REPORT_DATA.length + ' étudiant(s). Notes sur ' + GRAND_TOTAL + ' pts (seuil ' + SEUIL + ').</p>'
        + '<table style="border-collapse:collapse;width:100%"><tr>'
        + '<th style="padding:6px 8px;border:1px solid #ccc;background:#1D9E75;color:#fff">#</th>'
        + '<th style="padding:6px 8px;border:1px solid #ccc;background:#1D9E75;color:#fff">Nom et prénom</th>'
        + '<th style="padding:6px 8px;border:1px solid #ccc;background:#1D9E75;color:#fff">Code</th>'
        + '<th style="padding:6px 8px;border:1px solid #ccc;background:#1D9E75;color:#fff">Email</th>'
        + '<th style="padding:6px 8px;border:1px solid #ccc;background:#1D9E75;color:#fff">Auto /' + AUTO_TOTAL + '</th>'
        + '<th style="padding:6px 8px;border:1px solid #ccc;background:#1D9E75;color:#fff">Manuelle /' + SUBJ_TOTAL + '</th>'
        + '<th style="padding:6px 8px;border:1px solid #ccc;background:#1D9E75;color:#fff">Total /' + GRAND_TOTAL + '</th>'
        + '<th style="padding:6px 8px;border:1px solid #ccc;background:#1D9E75;color:#fff">Résultat</th>'
        + '</tr>' + rows + '</table></div>';
      try {
        await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
          to_email: TEACHER_EMAIL, student_name: 'Enseignant',
          objective_score: '', detail: '', subjective: '',
          email_body: 'Rapport des résultats — Examen Réseau 2', html_body: html
        }, EMAILJS_PUBLIC_KEY);
        fb.textContent = '✓ Rapport envoyé à ' + TEACHER_EMAIL + '.';
      } catch (e) {
        fb.style.background = '#FDECEA'; fb.style.color = '#B3402E'; fb.style.borderColor = '#F2C9C2';
        fb.textContent = 'Échec de l\'envoi du rapport. Réessayez.';
      }
    }
  </script>

<?php endif; ?>
</div>

</body>
</html>
