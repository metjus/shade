<?php

declare(strict_types=1);

namespace Shade;

/** Vstup od používateľa: čo propaguje, pre koho a s akým cieľom. */
final class Brief
{
    public const TYPES = ['website', 'software', 'game', 'eshop', 'service', 'other'];
    public const GOALS = ['awareness', 'users', 'sales', 'community'];
    public const BUDGETS = ['zero', 'small', 'medium'];

    public function __construct(
        public readonly string $name,
        public readonly string $type,
        public readonly string $url,
        public readonly string $description,
        public readonly string $audience,
        public readonly string $goal,
        public readonly string $budget,
        public readonly string $outputLang,
    ) {
    }

    /**
     * @param array<string,mixed> $in
     * @return array{0: ?Brief, 1: list<string>} brief alebo zoznam chybných polí
     */
    public static function fromArray(array $in): array
    {
        $s = static fn (string $k, int $max): string => mb_substr(trim((string) ($in[$k] ?? '')), 0, $max);

        $name = $s('name', 120);
        $description = $s('description', 2000);
        $url = $s('url', 300);
        $errors = [];
        if ($name === '') {
            $errors[] = 'name';
        }
        if (mb_strlen($description) < 20) {
            $errors[] = 'description';
        }
        if ($url !== '' && !filter_var($url, FILTER_VALIDATE_URL)) {
            $errors[] = 'url';
        }
        if ($errors) {
            return [null, $errors];
        }

        $pick = static fn (string $k, array $allowed): string
            => in_array($in[$k] ?? null, $allowed, true) ? $in[$k] : $allowed[0];

        return [new self(
            $name,
            $pick('type', self::TYPES),
            $url,
            $description,
            $s('audience', 500),
            $pick('goal', self::GOALS),
            $pick('budget', self::BUDGETS),
            $pick('output_lang', I18n::SUPPORTED),
        ), []];
    }
}
