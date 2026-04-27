import React, { useState } from 'react';

const API_URL = `${import.meta.env.VITE_API_URL || '/api'}`;

// Icône selon le type MIME
function getFileIcon(contentType = '') {
  if (contentType.startsWith('image/'))           return '🖼️';
  if (contentType === 'application/pdf')           return '📄';
  if (contentType.includes('word') || contentType.includes('document')) return '📝';
  if (contentType.includes('sheet') || contentType.includes('excel'))   return '📊';
  if (contentType.includes('zip') || contentType.includes('rar'))       return '📦';
  return '📎';
}

function formatSize(bytes = 0) {
  if (bytes < 1024)       return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function isPreviewable(contentType = '') {
  return contentType.startsWith('image/') || contentType === 'application/pdf';
}

function AttachmentCard({ mailId, att }) {
  const [previewing, setPreviewing] = useState(false);

  const downloadUrl = `${API_URL}/emails/${mailId}/attachments/${encodeURIComponent(att.filename)}`;
  const previewUrl  = `${API_URL}/emails/${mailId}/attachments/${encodeURIComponent(att.filename)}/preview`;

  return (
    <div className="attachment-card">
      {/* Preview modal */}
      {previewing && (
        <div className="attachment-preview-overlay" onClick={() => setPreviewing(false)}>
          <div className="attachment-preview-modal" onClick={e => e.stopPropagation()}>
            <div className="attachment-preview-header">
              <span>{att.filename}</span>
              <button className="attachment-preview-close" onClick={() => setPreviewing(false)}>✕</button>
            </div>
            {att.contentType.startsWith('image/') ? (
              <img src={previewUrl} alt={att.filename} style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain' }} />
            ) : (
              <iframe
                src={previewUrl}
                title={att.filename}
                style={{ width: '100%', height: '70vh', border: 'none', background: 'white' }}
              />
            )}
          </div>
        </div>
      )}

      {/* Card */}
      <div className="attachment-icon">{getFileIcon(att.contentType)}</div>
      <div className="attachment-info">
        <div className="attachment-name" title={att.filename}>{att.filename}</div>
        <div className="attachment-meta">
          <span className="attachment-type">{att.contentType.split('/')[1]?.toUpperCase() || 'FICHIER'}</span>
          <span className="attachment-size">{formatSize(att.size)}</span>
        </div>
      </div>
      <div className="attachment-actions">
        {isPreviewable(att.contentType) && (
          <button
            className="att-btn"
            title="Aperçu"
            onClick={() => setPreviewing(true)}
          >
            👁
          </button>
        )}
        <a
          href={downloadUrl}
          download={att.filename}
          className="att-btn att-btn-download"
          title="Télécharger"
        >
          ⬇
        </a>
      </div>
    </div>
  );
}

export default function EmailAttachments({ mailId, attachmentsJson }) {
  let attachments = [];
  try {
    attachments = JSON.parse(attachmentsJson || '[]');
  } catch (e) {
    return null;
  }

  if (!attachments || attachments.length === 0) return null;

  return (
    <div className="attachments-section">
      <div className="attachments-title">
        <span>📎</span>
        <span>{attachments.length} pièce{attachments.length > 1 ? 's' : ''} jointe{attachments.length > 1 ? 's' : ''}</span>
      </div>
      <div className="attachments-grid">
        {attachments.map((att, i) => (
          <AttachmentCard key={i} mailId={mailId} att={att} />
        ))}
      </div>
    </div>
  );
}
