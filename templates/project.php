<?php
use Shade\PlanSchema;

/** @var callable $t @var callable $h @var string $csrf @var string $today @var array $project @var ?array $plan @var list<array> $tasks @var list<array> $drafts @var list<array> $published @var list<array> $ideas @var string $prefill */
$pid = $project['id'];
$langs = explode(',', $project['languages']);
$data = $plan['data'] ?? null;
$weeks = [];
foreach ($tasks as $task) {
    $weeks[$task['week']][] = $task;
}
$done = count(array_filter($tasks, static fn ($x) => $x['done_at'] !== null));
$planChannels = $data ? array_column($data['channels'], 'channel') : ['x', 'reddit', 'linkedin'];
$back = "/projects/$pid";
$showProject = false;
$taskItem = static function (array $task) use ($csrf, $h, $today, $pid): string {
    $isDone = $task['done_at'] !== null;
    $late = !$isDone && $task['due_date'] < $today;
    return '<li' . ($isDone ? ' class="done"' : '') . '><form method="post" action="/tasks/' . $task['id'] . '/toggle" class="task">' . $csrf
        . '<input type="hidden" name="back" value="/projects/' . $pid . '#plan">'
        . '<button type="submit" class="check' . ($isDone ? ' on' : '') . '" aria-label="✓" aria-pressed="' . ($isDone ? 'true' : 'false') . '"></button>'
        . '<span>' . $h($task['title']) . ' <span class="tag' . ($late ? ' red' : '') . '">' . $h(date('j. n.', strtotime($task['due_date']))) . '</span></span>'
        . '</form></li>';
};
?>
<header class="project-head">
  <div>
    <p class="muted small"><?= $t('type.' . $project['type']) ?> · <?= $t('goal.' . $project['goal']) ?><?= $project['url'] !== '' ? ' · <a href="' . $h($project['url']) . '" rel="noopener" target="_blank">' . $h(parse_url($project['url'], PHP_URL_HOST)) . '</a>' : '' ?></p>
    <h1><?= $h($project['name']) ?></h1>
  </div>
  <a class="button ghost" href="/projects/<?= $pid ?>/edit"><?= $t('project.edit') ?></a>
</header>

<nav class="subnav">
  <a href="#plan"><?= $t('project.plan') ?></a>
  <a href="#ideas"><?= $t('project.ideas') ?> (<?= count(array_filter($ideas, static fn ($i) => !$i['used'])) ?>)</a>
  <a href="#repurpose"><?= $t('project.repurpose') ?></a>
  <a href="#drafts"><?= $t('project.drafts') ?> (<?= count($drafts) ?>)</a>
  <a href="#published"><?= $t('project.published') ?> (<?= count($published) ?>)</a>
</nav>

<section class="card" id="plan">
  <h2><?= $t('project.plan') ?></h2>
  <?php if (!$data): ?>
    <p><?= $t('plan.none') ?></p>
  <?php else: ?>
    <p class="one-liner"><?= $h($data['positioning']['one_liner']) ?></p>
    <ul><?php foreach ($data['positioning']['value_props'] as $vp): ?><li><?= $h($vp) ?></li><?php endforeach ?></ul>
    <p class="muted small"><strong><?= $t('result.tone') ?>:</strong> <?= $h($data['positioning']['tone']) ?></p>

    <h3><?= $t('result.channels') ?></h3>
    <div class="grid">
      <?php foreach ($data['channels'] as $c): ?>
        <div class="mini">
          <strong><?= $t('channel.' . $c['channel']) ?></strong> <span class="badge <?= $h($c['priority']) ?>"><?= $t('priority.' . $c['priority']) ?></span>
          <p><?= $h($c['why']) ?></p>
          <p class="muted small"><strong><?= $t('result.first_step') ?>:</strong> <?= $h($c['first_step']) ?></p>
        </div>
      <?php endforeach ?>
    </div>

    <div class="progress-row">
      <h3><?= $t('plan.tasks') ?></h3>
      <span class="muted small"><?= $done ?> / <?= count($tasks) ?></span>
    </div>
    <div class="progress"><div style="width: <?= $tasks ? round($done / count($tasks) * 100) : 0 ?>%"></div></div>
    <div class="weeks">
      <?php foreach ($weeks as $w => $list): ?>
        <div class="week">
          <h4><?= $w === 0 ? $t('result.quick_wins') : $t('result.week') . ' ' . $w . ($data['plan'][$w - 1]['focus'] ?? '' ? ': ' . $h($data['plan'][$w - 1]['focus']) : '') ?></h4>
          <ul class="tasks"><?php foreach ($list as $task) echo $taskItem($task) ?></ul>
        </div>
      <?php endforeach ?>
    </div>
  <?php endif ?>

  <details<?= $data ? '' : ' open' ?> class="regen">
    <summary><?= $t($data ? 'plan.regenerate' : 'plan.generate') ?></summary>
    <form method="post" action="/projects/<?= $pid ?>/plan" class="inline-form">
      <?= $csrf ?>
      <label><?= $t('form.output_lang') ?>
        <select name="lang"><?php foreach ($langs as $l): ?><option value="<?= $l ?>"><?= $l === 'sk' ? 'Slovenčina' : 'English' ?></option><?php endforeach ?></select>
      </label>
      <label class="grow"><?= $t('plan.note') ?>
        <input name="note" maxlength="500" placeholder="<?= $t('plan.note_ph') ?>">
      </label>
      <button type="submit" data-busy><?= $t($data ? 'plan.regenerate_btn' : 'plan.generate_btn') ?></button>
    </form>
    <?php if ($data): ?><p class="muted small"><?= $t('plan.regenerate_help') ?></p><?php endif ?>
  </details>
</section>

<section class="card" id="ideas">
  <h2><?= $t('project.ideas') ?></h2>
  <form method="post" action="/projects/<?= $pid ?>/ideas" class="inline-form">
    <?= $csrf ?>
    <label class="grow sr-label"><span class="sr-only"><?= $t('ideas.new') ?></span>
      <input name="text" maxlength="1000" required placeholder="<?= $t('ideas.placeholder') ?>">
    </label>
    <button type="submit" class="ghost"><?= $t('ideas.add') ?></button>
  </form>
  <?php if ($ideas): ?>
    <ul class="ideas">
      <?php foreach ($ideas as $idea): ?>
        <li<?= $idea['used'] ? ' class="used"' : '' ?>>
          <span><?= $h($idea['text']) ?></span>
          <form method="post" action="/ideas/<?= $idea['id'] ?>">
            <?= $csrf ?>
            <button type="submit" name="action" value="use" class="ghost small"><?= $t('ideas.use') ?></button>
            <button type="submit" name="action" value="delete" class="ghost small danger" aria-label="<?= $t('ideas.delete') ?>">×</button>
          </form>
        </li>
      <?php endforeach ?>
    </ul>
  <?php else: ?>
    <p class="muted"><?= $t('ideas.none') ?></p>
  <?php endif ?>
</section>

<section class="card" id="repurpose">
  <h2><?= $t('project.repurpose') ?></h2>
  <p class="muted"><?= $t('repurpose.help') ?></p>
  <form method="post" action="/projects/<?= $pid ?>/repurpose">
    <?= $csrf ?>
    <label><span class="sr-only"><?= $t('repurpose.source') ?></span>
      <textarea name="source" rows="6" required minlength="20" maxlength="6000" placeholder="<?= $t('repurpose.placeholder') ?>"><?= $h($prefill) ?></textarea>
    </label>
    <fieldset class="chips">
      <legend><?= $t('repurpose.channels') ?></legend>
      <?php foreach (PlanSchema::CHANNELS as $c): ?>
        <label class="chip-check"><input type="checkbox" name="channels[]" value="<?= $c ?>"<?= in_array($c, $planChannels, true) ? ' checked' : '' ?>> <?= $t('channel.' . $c) ?></label>
      <?php endforeach ?>
    </fieldset>
    <fieldset class="chips">
      <legend><?= $t('repurpose.langs') ?></legend>
      <?php foreach (['sk' => 'Slovenčina', 'en' => 'English'] as $code => $name): ?>
        <label class="chip-check"><input type="checkbox" name="langs[]" value="<?= $code ?>"<?= in_array($code, $langs, true) ? ' checked' : '' ?>> <?= $name ?></label>
      <?php endforeach ?>
    </fieldset>
    <button type="submit" data-busy><?= $t('repurpose.submit') ?></button>
  </form>
</section>

<section id="drafts">
  <h2><?= $t('project.drafts') ?></h2>
  <?php if ($drafts): foreach ($drafts as $post) require __DIR__ . '/_post.php'; else: ?>
    <p class="muted"><?= $t('drafts.none') ?></p>
  <?php endif ?>
</section>

<section id="published">
  <h2><?= $t('project.published') ?></h2>
  <?php if ($published): foreach ($published as $post) require __DIR__ . '/_post.php'; else: ?>
    <p class="muted"><?= $t('published.none') ?></p>
  <?php endif ?>
</section>
