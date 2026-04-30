import React from 'react';
import { Archive, Check, CheckSquare, RotateCcw, Search, Square, Trash2, X } from 'lucide-react';

export default function MailList({
    mails,
    selectedMailId,
    onSelectMail,
    searchTerm,
    onSearch,
    activeFilter,
    selectedIds = [],
    isBulkBusy = false,
    onToggleSelect,
    onSelectAll,
    onBulkStatus,
    onBulkDelete,
    onBulkFolder,
    folders = [],
}) {
    const [draggingIds, setDraggingIds] = React.useState([]);

    const formatDate = (dateString) => {
        if (!dateString) return '';
        const d = new Date(dateString);
        return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short' }).format(d);
    };

    const getPriorityDot = (priorite) => {
        switch(priorite) {
            case 'urgent': return '🔴';
            case 'important': return '🟠';
            case 'normal': return '🔵';
            default: return '⚫';
        }
    };

    const isAdvertising = (mail) => {
        if (Number(mail.is_advertising) === 1) return true;
        const haystack = `${mail.categorie || ''} ${mail.action_recommandee || ''} ${mail.subject || ''} ${mail.resume || ''}`;
        return /newsletter|promo|promotion|publicit|marketing|soldes|unsubscribe|desabonn/i.test(haystack);
    };

    const selectedCount = selectedIds.length;
    const allVisibleSelected = mails.length > 0 && mails.every(mail => selectedIds.includes(mail.id));
    const canDeleteForever = activeFilter === 'archive';
    const folderById = new Map(folders.map(folder => [String(folder.id), folder]));

    const startDragMail = (event, mail) => {
        const ids = selectedIds.includes(mail.id) ? selectedIds : [mail.id];
        setDraggingIds(ids);
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('application/x-mobywork-mails', JSON.stringify(ids));
        event.dataTransfer.setData('text/plain', ids.join(','));
    };

    return (
        <div className="mail-list-panel">
            {/* SEARCH */}
            <div className="mail-list-header">
                <div className="mail-list-search">
                    <input 
                        type="text" 
                        placeholder="Rechercher..." 
                        value={searchTerm}
                        onChange={(e) => onSearch(e.target.value)}
                    />
                    <Search className="search-icon" size={14} />
                </div>
                <div className="mail-list-meta-row">
                    <button
                        className="mail-select-all"
                        onClick={onSelectAll}
                        disabled={mails.length === 0 || isBulkBusy}
                        title={allVisibleSelected ? 'Deselectionner les mails visibles' : 'Selectionner les mails visibles'}
                    >
                        {allVisibleSelected ? <CheckSquare size={15} /> : <Square size={15} />}
                    </button>
                    <div className="mail-list-count">{mails.length} messages</div>
                </div>
                {selectedCount > 0 && (
                    <div className="mail-bulk-bar">
                        <span>{selectedCount} selectionne{selectedCount > 1 ? 's' : ''}</span>
                        <button className="mail-bulk-btn" onClick={() => onBulkStatus('traite')} disabled={isBulkBusy} title="Marquer comme traite">
                            <Check size={13} /> Traites
                        </button>
                        <button className="mail-bulk-btn" onClick={() => onBulkStatus('archive')} disabled={isBulkBusy} title="Archiver">
                            <Archive size={13} /> Archiver
                        </button>
                        {folders.length > 0 && (
                            <select
                                className="mail-folder-select"
                                defaultValue=""
                                onChange={(e) => {
                                    const value = e.target.value;
                                    if (value) onBulkFolder?.(value);
                                    e.target.value = '';
                                }}
                                disabled={isBulkBusy}
                                title="Classer dans un dossier"
                            >
                                <option value="">Classer...</option>
                                {folders.map(folder => (
                                    <option key={folder.id} value={folder.id}>
                                        {folder.name} - {folder.mailbox_address}
                                    </option>
                                ))}
                                <option value="__none">Retirer du dossier</option>
                            </select>
                        )}
                        {activeFilter === 'treated' && (
                            <button className="mail-bulk-btn" onClick={() => onBulkStatus('a_repondre')} disabled={isBulkBusy} title="Remettre a traiter">
                                <RotateCcw size={13} /> A traiter
                            </button>
                        )}
                        {canDeleteForever && (
                            <button className="mail-bulk-btn danger" onClick={onBulkDelete} disabled={isBulkBusy} title="Supprimer definitivement">
                                <Trash2 size={13} /> Supprimer
                            </button>
                        )}
                        <button className="mail-bulk-clear" onClick={() => selectedIds.forEach(id => onToggleSelect(id, false))} disabled={isBulkBusy} title="Annuler la selection">
                            <X size={13} />
                        </button>
                    </div>
                )}
            </div>

            {/* LIST */}
            <div className="mail-list-scroll">
                {mails.map(mail => {
                    const isSent = mail.direction === 'sent' || mail.status === 'sent';
                    const displayAddress = isSent ? (mail.to_address || mail.from_address) : mail.from_address;
                    // Extraction des initiales
                    let initial = "M";
                    if (displayAddress) {
                        const match = displayAddress.match(/^"?([^"<>@]+)/);
                        if (match && match[1]) {
                            initial = match[1].charAt(0).toUpperCase();
                        }
                    }

                    // Assombrir les logs "Archiver" 
                    const isIgnored = mail.action_recommandee === 'Ignorer' || mail.action_recommandee === 'Archiver';
                    const assignedFolder = mail.folder_id ? folderById.get(String(mail.folder_id)) : null;

                    return (
                        <div 
                            key={mail.id} 
                            className={`mail-card ${selectedMailId === mail.id ? 'selected' : ''} ${selectedIds.includes(mail.id) ? 'bulk-selected' : ''} ${mail.status === 'a_repondre' ? 'unread' : ''} ${draggingIds.includes(mail.id) ? 'dragging' : ''}`}
                            onClick={() => onSelectMail(mail)}
                            draggable
                            onDragStart={(event) => startDragMail(event, mail)}
                            onDragEnd={() => setDraggingIds([])}
                            style={{ opacity: isIgnored ? 0.6 : 1 }}
                        >
                            <button
                                className="mail-card-checkbox"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onToggleSelect(mail.id, !selectedIds.includes(mail.id));
                                }}
                                title={selectedIds.includes(mail.id) ? 'Retirer de la selection' : 'Selectionner ce mail'}
                            >
                                {selectedIds.includes(mail.id) ? <CheckSquare size={15} /> : <Square size={15} />}
                            </button>
                            <div className="mail-card-top">
                                <div className="mail-avatar">{initial}</div>
                                <div className="mail-card-from">{isSent ? 'A : ' : ''}{displayAddress}</div>
                                <div className="mail-card-date">{formatDate(mail.date_reception)}</div>
                            </div>

                            <div className="mail-card-subject" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <span title={`Priorité: ${mail.priorite}`}>{getPriorityDot(mail.priorite)}</span>
                                <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{mail.subject}</span>
                            </div>

                            <div className="mail-card-preview">
                                {mail.resume || "Contenu du message ignoré ou crypté."}
                            </div>

                            {(isSent || mail.mailbox_address) && (
                                <div className="mail-card-tags">
                                    {isSent && <span className="badge badge-traite">Envoye</span>}
                                {mail.mailbox_address && <span className="badge badge-normal">{mail.mailbox_address}</span>}
                                {assignedFolder && <span className="badge badge-folder">{assignedFolder.name}</span>}
                            </div>
                            )}

                            <div className="mail-card-tags">
                                {mail.is_business === 1 && (
                                    <span className="badge" style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' }}>
                                        💰 Opportunité
                                    </span>
                                )}
                                {mail.action_recommandee === 'Répondre' && (
                                    <span className="badge badge-client">📝 À traiter</span>
                                )}
                                {['newsletter', 'newsletters'].includes(mail.categorie) && <span className="badge badge-normal">Newsletter</span>}
                                {isAdvertising(mail) && <span className="badge badge-ad">Pub</span>}
                                {mail.categorie === 'facture' && <span className="badge badge-facture">Facture</span>}
                                {mail.status === 'traite' && <span className="badge badge-traite">✓ Traité</span>}
                            </div>
                        </div>
                    );
                })}

                {mails.length === 0 && (
                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        Aucun message ne correspond.
                    </div>
                )}
            </div>
        </div>
    );
}
