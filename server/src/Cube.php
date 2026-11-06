<?php
// Spoločná kocka: stav vrstvy po dlaždiciach, údery hráčov a baníkov, prechod na ďalšiu vrstvu.

final class Cube
{
    const MAX_VIEW_TILES = 16;
    const MAX_BREAKS_PER_SYNC = 60;

    /** Vytvorí kocku pri prvom spustení. */
    static function ensure(PDO $db): void
    {
        $edge = (int) (shade_config()['edge'] ?? 2048);
        if ($edge < 8 || $edge % 2) throw new ApiError('bad_edge_config', 500);
        $db->prepare('INSERT IGNORE INTO cube (id, edge, total) VALUES (1, ?, ?)')->execute([$edge, 6 * $edge * $edge]);
    }

    static function read(PDO $db, bool $lock = false): array
    {
        $row = $db->query('SELECT * FROM cube WHERE id = 1' . ($lock ? ' FOR UPDATE' : ''))->fetch();
        if (!$row) throw new ApiError('no_cube', 500);
        foreach (['season', 'edge', 'layer', 'mined', 'total', 'version'] as $k) $row[$k] = (int) $row[$k];
        return $row;
    }

    static function view(array $c): array
    {
        return [
            'season' => $c['season'], 'edge' => $c['edge'], 'layer' => $c['layer'],
            'mined' => $c['mined'], 'total' => $c['total'], 'version' => $c['version'],
            'opened' => $c['opened_by'] !== null,
        ];
    }

    /**
     * Synchronizácia: spracuje kliknutia a baníkov hráča, potom vráti, čo sa zmenilo v kocke.
     * Celá zmena beží pod zámkom riadku kocky, takže sa údery dvoch hráčov nikdy neprepíšu.
     */
    static function sync(PDO $db, array $p, array $in): array
    {
        $now = microtime(true);
        $breaks = [];
        $events = [];
        $db->beginTransaction();
        try {
            $c = self::read($db, true);
            $p = Player::lock($db, (int) $p['id']);
            $dt = max(0.0, min(Rules::OFFLINE_CAP_S, $now - (float) $p['last_sync']));
            $done = $c['opened_by'] !== null;
            $tiles = new TileSet($db, $c);
            $dust = 0;
            $kills = 0;
            $home = [(int) $p['home_f'], (int) $p['home_u'], (int) $p['home_v']];

            // 1) kliknutia (len do aktuálnej vrstvy, najviac MAX_CPS za sekundu)
            $clicks = isset($in['clicks']) && is_array($in['clicks']) ? $in['clicks'] : [];
            if (($in['layer'] ?? -1) !== $c['layer'] || $done) $clicks = [];
            $allowed = (int) min(Rules::MAX_CLICK_BURST, floor($dt * Rules::MAX_CPS) + 3);
            $clicks = array_slice($clicks, 0, $allowed);
            $power = Rules::power((int) $p['pickaxe']);
            $foot = Rules::footprint((int) $p['pickaxe']);
            foreach ($clicks as $k) {
                if (!is_array($k) || count($k) !== 3) continue;
                [$f, $u, $v] = $k;
                if (!is_int($f) || !is_int($u) || !is_int($v) || $f < 0 || $f > 5) continue;
                foreach ($foot as [$du, $dv]) {
                    $r = $tiles->hit($f, $u + $du, $v + $dv, $power);
                    if ($r === 1) {
                        $kills++;
                        if (count($breaks) < self::MAX_BREAKS_PER_SYNC) $breaks[] = [$f, $u + $du, $v + $dv, 0];
                    }
                }
                $home = [$f, $u, $v];
            }

            // 2) tieňoví baníci pracujú okolo miesta, kde hráč naposledy ťažil (aj keď je offline)
            $miners = (int) $p['miners'];
            $bank = min((float) $p['miner_bank'] + $miners * $dt, $miners * Rules::OFFLINE_CAP_S);
            $n = (int) min(floor($bank), Rules::MINER_HITS_PER_SYNC);
            if ($done) $n = 0;
            $bank -= $n;
            $size = $tiles->size;
            $misses = 0;
            $R = Rules::MINER_RADIUS;
            for ($i = 0, $tries = 0; $i < $n && $tries < $n * 3; $tries++) {
                if ($c['mined'] + $tiles->killed >= $c['total']) break;
                [$f, $hu, $hv] = $home;
                $u = max(0, min($size - 1, $hu + random_int(-$R, $R)));
                $v = max(0, min($size - 1, $hv + random_int(-$R, $R)));
                $r = $tiles->hit($f, $u, $v, 1);
                if ($r === null) {
                    if (++$misses > 30) { $home = [random_int(0, 5), random_int(0, $size - 1), random_int(0, $size - 1)]; $misses = 0; }
                    continue;
                }
                $i++;
                $misses = 0;
                if ($r === 1) {
                    $kills++;
                    if (count($breaks) < self::MAX_BREAKS_PER_SYNC && random_int(0, 3) === 0) $breaks[] = [$f, $u, $v, 1];
                }
            }

            $dust = $kills * Rules::blockReward(Rules::depth01($c['edge'], $c['layer']));
            if ($home[1] >= $size || $home[2] >= $size) $home = [$home[0], 0, 0];

            // 3) zápis
            if ($tiles->killed > 0 || $tiles->dirtyCount() > 0) {
                $c['version']++;
                $tiles->save($c['version']);
                $c['mined'] += $tiles->killed;
                if ($breaks) {
                    $sql = 'INSERT INTO breaks (version, player_id, f, u, v, effect, kind) VALUES ' . implode(',', array_fill(0, count($breaks), '(?,?,?,?,?,?,?)'));
                    $args = [];
                    foreach ($breaks as [$f, $u, $v, $kind]) array_push($args, $c['version'], $p['id'], $f, $u, $v, $p['effect'], $kind);
                    $db->prepare($sql)->execute($args);
                }
            }
            $db->prepare('UPDATE players SET dust = dust + ?, contributed = contributed + ?, miner_bank = ?, home_f = ?, home_u = ?, home_v = ?, last_sync = ?, last_seen = NOW() WHERE id = ?')
               ->execute([$dust, $kills, $bank, $home[0], $home[1], $home[2], $now, $p['id']]);

            // 4) vrstva hotová: ďalšia vrstva alebo otvorené jadro
            if ($c['mined'] >= $c['total'] && !$done) {
                $layerCount = Rules::layerCount($c['edge']);
                if ($c['layer'] >= $layerCount - 1) {
                    $db->prepare('UPDATE cube SET opened_by = ? WHERE id = 1')->execute([$p['id']]);
                    $c['opened_by'] = $p['id'];
                    $events[] = ['core', $p['name'] . ' rozbil jadro a otvoril stred kocky'];
                } else {
                    $events[] = ['layer', 'Vrstva ' . ($c['layer'] + 1) . ' je vyťažená. Posledný blok: ' . $p['name']];
                    $c['layer']++;
                    $c['mined'] = 0;
                    $s = Rules::size($c['edge'], $c['layer']);
                    $c['total'] = 6 * $s * $s;
                    $db->prepare('DELETE FROM tiles WHERE season = ? AND layer < ?')->execute([$c['season'], $c['layer']]);
                    $db->exec('DELETE FROM breaks');
                }
            }
            $db->prepare('UPDATE cube SET layer = ?, mined = ?, total = ?, version = ? WHERE id = 1')
               ->execute([$c['layer'], $c['mined'], $c['total'], $c['version']]);
            foreach ($events as $e) $db->prepare('INSERT INTO events (kind, text) VALUES (?, ?)')->execute($e);
            $db->commit();
        } catch (Throwable $e) {
            $db->rollBack();
            throw $e;
        }

        if (random_int(0, 19) === 0) $db->exec('DELETE FROM breaks WHERE created_at < NOW() - INTERVAL 2 MINUTE');

        $st = $db->prepare('SELECT * FROM players WHERE id = ?');
        $st->execute([$p['id']]);
        $p = $st->fetch();

        $out = [
            'now' => $now,
            'cube' => self::view($c),
            'player' => Player::view($p),
            'gained' => ['dust' => $dust, 'kills' => $kills, 'clicks' => count($clicks)],
            'tiles' => self::changedTiles($db, $c, $in['view'] ?? null, ($in['layer'] ?? -1) === $c['layer']),
            'online' => Player::online($db),
        ];
        [$out['bid'], $out['breaks']] = self::breaksSince($db, (int) $p['id'], $in['bid'] ?? 0, $in['view'] ?? null);
        [$out['eid'], $out['events']] = self::eventsSince($db, $in['eid'] ?? 0);
        $ov = self::overview($db, $c);
        if (($in['ov'] ?? null) !== $ov['stamp']) $out['overview'] = $ov;
        if (!empty($in['lb'])) $out['leaderboard'] = Player::leaderboard($db);
        return $out;
    }

    /** Dlaždice v okne klienta, ktoré sú novšie ako verzia, ktorú klient má. Chýbajúca dlaždica = nedotknutá. */
    static function changedTiles(PDO $db, array $c, $view, bool $sameLayer): array
    {
        if (!is_array($view)) return [];
        $out = [];
        $st = $db->prepare('SELECT data, mined, version FROM tiles WHERE season = ? AND layer = ? AND f = ? AND tx = ? AND ty = ?');
        foreach (array_slice($view, 0, self::MAX_VIEW_TILES) as $t) {
            if (!is_array($t) || count($t) !== 4) continue;
            [$f, $tx, $ty, $ver] = $t;
            if (!is_int($f) || !is_int($tx) || !is_int($ty) || !is_int($ver)) continue;
            if (!$sameLayer) $ver = -1;
            $st->execute([$c['season'], $c['layer'], $f, $tx, $ty]);
            $row = $st->fetch();
            if (!$row || (int) $row['version'] <= $ver) continue;
            $out[] = [$f, $tx, $ty, (int) $row['version'], base64_encode($row['data'])];
        }
        return $out;
    }

    /** Rozbitia ostatných hráčov (a vlastných baníkov) na stene, ktorú hráč práve vidí, aby videl ich efekty. */
    static function breaksSince(PDO $db, int $me, $bid, $view): array
    {
        $max = (int) $db->query('SELECT COALESCE(MAX(id), 0) FROM breaks')->fetchColumn();
        if (!is_int($bid) || $bid <= 0 || $bid > $max || !is_array($view) || !$view) return [$max, []];
        $faces = [];
        foreach ($view as $t) if (is_array($t) && isset($t[0]) && is_int($t[0])) $faces[$t[0]] = true;
        if (!$faces) return [$max, []];
        $in = implode(',', array_map('intval', array_keys($faces)));
        $st = $db->prepare("SELECT id, f, u, v, effect FROM breaks WHERE id > ? AND f IN ($in) AND NOT (player_id = ? AND kind = 0) ORDER BY id LIMIT 300");
        $st->execute([$bid, $me]);
        $rows = array_map(function ($r) { return [(int) $r['f'], (int) $r['u'], (int) $r['v'], $r['effect']]; }, $st->fetchAll());
        return [$max, $rows];
    }

    static function eventsSince(PDO $db, $eid): array
    {
        if (is_int($eid) && $eid > 0) {
            $st = $db->prepare('SELECT id, kind, text FROM events WHERE id > ? ORDER BY id LIMIT 20');
            $st->execute([$eid]);
            $rows = $st->fetchAll();
        } else {
            $rows = array_reverse($db->query('SELECT id, kind, text FROM events ORDER BY id DESC LIMIT 6')->fetchAll());
        }
        $last = $rows ? (int) end($rows)['id'] : (is_int($eid) ? $eid : 0);
        if (!$rows && $last === 0) $last = (int) $db->query('SELECT COALESCE(MAX(id), 0) FROM events')->fetchColumn();
        return [$last, array_map(function ($r) { return [$r['kind'], $r['text']]; }, $rows)];
    }

    /**
     * Prehľad kocky z diaľky: pre každú dlaždicu podiel vyťažených blokov (0..255).
     * Poradie: stena, riadok ty, stĺpec tx. Počíta sa najviac raz za 20 sekúnd.
     */
    static function overview(PDO $db, array $c): array
    {
        return shade_cache("ov_{$c['season']}_{$c['layer']}", 20, function () use ($db, $c) {
            $size = Rules::size($c['edge'], $c['layer']);
            $T = intdiv($size + Rules::TILE - 1, Rules::TILE);
            $buf = str_repeat("\0", 6 * $T * $T);
            $st = $db->prepare('SELECT f, tx, ty, mined FROM tiles WHERE season = ? AND layer = ?');
            $st->execute([$c['season'], $c['layer']]);
            while ($r = $st->fetch()) {
                $tx = (int) $r['tx']; $ty = (int) $r['ty'];
                if ($tx >= $T || $ty >= $T) continue;
                $cells = min(Rules::TILE, $size - $tx * Rules::TILE) * min(Rules::TILE, $size - $ty * Rules::TILE);
                $buf[(int) $r['f'] * $T * $T + $ty * $T + $tx] = chr((int) min(255, round(255 * (int) $r['mined'] / max(1, $cells))));
            }
            return ['stamp' => $c['layer'] . '-' . round(microtime(true), 3), 'layer' => $c['layer'], 'T' => $T, 'data' => base64_encode($buf)];
        });
    }
}

/** Dlaždice načítané počas jednej synchronizácie. Zapíšu sa naraz na konci. */
final class TileSet
{
    public $size;
    public $killed = 0;
    private $db;
    private $season;
    private $layer;
    private $hp;
    private $tiles = [];

    function __construct(PDO $db, array $c)
    {
        $this->db = $db;
        $this->season = $c['season'];
        $this->layer = $c['layer'];
        $this->size = Rules::size($c['edge'], $c['layer']);
        $this->hp = Rules::blockHp(Rules::depth01($c['edge'], $c['layer']));
    }

    private function &tile(int $f, int $tx, int $ty): array
    {
        $k = "$f:$tx:$ty";
        if (!isset($this->tiles[$k])) {
            $st = $this->db->prepare('SELECT data, mined FROM tiles WHERE season = ? AND layer = ? AND f = ? AND tx = ? AND ty = ?');
            $st->execute([$this->season, $this->layer, $f, $tx, $ty]);
            $row = $st->fetch();
            $this->tiles[$k] = $row
                ? ['f' => $f, 'tx' => $tx, 'ty' => $ty, 'data' => $row['data'], 'mined' => (int) $row['mined'], 'dirty' => false]
                : ['f' => $f, 'tx' => $tx, 'ty' => $ty, 'data' => str_repeat("\0", Rules::TILE * Rules::TILE), 'mined' => 0, 'dirty' => false];
        }
        return $this->tiles[$k];
    }

    /** Úder: null = nedá sa (mimo steny / už vyťažený), 0 = poškodený, 1 = vyťažený. */
    function hit(int $f, int $u, int $v, int $dmg): ?int
    {
        if ($u < 0 || $v < 0 || $u >= $this->size || $v >= $this->size) return null;
        $t = &$this->tile($f, intdiv($u, Rules::TILE), intdiv($v, Rules::TILE));
        $i = ($v % Rules::TILE) * Rules::TILE + ($u % Rules::TILE);
        $cur = ord($t['data'][$i]);
        if ($cur === Rules::MINED) return null;
        $t['dirty'] = true;
        $val = $cur + $dmg;
        if ($val >= $this->hp) {
            $t['data'][$i] = chr(Rules::MINED);
            $t['mined']++;
            $this->killed++;
            return 1;
        }
        $t['data'][$i] = chr($val);
        return 0;
    }

    function dirtyCount(): int
    {
        $n = 0;
        foreach ($this->tiles as $t) if ($t['dirty']) $n++;
        return $n;
    }

    function save(int $version): void
    {
        $st = $this->db->prepare('INSERT INTO tiles (season, layer, f, tx, ty, data, mined, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE data = VALUES(data), mined = VALUES(mined), version = VALUES(version)');
        foreach ($this->tiles as $t) {
            if (!$t['dirty']) continue;
            $st->bindValue(1, $this->season, PDO::PARAM_INT);
            $st->bindValue(2, $this->layer, PDO::PARAM_INT);
            $st->bindValue(3, $t['f'], PDO::PARAM_INT);
            $st->bindValue(4, $t['tx'], PDO::PARAM_INT);
            $st->bindValue(5, $t['ty'], PDO::PARAM_INT);
            $st->bindValue(6, $t['data'], PDO::PARAM_LOB);
            $st->bindValue(7, $t['mined'], PDO::PARAM_INT);
            $st->bindValue(8, $version, PDO::PARAM_INT);
            $st->execute();
        }
    }
}
