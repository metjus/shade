<?php
// Shade API. Jediný verejný PHP súbor: patrí do webového priečinka vedľa index.html hry.
// Všetko ostatné (src/, cache/) má byť mimo webového priečinka alebo zamknuté cez .htaccess.
//
// Volania: POST api.php?a=<akcia> s JSON telom.
//   hello  {token?}                      -> založí/nájde hráča, vráti token, hráča, kocku a pravidlá
//   sync   {token, layer, clicks, view, bid, eid, ov, lb?} -> spracuje ťaženie, vráti zmeny
//   buy    {token, item}                 -> pickaxe | miners | effect:<id>
//   name   {token, name}                 -> zmena mena

$src = is_dir(__DIR__ . '/../src') ? __DIR__ . '/../src' : __DIR__ . '/shade-server/src';
require $src . '/bootstrap.php';

try {
    shade_cors();
    if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') { http_response_code(204); exit; }
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') throw new ApiError('post_only', 405);
    $in = shade_input();
    $db = shade_db();
    $action = $_GET['a'] ?? '';

    if ($action === 'hello') {
        Cube::ensure($db);
        $p = Player::auth($db, $in['token'] ?? null, true);
        shade_json([
            'token' => $p['token'],
            'player' => Player::view($p),
            'cube' => Cube::view(Cube::read($db)),
            'rules' => [
                'tile' => Rules::TILE, 'tiers' => Rules::PICKAXE_TIERS, 'costs' => Rules::UPGRADE_COSTS,
                'max' => Rules::MAX_LEVELS, 'effects' => Rules::EFFECT_PRICES, 'cps' => Rules::MAX_CPS,
            ],
        ]);
    } elseif ($action === 'sync') {
        $p = Player::auth($db, $in['token'] ?? null, false);
        shade_json(Cube::sync($db, $p, $in));
    } elseif ($action === 'buy') {
        $p = Player::auth($db, $in['token'] ?? null, false);
        $p = Player::buy($db, $p, (string) ($in['item'] ?? ''));
        shade_json(['player' => Player::view($p)]);
    } elseif ($action === 'name') {
        $p = Player::auth($db, $in['token'] ?? null, false);
        $p = Player::rename($db, $p, $in['name'] ?? null);
        shade_json(['player' => Player::view($p)]);
    } else {
        throw new ApiError('unknown_action', 404);
    }
} catch (ApiError $e) {
    shade_json(['error' => $e->getMessage()], $e->status);
} catch (Throwable $e) {
    error_log('shade: ' . $e);
    shade_json(['error' => 'server_error'], 500);
}
