-- ============================================================
-- EXEMEN RESEAU 2 — SCHEMA BAZ DONEE (MariaDB / MySQL)
-- Konnen anpil laz: 1. Rann servis yo (Apache + MySQL)
--                    2. Enpòte fichye sa a nan phpMyAdmin oswa:
--                         mysql -u root < sql/schema.sql
-- ============================================================

CREATE DATABASE IF NOT EXISTS examen_reseau2
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE examen_reseau2;

-- ------------------------------------------------------------
-- TABLO ETIDYAN — kod YONIK, lye ak non ofisyèl la
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS students (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(120) NULL,
  is_test TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- SESYON EGZAMEN — yon etidyan ka gen yon sèl sesyon aktyèl
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS exam_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  session_key VARCHAR(64) NOT NULL UNIQUE,
  started_at DATETIME NOT NULL,
  expires_at DATETIME NOT NULL,
  submitted TINYINT(1) NOT NULL DEFAULT 0,
  submitted_at DATETIME NULL,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- REPONS — yon liy pa kesyon pa sesyon
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS answers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  session_id INT NOT NULL,
  question_key VARCHAR(20) NOT NULL,        -- eg. A.1, B.3, E.1
  answer TEXT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_session_question (session_id, question_key),
  FOREIGN KEY (session_id) REFERENCES exam_sessions(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- NOT FINAL — note manuelle + total (Espace enseignant / teacher.php)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS grades (
  session_key  VARCHAR(64) PRIMARY KEY,
  auto_score   DECIMAL(6,2) NOT NULL DEFAULT 0,
  manual_score DECIMAL(6,2) NOT NULL DEFAULT 0,
  total        DECIMAL(6,2) NOT NULL DEFAULT 0,
  updated_at   DATETIME DEFAULT NULL
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- SEED — Lis etidyan yo (MODIFYE selon lis klas ou)
-- Kod la YONIK + non ofisyèl obligatwa pou antre
-- ------------------------------------------------------------
INSERT INTO students (code, name, is_test) VALUES
  ('RES2-01', 'GAUCHIER Steven', 1),
  ('RES2-02', 'Deshley REJOUIS', 0),
  ('RES2-03', 'Dugacin Frantz MACKENLEY L.', 0),
  ('RES2-04', 'Loine MACKENDY', 0),
  ('RES2-05', 'CLERVILLE Stephania', 0),
  ('RES2-06', 'Belando DESIR', 0),
  ('RES2-07', 'OVIDE Samuel', 0),
  ('RES2-08', 'Frederic Schnyder', 0),
  ('RES2-09', 'Verna Josephine Angella', 0),
  ('RES2-10', 'Einstein Medjuvens LAFONTANT', 0),
  ('RES2-11', 'Standley DENIS', 0),
  ('RES2-12', 'Lovinsky FEDNA', 0)
ON DUPLICATE KEY UPDATE name = VALUES(name), is_test = VALUES(is_test);