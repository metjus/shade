<?php
// Herné pravidlá. Musia sedieť s client/src/config.js (klient ich používa na okamžitú odozvu,
// server rozhoduje, čo naozaj platí).

final class Rules
{
    const TILE = 64;                 // strana dlaždice v blokoch
    const MINED = 255;               // hodnota vyťaženého bloku

    // Krompáč: na týchto leveloch sa zväčší plocha úderu (šírka × výška).
    const PICKAXE_TIERS = [
        [0, 1, 1], [5, 2, 1], [10, 2, 2], [20, 3, 3], [35, 4, 4], [50, 5, 5],
    ];
    const UPGRADE_COSTS = ['pickaxe' => [15, 1.22], 'miners' => [40, 1.6]];
    const MAX_LEVELS = ['pickaxe' => 60, 'miners' => 50];
    const EFFECT_PRICES = ['basic' => 0, 'sparks' => 2000, 'frost' => 5000, 'fire' => 10000, 'smoke' => 25000, 'gold' => 60000];

    // Ochrana pred automatmi: najviac toľko kliknutí za sekundu, nazbierať sa dá najviac MAX_CLICK_BURST.
    const MAX_CPS = 12;
    const MAX_CLICK_BURST = 120;
    // Baníci pracujú aj offline, najviac 8 hodín. Za jednu synchronizáciu sa spracuje najviac MINER_HITS_PER_SYNC úderov.
    const OFFLINE_CAP_S = 28800;
    const MINER_HITS_PER_SYNC = 5000;
    const MINER_RADIUS = 16;

    static function blockHp(float $depth01): int { return 2 + (int) floor($depth01 * 10); }
    static function blockReward(float $depth01): int { return 1 + (int) floor($depth01 * 20); }

    static function power(int $pickaxe): int { return 1 + $pickaxe; }

    /** [w, h] plochy úderu pre level krompáča. */
    static function tier(int $pickaxe): array
    {
        $t = self::PICKAXE_TIERS[0];
        foreach (self::PICKAXE_TIERS as $x) if ($pickaxe >= $x[0]) $t = $x;
        return [$t[1], $t[2]];
    }

    /** Posuny blokov okolo kliknutého bloku (rovnako ako Economy.footprint v klientovi). */
    static function footprint(int $pickaxe): array
    {
        [$w, $h] = self::tier($pickaxe);
        $u0 = -intdiv($w - 1, 2);
        $v0 = -intdiv($h - 1, 2);
        $out = [];
        for ($dv = 0; $dv < $h; $dv++) for ($du = 0; $du < $w; $du++) $out[] = [$u0 + $du, $v0 + $dv];
        return $out;
    }

    static function cost(string $id, int $level): int
    {
        [$base, $mult] = self::UPGRADE_COSTS[$id];
        return (int) round($base * pow($mult, $level));
    }

    static function layerCount(int $edge): int { return intdiv($edge, 2); }
    static function size(int $edge, int $layer): int { return $edge - 2 * $layer; }
    static function depth01(int $edge, int $layer): float
    {
        $n = self::layerCount($edge);
        return $n <= 1 ? 1.0 : $layer / ($n - 1);
    }
}
