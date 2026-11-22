<?php

declare(strict_types=1);

namespace Shade;

/** Profily projektov: čo propaguješ, pre koho a akým tónom. AI ich dostáva pri každej požiadavke. */
final class Projects
{
    public const TYPES = ['website', 'software', 'game', 'eshop', 'service', 'other'];
    public const GOALS = ['awareness', 'users', 'sales', 'community'];
    public const BUDGETS = ['zero', 'small', 'medium'];
    public const LANGS = ['sk', 'en'];

    /** @return list<array<string,mixed>> */
    public static function all(): array
    {
        return Db::pdo()->query('SELECT * FROM projects ORDER BY updated_at DESC')->fetchAll();
    }

    /** @return array<string,mixed>|null */
    public static function find(int $id): ?array
    {
        $st = Db::pdo()->prepare('SELECT * FROM projects WHERE id = ?');
        $st->execute([$id]);
        return $st->fetch() ?: null;
    }

    /**
     * @param array<string,mixed> $in
     * @return array{0: array<string,string>, 1: list<string>} očistené dáta a chybné polia
     */
    public static function validate(array $in): array
    {
        $s = static fn (string $k, int $max): string => mb_substr(trim((string) ($in[$k] ?? '')), 0, $max);
        $pick = static fn (string $k, array $allowed): string
            => in_array($in[$k] ?? null, $allowed, true) ? $in[$k] : $allowed[0];

        $langs = array_values(array_intersect(self::LANGS, (array) ($in['languages'] ?? [])));
        $data = [
            'name' => $s('name', 120),
            'type' => $pick('type', self::TYPES),
            'url' => $s('url', 300),
            'description' => $s('description', 3000),
            'audience' => $s('audience', 600),
            'tone' => $s('tone', 300),
            'goal' => $pick('goal', self::GOALS),
            'budget' => $pick('budget', self::BUDGETS),
            'languages' => implode(',', $langs ?: ['sk']),
            'voice_samples' => $s('voice_samples', 4000),
        ];
        $errors = [];
        if ($data['name'] === '') {
            $errors[] = 'name';
        }
        if (mb_strlen($data['description']) < 20) {
            $errors[] = 'description';
        }
        if ($data['url'] !== '' && (!filter_var($data['url'], FILTER_VALIDATE_URL) || !preg_match('#^https?://#i', $data['url']))) {
            $errors[] = 'url';
        }
        return [$data, $errors];
    }

    /** @param array<string,string> $data */
    public static function save(?int $id, array $data): int
    {
        $pdo = Db::pdo();
        $cols = array_keys($data);
        if ($id === null) {
            $st = $pdo->prepare(sprintf(
                'INSERT INTO projects (%s) VALUES (%s)',
                implode(',', $cols),
                implode(',', array_map(static fn ($c) => ':' . $c, $cols)),
            ));
            $st->execute($data);
            return (int) $pdo->lastInsertId();
        }
        $set = implode(',', array_map(static fn ($c) => "$c = :$c", $cols));
        $st = $pdo->prepare("UPDATE projects SET $set, updated_at = CURRENT_TIMESTAMP WHERE id = :id");
        $st->execute($data + ['id' => $id]);
        return $id;
    }

    public static function delete(int $id): void
    {
        Db::pdo()->prepare('DELETE FROM projects WHERE id = ?')->execute([$id]);
    }

    /** Profil projektu ako text pre AI. @param array<string,mixed> $p */
    public static function brief(array $p): string
    {
        return implode("\n", [
            "Product name: {$p['name']}",
            "Product type: {$p['type']}",
            'Website: ' . ($p['url'] !== '' ? $p['url'] : 'none yet'),
            "Description: {$p['description']}",
            'Target audience: ' . ($p['audience'] !== '' ? $p['audience'] : 'not specified'),
            'Brand tone of voice: ' . ($p['tone'] !== '' ? $p['tone'] : 'not specified, use friendly and honest'),
            "Main goal: {$p['goal']}",
            "Marketing budget: {$p['budget']} (zero = no money, small = up to ~100 EUR/month, medium = up to ~1000 EUR/month)",
        ]) . ($p['voice_samples'] !== ''
            ? "\n\nExamples of the owner's own past posts. Match this voice, rhythm and vocabulary:\n<voice_samples>\n{$p['voice_samples']}\n</voice_samples>"
            : '');
    }
}
