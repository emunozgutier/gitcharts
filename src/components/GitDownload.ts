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
 * Clones a repository (shallow) into the in-browser FS.
 * Creates the target directory if it doesn't already exist.
 */
export async function cloneRepo(opts: CloneOptions): Promise<void> {
  const { dir, repoUrl, depth = 25, onProgress } = opts;

  try {
    await pfs.mkdir(dir);
  } catch {
    // Directory already exists – fine.
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
    120_000,
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
export async function readCommitLog(dir: string, depth = 10): Promise<CommitEntry[]> {
  const commits = await git.log({ fs, dir, depth });
  return commits.map((c) => ({
    oid: c.oid,
    timestamp: c.commit.author.timestamp,
  }));
}

// ── File listing ──────────────────────────────────────────────────────────────

const SOURCE_EXT = /\.(py|js|ts|tsx|java)$/;

/**
 * Lists source files present at a given commit OID, filtered to common
 * programming-language extensions.
 */
export async function listSourceFiles(dir: string, oid: string): Promise<string[]> {
  const all = await git.listFiles({ fs, dir, ref: oid });
  return all.filter((f) => SOURCE_EXT.test(f));
}

// ── Blob reading ──────────────────────────────────────────────────────────────

/**
 * Reads the raw text content of `filepath` at commit `oid`.
 * Returns `null` if the file is not found in the commit tree.
 */
export async function readFileAtCommit(
  dir: string,
  oid: string,
  filepath: string
): Promise<string | null> {
  const { tree } = await git.readTree({ fs, dir, oid });
  const entry = tree.find((e) => e.path === filepath);
  if (!entry) return null;
  const { blob } = await git.readBlob({ fs, dir, oid: entry.oid });
  return new TextDecoder().decode(blob);
}
