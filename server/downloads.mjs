// Atomic claim of one download. The condition lives in the UPDATE itself, so even if two processes pass the pre-check at the
// same moment (or a caller skips it), the stored limit can never be exceeded. Returns true only if THIS call got the slot.
export function claimDownload(db, tokenHash) {
  return db.prepare('UPDATE downloads SET download_count = download_count + 1 WHERE token_hash = ? AND download_count < max_downloads AND revoked = 0')
    .run(tokenHash).changes === 1;
}

// Gives the slot back (the file turned out to be unavailable: the buyer must not lose a download to our fault).
export function releaseDownload(db, tokenHash) {
  db.prepare('UPDATE downloads SET download_count = download_count - 1 WHERE token_hash = ? AND download_count > 0').run(tokenHash);
}
