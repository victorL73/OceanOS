<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

function oceanos_target_user(PDO $pdo, int $targetUserId): array
{
    $target = oceanos_find_user_by_id($pdo, $targetUserId);
    if ($target === null) {
        throw new InvalidArgumentException('Utilisateur introuvable.');
    }

    return $target;
}

function oceanos_is_protected_admin_role(array $user): bool
{
    return in_array(oceanos_normalize_role((string) ($user['role'] ?? 'member')), ['admin', 'super'], true);
}

function oceanos_assert_admin_can_update_user(array $actor, array $target, array $input): void
{
    if (oceanos_is_super_user($actor) || !oceanos_is_protected_admin_role($target)) {
        return;
    }

    $targetRole = oceanos_normalize_role((string) ($target['role'] ?? 'member'));
    $requestedRole = array_key_exists('role', $input)
        ? oceanos_normalize_role((string) $input['role'])
        : $targetRole;
    $targetIsActive = (bool) ($target['is_active'] ?? false);
    $requestedIsActive = array_key_exists('isActive', $input)
        ? (bool) $input['isActive']
        : $targetIsActive;
    $targetModules = oceanos_decode_visible_modules($target['visible_modules_json'] ?? null);
    $requestedModules = array_key_exists('visibleModules', $input)
        ? oceanos_normalize_visible_modules($input['visibleModules'], $targetModules)
        : $targetModules;

    if ($requestedRole !== $targetRole || $requestedIsActive !== $targetIsActive || $requestedModules !== $targetModules) {
        throw new InvalidArgumentException('Seul un super-utilisateur peut modifier les droits ou l activation d un administrateur.');
    }
}

function oceanos_assert_admin_can_delete_user(array $actor, array $target): void
{
    if (!oceanos_is_super_user($actor) && oceanos_is_protected_admin_role($target)) {
        throw new InvalidArgumentException('Seul un super-utilisateur peut supprimer un compte administrateur ou super-utilisateur.');
    }
}

try {
    $pdo = oceanos_pdo();
    $admin = oceanos_require_admin($pdo);
    $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

    if ($method === 'GET') {
        oceanos_json_response([
            'ok' => true,
            'managedBy' => 'OceanOS',
            'currentUser' => oceanos_public_user($admin),
            'users' => oceanos_list_users($pdo),
        ]);
    }

    if ($method === 'POST') {
        $input = oceanos_read_json_request();
        $requestedRole = oceanos_normalize_role((string) ($input['role'] ?? 'member'));
        if ($requestedRole === 'super' && !oceanos_is_super_user($admin)) {
            throw new InvalidArgumentException('Seul un super-utilisateur peut creer un compte super-utilisateur.');
        }

        $user = oceanos_create_user(
            $pdo,
            (string) ($input['displayName'] ?? ''),
            (string) ($input['email'] ?? ''),
            (string) ($input['password'] ?? ''),
            $requestedRole,
            array_key_exists('visibleModules', $input)
                ? oceanos_normalize_visible_modules($input['visibleModules'])
                : null
        );

        oceanos_json_response([
            'ok' => true,
            'managedBy' => 'OceanOS',
            'message' => 'Compte cree dans OceanOS.',
            'createdBy' => oceanos_public_user($admin),
            'user' => oceanos_public_user($user),
            'users' => oceanos_list_users($pdo),
        ], 201);
    }

    if ($method === 'PATCH') {
        $input = oceanos_read_json_request();
        $targetUserId = (int) ($input['id'] ?? $_GET['id'] ?? 0);
        if ($targetUserId <= 0) {
            throw new InvalidArgumentException('Utilisateur invalide.');
        }

        $target = oceanos_target_user($pdo, $targetUserId);
        oceanos_assert_admin_can_update_user($admin, $target, $input);
        $user = oceanos_update_user($pdo, $targetUserId, $input, $admin);

        oceanos_json_response([
            'ok' => true,
            'managedBy' => 'OceanOS',
            'message' => 'Compte mis a jour dans OceanOS.',
            'updatedBy' => oceanos_public_user($admin),
            'user' => oceanos_public_user($user),
            'currentUser' => oceanos_public_user(oceanos_find_user_by_id($pdo, (int) $admin['id']) ?? $admin),
            'users' => oceanos_list_users($pdo),
        ]);
    }

    if ($method === 'DELETE') {
        $input = oceanos_read_json_request();
        $targetUserId = (int) ($input['id'] ?? $_GET['id'] ?? 0);
        if ($targetUserId <= 0) {
            throw new InvalidArgumentException('Utilisateur invalide.');
        }

        $target = oceanos_target_user($pdo, $targetUserId);
        oceanos_assert_admin_can_delete_user($admin, $target);
        oceanos_delete_user($pdo, $targetUserId, $admin);

        oceanos_json_response([
            'ok' => true,
            'managedBy' => 'OceanOS',
            'message' => 'Compte supprime dans OceanOS.',
            'deletedBy' => oceanos_public_user($admin),
            'users' => oceanos_list_users($pdo),
        ]);
    }

    oceanos_json_response([
        'ok' => false,
        'error' => 'method_not_allowed',
        'message' => 'Methode non supportee.',
    ], 405);
} catch (InvalidArgumentException $exception) {
    oceanos_json_response([
        'ok' => false,
        'error' => 'validation_error',
        'message' => $exception->getMessage(),
    ], 422);
} catch (Throwable $exception) {
    oceanos_json_response([
        'ok' => false,
        'error' => 'server_error',
        'message' => $exception->getMessage(),
    ], 500);
}
