CREATE DATABASE IF NOT EXISTS `OceanOS`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `OceanOS`;

CREATE TABLE IF NOT EXISTS invocean_settings (
  id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
  shop_url VARCHAR(255) NULL,
  webservice_key_cipher TEXT NULL,
  webservice_key_hint VARCHAR(24) NULL,
  pdf_url_template TEXT NULL,
  sync_window_days INT UNSIGNED NOT NULL DEFAULT 30,
  seller_name VARCHAR(190) NULL,
  seller_vat_number VARCHAR(64) NULL,
  seller_siret VARCHAR(32) NULL,
  seller_street VARCHAR(190) NULL,
  seller_postcode VARCHAR(24) NULL,
  seller_city VARCHAR(120) NULL,
  seller_country_iso VARCHAR(2) NOT NULL DEFAULT 'FR',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS invocean_invoices (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  prestashop_invoice_id BIGINT UNSIGNED NOT NULL,
  order_id BIGINT UNSIGNED NOT NULL,
  invoice_number VARCHAR(80) NULL,
  invoice_date DATE NULL,
  order_reference VARCHAR(80) NULL,
  customer_name VARCHAR(190) NULL,
  customer_email VARCHAR(190) NULL,
  customer_company VARCHAR(190) NULL,
  vat_number VARCHAR(64) NULL,
  currency_iso VARCHAR(8) NULL,
  total_tax_excl DECIMAL(14,6) NOT NULL DEFAULT 0,
  total_tax_incl DECIMAL(14,6) NOT NULL DEFAULT 0,
  status ENUM('received', 'ready', 'sent', 'accepted', 'rejected', 'archived') NOT NULL DEFAULT 'received',
  channel ENUM('prestashop', 'manual', 'nautisign', 'pdp', 'chorus') NOT NULL DEFAULT 'prestashop',
  e_invoice_format ENUM('pdf', 'facturx', 'ubl', 'cii', 'unknown') NOT NULL DEFAULT 'pdf',
  pdf_url TEXT NULL,
  pdf_file_path VARCHAR(500) NULL,
  pdf_hash CHAR(64) NULL,
  pdf_downloaded_at DATETIME NULL,
  xml_payload LONGTEXT NULL,
  facturx_file_path VARCHAR(500) NULL,
  facturx_profile VARCHAR(40) NULL,
  facturx_generated_at DATETIME NULL,
  raw_json LONGTEXT NULL,
  source_hash CHAR(64) NOT NULL,
  synced_at DATETIME NOT NULL,
  deleted_at DATETIME NULL,
  deleted_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_invocean_prestashop_invoice (prestashop_invoice_id),
  KEY idx_invocean_invoice_date (invoice_date),
  KEY idx_invocean_status (status),
  KEY idx_invocean_order (order_id),
  KEY idx_invocean_customer_email (customer_email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS invocean_sync_runs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NULL,
  status ENUM('running', 'success', 'failed') NOT NULL DEFAULT 'running',
  started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at DATETIME NULL,
  invoices_seen INT UNSIGNED NOT NULL DEFAULT 0,
  invoices_created INT UNSIGNED NOT NULL DEFAULT 0,
  invoices_updated INT UNSIGNED NOT NULL DEFAULT 0,
  message TEXT NULL,
  raw_summary_json LONGTEXT NULL,
  CONSTRAINT fk_invocean_sync_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO invocean_settings (id, sync_window_days) VALUES (1, 30);
