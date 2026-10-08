<?php
/* ============================================================
   API — KONEKSYON BAZ DONEE (PDO)
   === RESPONSE !==
   === FILE: api/db.php ===
   ============================================================ */
declare(strict_types=1);

define('DB_HOST', '127.0.0.1');
define('DB_NAME', 'examen_reseau2');
define('DB_USER', 'root');
define('DB_PASS', '');   // XAMPP/MariaDB default = pa gen paswòd
define('EXAM_DURATION_MINUTES', 120);
define('TEACHER_PASS', 'reseau2026');   // paswòd Espace enseignant (teacher.php)

function db(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4';
        $pdo = new PDO($dsn, DB_USER, DB_PASS, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
    }
    return $pdo;
}

function json_out(array $data, int $status = 200): void {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data);
    exit;
}

function body_json(): array {
    $in = array_merge($_GET, $_POST);
    if (isset($in['data']) && is_string($in['data'])) {
        $decoded = json_decode($in['data'], true);
        if (is_array($decoded)) {
            $in = array_merge($in, $decoded);
        }
    }
    $raw = file_get_contents('php://input');
    $json = json_decode($raw, true);
    if (is_array($json)) {
        $in = array_merge($in, $json);
    }
    return $in;
}