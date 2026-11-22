<?php /** @var callable $t @var string $csrf @var ?string $error @var bool $configured */ ?>
<form method="post" action="/login" class="card login">
  <?= $csrf ?>
  <div class="logo">shade<span>.sk</span></div>
  <?php if (!$configured): ?>
    <p class="flash error"><?= $t('login.not_configured') ?></p>
    <pre>php bin/set-password.php</pre>
  <?php else: ?>
    <label><?= $t('login.password') ?>
      <input type="password" name="password" autocomplete="current-password" required autofocus>
    </label>
    <?php if ($error): ?><p class="flash error" role="alert"><?= htmlspecialchars($error) ?></p><?php endif ?>
    <button type="submit"><?= $t('login.submit') ?></button>
  <?php endif ?>
</form>
