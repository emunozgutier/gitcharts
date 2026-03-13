/**
 * GitProcessing.ts
 *
 * High-level analysis logic that sits on top of GitDownload.ts.
 *
 * Core feature: **Pseudo Git Blame**
 *
 * Because isomorphic-git doesn't expose a `git blame` command in the browser,
 * we simulate it by comparing consecutive file snapshots:
 *
 *   1. Read file content at commit N   → "old lines" (Set)
 *   2. Read file content at commit N-1 → "current lines"
 *   3. Any line in "current" that also exists in "old" was already present →
 *      it originated in or before commit N.
 *   4. Remove matched lines from "old" (so each line is only attributed once).
 *   5. Lines that remain in "current" but weren't in "old" are NEW lines
 *      introduced at commit N-1.
 *
 * This gives us a per-commit line count breakdown, which maps directly to the
 * BlameDataPoint structure consumed by the Vega chart.
 */

import {
  cloneRepo,
  readCommitLog,
  listAllFiles,
  readFileAtCommit,
  withTimeout,
} from './GitDownload';

// ── Public types ──────────────────────────────────────────────────────────────

export interface BlameDataPoint {
  commit_date: string; // YYYY-MM-DD snapshot date
  period: string;      // e.g. "2024-Q1" – the quarter the lines originated
  line_count: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getPeriod(date: Date): string {
  const year = date.getUTCFullYear();
  const quarter = Math.floor(date.getUTCMonth() / 3) + 1;
  return `${year}-Q${quarter}`;
}

function toDateStr(timestampSeconds: number): string {
  return new Date(timestampSeconds * 1000).toISOString().split('T')[0];
}

// ── Pseudo blame ──────────────────────────────────────────────────────────────

/**
 * Compare two plaintext file snapshots and attribute each line to the commit
 * where it first appeared.
 *
 * Algorithm (streaming through history, oldest → newest):
 *
 *   olderLines  – lines that existed in the older of the two commits
 *   newerLines  – lines that exist in the newer commit
 *
 * A line is considered **surviving** (originated earlier) if it is present in
 * both snapshots. We remove surviving lines from the older pool so they are
 * not double-counted. Lines that appear in `newerLines` but NOT in
 * `olderLines` are **new** at the newer commit.
 *
 * Returns the count of net-new lines introduced in `newerContent`.
 */
function pseudoBlame(olderContent: string, newerContent: string): {
  newLineCount: number;
  survivingLineCount: number;
  remainingOlderLines: string[];
} {
  const olderLines = olderContent.split('\n');
  const newerLines = newerContent.split('\n');

  // Build a mutable pool from older lines (allow duplicates via index tracking)
  const olderPool = [...olderLines];
  let survivingLineCount = 0;

  const newLines: string[] = [];

  for (const line of newerLines) {
    const idx = olderPool.indexOf(line);
    if (idx !== -1) {
      // Line exists in older snapshot → it survived (originated earlier)
      olderPool.splice(idx, 1);
      survivingLineCount++;
    } else {
      // Line is genuinely new at this snapshot
      newLines.push(line);
    }
  }

  return {
    newLineCount: newLines.length,
    survivingLineCount,
    remainingOlderLines: olderPool,
  };
}

// ── Main class ────────────────────────────────────────────────────────────────

export class GitArchaeology {
  public repoUrl: string;
  public dir: string;

  constructor(repoFullName: string) {
    this.repoUrl = `https://github.com/${repoFullName}`;
    this.dir = `/${repoFullName}`;
  }

  /**
   * Run the pseudo-blame archaeology process.
   *
   * For each sampled source file we walk through commit history (oldest →
   * newest) and attribute line counts to the quarter in which those lines first
   * appeared.
   */

  /**
   * Downloads (clones) the repository.
   */
  async download(onProgress?: (progress: string) => void): Promise<void> {
    if (onProgress) onProgress('Initializing local filesystem...');
    await cloneRepo({
      dir: this.dir,
      repoUrl: this.repoUrl,
      depth: 100,
      onProgress: (msg) => onProgress && onProgress(msg),
    });
  }

  /**
   * Scans the latest commit to get an overview of file types (by line count) and folders.
   */
  async scanRepo(): Promise<{ 
    extensions: Record<string, number>; 
    folders: string[]; 
    folderLines: Record<string, number>;
  }> {
    const commits = await readCommitLog(this.dir, 1);
    if (commits.length === 0) throw new Error("No commits found");
    const latestOid = commits[0].oid;
    const files = await listAllFiles(this.dir, latestOid);

    const extensionsLines: Record<string, number> = {};
    const foldersLines: Record<string, number> = {};

    for (const file of files) {
      let folder = '.';
      const parts = file.split('/');
      if (parts.length > 1) {
        folder = parts.slice(0, -1).join('/');
      }

      const extMatch = file.match(/\.([^.]+)$/);
      const ext = extMatch ? extMatch[0] : null;

      try {
        const content = await readFileAtCommit(this.dir, latestOid, file);
        if (content) {
          const lines = content.split('\n').length;
          if (ext) {
            extensionsLines[ext] = (extensionsLines[ext] || 0) + lines;
          }
          foldersLines[folder] = (foldersLines[folder] || 0) + lines;
        }
      } catch {
        // Skip files that can't be read
      }
    }

    return {
      extensions: extensionsLines,
      folders: Object.keys(foldersLines).sort(),
      folderLines: foldersLines,
    };
  }

  /**
   * Run the pseudo-blame archaeology process.
   */
  async run(
    onProgress?: (progress: string) => void,
    options?: { 
      extensions?: string[]; 
      folders?: string[]; 
      skipClone?: boolean;
      depth?: number;
      startDate?: string;
      endDate?: string;
    }
  ): Promise<BlameDataPoint[]> {
    // ── 1. Clone (if not skipped) ───────────────────────────────────────────
    if (!options?.skipClone) {
      await this.download(onProgress);
    }

    // ── 2. Commit log ───────────────────────────────────────────────────────
    const depth = options?.depth || 50;
    let commits = await readCommitLog(this.dir, depth);

    // Apply date filters if provided
    if (options?.startDate || options?.endDate) {
      const start = options.startDate ? new Date(options.startDate).getTime() : 0;
      const end = options.endDate ? new Date(options.endDate).getTime() : Infinity;
      
      commits = commits.filter(c => {
        const ts = c.timestamp * 1000;
        return ts >= start && ts <= end;
      });
    }

    const ordered = [...commits].reverse();
    console.log(`[GitProcessing] Found ${ordered.length} commits to analyze.`);

    if (onProgress) onProgress(`Analyzing ${ordered.length} commits...`);

    const data: BlameDataPoint[] = [];

    // ── 3. Per-commit analysis ──────────────────────────────────────────────
    for (let i = 0; i < ordered.length; i++) {
      const commit = ordered[i];
      const commitDateStr = toDateStr(commit.timestamp);
      const commitPeriod = getPeriod(new Date(commit.timestamp * 1000));

      if (onProgress) {
        onProgress(`Analyzing snapshot ${i + 1}/${ordered.length}: ${commit.oid.substring(0, 7)}...`);
      }

      let files = await withTimeout(
        listAllFiles(this.dir, commit.oid),
        30_000,
        `Listing files at ${commit.oid.substring(0, 7)}`
      );

      // Apply filters
      if (options?.extensions && options.extensions.length > 0) {
        files = files.filter(f => options.extensions!.some(ext => f.endsWith(ext)));
      }
      if (options?.folders && options.folders.length > 0) {
        files = files.filter(f => options.folders!.some(folder => f.startsWith(folder)));
      }

      // Sample to avoid hitting browser memory limits for huge repos
      // But let's be more generous than 5, say 15
      const sampledFiles = files.slice(0, 15);
      
      console.log(`[GitProcessing] commit ${commit.oid.substring(0,7)} (${commitPeriod}): ${files.length} matching files, sampling ${sampledFiles.length}`);

      const periodCounts: Record<string, number> = {};

      for (const filepath of sampledFiles) {
        try {
          const newerContent = await withTimeout(
            readFileAtCommit(this.dir, commit.oid, filepath),
            15_000,
            `Reading ${filepath} at ${commit.oid.substring(0, 7)}`
          );
          if (newerContent === null) continue;

          let olderContent: string | null = null;
          if (i > 0) {
            const prevOid = ordered[i - 1].oid;
            olderContent = await withTimeout(
              readFileAtCommit(this.dir, prevOid, filepath).catch(() => null),
              15_000,
              `Reading ${filepath} at previous commit`
            );
          }

          if (olderContent === null) {
            const lineCount = newerContent.split('\n').length;
            periodCounts[commitPeriod] = (periodCounts[commitPeriod] || 0) + lineCount;
          } else {
            const { newLineCount } = pseudoBlame(olderContent, newerContent);
            if (newLineCount > 0) {
              periodCounts[commitPeriod] = (periodCounts[commitPeriod] || 0) + newLineCount;
            }
          }
        } catch (e) {
          console.warn(`Skipping ${filepath} at ${commit.oid.substring(0, 7)}:`, e);
        }
      }

      for (const [period, count] of Object.entries(periodCounts)) {
        data.push({ commit_date: commitDateStr, period, line_count: count });
      }
    }

    return data.sort((a, b) => a.commit_date.localeCompare(b.commit_date));
  }

  /**
   * Legacy entry-point kept for backwards compatibility.
   * Delegates to `run()`.
   */
  async runLegacy(onProgress?: (progress: string) => void): Promise<BlameDataPoint[]> {
    return this.run(onProgress);
  }
}
