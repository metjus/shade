<?php

declare(strict_types=1);

namespace Shade;

/** 30-dňový plán pre projekt: vygeneruje ho, uloží úlohy s dátumami a príspevky ako koncepty. */
final class Plans
{
    private const SYSTEM = <<<'TXT'
        You are a pragmatic marketing strategist for a solo maker who has little time and little or no budget.

        Rules:
        - Be concrete and actionable. Every task must be doable by one person in under 2 hours and start with a verb.
        - Prefer free, organic channels; only suggest paid ads if the budget allows it.
        - Pick 3-5 channels that genuinely fit this product and audience, ordered by priority. Do not list everything.
        - The plan has exactly 4 weeks with 3-5 tasks each.
        - Give 8-10 content ideas and one ready-to-publish post for each of the top 3 channels.
          Posts must respect the channel's norms (length, hashtags, Reddit's anti-self-promotion culture, etc.)
          and the brand's tone of voice.
        - Give 3-5 quick wins that can be done today.
        - Never invent facts, numbers, reviews or features that are not in the brief.
        - Write all human-readable text in the requested output language.
        TXT;

    /** @return array<string,mixed>|null posledný plán projektu */
    public static function latest(int $projectId): ?array
    {
        $st = Db::pdo()->prepare('SELECT * FROM plans WHERE project_id = ? ORDER BY id DESC LIMIT 1');
        $st->execute([$projectId]);
        $row = $st->fetch();
        if (!$row) {
            return null;
        }
        $row['data'] = json_decode($row['data'], true);
        return $row;
    }

    /** @param array<string,mixed> $project */
    public static function generate(array $project, string $lang, ?string $note = null): int
    {
        $ai = Ai::get();
        if ($ai->enabled()) {
            $prompt = "Create a 30-day marketing plan for this product.\n\n" . Projects::brief($project)
                . "\nOutput language: " . ($lang === 'sk' ? 'Slovak' : 'English')
                . self::history((int) $project['id'])
                . ($note ? "\n\nExtra instructions from the owner: {$note}" : '');
            $data = $ai->json(self::SYSTEM, $prompt, PlanSchema::schema());
            $mode = 'ai';
        } else {
            $data = (new DemoGenerator())->plan($project, $lang);
            $mode = 'demo';
        }

        $pdo = Db::pdo();
        $pdo->beginTransaction();
        $start = new \DateTimeImmutable('today');
        $pdo->prepare('INSERT INTO plans (project_id, start_date, lang, mode, data) VALUES (?, ?, ?, ?, ?)')
            ->execute([$project['id'], $start->format('Y-m-d'), $lang, $mode, json_encode($data, JSON_UNESCAPED_UNICODE)]);
        $planId = (int) $pdo->lastInsertId();

        // Nedokončené úlohy zo starého plánu nahradí nový plán; hotové ostávajú v histórii.
        $pdo->prepare('DELETE FROM tasks WHERE project_id = ? AND plan_id <> ? AND done_at IS NULL')
            ->execute([$project['id'], $planId]);

        $insert = $pdo->prepare('INSERT INTO tasks (plan_id, project_id, week, title, due_date) VALUES (?, ?, ?, ?, ?)');
        foreach ($data['plan'] as $w => $week) {
            $tasks = array_values($week['tasks']);
            $weekIndex = min(3, max(0, (int) ($week['week'] ?? $w + 1) - 1));
            foreach ($tasks as $i => $title) {
                // Úlohy rozložíme rovnomerne na pracovné dni daného týždňa.
                $offset = $weekIndex * 7 + intdiv($i * 5, max(1, count($tasks)));
                $insert->execute([$planId, $project['id'], $weekIndex + 1, $title, $start->modify("+{$offset} days")->format('Y-m-d')]);
            }
        }
        foreach ($data['quick_wins'] as $title) {
            $insert->execute([$planId, $project['id'], 0, $title, $start->format('Y-m-d')]);
        }
        foreach ($data['posts'] as $post) {
            Posts::add((int) $project['id'], $post['channel'], $lang, $post['text'], '', 'plan');
        }
        foreach ($data['content_ideas'] as $idea) {
            Ideas::add((int) $project['id'], "{$idea['title']} ({$idea['format']}, {$idea['channel']})");
        }
        $pdo->commit();
        return $planId;
    }

    /** Čo už bolo zverejnené, aby AI nadviazala a neopakovala sa. */
    private static function history(int $projectId): string
    {
        $st = Db::pdo()->prepare("SELECT channel, substr(text, 1, 160) AS t FROM posts WHERE project_id = ? AND status = 'published' ORDER BY published_at DESC LIMIT 10");
        $st->execute([$projectId]);
        $done = Db::pdo()->prepare('SELECT title FROM tasks WHERE project_id = ? AND done_at IS NOT NULL ORDER BY done_at DESC LIMIT 15');
        $done->execute([$projectId]);
        $posts = $st->fetchAll();
        $tasks = $done->fetchAll(\PDO::FETCH_COLUMN);
        $top = Posts::top($projectId, 5);
        if (!$posts && !$tasks) {
            return '';
        }
        $out = "\n\nWhat the owner already did (build on it, do not repeat):";
        foreach ($tasks as $t) {
            $out .= "\n- task done: {$t}";
        }
        foreach ($posts as $p) {
            $out .= "\n- published on {$p['channel']}: {$p['t']}";
        }
        if ($top) {
            $out .= "\n\nBest performing posts so far (lean into what worked):";
            foreach ($top as $p) {
                $out .= sprintf("\n- %s: views %s, reactions %s, clicks %s%s — %s", $p['channel'], $p['views'] ?? '?', $p['reactions'] ?? '?', $p['clicks'] ?? '?', $p['result_note'] !== '' ? " ({$p['result_note']})" : '', mb_substr($p['text'], 0, 140));
            }
        }
        return $out;
    }
}
