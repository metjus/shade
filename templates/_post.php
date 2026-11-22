<?php
/**
 * Karta príspevku. Premenné: $post, $back, $showProject, $t, $h, $csrf, $today.
 * @var array<string,mixed> $post
 */
$draft = $post['status'] === 'draft';
$late = $draft && $post['scheduled_for'] && $post['scheduled_for'] < $today;
?>
<article class="post<?= $draft ? '' : ' published' ?>" id="post-<?= $post['id'] ?>">
  <form method="post" action="/posts/<?= $post['id'] ?>">
    <?= $csrf ?><input type="hidden" name="back" value="<?= $h($back) ?>#post-<?= $post['id'] ?>">
    <header class="post-head">
      <div>
        <strong><?= $t('channel.' . $post['channel']) ?></strong>
        <span class="tag"><?= strtoupper($h($post['lang'])) ?></span>
        <?php if (!empty($showProject)): ?><span class="muted">· <?= $h($post['project_name']) ?></span><?php endif ?>
        <?php if ($post['source'] === 'variant'): ?><span class="tag"><?= $t('post.variant') ?></span><?php endif ?>
        <?php if (!$draft && $post['evergreen']): ?><span class="tag green"><?= $t('post.evergreen') ?></span><?php endif ?>
      </div>
      <button type="button" class="ghost small" data-copy="#text-<?= $post['id'] ?>"><?= $t('post.copy') ?></button>
    </header>

    <?php if ($draft): ?>
      <textarea id="text-<?= $post['id'] ?>" name="text" rows="6" aria-label="<?= $t('post.text') ?>"><?= $h($post['text']) ?></textarea>
      <?php if ($post['tip'] !== ''): ?><p class="muted small"><strong><?= $t('post.tip') ?>:</strong> <?= $h($post['tip']) ?></p><?php endif ?>
      <p class="muted small"><?= $t('besttime.' . $post['channel']) ?></p>
      <div class="post-actions">
        <label class="inline<?= $late ? ' late' : '' ?>"><?= $t('post.date') ?>
          <input type="date" name="date" value="<?= $h($post['scheduled_for']) ?>">
        </label>
        <button type="submit" name="action" value="save" class="ghost small"><?= $t('post.save') ?></button>
        <button type="submit" name="action" value="variants" class="ghost small" data-busy><?= $t('post.variants') ?></button>
        <button type="submit" name="action" value="publish" class="small"><?= $t('post.publish') ?></button>
        <button type="submit" name="action" value="delete" class="ghost small danger" data-confirm="<?= $t('post.delete_confirm') ?>"><?= $t('post.delete') ?></button>
      </div>
    <?php else: ?>
      <pre id="text-<?= $post['id'] ?>"><?= $h($post['text']) ?></pre>
      <p class="muted small"><?= $t('post.published_at') ?> <?= $h(substr((string) $post['published_at'], 0, 10)) ?></p>
      <fieldset class="results">
        <legend><?= $t('post.results') ?></legend>
        <label><?= $t('post.views') ?><input type="number" min="0" name="views" value="<?= $h((string) $post['views']) ?>"></label>
        <label><?= $t('post.reactions') ?><input type="number" min="0" name="reactions" value="<?= $h((string) $post['reactions']) ?>"></label>
        <label><?= $t('post.clicks') ?><input type="number" min="0" name="clicks" value="<?= $h((string) $post['clicks']) ?>"></label>
        <label class="wide"><?= $t('post.note') ?><input name="result_note" maxlength="500" value="<?= $h($post['result_note']) ?>" placeholder="<?= $t('post.note_ph') ?>"></label>
      </fieldset>
      <div class="post-actions">
        <button type="submit" name="action" value="results" class="ghost small"><?= $t('post.save_results') ?></button>
        <button type="submit" name="action" value="evergreen" class="ghost small"><?= $t($post['evergreen'] ? 'post.evergreen_off' : 'post.evergreen_on') ?></button>
        <button type="submit" name="action" value="variants" class="ghost small" data-busy><?= $t('post.reshare') ?></button>
        <button type="submit" name="action" value="unpublish" class="ghost small"><?= $t('post.unpublish') ?></button>
      </div>
    <?php endif ?>
  </form>
</article>
