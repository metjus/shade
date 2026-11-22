<?php

use Shade\I18n;

/** @var callable $t @var string $content @var bool $demo @var ?array $flash @var string $csrf @var I18n $i18n */
$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
$nav = static fn (string $href, string $label, bool $active) =>
    '<a href="' . $href . '"' . ($active ? ' aria-current="page"' : '') . '>' . $label . '</a>';
?><!doctype html>
<html lang="<?= $i18n->locale ?>">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <title>Shade</title>
  <link rel="stylesheet" href="/assets/app.css">
</head>
<body>
  <header class="top">
    <a class="logo" href="/">shade<span>.sk</span></a>
    <nav class="main-nav">
      <?= $nav('/', $t('nav.today'), $path === '/') ?>
      <?= $nav('/calendar', $t('nav.calendar'), $path === '/calendar') ?>
      <?= $nav('/projects/new', '+ ' . $t('nav.new_project'), $path === '/projects/new') ?>
    </nav>
    <div class="top-right">
      <?php foreach (I18n::SUPPORTED as $code): ?>
        <a class="lang" href="?lang=<?= $code ?>"<?= $code === $i18n->locale ? ' aria-current="true"' : '' ?>><?= strtoupper($code) ?></a>
      <?php endforeach ?>
      <form method="post" action="/logout"><?= $csrf ?><button class="link" type="submit"><?= $t('nav.logout') ?></button></form>
    </div>
  </header>

  <main>
    <?php if ($demo): ?><p class="notice"><?= $t('demo.notice') ?></p><?php endif ?>
    <?php if ($flash): ?><p class="flash <?= $flash['type'] === 'error' ? 'error' : 'ok' ?>" role="status"><?= htmlspecialchars($flash['message']) ?></p><?php endif ?>
    <?= $content ?>
  </main>

  <div class="busy" id="busy" hidden><span class="spinner"></span><?= $t('busy') ?></div>
  <script src="/assets/app.js"></script>
</body>
</html>
