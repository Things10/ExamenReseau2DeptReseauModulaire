<?php
/* ============================================================
   API — DEKONEKSYON KONT TÈS
   POST { session_key }
   - Si se yon kont tès (is_test=1) : efase sesyon an + repons li
     → pwochen koneksyon ap kòmanse fre ak 120 min.
   - Kont reyèl : refize (bouton an pa parèt pou yo de tout fason).
   ============================================================ */
declare(strict_types=1);
require __DIR__ . '/db.php';

$in = body_json();
$sessionKey = trim((string)($in['session_key'] ?? ''));

if ($sessionKey === '') {
    json_out(['ok' => false, 'message' => 'session_key manquant.'], 422);
}

$pdo = db();

$stmt = $pdo->prepare(
    'SELECT s.id, s.student_id, st.is_test
       FROM exam_sessions s
       JOIN students st ON st.id = s.student_id
      WHERE s.session_key = :sk
      LIMIT 1'
);
$stmt->execute([':sk' => $sessionKey]);
$row = $stmt->fetch();

if (!$row) {
    json_out(['ok' => true, 'deleted' => false]);
}

if ((int)$row['is_test'] !== 1) {
    json_out(['ok' => false, 'message' => 'Non autorisé.'], 403);
}

$sid = (int)$row['id'];
$pdo->prepare('DELETE FROM answers WHERE session_id = :sid')->execute([':sid' => $sid]);
$pdo->prepare('DELETE FROM exam_sessions WHERE id = :sid')->execute([':sid' => $sid]);

json_out(['ok' => true, 'deleted' => true]);
