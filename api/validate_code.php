<?php
/* ============================================================
   API — VALIDE KOD + NON ETIDYAN
   POST { code, name }
   - chèche etidyan an nan baz la (code YONIK + non ofisyèl)
   - kreye oubyen rekòmanse sesyon an
   ============================================================ */
declare(strict_types=1);
require __DIR__ . '/db.php';

/* Nòmalize yon non : miniskil, san aksan, espas miltip -> yon sèl espas */
function norm_name(string $s): string {
    $s = mb_strtolower(trim($s), 'UTF-8');
    $accents = [
        'à'=>'a','á'=>'a','â'=>'a','ä'=>'a','ã'=>'a','å'=>'a','ā'=>'a','ă'=>'a','ą'=>'a',
        'ç'=>'c','ć'=>'c','č'=>'c',
        'è'=>'e','é'=>'e','ê'=>'e','ë'=>'e','ē'=>'e','ĕ'=>'e','ė'=>'e','ę'=>'e','ě'=>'e',
        'ì'=>'i','í'=>'i','î'=>'i','ï'=>'i','ī'=>'i','ĭ'=>'i','į'=>'i','ı'=>'i',
        'ñ'=>'n','ń'=>'n','ň'=>'n',
        'ò'=>'o','ó'=>'o','ô'=>'o','ö'=>'o','õ'=>'o','ø'=>'o','ō'=>'o','ŏ'=>'o','ő'=>'o',
        'ù'=>'u','ú'=>'u','û'=>'u','ü'=>'u','ū'=>'u','ŭ'=>'u','ů'=>'u','ű'=>'u','ų'=>'u',
        'ý'=>'y','ÿ'=>'y','ŷ'=>'y',
        'ß'=>'ss','ş'=>'s','ș'=>'s','š'=>'s','ś'=>'s','ŝ'=>'s',
        'ţ'=>'t','ť'=>'t','ț'=>'t',
        'ž'=>'z','ź'=>'z','ż'=>'z',
        'œ'=>'oe','æ'=>'ae',
    ];
    $s = strtr($s, $accents);
    if (function_exists('iconv')) {
        $conv = @iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $s);
        if ($conv !== false) { $s = $conv; }
    }
    $s = preg_replace('/[^a-z0-9]+/', ' ', $s);
    $s = trim(preg_replace('/ +/', ' ', (string)$s));
    return (string)$s;
}

/* Verifye non an : asepte non konplè, oswa yon mo sèl (non OSWA prenon).
   Aksepte aksan ak espas miltip (nòmalize anvan konpare). */
function name_matches(string $official, string $typed): bool {
    $o = norm_name($official);
    $t = norm_name($typed);
    if ($t === '' || $o === '') { return false; }
    if ($t === $o) { return true; }
    return (bool)preg_match('/(?:^| )' . preg_quote($t, '/') . '(?: |$)/u', $o);
}

$in = body_json();
$code = trim((string)($in['code'] ?? ''));
$name = trim((string)($in['name'] ?? ''));
$email = trim((string)($in['email'] ?? ''));
if ($email !== '' && filter_var($email, FILTER_VALIDATE_EMAIL) === false) { $email = ''; }

if ($code === '' || $name === '') {
    json_out(['ok' => false, 'message' => 'Le code et le nom sont obligatoires.'], 422);
}

$pdo = db();

/* Asire kolòn `email` egziste nan tablo students */
try {
    $chk = $pdo->query(
        'SELECT COUNT(*) AS c FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = "students" AND COLUMN_NAME = "email"'
    );
    if ((int)$chk->fetch()['c'] === 0) {
        $pdo->exec('ALTER TABLE students ADD COLUMN email VARCHAR(120) NULL');
    }
} catch (Throwable $e) { /* rete pare */ }

$stmt = $pdo->prepare('SELECT id, code, name, is_test, email FROM students WHERE code = :code');
$stmt->execute([':code' => $code]);
$student = $stmt->fetch();

if (!$student) {
    json_out(['ok' => false, 'message' => 'Ce code n\'est pas reconnu. Vérifiez auprès de votre enseignant.']);
}

/* Non an dwe koresponn ak non ofisyèl la (nom oswa prénom, san aksan, espas miltip OK) */
if (!name_matches((string)$student['name'], $name)) {
    json_out(['ok' => false, 'message' => 'Ce code n\'est pas associé à ce nom. Entrez votre nom ou prénom tel qu\'enregistré (les accents et espaces multiples sont acceptés).']);
}

/* Sove email etidyan an si li bay yon sèl valab */
if ($email !== '') {
    $pdo->prepare('UPDATE students SET email = :em WHERE id = :sid')
        ->execute([':em' => $email, ':sid' => (int)$student['id']]);
    $student['email'] = $email;
}
$studentPayload = ['code' => $student['code'], 'name' => $student['name'], 'email' => (string)($student['email'] ?? '')];

$now = new DateTime();
$expires = (clone $now)->modify('+' . EXAM_DURATION_MINUTES . ' minutes');

$isTest = (int)($student['is_test'] ?? 0) === 1;

/* Kont tès : ki pa janm bloke, men ki kapab relanse yon sesyon ki poko soumèt
   (konsa testeur ka fermen paj la epi jwenn repons li anko apre re-entrée) */
if ($isTest) {
    $stmt = $pdo->prepare(
        'SELECT id, session_key, expires_at
           FROM exam_sessions
          WHERE student_id = :sid AND submitted = 0
          ORDER BY id DESC LIMIT 1'
    );
    $stmt->execute([':sid' => $student['id']]);
    $existing = $stmt->fetch();

    if ($existing && new DateTime($existing['expires_at']) > $now) {
        json_out([
            'ok'        => true,
            'resuming'  => true,
            'is_test'   => true,
            'session_key' => $existing['session_key'],
            'expires_at'  => $existing['expires_at'],
            'remaining_seconds' => (new DateTime($existing['expires_at']))->getTimestamp() - $now->getTimestamp(),
            'student'     => $studentPayload,
        ]);
    }

    /* Si sesyon an soumèt oubyen ekspire -> rekòmanse nèt (testeur ka soumèt plizyè fwa) */
    $pdo->prepare('DELETE FROM exam_sessions WHERE student_id = :sid')->execute([':sid' => $student['id']]);
    $sessionKey = hash('sha256', $code . '|' . $student['id'] . '|examen-reseau2-test');
    $pdo->prepare(
        'INSERT INTO exam_sessions (student_id, session_key, started_at, expires_at)
         VALUES (:sid, :sk, :start, :exp)'
    )->execute([
        ':sid'   => $student['id'],
        ':sk'    => $sessionKey,
        ':start' => $now->format('Y-m-d H:i:s'),
        ':exp'   => $expires->format('Y-m-d H:i:s'),
    ]);
    json_out([
        'ok'            => true,
        'resuming'      => false,
        'is_test'       => true,
        'session_key'   => $sessionKey,
        'expires_at'    => $expires->format('Y-m-d H:i:s'),
        'remaining_seconds' => EXAM_DURATION_MINUTES * 60,
        'student'       => $studentPayload,
    ]);
}

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
            'student'     => $studentPayload,
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
    'student'     => $studentPayload,
]);