<?php

declare(strict_types=1);

use Shade\Brief;
use Shade\I18n;

require __DIR__ . '/../vendor/autoload.php';

$i18n = I18n::fromRequest();
$t = static fn (string $k): string => htmlspecialchars($i18n->t($k), ENT_QUOTES);
$opts = static function (string $prefix, array $values) use ($t): string {
    return implode('', array_map(static fn ($v) => "<option value=\"{$v}\">{$t($prefix . $v)}</option>", $values));
};
?><!doctype html>
<html lang="<?= $i18n->locale ?>">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title><?= $t('meta.title') ?></title>
  <meta name="description" content="<?= $t('meta.description') ?>">
  <?php foreach (I18n::SUPPORTED as $code): ?>
  <link rel="alternate" hreflang="<?= $code ?>" href="/?lang=<?= $code ?>">
  <?php endforeach ?>
  <link rel="stylesheet" href="/assets/app.css">
</head>
<body>
  <header class="top">
    <a class="logo" href="/">shade<span>.sk</span></a>
    <nav class="langs" aria-label="Language">
      <?php foreach (I18n::SUPPORTED as $code): ?>
        <a href="?lang=<?= $code ?>"<?= $code === $i18n->locale ? ' aria-current="true"' : '' ?>><?= strtoupper($code) ?></a>
      <?php endforeach ?>
    </nav>
  </header>

  <main>
    <section class="hero">
      <h1><?= $t('hero.title') ?></h1>
      <p><?= $t('hero.subtitle') ?></p>
    </section>

    <form id="brief" class="card" novalidate>
      <div class="row">
        <label><?= $t('form.name') ?>
          <input name="name" required maxlength="120" placeholder="<?= $t('form.name.placeholder') ?>">
        </label>
        <label><?= $t('form.type') ?>
          <select name="type"><?= $opts('type.', Brief::TYPES) ?></select>
        </label>
      </div>
      <label><?= $t('form.url') ?>
        <input name="url" type="url" maxlength="300" placeholder="https://">
      </label>
      <label><?= $t('form.description') ?>
        <textarea name="description" required minlength="20" maxlength="2000" rows="4" placeholder="<?= $t('form.description.placeholder') ?>"></textarea>
      </label>
      <label><?= $t('form.audience') ?>
        <input name="audience" maxlength="500" placeholder="<?= $t('form.audience.placeholder') ?>">
      </label>
      <div class="row three">
        <label><?= $t('form.goal') ?>
          <select name="goal"><?= $opts('goal.', Brief::GOALS) ?></select>
        </label>
        <label><?= $t('form.budget') ?>
          <select name="budget"><?= $opts('budget.', Brief::BUDGETS) ?></select>
        </label>
        <label><?= $t('form.output_lang') ?>
          <select name="output_lang">
            <option value="sk"<?= $i18n->locale === 'sk' ? ' selected' : '' ?>>Slovenčina</option>
            <option value="en"<?= $i18n->locale === 'en' ? ' selected' : '' ?>>English</option>
          </select>
        </label>
      </div>
      <p class="error" id="form-error" role="alert" hidden></p>
      <button type="submit"><?= $t('form.submit') ?></button>
      <p class="loading" id="loading" hidden><span class="spinner"></span><?= $t('form.loading') ?></p>
    </form>

    <section id="result" hidden></section>
  </main>

  <footer><?= $t('footer.note') ?></footer>

  <script>window.SHADE_I18N = <?= json_encode($i18n->all(), JSON_UNESCAPED_UNICODE | JSON_HEX_TAG) ?>;</script>
  <script src="/assets/app.js"></script>
</body>
</html>
