<?php

declare(strict_types=1);

namespace Shade;

final class Tasks
{
    /** Úlohy na dnes a meškajúce, zo všetkých projektov. @return list<array<string,mixed>> */
    public static function dueUntil(string $date): array
    {
        $st = Db::pdo()->prepare(
            'SELECT t.*, p.name AS project_name FROM tasks t JOIN projects p ON p.id = t.project_id
             WHERE t.done_at IS NULL AND t.due_date <= ? ORDER BY t.due_date, t.id'
        );
        $st->execute([$date]);
        return $st->fetchAll();
    }

    /** @return list<array<string,mixed>> */
    public static function upcoming(string $from, string $to): array
    {
        $st = Db::pdo()->prepare(
            'SELECT t.*, p.name AS project_name FROM tasks t JOIN projects p ON p.id = t.project_id
             WHERE t.done_at IS NULL AND t.due_date > ? AND t.due_date <= ? ORDER BY t.due_date, t.id'
        );
        $st->execute([$from, $to]);
        return $st->fetchAll();
    }

    /** @return list<array<string,mixed>> */
    public static function forPlan(int $planId): array
    {
        $st = Db::pdo()->prepare('SELECT * FROM tasks WHERE plan_id = ? ORDER BY week = 0 DESC, week, due_date, id');
        $st->execute([$planId]);
        return $st->fetchAll();
    }

    public static function toggle(int $id): ?int
    {
        $pdo = Db::pdo();
        $pdo->prepare('UPDATE tasks SET done_at = CASE WHEN done_at IS NULL THEN ? ELSE NULL END WHERE id = ?')
            ->execute([date('Y-m-d H:i:s'), $id]);
        $st = $pdo->prepare('SELECT project_id FROM tasks WHERE id = ?');
        $st->execute([$id]);
        $pid = $st->fetchColumn();
        return $pid === false ? null : (int) $pid;
    }
}
