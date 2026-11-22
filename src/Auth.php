<?php

declare(strict_types=1);

namespace Shade;

/**
 * Jeden používateľ (ty). Heslo je uložené ako hash v data/auth.json,
 * nastavuje sa príkazom `php bin/set-password.php`.
 */
final class Auth
{
    private const FILE = __DIR__ . '/../data/auth.json';

    public static function start(): void
    {
        if (session_status() !== PHP_SESSION_ACTIVE) {
            session_set_cookie_params(['httponly' => true, 'samesite' => 'Lax', 'secure' => !empty($_SERVER['HTTPS'])]);
            session_name('shade');
            session_start();
        }
    }

    public static function isConfigured(): bool
    {
        return is_file(self::FILE);
    }

    public static function check(): bool
    {
        return ($_SESSION['auth'] ?? false) === true;
    }

    public static function login(string $password): bool
    {
        if (!self::isConfigured()) {
            return false;
        }
        $hash = json_decode((string) file_get_contents(self::FILE), true)['hash'] ?? '';
        if (!is_string($hash) || !password_verify($password, $hash)) {
            usleep(400_000); // spomalí hádanie hesla
            return false;
        }
        session_regenerate_id(true);
        $_SESSION['auth'] = true;
        return true;
    }

    public static function logout(): void
    {
        $_SESSION = [];
        session_destroy();
    }

    public static function setPassword(string $password): void
    {
        if (!is_dir(dirname(self::FILE))) {
            mkdir(dirname(self::FILE), 0770, true);
        }
        file_put_contents(self::FILE, json_encode(['hash' => password_hash($password, PASSWORD_DEFAULT)]));
        chmod(self::FILE, 0600);
    }

    public static function csrfToken(): string
    {
        return $_SESSION['csrf'] ??= bin2hex(random_bytes(16));
    }

    public static function verifyCsrf(): bool
    {
        $sent = $_POST['_csrf'] ?? '';
        return is_string($sent) && hash_equals($_SESSION['csrf'] ?? '', $sent);
    }
}
