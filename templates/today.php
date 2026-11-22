<?php
/** @var callable $t @var callable $h @var string $csrf @var string $today @var list<array> $due @var list<array> $upcoming @var list<array> $scheduled @var list<array> $reshare @var list<array> $drafts @var list<array> $projects */
$taskItem = static function (array $task, bool $showDate) use ($csrf, $h, $today): string {
    $late = $task['due_date'] < $today;
    return '<li><form method="post" action="/tasks/' . $task['id'] . '/toggle" class="task">' . $csrf
        . '<input type="hidden" name="back" value="/">'
        . '<button type="submit" class="check" aria-label="✓"></button>'
        . '<span>' . $h($task['title']) . ' <a class="muted small" href="/projects/' . $task['project_id'] . '">' . $h($task['project_name']) . '</a>'
        . ($showDate || $late ? ' <span class="tag' . ($late ? ' red' : '') . '">' . $h(date('j. n.', strtotime($task['due_date']))) . '</span>' : '')
        . '</span></form></li>';
};
?>
<h1><?= $t('today.title') ?></h1>

<?php if (!$projects): ?>
  <section class="card empty">
    <h2><?= $t('today.empty_title') ?></h2>
    <p><?= $t('today.empty_text') ?></p>
    <a class="button" href="/projects/new"><?= $t('nav.new_project') ?></a>
  </section>
<?php else: ?>
<div class="cols">
  <div class="col-main">
    <section class="card">
      <h2><?= $t('today.tasks') ?></h2>
      <?php if ($due): ?>
        <ul class="tasks"><?php foreach ($due as $task) echo $taskItem($task, false) ?></ul>
      <?php else: ?>
        <p class="muted"><?= $t('today.no_tasks') ?></p>
      <?php endif ?>
    </section>

    <section class="card">
      <h2><?= $t('today.posts') ?></h2>
      <?php if ($scheduled): ?>
        <?php foreach ($scheduled as $post) { $back = '/'; $showProject = true; if ($post['status'] === 'draft') require __DIR__ . '/_post.php'; } ?>
      <?php else: ?>
        <p class="muted"><?= $t('today.no_posts') ?></p>
      <?php endif ?>
    </section>

    <?php if ($reshare): ?>
    <section class="card">
      <h2><?= $t('today.reshare') ?></h2>
      <p class="muted small"><?= $t('today.reshare_text') ?></p>
      <?php foreach ($reshare as $post) { $back = '/'; $showProject = true; require __DIR__ . '/_post.php'; } ?>
    </section>
    <?php endif ?>
  </div>

  <aside class="col-side">
    <section class="card">
      <h2><?= $t('today.week') ?></h2>
      <?php if ($upcoming): ?>
        <ul class="tasks"><?php foreach ($upcoming as $task) echo $taskItem($task, true) ?></ul>
      <?php else: ?>
        <p class="muted"><?= $t('today.no_upcoming') ?></p>
      <?php endif ?>
    </section>
    <section class="card">
      <h2><?= $t('today.projects') ?></h2>
      <ul class="plain">
        <?php foreach ($projects as $p): ?>
          <li><a href="/projects/<?= $p['id'] ?>"><?= $h($p['name']) ?></a> <span class="muted small"><?= $t('type.' . $p['type']) ?></span></li>
        <?php endforeach ?>
      </ul>
    </section>
    <?php if ($drafts): ?>
    <section class="card">
      <h2><?= $t('today.drafts') ?></h2>
      <ul class="plain">
        <?php foreach ($drafts as $d): ?>
          <li><a href="/projects/<?= $d['project_id'] ?>#post-<?= $d['id'] ?>"><?= $t('channel.' . $d['channel']) ?> · <?= $h($d['project_name']) ?></a>
            <span class="muted small"><?= $h(mb_substr($d['text'], 0, 60)) ?>…</span></li>
        <?php endforeach ?>
      </ul>
    </section>
    <?php endif ?>
  </aside>
</div>
<?php endif ?>
