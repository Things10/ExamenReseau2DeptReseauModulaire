<?php
/* ============================================================
   API — RECWPERE REPONS SOVE YO
   POST { session_key }  (pou rekòmanse apre erè / pati)
   ============================================================ */
declare(strict_types=1);
require __DIR__ . '/db.php';

$in = body_json();
$sessionKey = trim((string)($in['session_key'] ?? ''));
if ($sessionKey === '') {
    json_out(['ok' => false, 'message' => 'session_key obligatoire.'], 422);
}

$pdo = db();

$stmt = $pdo->prepare('SELECT id, submitted, expires_at FROM exam_sessions WHERE session_key = :sk');
$stmt->execute([':sk' => $sessionKey]);
$session = $stmt->fetch();

if (!$session) {
    json_out(['ok' => false, 'message' => 'Aucune session.']);
}

$answers = [];
$stmt = $pdo->prepare('SELECT question_key, answer FROM answers WHERE session_id = :sid');
$stmt->execute([':sid' => $session['id']]);
foreach ($stmt->fetchAll() as $row) {
    $val = $row['answer'];
    $decoded = json_decode($val, true);
    $answers[$row['question_key']] = ($decoded !== null) ? $decoded : $val;
}

json_out([
    'ok'       => true,
    'submitted' => (int)$session['submitted'],
    'expires_at' => $session['expires_at'],
    'remaining_seconds' => max(0, (new DateTime($session['expires_at']))->getTimestamp() - time()),
    'answers'  => $answers,
]);