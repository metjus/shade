<?php

declare(strict_types=1);

namespace Shade;

/** Banka nápadov: rýchlo si zapíšeš nápad, neskôr z neho spravíš príspevky. */
final class Ideas
{
    public static function add(int $projectId, string $text): void
    {
        $text = mb_substr(trim($text), 0, 1000);
        if ($text !== '') {
            Db::pdo()->prepare('INSERT INTO ideas (project_id, text) VALUES (?, ?)')->execute([$projectId, $text]);
        }
    }

    /** @return list<array<string,mixed>> */
    public static function forProject(int $projectId): array
    {
        $st = Db::pdo()->prepare('SELECT * FROM ideas WHERE project_id = ? ORDER BY used, id DESC');
        $st->execute([$projectId]);
        return $st->fetchAll();
    }

    /** @return array<string,mixed>|null */
    public static function find(int $id): ?array
    {
        $st = Db::pdo()->prepare('SELECT * FROM ideas WHERE id = ?');
        $st->execute([$id]);
        return $st->fetch() ?: null;
    }

    public static function markUsed(int $id): void
    {
        Db::pdo()->prepare('UPDATE ideas SET used = 1 WHERE id = ?')->execute([$id]);
    }

    public static function delete(int $id): void
    {
        Db::pdo()->prepare('DELETE FROM ideas WHERE id = ?')->execute([$id]);
    }
}
