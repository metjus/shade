<?php

// Len pre lokálny vývoj: php -S localhost:8000 -t public public/router.php
if (PHP_SAPI === 'cli-server' && is_file(__DIR__ . parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH))) {
    return false;
}
require __DIR__ . '/index.php';
