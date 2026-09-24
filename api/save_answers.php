<?php
/* ============================================================
   API — SOVE REPONS (auto-save pandan egzamen an)
   POST { session_key, answers: { "A.1": "...", ... } }
   Met à jour pa kesyon a nan baz la (INSERT ... ON DUPLICATE)
   ============================================================ */
declare(strict_types=1);
require __DIR__ . '/db.php';

$in = body_json();
$sessionKey = (string)($in['session_key'] ?? '');
$answers = $in['answers'] ?? null;

if ($sessionKey === '' || !is_array($answers)) {
    json_out(['ok' => false, 'message' => 'Paramèt manke.'], 422);
}

$pdo = db();

$stmt = $pdo->prepare('SELECT id, submitted, expires_at FROM exam_sessions WHERE session_key = :sk');
$stmt->execute([':sk' => $sessionKey]);
$session = $stmt->fetch();

if (!$session) {
    json_out(['ok' => false, 'message' => 'Sesyon pa rekonèt. Rekòmanse egzamen an.']);
}
if ((int)$session['submitted'] === 1) {
    json_out(['ok' => false, 'submitted' => true, 'message' => 'Egzamen an soumèt deja.']);
}
$nowTs = time();
$expTs  = (new DateTime($session['expires_at']))->getTimestamp();
if ($expTs <= $nowTs) {
    json_out(['ok' => false, 'expired' => true, 'message' => 'Tan egzamen an fini.']);
}

$upsert = $pdo->prepare(
    'INSERT INTO answers (session_id, question_key, answer)
     VALUES (:sid, :qk, :ans)
     ON DUPLICATE KEY UPDATE answer = VALUES(answer)'
);

$count = 0;
foreach ($answers as $qk => $val) {
    $qk = trim((string)$qk);
    if ($qk === '') continue;
    if (is_array($val)) $val = json_encode($val, JSON_UNESCAPED_UNICODE);
    elseif ($val === null) $val = '';
    else $val = (string)$val;

    $upsert->execute([':sid' => $session['id'], ':qk' => $qk, ':ans' => $val]);
    $count++;
}

json_out([
    'ok'               => true,
    'saved'            => $count,
    'submitted'        => (int)$session['submitted'],
    'remaining_seconds' => max(0, $expTs - $nowTs),
    'timestamps'       => date('Y-m-d H:i:s'),
]);