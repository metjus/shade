<?php
// Skopíruj ako config.php a doplň údaje k databáze z administrácie Hostcreators.
// config.php sa nenahráva do gitu.
return [
    'db' => [
        'dsn' => 'mysql:host=localhost;dbname=shade;charset=utf8mb4',
        'user' => 'shade',
        'pass' => 'ZMEN_MA',
    ],
    // Hrana kocky pri prvom spustení (musí byť párna). 2048 ≈ 8,6 mld. blokov.
    'edge' => 2048,
    // Priečinok pre cache (prehľad kocky, rebríček). Musí byť zapisovateľný.
    'cache_dir' => __DIR__ . '/../cache',
    // Povolené domény pre volania z prehliadača (CORS). Prázdne = len rovnaká doména.
    'allowed_origins' => [],
];
