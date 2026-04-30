import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Download, Eye, File, FileArchive, FileSpreadsheet, FileText, Image, Paperclip, X } from 'lucide-react';

const API_URL = `${import.meta.env.VITE_API_URL || '/api'}`;

function FileIcon({ contentType = '' }) {
  const size = 18;
  if (contentType.startsWith('image/')) return <Image size={size} />;
  if (contentType === 'application/pdf') return <FileText size={size} />;
  if (contentType.includes('sheet') || contentType.includes('excel')) return <FileSpreadsheet size={size} />;
  if (contentType.includes('zip') || contentType.includes('rar')) return <FileArchive size={size} />;
  return <File size={size} />;
}

function formatSize(bytes = 0) {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function isPreviewable(contentType = '') {
  return contentType.startsWith('image/') || contentType === 'application/pdf';
}

function attachmentUrl(mailId, filename, preview = false) {
  const base = `${API_URL}/emails/${mailId}/attachments/${encodeURIComponent(filename)}`;
  return preview ? `${base}/preview` : base;
}

function AttachmentCard({ mailId, att }) {
  const [previewing, setPreviewing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const filename = att.filename || 'piece-jointe';
  const contentType = att.contentType || 'application/octet-stream';

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const fetchBlob = async (preview = false) => {
    const res = await axios.get(attachmentUrl(mailId, filename, preview), {
      responseType: 'blob',
    });
    return new Blob([res.data], { type: res.headers['content-type'] || contentType });
  };

  const handlePreview = async () => {
    setPreviewing(true);
    if (previewUrl) return;

    setIsLoadingPreview(true);
    try {
      const blob = await fetchBlob(true);
      setPreviewUrl(URL.createObjectURL(blob));
    } catch (error) {
      console.error('Erreur apercu piece jointe:', error);
      alert("Impossible de charger l'apercu de cette piece jointe.");
      setPreviewing(false);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const blob = await fetchBlob(false);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch (error) {
      console.error('Erreur telechargement piece jointe:', error);
      alert('Impossible de telecharger cette piece jointe.');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="attachment-card">
      {previewing && (
        <div className="attachment-preview-overlay" onClick={() => setPreviewing(false)}>
          <div className="attachment-preview-modal" onClick={e => e.stopPropagation()}>
            <div className="attachment-preview-header">
              <span>{filename}</span>
              <button className="attachment-preview-close" onClick={() => setPreviewing(false)} title="Fermer">
                <X size={14} />
              </button>
            </div>
            {isLoadingPreview && <div className="attachment-preview-loading">Chargement...</div>}
            {!isLoadingPreview && previewUrl && contentType.startsWith('image/') && (
              <img src={previewUrl} alt={filename} style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain' }} />
            )}
            {!isLoadingPreview && previewUrl && contentType === 'application/pdf' && (
              <iframe
                src={previewUrl}
                title={filename}
                style={{ width: '100%', height: '70vh', border: 'none', background: 'white' }}
              />
            )}
          </div>
        </div>
      )}

      <div className="attachment-icon"><FileIcon contentType={contentType} /></div>
      <div className="attachment-info">
        <div className="attachment-name" title={filename}>{filename}</div>
        <div className="attachment-meta">
          <span className="attachment-type">{contentType.split('/')[1]?.toUpperCase() || 'FICHIER'}</span>
          <span className="attachment-size">{formatSize(att.size)}</span>
        </div>
      </div>
      <div className="attachment-actions">
        {isPreviewable(contentType) && (
          <button className="att-btn" title="Apercu" onClick={handlePreview} disabled={isLoadingPreview}>
            <Eye size={15} />
          </button>
        )}
        <button className="att-btn att-btn-download" title="Telecharger" onClick={handleDownload} disabled={isDownloading}>
          <Download size={15} />
        </button>
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
        <Paperclip size={14} />
        <span>{attachments.length} piece{attachments.length > 1 ? 's' : ''} jointe{attachments.length > 1 ? 's' : ''}</span>
      </div>
      <div className="attachments-grid">
        {attachments.map((att, i) => (
          <AttachmentCard key={`${att.filename || 'attachment'}-${i}`} mailId={mailId} att={att} />
        ))}
      </div>
    </div>
  );
}
