<?php
/** @var callable $t @var callable $h @var DateTimeImmutable $first @var DateTimeImmutable $last @var array<string,list<array>> $byDay @var string $prev @var string $next @var string $today */
$lead = (int) $first->format('N') - 1; // pondelok = 0
$days = (int) $last->format('j');
?>
<div class="cal-head">
  <a class="button ghost" href="/calendar?m=<?= $prev ?>" aria-label="<?= $t('cal.prev') ?>">←</a>
  <h1><?= $t('month.' . $first->format('n')) ?> <?= $first->format('Y') ?></h1>
  <a class="button ghost" href="/calendar?m=<?= $next ?>" aria-label="<?= $t('cal.next') ?>">→</a>
</div>
<p class="muted"><?= $t('cal.help') ?></p>

<div class="calendar">
  <?php foreach (['1', '2', '3', '4', '5', '6', '7'] as $d): ?><div class="dow"><?= $t('dow.' . $d) ?></div><?php endforeach ?>
  <?php for ($i = 0; $i < $lead; $i++): ?><div class="day pad" aria-hidden="true"></div><?php endfor ?>
  <?php for ($d = 1; $d <= $days; $d++):
      $date = $first->format('Y-m-') . str_pad((string) $d, 2, '0', STR_PAD_LEFT);
      $items = $byDay[$date] ?? [];
  ?>
    <div class="day<?= $date === $today ? ' today' : '' ?><?= $items ? '' : ' none' ?>">
      <div class="num"><?= $d ?>.<span class="dow-inline"> <?= $t('dow.' . date('N', strtotime($date))) ?></span></div>
      <?php foreach ($items as $p): ?>
        <a class="chip <?= $p['status'] ?>" href="/projects/<?= $p['project_id'] ?>#post-<?= $p['id'] ?>">
          <?= $t('channel.' . $p['channel']) ?> · <?= $h($p['project_name']) ?>
        </a>
      <?php endforeach ?>
    </div>
  <?php endfor ?>
</div>
