<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

try {
    $pdo = formcean_pdo();
    $user = formcean_require_user($pdo);
    $form = formcean_require_form($pdo, (int) ($_GET['id'] ?? 0), $user);
    $responses = formcean_list_responses($pdo, $form);
    $fields = formcean_decode_fields($form['fields_json'] ?? null);

    $filename = formcean_slugify((string) $form['title']) . '-reponses.csv';

    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="' . $filename . '"');
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

    $output = fopen('php://output', 'wb');
    if (!$output) {
        throw new RuntimeException('Export CSV indisponible.');
    }

    fwrite($output, "\xEF\xBB\xBF");
    $headers = ['Date de reponse'];
    $settings = formcean_decode_settings($form['settings_json'] ?? null);
    if (!empty($settings['collectEmail'])) {
        $headers[] = 'Email';
    }
    foreach ($fields as $field) {
        $headers[] = (string) $field['label'];
    }
    fputcsv($output, $headers, ';');

    foreach (array_reverse($responses) as $response) {
        $answersById = [];
        foreach ($response['answers'] as $answer) {
            $answersById[(string) ($answer['id'] ?? '')] = (string) ($answer['displayValue'] ?? '');
        }

        $row = [$response['createdAt']];
        if (!empty($settings['collectEmail'])) {
            $row[] = $response['respondent']['email'] ?? '';
        }
        foreach ($fields as $field) {
            $row[] = $answersById[(string) $field['id']] ?? '';
        }
        fputcsv($output, $row, ';');
    }

    fclose($output);
    exit;
} catch (InvalidArgumentException $exception) {
    formcean_json_response([
        'ok' => false,
        'error' => 'validation_error',
        'message' => $exception->getMessage(),
    ], 422);
} catch (Throwable $exception) {
    formcean_json_response([
        'ok' => false,
        'error' => 'server_error',
        'message' => $exception->getMessage(),
    ], 500);
}
