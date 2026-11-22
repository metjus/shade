<?php
// Skopíruj ako config.php (je v .gitignore) a doplň kľúč.
// Bez kľúča beží nástroj v DEMO režime so vzorovými výstupmi.
return [
    'anthropic_api_key' => getenv('ANTHROPIC_API_KEY') ?: '',
    'model'             => getenv('SHADE_MODEL') ?: 'claude-opus-5-5',
    // low | medium | high — vyššie = dôkladnejšie, ale pomalšie a drahšie
    'effort'            => getenv('SHADE_EFFORT') ?: 'medium',
];
