<?php

declare(strict_types=1);

namespace Shade;

/** Knižnica príspevkov: koncepty a zverejnené. */
final class Posts
{
    private const REPURPOSE_SYSTEM = <<<'TXT'
        You adapt one piece of content (a devlog, an update, an announcement) into native posts for several channels
        for a solo maker. Each post must feel written for that channel, not copy-pasted:
        - x: max 280 characters, one hook, at most 2 hashtags.
        - linkedin: professional but personal, short paragraphs, a question at the end.
        - facebook / instagram: friendly, short, a call to action; instagram gets 5-10 relevant hashtags.
        - tiktok / youtube: a short video script: hook in the first 2 seconds, 3-5 beats, on-screen text in [brackets].
        - reddit: a title on the first line, then a genuine, non-salesy post that gives value; no hashtags.
        - discord: casual community announcement.
        - newsletter / blog: a subject line or title on the first line, then a fuller text.
        - producthunt / forums: concise, honest, invites feedback.
        Keep the brand's tone of voice. Never invent facts, numbers or features that are not in the source or the brief.
        Write each post in the language requested for it. In "tip", give one short practical note for publishing it
        (best time, what image or clip to attach, which subreddit or community type), in the same language as the post.
        TXT;

    public static function add(int $projectId, string $channel, string $lang, string $text, string $tip, string $source, ?int $parentId = null): int
    {
        $pdo = Db::pdo();
        $pdo->prepare('INSERT INTO posts (project_id, channel, lang, text, tip, source, parent_id) VALUES (?, ?, ?, ?, ?, ?, ?)')
            ->execute([$projectId, $channel, $lang, $text, $tip, $source, $parentId]);
        return (int) $pdo->lastInsertId();
    }

    /** @return list<array<string,mixed>> */
    public static function forProject(int $projectId, string $status): array
    {
        $order = $status === 'published' ? 'published_at DESC' : 'scheduled_for IS NULL, scheduled_for, id DESC';
        $st = Db::pdo()->prepare("SELECT * FROM posts WHERE project_id = ? AND status = ? ORDER BY $order LIMIT 100");
        $st->execute([$projectId, $status]);
        return $st->fetchAll();
    }

    /** @return list<array<string,mixed>> */
    public static function drafts(int $limit): array
    {
        $st = Db::pdo()->prepare(
            "SELECT po.*, p.name AS project_name FROM posts po JOIN projects p ON p.id = po.project_id
             WHERE po.status = 'draft' ORDER BY po.id DESC LIMIT ?"
        );
        $st->execute([$limit]);
        return $st->fetchAll();
    }

    /** @return array<string,mixed>|null */
    public static function find(int $id): ?array
    {
        $st = Db::pdo()->prepare('SELECT * FROM posts WHERE id = ?');
        $st->execute([$id]);
        return $st->fetch() ?: null;
    }

    public static function update(int $id, string $text): void
    {
        Db::pdo()->prepare('UPDATE posts SET text = ? WHERE id = ?')->execute([mb_substr($text, 0, 10000), $id]);
    }

    public static function setStatus(int $id, string $status): void
    {
        Db::pdo()->prepare("UPDATE posts SET status = ?, published_at = CASE WHEN ? = 'published' THEN datetime('now') ELSE NULL END WHERE id = ?")
            ->execute([$status, $status, $id]);
    }

    public static function delete(int $id): void
    {
        Db::pdo()->prepare('DELETE FROM posts WHERE id = ?')->execute([$id]);
    }

    /**
     * Jeden obsah → príspevky pre viac kanálov a jazykov. Uloží ich ako koncepty.
     *
     * @param array<string,mixed> $project
     * @param list<string> $channels
     * @param list<string> $langs
     */
    public static function repurpose(array $project, string $source, array $channels, array $langs): int
    {
        $ai = Ai::get();
        if ($ai->enabled()) {
            $langNames = array_map(static fn ($l) => $l === 'sk' ? 'Slovak (sk)' : 'English (en)', $langs);
            $prompt = Projects::brief($project)
                . "\n\nSource content:\n<source>\n{$source}\n</source>\n\n"
                . 'Write one post for every combination of these channels: ' . implode(', ', $channels)
                . ' and these languages: ' . implode(', ', $langNames) . '.';
            $data = $ai->json(self::REPURPOSE_SYSTEM, $prompt, self::schema());
        } else {
            $data = (new DemoGenerator())->repurpose($project, $source, $channels, $langs);
        }
        $count = 0;
        foreach ($data['posts'] as $p) {
            self::add((int) $project['id'], $p['channel'], $p['lang'], $p['text'], $p['tip'], 'repurpose');
            $count++;
        }
        return $count;
    }

    /** @return array<string,mixed> */
    private static function schema(): array
    {
        return [
            'type' => 'object',
            'properties' => [
                'posts' => ['type' => 'array', 'items' => [
                    'type' => 'object',
                    'properties' => [
                        'channel' => ['type' => 'string', 'enum' => PlanSchema::CHANNELS],
                        'lang' => ['type' => 'string', 'enum' => Projects::LANGS],
                        'text' => ['type' => 'string'],
                        'tip' => ['type' => 'string'],
                    ],
                    'required' => ['channel', 'lang', 'text', 'tip'],
                    'additionalProperties' => false,
                ]],
            ],
            'required' => ['posts'],
            'additionalProperties' => false,
        ];
    }

    public static function schedule(int $id, ?string $date): void
    {
        $valid = $date !== null && preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) ? $date : null;
        Db::pdo()->prepare('UPDATE posts SET scheduled_for = ? WHERE id = ?')->execute([$valid, $id]);
    }

    public static function toggleEvergreen(int $id): void
    {
        Db::pdo()->prepare('UPDATE posts SET evergreen = 1 - evergreen WHERE id = ?')->execute([$id]);
    }

    /** @param array<string,mixed> $in */
    public static function saveResults(int $id, array $in): void
    {
        $num = static fn (string $k): ?int => isset($in[$k]) && $in[$k] !== '' ? max(0, (int) $in[$k]) : null;
        Db::pdo()->prepare('UPDATE posts SET views = ?, reactions = ?, clicks = ?, result_note = ? WHERE id = ?')
            ->execute([$num('views'), $num('reactions'), $num('clicks'), mb_substr(trim((string) ($in['result_note'] ?? '')), 0, 500), $id]);
    }

    /** Naplánované príspevky v rozsahu dátumov (kalendár). @return list<array<string,mixed>> */
    public static function scheduledBetween(string $from, string $to): array
    {
        $st = Db::pdo()->prepare(
            "SELECT po.*, p.name AS project_name FROM posts po JOIN projects p ON p.id = po.project_id
             WHERE (po.scheduled_for BETWEEN ? AND ?) OR (po.status = 'published' AND date(po.published_at) BETWEEN ? AND ? AND po.scheduled_for IS NULL)
             ORDER BY coalesce(po.scheduled_for, date(po.published_at)), po.id"
        );
        $st->execute([$from, $to, $from, $to]);
        return $st->fetchAll();
    }

    /** Evergreen príspevky zverejnené pred viac ako 30 dňami, ktoré ešte nemajú nový variant. @return list<array<string,mixed>> */
    public static function reshareCandidates(int $limit): array
    {
        $st = Db::pdo()->prepare(
            "SELECT po.*, p.name AS project_name FROM posts po JOIN projects p ON p.id = po.project_id
             WHERE po.evergreen = 1 AND po.status = 'published' AND po.published_at <= datetime('now', '-30 days')
               AND NOT EXISTS (SELECT 1 FROM posts c WHERE c.parent_id = po.id AND c.created_at > datetime('now', '-30 days'))
             ORDER BY coalesce(po.reactions, 0) + coalesce(po.clicks, 0) DESC, po.published_at LIMIT ?"
        );
        $st->execute([$limit]);
        return $st->fetchAll();
    }

    /** Najúspešnejšie príspevky projektu podľa zapísaných výsledkov. @return list<array<string,mixed>> */
    public static function top(int $projectId, int $limit): array
    {
        $st = Db::pdo()->prepare(
            "SELECT * FROM posts WHERE project_id = ? AND status = 'published'
               AND coalesce(views, reactions, clicks) IS NOT NULL
             ORDER BY coalesce(clicks, 0) * 5 + coalesce(reactions, 0) * 2 + coalesce(views, 0) / 100 DESC LIMIT ?"
        );
        $st->execute([$projectId, $limit]);
        return $st->fetchAll();
    }

    /**
     * Varianty jedného príspevku s inými úvodnými háčikmi (A/B test alebo opätovné zdieľanie).
     *
     * @param array<string,mixed> $project
     * @param array<string,mixed> $post
     */
    public static function variants(array $project, array $post, int $count = 3): int
    {
        $ai = Ai::get();
        if ($ai->enabled()) {
            $prompt = Projects::brief($project)
                . "\n\nOriginal {$post['channel']} post:\n<post>\n{$post['text']}\n</post>\n\n"
                . "Write {$count} alternative versions for the same channel ({$post['channel']}) and language ({$post['lang']}). "
                . 'Each must open with a clearly different hook (question, bold claim, story, number from the source, curiosity gap) '
                . 'and may restructure the rest. Keep facts identical. In "tip", name the hook style used.';
            $data = $ai->json(self::REPURPOSE_SYSTEM, $prompt, self::schema());
        } else {
            $data = (new DemoGenerator())->variants($post, $count);
        }
        $n = 0;
        foreach ($data['posts'] as $p) {
            self::add((int) $project['id'], $post['channel'], $post['lang'], $p['text'], $p['tip'], 'variant', (int) $post['id']);
            $n++;
        }
        return $n;
    }
}
