/**
 * GitDownload.ts
 *
 * Low-level helpers for cloning a GitHub repository via isomorphic-git
 * and reading raw file content (blobs) from the in-browser filesystem.
 * Nothing in this module performs any line-level analysis.
 */

import git from 'isomorphic-git';
import http from 'isomorphic-git/http/web';
import FS from '@isomorphic-git/lightning-fs';

// ── Filesystem singleton ──────────────────────────────────────────────────────

export const fs = new FS('gitcharts');
export const pfs = fs.promises;

// ── Utilities ─────────────────────────────────────────────────────────────────

/**
 * Wraps a promise so that it rejects after `ms` milliseconds with a
 * descriptive error message.
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message: string
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`Timeout: ${message}`)), ms);
  });
  const result = await Promise.race([promise, timeoutPromise]);
  clearTimeout(timeoutId!);
  return result;
}

// ── Clone ─────────────────────────────────────────────────────────────────────

export interface CloneOptions {
  dir: string;
  repoUrl: string;
  depth?: number;
  onProgress?: (msg: string) => void;
}

/**
 * Recursively deletes a directory (and all its contents) from lightning-fs.
 * Silently ignores "not found" errors.
 */
async function rmrf(path: string): Promise<void> {
  let stat: any;
  try {
    stat = await pfs.stat(path);
  } catch {
    return; // doesn't exist, nothing to do
  }

  if (stat.isDirectory()) {
    const entries: string[] = await pfs.readdir(path);
    for (const e of entries) {
      await rmrf(`${path}/${e}`);
    }
    await pfs.rmdir(path);
  } else {
    await pfs.unlink(path);
  }
}

/**
 * Clones a repository (shallow) into the in-browser FS.
 * Creates the target directory if it doesn't already exist.
 */
export async function cloneRepo(opts: CloneOptions): Promise<void> {
  const { dir, repoUrl, depth = 100, onProgress } = opts;

  // Always wipe the previous clone so we never reuse stale git objects
  // that were fetched before code fixes.
  if (onProgress) onProgress('Clearing previous clone...');
  await rmrf(dir);
  
  // Recursively create directories
  const parts = dir.split('/').filter(Boolean);
  let currentPath = '';
  for (const part of parts) {
    currentPath += `/${part}`;
    try {
      await pfs.stat(currentPath);
    } catch {
      await pfs.mkdir(currentPath);
    }
  }

  await withTimeout(
    git.clone({
      fs,
      http,
      dir,
      url: repoUrl,
      corsProxy: 'https://cors.isomorphic-git.org',
      singleBranch: true,
      depth,
      onProgress: (p) => {
        if (onProgress && p.phase) {
          const pct = Math.round((p.loaded / (p.total || 1)) * 100);
          onProgress(`Cloning: ${p.phase} (${pct}%)`);
        }
      },
    }),
    180_000, // 3 min – a deeper clone takes longer
    'Cloning repository'
  );
}

// ── Commit log ────────────────────────────────────────────────────────────────

export interface CommitEntry {
  oid: string;
  timestamp: number; // Unix seconds
}

/**
 * Returns the last `depth` commits for the checked-out branch.
 */
export async function readCommitLog(dir: string, depth = 50): Promise<CommitEntry[]> {
  const commits = await git.log({ fs, dir, depth });
  return commits.map((c) => ({
    oid: c.oid,
    timestamp: c.commit.author.timestamp,
  }));
}

// ── File listing ──────────────────────────────────────────────────────────────

/**
 * Lists all files present at a given commit OID.
 */
export async function listAllFiles(dir: string, oid: string): Promise<string[]> {
  return await git.listFiles({ fs, dir, ref: oid });
}

// ── Blob reading ──────────────────────────────────────────────────────────────

/**
 * Reads the raw text content of `filepath` at commit `oid`.
 * Returns `null` if the file is not found in the commit tree.
 *
 * NOTE: We resolve the blob by walking the tree segment-by-segment.
 * `git.readTree({ oid })` only returns *root-level* entries, so a path like
 * "src/index.js" would never be found with a flat `tree.find()`. Instead we
 * traverse each path component through the tree manually.
 */
export async function readFileAtCommit(
  dir: string,
  commitOid: string,
  filepath: string
): Promise<string | null> {
  try {
    // Start at the commit's root tree
    const { commit } = await git.readCommit({ fs, dir, oid: commitOid });
    let currentOid = commit.tree; // root tree OID

    const parts = filepath.split('/');
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const { tree } = await git.readTree({ fs, dir, oid: currentOid });
      const entry = tree.find((e) => e.path === part);
      if (!entry) return null;

      if (i === parts.length - 1) {
        // Last segment — should be a blob
        const { blob } = await git.readBlob({ fs, dir, oid: entry.oid });
        return new TextDecoder().decode(blob);
      } else {
        // Intermediate segment — descend into subtree
        currentOid = entry.oid;
      }
    }
    return null;
  } catch {
    return null;
  }
}
