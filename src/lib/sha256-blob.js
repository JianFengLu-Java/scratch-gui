import Sha256 from 'hash.js/lib/hash/sha/256';

const CHUNK_BYTES = 256 * 1024;

const sha256Blob = async blob => {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const subtle = typeof window !== 'undefined' && window.crypto && window.crypto.subtle;
    if (subtle && typeof subtle.digest === 'function') {
        const digest = await subtle.digest('SHA-256', bytes);
        return Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('');
    }

    // LAN HTTP lacks SubtleCrypto. Compute the same checksum and yield between chunks.
    const hash = new Sha256();
    for (let offset = 0; offset < bytes.length; offset += CHUNK_BYTES) {
        hash.update(bytes.subarray(offset, offset + CHUNK_BYTES));
        if (offset + CHUNK_BYTES < bytes.length) {
            await new Promise(resolve => setTimeout(resolve, 0));
        }
    }
    return hash.digest('hex');
};

export default sha256Blob;
