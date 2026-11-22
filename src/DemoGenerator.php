<?php

declare(strict_types=1);

namespace Shade;

/**
 * Šablónový generátor bez AI. Beží, keď nie je nastavený API kľúč,
 * aby sa dal prototyp vyskúšať hneď a zadarmo. Výstup má rovnaký tvar ako AI.
 */
final class DemoGenerator
{
    /** Kanály podľa typu produktu, zoradené podľa priority. */
    private const CHANNELS_BY_TYPE = [
        'website'  => ['blog', 'reddit', 'x', 'newsletter'],
        'software' => ['producthunt', 'reddit', 'x', 'linkedin'],
        'game'     => ['tiktok', 'reddit', 'discord', 'youtube'],
        'eshop'    => ['instagram', 'facebook', 'tiktok', 'newsletter'],
        'service'  => ['linkedin', 'facebook', 'blog', 'forums'],
        'other'    => ['facebook', 'instagram', 'reddit', 'newsletter'],
    ];

    /**
     * @param array<string,mixed> $p
     * @return array<string,mixed>
     */
    public function plan(array $p, string $lang): array
    {
        $sk = $lang === 'sk';
        $n = $p['name'];
        $link = $p['url'] !== '' ? $p['url'] : ($sk ? '[odkaz]' : '[link]');
        $who = $p['audience'] !== '' ? $p['audience'] : ($sk ? 'ľudia, ktorým váš produkt rieši problém' : 'people whose problem your product solves');
        $channels = self::CHANNELS_BY_TYPE[$p['type']];
        $firstSentence = trim((string) preg_split('/(?<=[.!?])\s/u', $p['description'])[0]);

        $why = $sk
            ? ['Najväčší dosah pre tento typ produktu zadarmo.', 'Komunita, ktorá aktívne hľadá novinky.', 'Pravidelný kontakt a budovanie značky.', 'Doplnkový kanál na neskôr.']
            : ['Biggest free reach for this kind of product.', 'A community actively looking for new things.', 'Regular contact and brand building.', 'A secondary channel for later.'];
        $prio = ['high', 'high', 'medium', 'low'];

        $out = [
            'positioning' => [
                'one_liner' => $sk ? "{$n}: {$firstSentence}" : "{$n}: {$firstSentence}",
                'value_props' => $sk
                    ? ['Rieši konkrétny problém jednoducho', 'Vytvorené s dôrazom na používateľov', 'Ľahko sa dá vyskúšať hneď']
                    : ['Solves a concrete problem simply', 'Built with users in mind', 'Easy to try right away'],
                'tone' => $sk ? 'Priateľský, úprimný, bez korporátneho žargónu.' : 'Friendly, honest, no corporate jargon.',
            ],
            'audiences' => [[
                'name' => $sk ? 'Hlavná skupina' : 'Primary audience',
                'description' => $who,
                'where_to_find' => array_slice($channels, 0, 3),
            ]],
            'channels' => [],
            'plan' => $sk ? [
                ['week' => 1, 'focus' => 'Základy', 'tasks' => ['Napíšte jednu vetu, čo produkt robí a pre koho', 'Založte profily na 2 hlavných kanáloch', 'Pripravte 3 snímky obrazovky alebo krátke video']],
                ['week' => 2, 'focus' => 'Prvé publikovanie', 'tasks' => ['Zverejnite úvodný príspevok na hlavnom kanáli', 'Odpovedzte na každý komentár do 24 hodín', 'Požiadajte 5 známych o úprimnú spätnú väzbu']],
                ['week' => 3, 'focus' => 'Komunita', 'tasks' => ['Zapojte sa do 3 diskusií, kde sa rieši váš problém (bez reklamy)', 'Zdieľajte príbeh, prečo ste produkt vytvorili', 'Pridajte na web jednoduchý zber e-mailov']],
                ['week' => 4, 'focus' => 'Vyhodnotenie', 'tasks' => ['Pozrite, ktorý kanál priniesol najviac návštev', 'Zopakujte formát, ktorý fungoval najlepšie', 'Naplánujte obsah na ďalší mesiac']],
            ] : [
                ['week' => 1, 'focus' => 'Foundations', 'tasks' => ['Write one sentence on what the product does and for whom', 'Set up profiles on the 2 main channels', 'Prepare 3 screenshots or a short video']],
                ['week' => 2, 'focus' => 'First posts', 'tasks' => ['Publish an intro post on the main channel', 'Reply to every comment within 24 hours', 'Ask 5 people you know for honest feedback']],
                ['week' => 3, 'focus' => 'Community', 'tasks' => ['Join 3 discussions where your problem comes up (no ads)', 'Share the story of why you built it', 'Add a simple email signup to the website']],
                ['week' => 4, 'focus' => 'Review', 'tasks' => ['Check which channel brought the most visits', 'Repeat the format that worked best', 'Plan next month\'s content']],
            ],
            'content_ideas' => [],
            'posts' => [],
            'quick_wins' => $sk
                ? ['Pridajte odkaz na ' . $n . ' do e-mailového podpisu a bio na sociálnych sieťach', 'Zaregistrujte sa do Google Search Console', 'Pošlite odkaz 10 ľuďom, ktorým by mohol pomôcť']
                : ['Add a link to ' . $n . ' in your email signature and social bios', 'Register with Google Search Console', 'Send the link to 10 people it could help'],
        ];

        foreach ($channels as $i => $c) {
            $out['channels'][] = [
                'channel' => $c,
                'priority' => $prio[$i],
                'why' => $why[$i],
                'first_step' => $sk ? 'Pozrite si 10 úspešných príspevkov na tomto kanáli a zapíšte, čo majú spoločné.' : 'Study 10 successful posts on this channel and note what they have in common.',
            ];
        }

        $ideas = $sk
            ? [['Príbeh vzniku ' . $n, 'príbeh'], ['3 chyby, ktorým sa ' . $n . ' vyhne', 'zoznam'], ['Ako to funguje za 60 sekúnd', 'krátke video'], ['Zákulisie vývoja', 'fotky / video'], ['Otázky a odpovede od používateľov', 'príspevok'], ['Porovnanie pred a po', 'obrázok'], ['Tip týždňa', 'séria'], ['Míľnik a poďakovanie komunite', 'príspevok']]
            : [['Why I built ' . $n, 'story'], ['3 mistakes ' . $n . ' helps you avoid', 'list'], ['How it works in 60 seconds', 'short video'], ['Behind the scenes', 'photos / video'], ['Questions from users, answered', 'post'], ['Before and after', 'image'], ['Tip of the week', 'series'], ['Milestone and thank-you to the community', 'post']];
        foreach ($ideas as $i => [$title, $format]) {
            $out['content_ideas'][] = ['title' => $title, 'format' => $format, 'channel' => $channels[$i % count($channels)]];
        }

        foreach (array_slice($channels, 0, 3) as $c) {
            $out['posts'][] = ['channel' => $c, 'text' => $sk
                ? "Ahojte! Posledné mesiace pracujem na projekte {$n}. {$firstSentence}\n\nJe pre: {$who}.\n\nPoteší ma akákoľvek spätnú väzbu, aj kritickú: {$link}"
                : "Hey everyone! For the past few months I've been working on {$n}. {$firstSentence}\n\nI made it for: {$who}.\n\nI'd love any feedback, even critical: {$link}"];
        }

        return $out;
    }

    /**
     * @param array<string,mixed> $p
     * @param list<string> $channels
     * @param list<string> $langs
     * @return array{posts: list<array{channel:string, lang:string, text:string, tip:string}>}
     */
    public function repurpose(array $p, string $source, array $channels, array $langs): array
    {
        $short = mb_substr(trim(preg_replace('/\s+/u', ' ', $source)), 0, 220);
        $posts = [];
        foreach ($langs as $lang) {
            $sk = $lang === 'sk';
            foreach ($channels as $c) {
                $text = match ($c) {
                    'x' => $short . ($p['url'] !== '' ? "\n\n{$p['url']}" : ''),
                    'reddit' => ($sk ? "Novinka z vývoja projektu {$p['name']}" : "Dev update on {$p['name']}") . "\n\n{$source}\n\n" . ($sk ? 'Čo si o tom myslíte?' : 'What do you think?'),
                    'newsletter', 'blog' => ($sk ? "Ahojte,\n\n" : "Hi,\n\n") . $source,
                    default => "{$short}\n\n#" . preg_replace('/[^\pL\pN]/u', '', $p['name']),
                };
                $posts[] = [
                    'channel' => $c,
                    'lang' => $lang,
                    'text' => $text,
                    'tip' => $sk ? 'Ukážkový režim: text je zo šablóny.' : 'Demo mode: this text is from a template.',
                ];
            }
        }
        return ['posts' => $posts];
    }

    /**
     * @param array<string,mixed> $post
     * @return array{posts: list<array{channel:string, lang:string, text:string, tip:string}>}
     */
    public function variants(array $post, int $count): array
    {
        $sk = $post['lang'] === 'sk';
        $hooks = $sk
            ? ['Otázka: ', 'Krátky príbeh: ', 'Odvážne tvrdenie: ']
            : ['Question: ', 'Short story: ', 'Bold claim: '];
        $out = [];
        for ($i = 0; $i < $count; $i++) {
            $out[] = [
                'channel' => $post['channel'],
                'lang' => $post['lang'],
                'text' => $hooks[$i % 3] . $post['text'],
                'tip' => $sk ? 'Ukážkový režim: variant zo šablóny.' : 'Demo mode: template variant.',
            ];
        }
        return ['posts' => $out];
    }
}
