<?php

declare(strict_types=1);

namespace Shade;

use PDO;

/** SQLite databáza v data/shade.sqlite. Schéma sa vytvorí sama pri prvom spustení. */
final class Db
{
    private static ?PDO $pdo = null;

    public static function pdo(?string $path = null): PDO
    {
        if (self::$pdo === null) {
            $path ??= __DIR__ . '/../data/shade.sqlite';
            if (!is_dir(dirname($path))) {
                mkdir(dirname($path), 0770, true);
            }
            self::$pdo = new PDO('sqlite:' . $path, null, null, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            ]);
            self::$pdo->exec('PRAGMA foreign_keys = ON');
            self::migrate(self::$pdo);
        }
        return self::$pdo;
    }

    private static function migrate(PDO $pdo): void
    {
        $pdo->exec(<<<'SQL'
            CREATE TABLE IF NOT EXISTS projects (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                type TEXT NOT NULL,
                url TEXT NOT NULL DEFAULT '',
                description TEXT NOT NULL,
                audience TEXT NOT NULL DEFAULT '',
                tone TEXT NOT NULL DEFAULT '',
                goal TEXT NOT NULL,
                budget TEXT NOT NULL,
                languages TEXT NOT NULL DEFAULT 'sk',
                voice_samples TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS plans (
                id INTEGER PRIMARY KEY,
                project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                start_date TEXT NOT NULL,
                lang TEXT NOT NULL,
                mode TEXT NOT NULL,
                data TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS tasks (
                id INTEGER PRIMARY KEY,
                plan_id INTEGER NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
                project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                week INTEGER NOT NULL,
                title TEXT NOT NULL,
                due_date TEXT NOT NULL,
                done_at TEXT
            );
            CREATE TABLE IF NOT EXISTS posts (
                id INTEGER PRIMARY KEY,
                project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                channel TEXT NOT NULL,
                lang TEXT NOT NULL,
                text TEXT NOT NULL,
                tip TEXT NOT NULL DEFAULT '',
                source TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'draft',
                scheduled_for TEXT,
                evergreen INTEGER NOT NULL DEFAULT 0,
                views INTEGER,
                reactions INTEGER,
                clicks INTEGER,
                result_note TEXT NOT NULL DEFAULT '',
                parent_id INTEGER,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                published_at TEXT
            );
            CREATE TABLE IF NOT EXISTS ideas (
                id INTEGER PRIMARY KEY,
                project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                text TEXT NOT NULL,
                used INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS tasks_due ON tasks(due_date, done_at);
            CREATE INDEX IF NOT EXISTS posts_project ON posts(project_id, status);
            CREATE INDEX IF NOT EXISTS posts_scheduled ON posts(scheduled_for);
            SQL);
    }
}
