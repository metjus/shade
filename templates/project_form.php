<?php
use Shade\Projects;

/** @var callable $t @var callable $h @var string $csrf @var ?array $project @var array $values @var list<string> $errors */
$v = static fn (string $k): string => $h((string) ($values[$k] ?? ''));
$opts = static function (string $prefix, array $list, string $current) use ($t): string {
    $out = '';
    foreach ($list as $o) {
        $out .= '<option value="' . $o . '"' . ($o === $current ? ' selected' : '') . '>' . $t($prefix . $o) . '</option>';
    }
    return $out;
};
$langs = explode(',', (string) ($values['languages'] ?? 'sk'));
$err = static fn (string $k): string => in_array($k, $errors, true) ? '<span class="field-error">' . $t('error.' . $k) . '</span>' : '';
?>
<h1><?= $project ? $h($project['name']) . ' · ' . $t('form.edit') : $t('form.new_title') ?></h1>
<p class="muted"><?= $t('form.intro') ?></p>

<form method="post" action="<?= $project ? '/projects/' . $project['id'] : '/projects' ?>" class="card form">
  <?= $csrf ?>
  <div class="row">
    <label><?= $t('form.name') ?>
      <input name="name" required maxlength="120" value="<?= $v('name') ?>" placeholder="<?= $t('form.name.placeholder') ?>"><?= $err('name') ?>
    </label>
    <label><?= $t('form.type') ?>
      <select name="type"><?= $opts('type.', Projects::TYPES, (string) ($values['type'] ?? '')) ?></select>
    </label>
  </div>
  <label><?= $t('form.url') ?>
    <input name="url" type="url" maxlength="300" value="<?= $v('url') ?>" placeholder="https://"><?= $err('url') ?>
  </label>
  <label><?= $t('form.description') ?>
    <textarea name="description" required rows="4" maxlength="3000" placeholder="<?= $t('form.description.placeholder') ?>"><?= $v('description') ?></textarea><?= $err('description') ?>
  </label>
  <div class="row">
    <label><?= $t('form.audience') ?>
      <input name="audience" maxlength="600" value="<?= $v('audience') ?>" placeholder="<?= $t('form.audience.placeholder') ?>">
    </label>
    <label><?= $t('form.tone') ?>
      <input name="tone" maxlength="300" value="<?= $v('tone') ?>" placeholder="<?= $t('form.tone.placeholder') ?>">
    </label>
  </div>
  <label><?= $t('form.voice') ?>
    <textarea name="voice_samples" rows="4" maxlength="4000" placeholder="<?= $t('form.voice.placeholder') ?>"><?= $v('voice_samples') ?></textarea>
    <span class="muted small"><?= $t('form.voice.help') ?></span>
  </label>
  <div class="row three">
    <label><?= $t('form.goal') ?>
      <select name="goal"><?= $opts('goal.', Projects::GOALS, (string) ($values['goal'] ?? '')) ?></select>
    </label>
    <label><?= $t('form.budget') ?>
      <select name="budget"><?= $opts('budget.', Projects::BUDGETS, (string) ($values['budget'] ?? '')) ?></select>
    </label>
    <fieldset>
      <legend><?= $t('form.languages') ?></legend>
      <label class="inline"><input type="checkbox" name="languages[]" value="sk"<?= in_array('sk', $langs, true) ? ' checked' : '' ?>> Slovenčina</label>
      <label class="inline"><input type="checkbox" name="languages[]" value="en"<?= in_array('en', $langs, true) ? ' checked' : '' ?>> English</label>
    </fieldset>
  </div>
  <div class="form-actions">
    <button type="submit"><?= $t('form.save') ?></button>
    <?php if ($project): ?><a href="/projects/<?= $project['id'] ?>"><?= $t('form.cancel') ?></a><?php endif ?>
  </div>
</form>

<?php if ($project): ?>
<form method="post" action="/projects/<?= $project['id'] ?>/delete" class="danger-zone">
  <?= $csrf ?>
  <button type="submit" class="ghost danger" data-confirm="<?= $t('form.delete_confirm') ?>"><?= $t('form.delete') ?></button>
</form>
<?php endif ?>
