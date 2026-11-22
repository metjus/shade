<?php

declare(strict_types=1);

namespace Shade;

/** JSON schéma výstupu: marketingový plán. Rovnaký tvar vracia AI aj demo. */
final class PlanSchema
{
    public const CHANNELS = ['x', 'linkedin', 'facebook', 'instagram', 'tiktok', 'reddit', 'youtube', 'newsletter', 'blog', 'discord', 'producthunt', 'forums'];

    /** @return array<string,mixed> */
    public static function schema(): array
    {
        $str = ['type' => 'string'];
        $strList = ['type' => 'array', 'items' => $str];
        $obj = static fn (array $props): array => [
            'type' => 'object',
            'properties' => $props,
            'required' => array_keys($props),
            'additionalProperties' => false,
        ];
        $channel = ['type' => 'string', 'enum' => self::CHANNELS];

        return $obj([
            'positioning' => $obj([
                'one_liner' => $str,
                'value_props' => $strList,
                'tone' => $str,
            ]),
            'audiences' => ['type' => 'array', 'items' => $obj([
                'name' => $str,
                'description' => $str,
                'where_to_find' => $strList,
            ])],
            'channels' => ['type' => 'array', 'items' => $obj([
                'channel' => $channel,
                'priority' => ['type' => 'string', 'enum' => ['high', 'medium', 'low']],
                'why' => $str,
                'first_step' => $str,
            ])],
            'plan' => ['type' => 'array', 'items' => $obj([
                'week' => ['type' => 'integer'],
                'focus' => $str,
                'tasks' => $strList,
            ])],
            'content_ideas' => ['type' => 'array', 'items' => $obj([
                'title' => $str,
                'format' => $str,
                'channel' => $channel,
            ])],
            'posts' => ['type' => 'array', 'items' => $obj([
                'channel' => $channel,
                'text' => $str,
            ])],
            'quick_wins' => $strList,
        ]);
    }
}
