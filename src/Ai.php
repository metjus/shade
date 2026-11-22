<?php

declare(strict_types=1);

namespace Shade;

use Anthropic\Client;

/**
 * Tenký obal nad Claude API: pošle zadanie a vráti JSON podľa schémy.
 * Bez API kľúča je `enabled()` false a volajúci použije demo výstup.
 */
final class Ai
{
    private static ?self $instance = null;

    private function __construct(
        private readonly ?Client $client,
        private readonly string $model,
        private readonly string $effort,
    ) {
    }

    public static function get(): self
    {
        if (self::$instance === null) {
            $config = Config::get();
            $key = (string) ($config['anthropic_api_key'] ?? '');
            self::$instance = new self(
                $key !== '' ? new Client(apiKey: $key) : null,
                (string) $config['model'],
                (string) $config['effort'],
            );
        }
        return self::$instance;
    }

    public function enabled(): bool
    {
        return $this->client !== null;
    }

    /**
     * @param array<string,mixed> $schema
     * @return array<string,mixed>
     */
    public function json(string $system, string $prompt, array $schema): array
    {
        if ($this->client === null) {
            throw new GenerationException('no_api_key');
        }
        set_time_limit(300);
        $message = $this->client->beta->messages->create(
            model: $this->model,
            maxTokens: 16000,
            system: $system,
            messages: [['role' => 'user', 'content' => $prompt]],
            outputConfig: [
                'effort' => $this->effort,
                'format' => ['type' => 'json_schema', 'schema' => $schema],
            ],
            // Ak model požiadavku odmietne, server ju skúsi na záložnom modeli.
            fallbacks: 'default',
            betas: ['server-side-fallback-2026-07-01'],
        );

        if ($message->stopReason === 'refusal') {
            throw new GenerationException('refused');
        }
        if ($message->stopReason === 'max_tokens') {
            throw new GenerationException('truncated');
        }
        foreach ($message->content as $block) {
            if ($block->type === 'text') {
                $data = json_decode($block->text, true);
                if (is_array($data)) {
                    return $data;
                }
            }
        }
        throw new GenerationException('invalid_output');
    }
}
