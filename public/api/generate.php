<?php

declare(strict_types=1);

use Anthropic\Client;
use Shade\Brief;
use Shade\ClaudeGenerator;
use Shade\DemoGenerator;
use Shade\GenerationException;

require __DIR__ . '/../../vendor/autoload.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

$respond = static function (int $status, array $body): never {
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_UNICODE);
    exit;
};

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    $respond(405, ['error' => 'method_not_allowed']);
}

$input = json_decode((string) file_get_contents('php://input'), true);
if (!is_array($input)) {
    $respond(400, ['error' => 'bad_request']);
}

[$brief, $errors] = Brief::fromArray($input);
if ($brief === null) {
    $respond(422, ['error' => 'validation', 'fields' => $errors]);
}

$configFile = __DIR__ . '/../../config.php';
$config = is_file($configFile) ? require $configFile : require __DIR__ . '/../../config.example.php';

if (($config['anthropic_api_key'] ?? '') === '') {
    $respond(200, ['mode' => 'demo', 'plan' => (new DemoGenerator())->generate($brief)]);
}

set_time_limit(300);
try {
    $client = new Client(apiKey: $config['anthropic_api_key']);
    $generator = new ClaudeGenerator($client, $config['model'], $config['effort']);
    $respond(200, ['mode' => 'ai', 'plan' => $generator->generate($brief)]);
} catch (GenerationException $e) {
    $respond(502, ['error' => $e->getMessage()]);
} catch (\Throwable $e) {
    error_log('[shade] ' . $e::class . ': ' . $e->getMessage());
    $respond(502, ['error' => 'upstream']);
}
