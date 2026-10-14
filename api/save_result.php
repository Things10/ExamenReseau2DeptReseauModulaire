<?php
/* ============================================================
   API — SOVE DOKIMAN REZILTA (HTML + TÈKS) POU ESPAS PWOFESÈ A
   POST { session_key, html_body, text_body }
   - sove kopi etidyan an (repons detaye + tablo yo)
   - pwofesè a ap li l epi voye l bay etidyan an apre koreksyon
   ============================================================ */
declare(strict_types=1);
require __DIR__ . '/db.php';

$in = body_json();
$sessionKey = trim((string)($in['session_key'] ?? ''));
$htmlBody   = (string)($in['html_body'] ?? '');
$textBody   = (string)($in['text_body'] ?? '');

if ($sessionKey === '' || $htmlBody === '') {
    json_out(['ok' => false, 'message' => 'Paramètres manquants.'], 422);
}

$pdo = db();

/* Tablo a kreye otomatikman si li pa egziste */
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

$stmt = $pdo->prepare('SELECT id, submitted FROM exam_sessions WHERE session_key = :sk');
$stmt->execute([':sk' => $sessionKey]);
$session = $stmt->fetch();
if (!$session) {
    json_out(['ok' => false, 'message' => 'Session non reconnue.'], 404);
}
if ((int)$session['submitted'] !== 1) {
    json_out(['ok' => false, 'message' => 'L\'examen n\'a pas encore été soumis.'], 409);
}

$up = $pdo->prepare(
    'INSERT INTO exam_results (session_key, html_body, text_body, updated_at)
     VALUES (:sk, :h, :t, NOW())
     ON DUPLICATE KEY UPDATE html_body = VALUES(html_body),
                             text_body = VALUES(text_body),
                             updated_at = NOW()'
);
$up->execute([':sk' => $sessionKey, ':h' => $htmlBody, ':t' => $textBody]);

json_out(['ok' => true, 'message' => 'Copie enregistrée.']);
