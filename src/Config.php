<?php

declare(strict_types=1);

namespace Shade;

final class Config
{
    /** @var array<string,mixed>|null */
    private static ?array $config = null;

    /** @return array<string,mixed> */
    public static function get(): array
    {
        if (self::$config === null) {
            $file = __DIR__ . '/../config.php';
            self::$config = is_file($file) ? require $file : require __DIR__ . '/../config.example.php';
        }
        return self::$config;
    }
}
