<?php
/* ============================================================
   API — SOUMET EGZAMEN (final)
   POST { session_key }
   Mache sesyon an kòm soumèt — pa gen antre ankò
   ============================================================ */
declare(strict_types=1);
require __DIR__ . '/db.php';

$in = body_json();
$sessionKey = (string)($in['session_key'] ?? '');
if ($sessionKey === '') {
    json_out(['ok' => false, 'message' => 'session_key obligatwa.'], 422);
}

$pdo = db();

$stmt = $pdo->prepare('SELECT id, submitted FROM exam_sessions WHERE session_key = :sk');
$stmt->execute([':sk' => $sessionKey]);
$session = $stmt->fetch();

if (!$session) {
    json_out(['ok' => false, 'message' => 'Sesyon pa rekonèt.']);
}

if ((int)$session['submitted'] === 1) {
    json_out(['ok' => false, 'message' => 'Egzamen an soumèt deja.']);
}

$stmt = $pdo->prepare('UPDATE exam_sessions SET submitted = 1, submitted_at = NOW() WHERE id = :id');
$stmt->execute([':id' => $session['id']]);

json_out(['ok' => true, 'message' => 'Egzamen soumèt avèk siksè.']);