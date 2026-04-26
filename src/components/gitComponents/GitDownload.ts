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
  ref?: string;
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
    try {
      await pfs.rmdir(path);
    } catch (e) {
      // Ignore errors like ENOTEMPTY, we'll use unique dirs to avoid collisions
    }
  } else {
    try {
      await pfs.unlink(path);
    } catch (e) {
      // Ignore
    }
  }
}

/**
 * Wipes the root directory to clear out any old repositories and free up IndexedDB space.
 */
export async function wipeAllFs(): Promise<void> {
  try {
    const entries = await pfs.readdir('/');
    for (const e of entries) {
      if (e !== '.' && e !== '..') {
        await rmrf(`/${e}`);
      }
    }
  } catch (e) {
    console.warn("Failed to wipe fs:", e);
  }
}

/**
 * Clones a repository (shallow) into the in-browser FS.
 * Creates the target directory if it doesn't already exist.
 */
export async function cloneRepo(opts: CloneOptions): Promise<void> {
  const { dir, repoUrl, ref, depth = 100, onProgress } = opts;

  // Always wipe the previous clone so we never reuse stale git objects
  // that were fetched before code fixes.
  if (onProgress) onProgress('Clearing previous clones...');
  await wipeAllFs();
  
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

  await git.clone({
    fs,
    http,
    dir,
    url: repoUrl,
    ref,
    corsProxy: 'https://cors.isomorphic-git.org',
    singleBranch: true,
    depth,
    onProgress: (p) => {
      if (onProgress && p.phase) {
        if (p.total) {
          const pct = Math.round((p.loaded / p.total) * 100);
          onProgress(`Cloning: ${p.phase} (${pct}%)`);
        } else {
          onProgress(`Cloning: ${p.phase} (${p.loaded} items)`);
        }
      }
    },
  });
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

const treeCache = new Map<string, any[]>();

export function clearTreeCache() {
  treeCache.clear();
}

/**
 * Resolves the blob OID for a given filepath at a commit OID.
 * Memoizes tree traversal to avoid redundant reads.
 */
export async function getBlobOidAtCommit(
  dir: string,
  commitOid: string,
  filepath: string
): Promise<string | null> {
  try {
    const { commit } = await git.readCommit({ fs, dir, oid: commitOid });
    let currentOid = commit.tree;

    const parts = filepath.split('/');
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      
      let tree = treeCache.get(currentOid);
      if (!tree) {
        const res = await git.readTree({ fs, dir, oid: currentOid });
        tree = res.tree;
        treeCache.set(currentOid, tree);
      }
      
      const entry = tree.find((e) => e.path === part);
      if (!entry) return null;

      if (i === parts.length - 1) {
        return entry.oid;
      } else {
        currentOid = entry.oid;
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Reads the raw text content of a blob given its OID.
 */
export async function readBlobContent(
  dir: string,
  blobOid: string
): Promise<string> {
  const { blob } = await git.readBlob({ fs, dir, oid: blobOid });
  return new TextDecoder().decode(blob);
}
