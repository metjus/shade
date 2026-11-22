<?php

declare(strict_types=1);

// Nastaví (alebo zmení) heslo do Shade. Použitie: php bin/set-password.php

require __DIR__ . '/../vendor/autoload.php';

if (PHP_SAPI !== 'cli') {
    exit(1);
}
echo 'Nové heslo: ';
system('stty -echo 2>/dev/null');
$password = trim((string) fgets(STDIN));
system('stty echo 2>/dev/null');
echo PHP_EOL;
if (mb_strlen($password) < 10) {
    fwrite(STDERR, "Heslo musí mať aspoň 10 znakov.\n");
    exit(1);
}
Shade\Auth::setPassword($password);
echo "Hotovo.\n";
