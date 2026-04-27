<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

try {
    $pdo = flowcean_pdo();
    $user = flowcean_require_auth($pdo);
    $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

    flowcean_sync_user_invitations($pdo, $user);
    flowcean_ensure_user_personal_workspace($pdo, $user);
    $user = flowcean_find_user_by_id($pdo, (int) $user['id']) ?? $user;

    if ($method === 'GET') {
        $requestedSlug = trim((string) ($_GET['slug'] ?? ''));
        if ($requestedSlug !== '') {
            $workspace = flowcean_require_workspace_access($pdo, flowcean_workspace_slug($requestedSlug), $user, 'viewer');
            $canManageMembers = (bool) (flowcean_workspace_permissions($workspace['member_role'] ?? null)['canManageMembers'] ?? false);

            flowcean_json_response([
                'ok' => true,
                'workspace' => flowcean_public_workspace($workspace),
                'members' => flowcean_list_workspace_members($pdo, (int) $workspace['id']),
                'invitations' => $canManageMembers ? flowcean_list_workspace_invitations($pdo, (int) $workspace['id']) : [],
            ]);
        }

        $workspaces = flowcean_list_user_workspaces($pdo, $user);
        $deletedWorkspaces = flowcean_list_deleted_user_workspaces($pdo, $user);
        $pendingInvitations = flowcean_list_user_pending_invitations($pdo, $user);

        flowcean_json_response([
            'ok' => true,
            'workspaces' => $workspaces,
            'deletedWorkspaces' => $deletedWorkspaces,
            'pendingInvitations' => $pendingInvitations,
            'preferredWorkspaceSlug' => $workspaces[0]['slug'] ?? null,
        ]);
    }

    if ($method === 'POST') {
        $input = flowcean_read_json_request();
        $action = strtolower(trim((string) ($input['action'] ?? 'create')));

        if ($action === 'create') {
            $workspace = flowcean_create_workspace(
                $pdo,
                $user,
                (string) ($input['name'] ?? ''),
                false
            );

            flowcean_json_response([
                'ok' => true,
                'message' => 'Workspace cree avec succes.',
                'workspace' => flowcean_public_workspace($workspace),
                'workspaces' => flowcean_list_user_workspaces($pdo, $user),
                'deletedWorkspaces' => flowcean_list_deleted_user_workspaces($pdo, $user),
                'pendingInvitations' => flowcean_list_user_pending_invitations($pdo, $user),
            ], 201);
        }

        if ($action === 'invite') {
            $workspace = flowcean_require_workspace_access(
                $pdo,
                flowcean_workspace_slug((string) ($input['workspaceSlug'] ?? '')),
                $user,
                'admin'
            );
            $invitation = flowcean_create_workspace_invitation(
                $pdo,
                (int) $workspace['id'],
                $user,
                (string) ($input['email'] ?? ''),
                (string) ($input['role'] ?? 'editor')
            );

            flowcean_json_response([
                'ok' => true,
                'message' => 'Invitation enregistree.',
                'workspace' => flowcean_public_workspace($workspace),
                'invitation' => flowcean_public_workspace_invitation($invitation),
                'members' => flowcean_list_workspace_members($pdo, (int) $workspace['id']),
                'invitations' => flowcean_list_workspace_invitations($pdo, (int) $workspace['id']),
            ], 201);
        }

        if ($action === 'update_member_role') {
            $workspace = flowcean_update_workspace_member_role(
                $pdo,
                flowcean_workspace_slug((string) ($input['workspaceSlug'] ?? '')),
                $user,
                (int) ($input['userId'] ?? 0),
                (string) ($input['role'] ?? 'editor')
            );

            flowcean_json_response([
                'ok' => true,
                'message' => 'Droits du membre modifies.',
                'workspace' => flowcean_public_workspace($workspace),
                'members' => flowcean_list_workspace_members($pdo, (int) $workspace['id']),
                'invitations' => flowcean_list_workspace_invitations($pdo, (int) $workspace['id']),
            ]);
        }

        if ($action === 'remove_member') {
            $workspace = flowcean_remove_workspace_member(
                $pdo,
                flowcean_workspace_slug((string) ($input['workspaceSlug'] ?? '')),
                $user,
                (int) ($input['userId'] ?? 0)
            );

            flowcean_json_response([
                'ok' => true,
                'message' => 'Membre retire du workspace.',
                'workspace' => flowcean_public_workspace($workspace),
                'members' => flowcean_list_workspace_members($pdo, (int) $workspace['id']),
                'invitations' => flowcean_list_workspace_invitations($pdo, (int) $workspace['id']),
            ]);
        }

        if ($action === 'accept_invite') {
            $workspace = flowcean_accept_workspace_invitation(
                $pdo,
                (int) ($input['invitationId'] ?? 0),
                $user
            );

            flowcean_json_response([
                'ok' => true,
                'message' => 'Invitation acceptee.',
                'workspace' => flowcean_public_workspace($workspace),
                'workspaces' => flowcean_list_user_workspaces($pdo, $user),
                'deletedWorkspaces' => flowcean_list_deleted_user_workspaces($pdo, $user),
                'pendingInvitations' => flowcean_list_user_pending_invitations($pdo, $user),
            ]);
        }

        if ($action === 'decline_invite') {
            flowcean_decline_workspace_invitation(
                $pdo,
                (int) ($input['invitationId'] ?? 0),
                $user
            );

            flowcean_json_response([
                'ok' => true,
                'message' => 'Invitation refusee.',
                'workspaces' => flowcean_list_user_workspaces($pdo, $user),
                'deletedWorkspaces' => flowcean_list_deleted_user_workspaces($pdo, $user),
                'pendingInvitations' => flowcean_list_user_pending_invitations($pdo, $user),
            ]);
        }

        if ($action === 'delete_workspace') {
            $deletedWorkspace = flowcean_soft_delete_workspace(
                $pdo,
                flowcean_workspace_slug((string) ($input['workspaceSlug'] ?? '')),
                $user
            );
            $workspaces = flowcean_list_user_workspaces($pdo, $user);

            flowcean_json_response([
                'ok' => true,
                'message' => 'Workspace supprime. Vous pouvez le restaurer pendant 30 jours.',
                'workspace' => flowcean_public_workspace($deletedWorkspace),
                'workspaces' => $workspaces,
                'deletedWorkspaces' => flowcean_list_deleted_user_workspaces($pdo, $user),
                'pendingInvitations' => flowcean_list_user_pending_invitations($pdo, $user),
                'preferredWorkspaceSlug' => $workspaces[0]['slug'] ?? null,
            ]);
        }

        if ($action === 'restore_workspace') {
            $restoredWorkspace = flowcean_restore_workspace(
                $pdo,
                flowcean_workspace_slug((string) ($input['workspaceSlug'] ?? '')),
                $user
            );

            flowcean_json_response([
                'ok' => true,
                'message' => 'Workspace restaure.',
                'workspace' => flowcean_public_workspace($restoredWorkspace),
                'workspaces' => flowcean_list_user_workspaces($pdo, $user),
                'deletedWorkspaces' => flowcean_list_deleted_user_workspaces($pdo, $user),
                'pendingInvitations' => flowcean_list_user_pending_invitations($pdo, $user),
            ]);
        }

        flowcean_json_response([
            'ok' => false,
            'error' => 'unsupported_action',
            'message' => 'Action non supportee.',
        ], 422);
    }

    flowcean_json_response([
        'ok' => false,
        'error' => 'method_not_allowed',
        'message' => 'Methode non supportee.',
    ], 405);
} catch (InvalidArgumentException $exception) {
    flowcean_json_response([
        'ok' => false,
        'error' => 'validation_error',
        'message' => $exception->getMessage(),
    ], 422);
} catch (Throwable $exception) {
    flowcean_json_response([
        'ok' => false,
        'error' => 'server_error',
        'message' => $exception->getMessage(),
    ], 500);
}
