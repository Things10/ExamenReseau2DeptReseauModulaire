<?php
/* ============================================================
   API — VALIDE KOD + NON ETIDYAN
   POST { code, name }
   - chèche etidyan an nan baz la (code YONIK + non ofisyèl)
   - kreye oubyen rekòmanse sesyon an
   ============================================================ */
declare(strict_types=1);
require __DIR__ . '/db.php';

$in = body_json();
$code = trim((string)($in['code'] ?? ''));
$name = trim((string)($in['name'] ?? ''));

if ($code === '' || $name === '') {
    json_out(['ok' => false, 'message' => 'Le code et le nom sont obligatoires.'], 422);
}

$pdo = db();

$stmt = $pdo->prepare('SELECT id, code, name FROM students WHERE code = :code');
$stmt->execute([':code' => $code]);
$student = $stmt->fetch();

if (!$student) {
    json_out(['ok' => false, 'message' => 'Ce code n\'est pas reconnu. Vérifiez auprès de votre enseignant.']);
}

/* Non an dwe koresponn ak non ofisyèl la (enpòtan pou se siy li) */
if (strcasecmp($student['name'], $name) !== 0) {
    json_out(['ok' => false, 'message' => 'Ce code n\'est pas associé à ce nom. Vous ne pouvez pas utiliser le code d\'un autre étudiant.']);
}

$now = new DateTime();
$expires = (clone $now)->modify('+' . EXAM_DURATION_MINUTES . ' minutes');

/* Si gen sesyon ki fin soumèt deja, bloke l */
$done = $pdo->prepare('SELECT id FROM exam_sessions WHERE student_id = :sid AND submitted = 1 LIMIT 1');
$done->execute([':sid' => $student['id']]);
if ($done->fetch()) {
    json_out(['ok' => false, 'message' => 'Vous avez déjà soumis l\'examen. Vous ne pouvez plus y accéder.']);
}

/* Rekòmanse sesyon an si li poko fin soumèt (pou recovery apre erè) */
$sessionKey = hash('sha256', $code . '|' . $student['id'] . '|examen-reseau2');

$stmt = $pdo->prepare(
    'SELECT id, session_key, started_at, expires_at, submitted
       FROM exam_sessions
      WHERE student_id = :sid AND submitted = 0
      ORDER BY id DESC LIMIT 1'
);
$stmt->execute([':sid' => $student['id']]);
$existing = $stmt->fetch();

if ($existing) {
    /* Tan apre voi - si sesyon an depase, rekreye li yo */
    if (new DateTime($existing['expires_at']) > $now) {
        json_out([
            'ok'        => true,
            'resuming'  => true,
            'session_key' => $existing['session_key'],
            'expires_at'  => $existing['expires_at'],
            'remaining_seconds' => (new DateTime($existing['expires_at']))->getTimestamp() - $now->getTimestamp(),
            'student'     => ['code' => $student['code'], 'name' => $student['name']],
        ]);
    }
    $pdo->prepare('DELETE FROM exam_sessions WHERE id = :id')->execute([':id' => $existing['id']]);
}

/* Kreye nouvo sesyon */
$stmt = $pdo->prepare(
    'INSERT INTO exam_sessions (student_id, session_key, started_at, expires_at)
     VALUES (:sid, :sk, :start, :exp)'
);
$stmt->execute([
    ':sid'   => $student['id'],
    ':sk'    => $sessionKey,
    ':start' => $now->format('Y-m-d H:i:s'),
    ':exp'   => $expires->format('Y-m-d H:i:s'),
]);

json_out([
    'ok'        => true,
    'resuming'  => false,
    'session_key' => $sessionKey,
    'expires_at'  => $expires->format('Y-m-d H:i:s'),
    'remaining_seconds' => EXAM_DURATION_MINUTES * 60,
    'student'     => ['code' => $student['code'], 'name' => $student['name']],
]);