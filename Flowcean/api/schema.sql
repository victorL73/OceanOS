CREATE DATABASE IF NOT EXISTS `OceanOS`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `OceanOS`;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(190) NOT NULL UNIQUE,
  display_name VARCHAR(120) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('super', 'admin', 'member') NOT NULL DEFAULT 'member',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS flowcean_workspaces (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(120) NOT NULL UNIQUE,
  name VARCHAR(190) NOT NULL,
  owner_user_id BIGINT UNSIGNED NULL,
  is_personal TINYINT(1) NOT NULL DEFAULT 0,
  data_json LONGTEXT NOT NULL,
  version INT UNSIGNED NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_workspaces_owner FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS flowcean_workspace_members (
  workspace_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  role ENUM('owner', 'admin', 'editor', 'viewer') NOT NULL DEFAULT 'editor',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (workspace_id, user_id),
  CONSTRAINT fk_workspace_members_workspace FOREIGN KEY (workspace_id) REFERENCES flowcean_workspaces(id) ON DELETE CASCADE,
  CONSTRAINT fk_workspace_members_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS flowcean_workspace_invitations (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  workspace_id BIGINT UNSIGNED NOT NULL,
  email VARCHAR(190) NOT NULL,
  invited_user_id BIGINT UNSIGNED NULL,
  invited_by_user_id BIGINT UNSIGNED NOT NULL,
  role ENUM('admin', 'editor', 'viewer') NOT NULL DEFAULT 'editor',
  status ENUM('pending', 'accepted', 'revoked') NOT NULL DEFAULT 'pending',
  accepted_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_workspace_invite_email (workspace_id, email),
  INDEX idx_workspace_invites_user_status (invited_user_id, status),
  CONSTRAINT fk_workspace_invites_workspace FOREIGN KEY (workspace_id) REFERENCES flowcean_workspaces(id) ON DELETE CASCADE,
  CONSTRAINT fk_workspace_invites_user FOREIGN KEY (invited_user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_workspace_invites_sender FOREIGN KEY (invited_by_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS flowcean_workspace_events (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  workspace_id BIGINT UNSIGNED NOT NULL,
  actor_user_id BIGINT UNSIGNED NULL,
  event_type VARCHAR(80) NOT NULL,
  payload_json LONGTEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_workspace_events_workspace_created (workspace_id, created_at),
  CONSTRAINT fk_workspace_events_workspace FOREIGN KEY (workspace_id) REFERENCES flowcean_workspaces(id) ON DELETE CASCADE,
  CONSTRAINT fk_workspace_events_user FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS flowcean_workspace_presence (
  workspace_id BIGINT UNSIGNED NOT NULL,
  client_id VARCHAR(80) NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  active_page_id VARCHAR(120) NULL,
  active_page_title VARCHAR(190) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (workspace_id, client_id),
  INDEX idx_workspace_presence_workspace_updated (workspace_id, updated_at),
  CONSTRAINT fk_workspace_presence_workspace FOREIGN KEY (workspace_id) REFERENCES flowcean_workspaces(id) ON DELETE CASCADE,
  CONSTRAINT fk_workspace_presence_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS flowcean_workspace_user_preferences (
  workspace_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  preferences_json LONGTEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (workspace_id, user_id),
  CONSTRAINT fk_workspace_user_preferences_workspace FOREIGN KEY (workspace_id) REFERENCES flowcean_workspaces(id) ON DELETE CASCADE,
  CONSTRAINT fk_workspace_user_preferences_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_ai_settings (
  user_id BIGINT UNSIGNED PRIMARY KEY,
  provider VARCHAR(40) NOT NULL DEFAULT 'groq',
  model VARCHAR(120) NOT NULL DEFAULT 'llama-3.3-70b-versatile',
  api_key_cipher TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_user_ai_settings_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
