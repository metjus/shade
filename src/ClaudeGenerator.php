<?php

declare(strict_types=1);

namespace Shade;

use Anthropic\Client;

/** Generuje plán cez Claude API (štruktúrovaný JSON výstup). */
final class ClaudeGenerator
{
    private const SYSTEM = <<<'TXT'
        You are a pragmatic marketing strategist for solo makers, indie developers and small businesses
        that have never done marketing before. They have little time and little or no budget.

        Rules:
        - Be concrete and actionable. Every task should be doable by one person in under 2 hours.
        - Prefer free, organic channels; only suggest paid ads if the budget allows it.
        - Pick 3-5 channels that genuinely fit this product and audience, ordered by priority. Do not list everything.
        - The 30-day plan has exactly 4 weeks with 3-5 tasks each.
        - Give 8-10 content ideas and one ready-to-publish post for each of the top 3 channels.
          Posts must respect the channel's norms (length, hashtags, Reddit's anti-self-promotion culture, etc.).
        - Give 3-5 quick wins that can be done today.
        - Never invent facts, numbers, reviews or features that are not in the brief. If something is unknown, keep it generic.
        - Write all human-readable text in the requested output language.
        TXT;

    public function __construct(
        private readonly Client $client,
        private readonly string $model,
        private readonly string $effort,
    ) {
    }

    /** @return array<string,mixed> */
    public function generate(Brief $b): array
    {
        $langName = ['sk' => 'Slovak', 'en' => 'English'][$b->outputLang] ?? 'English';
        $brief = implode("\n", [
            "Product name: {$b->name}",
            "Product type: {$b->type}",
            'Website: ' . ($b->url !== '' ? $b->url : 'none yet'),
            "Description: {$b->description}",
            'Target audience (as described by the owner): ' . ($b->audience !== '' ? $b->audience : 'not specified'),
            "Main goal for the next 30 days: {$b->goal}",
            "Marketing budget: {$b->budget} (zero = no money, small = up to ~100 EUR/month, medium = up to ~1000 EUR/month)",
            "Output language: {$langName}",
        ]);

        $message = $this->client->beta->messages->create(
            model: $this->model,
            maxTokens: 16000,
            system: self::SYSTEM,
            messages: [['role' => 'user', 'content' => "Create a 30-day marketing plan for this product.\n\n" . $brief]],
            outputConfig: [
                'effort' => $this->effort,
                'format' => ['type' => 'json_schema', 'schema' => PlanSchema::schema()],
            ],
            // Ak model odmietne požiadavku, server ju skúsi na záložnom modeli.
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
