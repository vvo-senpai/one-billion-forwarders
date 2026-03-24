


<?php
$dir = __DIR__ . '/assets/images/avis/';
$webPath = 'assets/images/avis/';
$files = [];
$debug = [];
$scanned = [];
$globbed = [];

$debug[] = [
    'checked_dir' => $dir,
    'exists' => is_dir($dir),
    'readable' => is_readable($dir),
];

if (is_dir($dir)) {
    $scanned = scandir($dir) ?: [];

    $patterns = [
        $dir . '*.jpg',
        $dir . '*.jpeg',
        $dir . '*.png',
        $dir . '*.webp',
        $dir . '*.gif',
        $dir . '*.JPG',
        $dir . '*.JPEG',
        $dir . '*.PNG',
        $dir . '*.WEBP',
        $dir . '*.GIF',
    ];

    foreach ($patterns as $pattern) {
        $matches = glob($pattern) ?: [];
        foreach ($matches as $match) {
            $globbed[] = $match;
        }
    }

    $globbed = array_values(array_unique($globbed));
    sort($globbed, SORT_NATURAL | SORT_FLAG_CASE);

    foreach ($globbed as $fullPath) {
        if (!is_file($fullPath)) {
            continue;
        }

        $files[] = basename($fullPath);
    }
}

sort($files, SORT_NATURAL | SORT_FLAG_CASE);

if (!empty($files)) {
    echo '<div class="services-carousel operations-carousel">';
    echo '<button class="services-carousel-btn prev" type="button" aria-label="Éléments précédents">‹</button>';
    echo '<div class="services-carousel-window">';
    echo '<div class="services-carousel-track">';

    foreach ($files as $file) {
        $src = htmlspecialchars($webPath . rawurlencode($file), ENT_QUOTES, 'UTF-8');
        echo '<article class="service" style="padding:0; min-height:auto; background:transparent; border:0; box-shadow:none; backdrop-filter:none; overflow:hidden;">';
        echo '<img src="' . $src . '" alt="Opération réalisée" style="width:100%; height:240px; object-fit:cover; border-radius:16px; display:block;" />';
        echo '</article>';
    }

    echo '</div>';
    echo '</div>';
    echo '<button class="services-carousel-btn next" type="button" aria-label="Éléments suivants">›</button>';
    echo '</div>';
} else {
    echo '<p style="color:var(--muted);">Aucune image trouvée dans le dossier <code>assets/images/avis/</code>.</p>';
    echo '<pre style="color:var(--muted); white-space:pre-wrap; font-size:12px; opacity:.9;">';
    echo "Diagnostics PHP :\n";

    foreach ($debug as $entry) {
        echo '- Dossier testé : ' . htmlspecialchars($entry['checked_dir'], ENT_QUOTES, 'UTF-8') . "\n";
        echo '  Existe : ' . ($entry['exists'] ? 'oui' : 'non') . "\n";
        echo '  Lisible : ' . ($entry['readable'] ? 'oui' : 'non') . "\n";
    }

    echo "\nContenu du dossier (scandir) :\n";
    foreach ($scanned as $f) {
        echo '- ' . $f . "\n";
    }

    echo "\nRésultat glob() :\n";
    foreach ($globbed as $g) {
        echo '- ' . $g . "\n";
    }

    echo "\nFichiers image détectés : " . count($files) . "\n";

    if (!empty($files)) {
        echo "\nNoms retenus :\n";
        foreach ($files as $f) {
            echo '- ' . $f . "\n";
        }
    }

    echo '</pre>';
}