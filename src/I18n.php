<?php

declare(strict_types=1);

namespace Shade;

/**
 * Jednoduché i18n: preklady v lang/<kod>.json, výber jazyka cez ?lang=,
 * cookie alebo hlavičku Accept-Language. Nový jazyk = pridať JSON súbor
 * a kód do SUPPORTED.
 */
final class I18n
{
    public const SUPPORTED = ['sk', 'en'];
    public const DEFAULT = 'en';

    /** @var array<string,string> */
    private array $strings;

    private function __construct(public readonly string $locale)
    {
        $path = __DIR__ . '/../lang/' . $locale . '.json';
        $this->strings = json_decode((string) file_get_contents($path), true, 512, JSON_THROW_ON_ERROR);
    }

    public static function fromRequest(): self
    {
        $requested = $_GET['lang'] ?? $_COOKIE['lang'] ?? null;
        if (is_string($requested) && in_array($requested, self::SUPPORTED, true)) {
            if (($_GET['lang'] ?? null) === $requested && !headers_sent()) {
                setcookie('lang', $requested, ['expires' => time() + 31536000, 'path' => '/', 'samesite' => 'Lax']);
            }
            return new self($requested);
        }
        return new self(self::detect($_SERVER['HTTP_ACCEPT_LANGUAGE'] ?? ''));
    }

    public static function for(string $locale): self
    {
        return new self(in_array($locale, self::SUPPORTED, true) ? $locale : self::DEFAULT);
    }

    private static function detect(string $header): string
    {
        foreach (explode(',', strtolower($header)) as $part) {
            $code = substr(trim(explode(';', $part)[0]), 0, 2);
            // Čeština dostane slovenčinu, kým nebude mať vlastný preklad.
            if ($code === 'cs') {
                return 'sk';
            }
            if (in_array($code, self::SUPPORTED, true)) {
                return $code;
            }
        }
        return self::DEFAULT;
    }

    public function t(string $key): string
    {
        return $this->strings[$key] ?? $key;
    }

    /** @return array<string,string> */
    public function all(): array
    {
        return $this->strings;
    }
}
