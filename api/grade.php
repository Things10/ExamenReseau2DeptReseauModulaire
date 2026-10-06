<?php
/* ============================================================
   API — NOTASYON AKYOTOMATIK (sou sèvè)
   POST { session_key, answers }
   - pa janm voye bon repons yo ba kliyan
   - grade sèlman si sesyon an soumèt, ekspire, oswa kont tès
     (anpeche etidyan yo eseye dekoupe repons yo pandan egzamen an)
   ============================================================ */
declare(strict_types=1);
require __DIR__ . '/db.php';
require __DIR__ . '/exam_answers.php';

$in = body_json();
$sessionKey = (string)($in['session_key'] ?? '');
$answers = $in['answers'] ?? null;

if ($sessionKey === '' || !is_array($answers)) {
    json_out(['ok' => false, 'message' => 'Paramètres manquants.'], 422);
}

$pdo = db();

$stmt = $pdo->prepare(
    'SELECT s.id, s.submitted, s.expires_at, st.is_test
       FROM exam_sessions s
       JOIN students st ON st.id = s.student_id
      WHERE s.session_key = :sk'
);
$stmt->execute([':sk' => $sessionKey]);
$session = $stmt->fetch();

if (!$session) {
    json_out(['ok' => false, 'message' => 'Session non reconnue.']);
}

/* Anti-triche : pa kalkile not si sesyon an poko soumèt, poko ekspire, epi se pa kont tès */
$nowTs = time();
$expTs = (new DateTime($session['expires_at']))->getTimestamp();
$isTest = (int)($session['is_test'] ?? 0) === 1;

if ((int)$session['submitted'] !== 1 && $expTs > $nowTs && !$isTest) {
    json_out(['ok' => false, 'reason' => 'not_submitted', 'message' => 'L\'examen n\'est pas encore soumis.']);
}

$score = 0.0;
$detail = [];
$qi = 0;

/* SECTION A — QCM (choix simple) */
for ($i = 0; $i < QCM_COUNT; $i++, $qi++) {
    $raw = $answers[(string)$qi] ?? '';
    $userAns = is_string($raw) ? trim($raw) : '';
    $norm = mb_strtolower($userAns);
    $good = mb_strtolower(trim($QCM_ANSWERS[$i]));
    $correct = ($norm !== '' && $norm === $good);
    if ($correct) $score += QCM_PTS;
    $display = $userAns !== '' ? $userAns : '(sans réponse)';
    $detail[] = sprintf('A.%d: %s %s', $i + 1, $display, $correct ? '[correct]' : '[incorrect]');
}

/* SECTION B — Multi (tout-ou-rien) */
for ($i = 0; $i < MULTI_COUNT; $i++, $qi++) {
    $selected = $answers[(string)$qi] ?? [];
    if (!is_array($selected)) $selected = [];
    $userSet = array_values(array_unique(array_map('strval', $selected)));
    $goodSet = array_values(array_unique(array_map('strval', $MULTI_ANSWERS[$i])));

    $correct = (count($userSet) === count($goodSet))
        && count(array_intersect($userSet, $goodSet)) === count($goodSet);

    if ($correct) $score += MULTI_PTS;
    $display = count($userSet) > 0 ? implode(', ', $userSet) : '(sans réponse)';
    $detail[] = sprintf('B.%d: %s %s', $i + 1, $display, $correct ? '[correct]' : '[incorrect]');
}

json_out([
    'ok'          => true,
    'score'       => round($score, 2),
    'auto_total'  => QCM_PTS * QCM_COUNT + MULTI_PTS * MULTI_COUNT,
    'detail'      => $detail,
]);