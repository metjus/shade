<?php
// Rýchly test API proti bežiacemu serveru: php tests/smoke.php http://127.0.0.1:8099/api.php
// Pozor: test predpokladá prázdnu databázu s malou kockou (edge 8) a cache vypnutú alebo prázdnu.
$url = $argv[1] ?? 'http://127.0.0.1:8099/api.php';
$fail = 0;

function call(string $url, string $a, array $body): array
{
    $ctx = stream_context_create(['http' => [
        'method' => 'POST', 'header' => "Content-Type: application/json\r\n",
        'content' => json_encode($body), 'ignore_errors' => true,
    ]]);
    $raw = file_get_contents("$url?a=$a", false, $ctx);
    $res = json_decode($raw, true);
    if (!is_array($res)) { echo "Neplatná odpoveď pre $a: $raw\n"; exit(1); }
    return $res;
}
function check(bool $ok, string $what): void
{
    global $fail;
    echo ($ok ? 'OK   ' : 'CHYBA') . " $what\n";
    if (!$ok) $fail++;
}

$h = call($url, 'hello', []);
check(isset($h['token']) && strlen($h['token']) === 64, 'hello vytvorí hosťa');
$t = $h['token'];
$edge = $h['cube']['edge'];
$h2 = call($url, 'hello', ['token' => $t]);
check($h2['player']['id'] === $h['player']['id'], 'hello s tokenom vráti toho istého hráča');
check((call($url, 'sync', ['token' => str_repeat('a', 64)])['error'] ?? '') === 'unknown_token', 'neznámy token je odmietnutý');

$s = call($url, 'sync', ['token' => $t, 'layer' => 0, 'clicks' => [], 'view' => [[4, 0, 0, -1]], 'bid' => 0, 'eid' => 0]);
check($s['tiles'] === [], 'nedotknutá dlaždica sa neposiela');
$layer0 = $s['cube']['layer'];

// dva údery do toho istého bloku: povrch má 2 životy, sila 1
sleep(1);
$s = call($url, 'sync', ['token' => $t, 'layer' => $layer0, 'clicks' => [[4, 1, 1], [4, 1, 1]], 'view' => [[4, 0, 0, -1]], 'bid' => $s['bid'], 'eid' => $s['eid']]);
check($s['gained']['kills'] === 1 && $s['player']['dust'] === 1, 'dva údery vyťažia blok a dajú 1 prach');
check(count($s['tiles']) === 1 && ord(base64_decode($s['tiles'][0][4])[1 * 64 + 1]) === 255, 'dlaždica obsahuje vyťažený blok');
$ver = $s['tiles'][0][3];
$s = call($url, 'sync', ['token' => $t, 'layer' => $layer0, 'clicks' => [], 'view' => [[4, 0, 0, $ver]], 'bid' => $s['bid'], 'eid' => $s['eid']]);
check($s['tiles'] === [], 'nezmenená dlaždica sa znova neposiela');

// druhý hráč vidí efekt rozbitia
$o = call($url, 'hello', [])['token'];
$so = call($url, 'sync', ['token' => $o, 'layer' => $layer0, 'clicks' => [], 'view' => [[4, 0, 0, -1]], 'bid' => 0, 'eid' => 0]);
sleep(1);
call($url, 'sync', ['token' => $t, 'layer' => $layer0, 'clicks' => [[4, 2, 2], [4, 2, 2]], 'view' => [], 'bid' => 0, 'eid' => 0]);
$so = call($url, 'sync', ['token' => $o, 'layer' => $layer0, 'clicks' => [], 'view' => [[4, 0, 0, -1]], 'bid' => $so['bid'], 'eid' => $so['eid']]);
check(count($so['breaks']) === 1 && $so['breaks'][0][1] === 2 && $so['breaks'][0][3] === 'basic', 'druhý hráč dostane rozbitie s efektom');
check(count($so['tiles']) === 1, 'druhý hráč dostane zmenenú dlaždicu');

// nákup
check((call($url, 'buy', ['token' => $t, 'item' => 'miners'])['error'] ?? '') === 'not_enough_dust', 'bez prachu sa nedá kúpiť');
check((call($url, 'buy', ['token' => $t, 'item' => 'effect:basic'])['player']['effect'] ?? '') === 'basic', 'vlastný efekt sa dá nasadiť');
check((call($url, 'name', ['token' => $t, 'name' => 'Matúš'])['player']['name'] ?? '') === 'Matúš', 'zmena mena');
check((call($url, 'name', ['token' => $o, 'name' => 'Matúš'])['error'] ?? '') === 'name_taken', 'obsadené meno');
check((call($url, 'name', ['token' => $o, 'name' => '<b>'])['error'] ?? '') === 'bad_name', 'neplatné meno');

// limit kliknutí: hneď po synchronizácii prejdú najviac 3 kliknutia
$s = call($url, 'sync', ['token' => $t, 'layer' => $layer0, 'clicks' => array_fill(0, 50, [4, 5, 5]), 'view' => [], 'bid' => 0, 'eid' => 0]);
check($s['gained']['clicks'] <= 4, 'limit kliknutí za sekundu (' . $s['gained']['clicks'] . ')');

// vyťaž celú vrstvu, pričom kliknutia do starej vrstvy sa ignorujú
$size = $edge - 2 * $layer0;
$all = [];
for ($f = 0; $f < 6; $f++) for ($u = 0; $u < $size; $u++) for ($v = 0; $v < $size; $v++) { $all[] = [$f, $u, $v]; $all[] = [$f, $u, $v]; }
$layerBefore = $layer0;
foreach (array_chunk($all, 100) as $chunk) {
    $db = new PDO('mysql:unix_socket=/tmp/sdb/sock;dbname=shade', 'shade', 'test');
    $db->exec('UPDATE players SET last_sync = 0');   // obíde limit kliknutí v teste
    $s = call($url, 'sync', ['token' => $t, 'layer' => $layerBefore, 'clicks' => $chunk, 'view' => [], 'bid' => 0, 'eid' => 0]);
}
check($s['cube']['layer'] === $layerBefore + 1, 'po vyťažení vrstvy začne ďalšia (' . $s['cube']['layer'] . ')');
check($s['cube']['mined'] === 0 && $s['cube']['total'] === 6 * ($size - 2) ** 2, 'nová vrstva má správny počet blokov');
$ev = call($url, 'sync', ['token' => $o, 'layer' => 0, 'clicks' => [], 'view' => [], 'bid' => 0, 'eid' => 0]);
check((bool) array_filter($ev['events'], function ($e) { return $e[0] === 'layer'; }), 'udalosť o dokončenej vrstve');
check(isset($ev['overview']['T']), 'prehľad kocky');

// baníci pracujú aj offline
$db->exec("UPDATE players SET dust = 1000000 WHERE token = '$t'");
for ($i = 0; $i < 3; $i++) call($url, 'buy', ['token' => $t, 'item' => 'miners']);
$db->exec("UPDATE players SET last_sync = UNIX_TIMESTAMP() - 10 WHERE token = '$t'");
$s = call($url, 'sync', ['token' => $t, 'layer' => $s['cube']['layer'], 'clicks' => [], 'view' => [], 'bid' => 0, 'eid' => 0]);
check($s['player']['levels']['miners'] === 3 && $s['gained']['kills'] >= 1, 'baníci za 10 s (30 úderov) vyťažili ' . $s['gained']['kills'] . ' blokov');

echo $fail ? "\n$fail testov zlyhalo\n" : "\nVšetko v poriadku\n";
exit($fail ? 1 : 0);
