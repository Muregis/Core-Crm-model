-- Migration: Add distributed job queue tables
-- Compatible with existing kenya_crm schema
-- Part of: Distributed Task Queue with Real-Time Observability

USE kenya_crm;

-- ============================================================
-- Jobs table (the main queue)
-- ============================================================
CREATE TABLE IF NOT EXISTS jobs (
    id              BIGINT PRIMARY KEY AUTO_INCREMENT,
    job_id          VARCHAR(36)  NOT NULL UNIQUE,          -- UUID for external reference
    type            VARCHAR(100) NOT NULL,                 -- e.g. 'send_bulk_sms', 'generate_report'
    payload         JSON         NOT NULL,                 -- job data
    status          ENUM('pending','running','completed','failed','cancelled','dead')
                    NOT NULL DEFAULT 'pending',
    priority        INT          NOT NULL DEFAULT 0,       -- higher = more urgent
    attempts        INT          NOT NULL DEFAULT 0,
    max_attempts    INT          NOT NULL DEFAULT 3,
    idempotency_key VARCHAR(255) NULL,                    -- for exactly-once
    result          JSON         NULL,
    error_message   TEXT         NULL,
    locked_by       VARCHAR(100) NULL,                    -- worker_id that holds the lock
    locked_at       DATETIME     NULL,
    available_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,  -- for delayed jobs / backoff
    started_at      DATETIME     NULL,
    completed_at    DATETIME     NULL,
    created_by      INT          NULL,                    -- FK to users
    created_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_status_available (status, available_at),
    INDEX idx_priority_available (priority DESC, available_at),
    INDEX idx_type (type),
    INDEX idx_idempotency (idempotency_key),
    INDEX idx_locked_by (locked_by),
    INDEX idx_created_by (created_by),
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Workers registry (heartbeat + health)
-- ============================================================
CREATE TABLE IF NOT EXISTS workers (
    id              INT PRIMARY KEY AUTO_INCREMENT,
    worker_id       VARCHAR(100) NOT NULL UNIQUE,          -- e.g. 'worker-hostname-pid'
    hostname        VARCHAR(255) NULL,
    status          ENUM('online','offline','draining') NOT NULL DEFAULT 'online',
    current_jobs    INT          NOT NULL DEFAULT 0,
    max_concurrency INT          NOT NULL DEFAULT 5,
    last_heartbeat  DATETIME     NOT NULL,
    started_at      DATETIME     NOT NULL,
    metadata        JSON         NULL,                    -- version, os, etc.
    created_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_status_heartbeat (status, last_heartbeat)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Job attempts / history (for observability)
-- ============================================================
CREATE TABLE IF NOT EXISTS job_attempts (
    id              BIGINT PRIMARY KEY AUTO_INCREMENT,
    job_id          BIGINT       NOT NULL,
    worker_id       VARCHAR(100) NOT NULL,
    attempt_number  INT          NOT NULL,
    status          ENUM('started','succeeded','failed') NOT NULL,
    error_message   TEXT         NULL,
    duration_ms     INT          NULL,
    started_at      DATETIME     NOT NULL,
    finished_at     DATETIME     NULL,

    INDEX idx_job (job_id),
    INDEX idx_worker (worker_id),
    FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Optional: simple metrics snapshot (for dashboard)
-- ============================================================
CREATE TABLE IF NOT EXISTS job_metrics (
    id              BIGINT PRIMARY KEY AUTO_INCREMENT,
    metric_date     DATE         NOT NULL,
    metric_hour     TINYINT      NOT NULL,               -- 0-23
    jobs_submitted  INT          NOT NULL DEFAULT 0,
    jobs_completed  INT          NOT NULL DEFAULT 0,
    jobs_failed     INT          NOT NULL DEFAULT 0,
    jobs_retried    INT          NOT NULL DEFAULT 0,
    avg_duration_ms INT          NULL,
    created_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY uq_date_hour (metric_date, metric_hour)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
