const fs = require('fs');
const os = require('os');
const path = require('path');

const PRIMARY_ATTACHMENTS_DIR = path.resolve(process.env.MOBYWORK_ATTACHMENTS_DIR || path.join(__dirname, 'attachments'));
const FALLBACK_ATTACHMENTS_DIR = path.resolve(
    process.env.MOBYWORK_ATTACHMENTS_FALLBACK_DIR || path.join(os.tmpdir(), 'mobywork-attachments')
);

function ensureWritableDirectory(dir) {
    try {
        fs.mkdirSync(dir, { recursive: true });
        fs.accessSync(dir, fs.constants.W_OK);
        return true;
    } catch (error) {
        console.warn(`[attachments] Dossier non accessible ${dir}: ${error.message}`);
        return false;
    }
}

const ATTACHMENTS_DIR = ensureWritableDirectory(PRIMARY_ATTACHMENTS_DIR)
    ? PRIMARY_ATTACHMENTS_DIR
    : (ensureWritableDirectory(FALLBACK_ATTACHMENTS_DIR) ? FALLBACK_ATTACHMENTS_DIR : PRIMARY_ATTACHMENTS_DIR);

const ATTACHMENTS_DIRS = Array.from(new Set([
    ATTACHMENTS_DIR,
    PRIMARY_ATTACHMENTS_DIR,
    FALLBACK_ATTACHMENTS_DIR,
].map(dir => path.resolve(dir))));

function isInsideDirectory(filePath, dir) {
    const resolvedFile = path.resolve(filePath);
    const resolvedDir = path.resolve(dir);
    return resolvedFile === resolvedDir || resolvedFile.startsWith(`${resolvedDir}${path.sep}`);
}

function resolveStoredAttachmentPath(storedPath) {
    if (!storedPath) return null;
    const absolutePath = path.isAbsolute(storedPath)
        ? storedPath
        : path.join(ATTACHMENTS_DIR, storedPath);
    const resolved = path.resolve(absolutePath);

    return ATTACHMENTS_DIRS.some(dir => isInsideDirectory(resolved, dir)) ? resolved : null;
}

module.exports = {
    ATTACHMENTS_DIR,
    ATTACHMENTS_DIRS,
    ensureWritableDirectory,
    isInsideDirectory,
    resolveStoredAttachmentPath,
};
