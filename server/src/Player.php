<?php
// Hráči: hosťovský účet podľa náhodného tokenu (uložený v prehliadači), vylepšenia a obchod.

final class Player
{
    /** Nájde hráča podľa tokenu alebo založí nového hosťa. */
    static function auth(PDO $db, $token, bool $create): array
    {
        if (is_string($token) && preg_match('/^[a-f0-9]{64}$/', $token)) {
            $st = $db->prepare('SELECT * FROM players WHERE token = ?');
            $st->execute([$token]);
            $p = $st->fetch();
            if ($p) return $p;
        }
        if (!$create) throw new ApiError('unknown_token', 401);
        $token = bin2hex(random_bytes(32));
        $name = 'Baník' . random_int(1000, 9999);
        $db->prepare('INSERT INTO players (token, name, last_sync) VALUES (?, ?, ?)')
           ->execute([$token, $name, microtime(true)]);
        $st = $db->prepare('SELECT * FROM players WHERE id = ?');
        $st->execute([(int) $db->lastInsertId()]);
        return $st->fetch();
    }

    static function lock(PDO $db, int $id): array
    {
        $st = $db->prepare('SELECT * FROM players WHERE id = ? FOR UPDATE');
        $st->execute([$id]);
        return $st->fetch();
    }

    /** Údaje o hráčovi, ktoré dostane klient. */
    static function view(array $p): array
    {
        return [
            'id' => (int) $p['id'],
            'name' => $p['name'],
            'dust' => (int) $p['dust'],
            'levels' => ['pickaxe' => (int) $p['pickaxe'], 'miners' => (int) $p['miners']],
            'effect' => $p['effect'],
            'effects' => explode(',', $p['effects']),
            'contributed' => (int) $p['contributed'],
        ];
    }

    /** Kúpa vylepšenia (pickaxe, miners) alebo efektu (effect:<id>, ak ho hráč má, len ho nasadí). */
    static function buy(PDO $db, array $p, string $item): array
    {
        $db->beginTransaction();
        try {
            $p = self::lock($db, (int) $p['id']);
            $event = null;
            if ($item === 'pickaxe' || $item === 'miners') {
                $lvl = (int) $p[$item];
                if ($lvl >= Rules::MAX_LEVELS[$item]) throw new ApiError('max_level');
                $cost = Rules::cost($item, $lvl);
                if ((int) $p['dust'] < $cost) throw new ApiError('not_enough_dust');
                $db->prepare("UPDATE players SET dust = dust - ?, $item = $item + 1 WHERE id = ?")
                   ->execute([$cost, $p['id']]);
                if ($item === 'pickaxe') {
                    foreach (Rules::PICKAXE_TIERS as $t) {
                        if ($t[0] === $lvl + 1 && $t[0] > 0) $event = ['tier', $p['name'] . ' má nový krompáč (' . $t[1] . '×' . $t[2] . ')'];
                    }
                }
            } elseif (strncmp($item, 'effect:', 7) === 0) {
                $id = substr($item, 7);
                if (!array_key_exists($id, Rules::EFFECT_PRICES)) throw new ApiError('unknown_item');
                $owned = explode(',', $p['effects']);
                if (in_array($id, $owned, true)) {
                    $db->prepare('UPDATE players SET effect = ? WHERE id = ?')->execute([$id, $p['id']]);
                } else {
                    $price = Rules::EFFECT_PRICES[$id];
                    if ((int) $p['dust'] < $price) throw new ApiError('not_enough_dust');
                    $owned[] = $id;
                    $db->prepare('UPDATE players SET dust = dust - ?, effect = ?, effects = ? WHERE id = ?')
                       ->execute([$price, $id, implode(',', $owned), $p['id']]);
                }
            } else {
                throw new ApiError('unknown_item');
            }
            if ($event) $db->prepare('INSERT INTO events (kind, text) VALUES (?, ?)')->execute($event);
            $db->commit();
        } catch (Throwable $e) {
            $db->rollBack();
            throw $e;
        }
        $st = $db->prepare('SELECT * FROM players WHERE id = ?');
        $st->execute([$p['id']]);
        return $st->fetch();
    }

    static function rename(PDO $db, array $p, $name): array
    {
        $name = is_string($name) ? trim(preg_replace('/\s+/u', ' ', $name)) : '';
        if (!preg_match('/^[\p{L}\p{N}_ .-]{3,16}$/u', $name)) throw new ApiError('bad_name');
        $st = $db->prepare('SELECT 1 FROM players WHERE name = ? AND id <> ?');
        $st->execute([$name, $p['id']]);
        if ($st->fetch()) throw new ApiError('name_taken');
        $db->prepare('UPDATE players SET name = ? WHERE id = ?')->execute([$name, $p['id']]);
        $p['name'] = $name;
        return $p;
    }

    /** Najlepší baníci (cache 30 s). */
    static function leaderboard(PDO $db): array
    {
        return shade_cache('leaderboard', 30, function () use ($db) {
            $rows = $db->query('SELECT name, contributed FROM players WHERE contributed > 0 ORDER BY contributed DESC LIMIT 10')->fetchAll();
            return array_map(function ($r) { return [$r['name'], (int) $r['contributed']]; }, $rows);
        });
    }

    static function online(PDO $db): int
    {
        return (int) shade_cache('online', 15, function () use ($db) {
            return (int) $db->query('SELECT COUNT(*) FROM players WHERE last_seen > NOW() - INTERVAL 60 SECOND')->fetchColumn();
        });
    }
}
