<?php
declare(strict_types=1);

function flowcean_default_state(string $workspaceName = 'Flowcean Workspace', string $workspaceSlug = 'main'): array
{
    $nowMs = (int) round(microtime(true) * 1000);
    $today = new DateTimeImmutable('today');

    $todayIso = $today->format('Y-m-d');
    $plus3 = $today->modify('+3 days')->format('Y-m-d');
    $plus7 = $today->modify('+7 days')->format('Y-m-d');
    $plus10 = $today->modify('+10 days')->format('Y-m-d');

    return [
        'workspace' => [
            'name' => $workspaceName,
            'theme' => 'light',
        ],
        'pages' => [
            [
                'id' => 'page-welcome',
                'parentId' => null,
                'title' => 'Bienvenue dans Flowcean',
                'icon' => '🌿',
                'favorite' => true,
                'expanded' => true,
                'kind' => 'document',
                'updatedAt' => $nowMs,
                'deletedAt' => null,
                'blocks' => [
                    [
                        'id' => 'block-welcome-1',
                        'type' => 'h1',
                        'text' => 'Votre espace Flowcean est maintenant sauvegarde sur le serveur',
                        'checked' => false,
                    ],
                    [
                        'id' => 'block-welcome-2',
                        'type' => 'paragraph',
                        'text' => 'Les donnees sont stockees dans MySQL via une API PHP locale, ce qui prepare l arrivee des utilisateurs et des workspaces partages.',
                        'checked' => false,
                    ],
                    [
                        'id' => 'block-welcome-3',
                        'type' => 'todo',
                        'text' => 'Creer des utilisateurs',
                        'checked' => false,
                    ],
                    [
                        'id' => 'block-welcome-4',
                        'type' => 'todo',
                        'text' => 'Partager un espace entre plusieurs membres',
                        'checked' => false,
                    ],
                    [
                        'id' => 'block-welcome-5',
                        'type' => 'todo',
                        'text' => 'Ajouter la synchronisation collaborative temps reel',
                        'checked' => false,
                    ],
                ],
                'database' => null,
            ],
            [
                'id' => 'page-roadmap',
                'parentId' => null,
                'title' => 'Roadmap produit',
                'icon' => '🚀',
                'favorite' => true,
                'expanded' => true,
                'kind' => 'database',
                'updatedAt' => $nowMs,
                'deletedAt' => null,
                'blocks' => [],
                'database' => [
                    'activeView' => 'board',
                    'viewMonth' => $today->format('Y-m-01'),
                    'properties' => [
                        ['id' => 'prop-name', 'name' => 'Nom', 'type' => 'text', 'options' => []],
                        ['id' => 'prop-status', 'name' => 'Statut', 'type' => 'select', 'options' => ['A faire', 'En cours', 'Bloque', 'Lance']],
                        ['id' => 'prop-date', 'name' => 'Date', 'type' => 'date', 'options' => []],
                        ['id' => 'prop-owner', 'name' => 'Responsable', 'type' => 'text', 'options' => []],
                        ['id' => 'prop-done', 'name' => 'Fait', 'type' => 'checkbox', 'options' => []],
                    ],
                    'rows' => [
                        [
                            'id' => 'row-1',
                            'cells' => [
                                'prop-name' => 'Base serveur MySQL',
                                'prop-status' => 'Lance',
                                'prop-date' => $todayIso,
                                'prop-owner' => 'Codex',
                                'prop-done' => true,
                            ],
                        ],
                        [
                            'id' => 'row-2',
                            'cells' => [
                                'prop-name' => 'Gestion des membres',
                                'prop-status' => 'A faire',
                                'prop-date' => $plus3,
                                'prop-owner' => 'Equipe produit',
                                'prop-done' => false,
                            ],
                        ],
                        [
                            'id' => 'row-3',
                            'cells' => [
                                'prop-name' => 'Edition collaborative',
                                'prop-status' => 'En cours',
                                'prop-date' => $plus7,
                                'prop-owner' => 'Equipe temps reel',
                                'prop-done' => false,
                            ],
                        ],
                        [
                            'id' => 'row-4',
                            'cells' => [
                                'prop-name' => 'Historique des activites',
                                'prop-status' => 'Bloque',
                                'prop-date' => $plus10,
                                'prop-owner' => 'Backend',
                                'prop-done' => false,
                            ],
                        ],
                    ],
                ],
            ],
        ],
        'ui' => [
            'activePageId' => 'page-welcome',
        ],
        'meta' => [
            'workspaceSlug' => $workspaceSlug,
            'serverVersion' => 0,
            'lastSyncedAt' => null,
            'source' => 'server',
        ],
    ];
}
