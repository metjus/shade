<?php
declare(strict_types=1);

require __DIR__ . '/Rules.php';
require __DIR__ . '/Player.php';
require __DIR__ . '/Cube.php';

final class ApiError extends Exception
{
    public $status;
    function __construct(string $code, int $status = 400)
    {
        parent::__construct($code);
        $this->status = $status;
    }
}

function shade_config(): array
{
    static $cfg = null;
    if ($cfg === null) {
        $file = __DIR__ . '/config.php';
        if (!is_file($file)) throw new ApiError('not_configured', 500);
        $cfg = require $file;
    }
    return $cfg;
}

function shade_db(): PDO
{
    static $pdo = null;
    if ($pdo === null) {
        $c = shade_config()['db'];
        $pdo = new PDO($c['dsn'], $c['user'], $c['pass'], [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
    }
    return $pdo;
}

/** Jednoduchá cache v súbore (prehľad kocky, rebríček, počet hráčov online). */
function shade_cache(string $key, int $ttl, callable $make)
{
    $dir = shade_config()['cache_dir'] ?? null;
    if (!$dir || !is_dir($dir) || !is_writable($dir)) return $make();
    $file = $dir . '/' . preg_replace('/[^a-z0-9_-]/i', '_', $key) . '.json';
    $st = @stat($file);
    if ($st && time() - $st['mtime'] < $ttl) {
        $raw = @file_get_contents($file);
        if ($raw !== false) {
            $val = json_decode($raw, true);
            if ($val !== null) return $val;
        }
    }
    $val = $make();
    $tmp = $file . '.' . getmypid() . '.tmp';
    if (@file_put_contents($tmp, json_encode($val)) !== false) @rename($tmp, $file);
    return $val;
}

function shade_cors(): void
{
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    $allowed = shade_config()['allowed_origins'] ?? [];
    if ($origin !== '' && in_array($origin, $allowed, true)) {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Vary: Origin');
        header('Access-Control-Allow-Methods: POST, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type');
    }
}

function shade_json($data, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}

function shade_input(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || strlen($raw) > 65536) throw new ApiError('bad_request');
    if ($raw === '') return [];
    $data = json_decode($raw, true);
    if (!is_array($data)) throw new ApiError('bad_request');
    return $data;
}
