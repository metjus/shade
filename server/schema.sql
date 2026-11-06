-- Shade: databázová schéma (MySQL 5.7+ / MariaDB 10.3+)
-- Import: v phpMyAdmin na Hostcreators otvor databázu a importuj tento súbor.

CREATE TABLE IF NOT EXISTS cube (
  id TINYINT UNSIGNED NOT NULL PRIMARY KEY,   -- vždy 1
  season INT UNSIGNED NOT NULL DEFAULT 1,
  edge INT UNSIGNED NOT NULL,                 -- hrana kocky v blokoch
  layer INT UNSIGNED NOT NULL DEFAULT 0,      -- aktuálne ťažená vrstva (0 = povrch)
  mined BIGINT UNSIGNED NOT NULL DEFAULT 0,   -- vyťažené bloky v aktuálnej vrstve
  total BIGINT UNSIGNED NOT NULL,             -- všetky bloky aktuálnej vrstvy
  version BIGINT UNSIGNED NOT NULL DEFAULT 0, -- rastie pri každej zmene dlaždíc
  opened_by INT UNSIGNED NULL,                -- hráč, ktorý rozbil jadro
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Stav blokov po dlaždiciach 64 × 64. Riadok vznikne až pri prvom údere do dlaždice.
-- data: 4096 bajtov, 0 = celý blok, 1..254 = poškodenie, 255 = vyťažený.
CREATE TABLE IF NOT EXISTS tiles (
  season INT UNSIGNED NOT NULL,
  layer INT UNSIGNED NOT NULL,
  f TINYINT UNSIGNED NOT NULL,
  tx SMALLINT UNSIGNED NOT NULL,
  ty SMALLINT UNSIGNED NOT NULL,
  data BLOB NOT NULL,
  mined SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  version BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (season, layer, f, tx, ty),
  KEY by_version (season, layer, version)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS players (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  token CHAR(64) NOT NULL,
  name VARCHAR(24) NOT NULL,
  dust BIGINT UNSIGNED NOT NULL DEFAULT 0,
  pickaxe SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  miners SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  miner_bank DOUBLE NOT NULL DEFAULT 0,        -- údery baníkov, ktoré ešte neboli spracované
  effect VARCHAR(16) NOT NULL DEFAULT 'basic',
  effects VARCHAR(255) NOT NULL DEFAULT 'basic',  -- vlastnené efekty, oddelené čiarkou
  contributed BIGINT UNSIGNED NOT NULL DEFAULT 0, -- vyťažené bloky (rebríček)
  home_f TINYINT UNSIGNED NOT NULL DEFAULT 4,     -- kde naposledy ťažil (tam pracujú baníci)
  home_u INT UNSIGNED NOT NULL DEFAULT 0,
  home_v INT UNSIGNED NOT NULL DEFAULT 0,
  last_sync DOUBLE NOT NULL DEFAULT 0,          -- unix čas v sekundách
  last_seen TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY by_token (token),
  KEY by_contributed (contributed),
  KEY by_seen (last_seen)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Nedávne rozbitia blokov hráčmi, aby ostatní videli ich efekty. Staré riadky sa mažú.
CREATE TABLE IF NOT EXISTS breaks (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  version BIGINT UNSIGNED NOT NULL,
  player_id INT UNSIGNED NOT NULL,
  f TINYINT UNSIGNED NOT NULL,
  u INT UNSIGNED NOT NULL,
  v INT UNSIGNED NOT NULL,
  effect VARCHAR(16) NOT NULL,
  kind TINYINT UNSIGNED NOT NULL DEFAULT 0,    -- 0 = kliknutie, 1 = baník
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY by_version (version),
  KEY by_created (created_at)
) ENGINE=InnoDB;

-- Dianie v kocke (dokončené vrstvy, nové krompáče, otvorenie jadra).
CREATE TABLE IF NOT EXISTS events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  kind VARCHAR(24) NOT NULL,
  text VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
