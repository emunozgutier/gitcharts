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

import {
  type GranularityUnit,
  type BlameDataPoint,
  type FileHistory,
  getPeriod,
  toDateStr,
  computeFileHistory,
} from './GitBlame';

const IGNORED_EXTENSIONS = [
  '.json', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.pdf', '.zip', '.gz', '.tar', 
  '.map', '.lock', '.woff', '.woff2', '.ttf', '.eot', '.mp4', '.webm', '.ogg', '.mp3', '.wav'
];

function isCodeFile(filename: string): boolean {
  const lower = filename.toLowerCase();
  return !IGNORED_EXTENSIONS.some(ext => lower.endsWith(ext));
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
   * Scans the latest commit to get an overview of file types (by line count) and folders.
   */
  async scanRepo(): Promise<{ 
    extensions: Record<string, number>; 
    folders: string[]; 
    folderLines: Record<string, number>;
    timeRange: { min: number; max: number };
  }> {
    const depth = 100;
    const commits = await readCommitLog(this.dir, depth);
    if (commits.length === 0) throw new Error("No commits found");
    
    const latestOid = commits[0].oid;
    const timestamps = commits.map(c => c.timestamp);
    const minTime = Math.min(...timestamps);
    const maxTime = Math.max(...timestamps);

    const allFiles = await listAllFiles(this.dir, latestOid);
    const files = allFiles.filter(isCodeFile);

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
      timeRange: { min: minTime, max: maxTime },
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
      granularity?: GranularityUnit;
    }
  ): Promise<BlameDataPoint[]> {
    // ── 1. Clone (if not skipped) ───────────────────────────────────────────
    if (!options?.skipClone) {
      if (onProgress) onProgress('Initializing local filesystem...');
      await cloneRepo({
        dir: this.dir,
        repoUrl: this.repoUrl,
        depth: 100,
        onProgress: (msg) => onProgress && onProgress(msg),
      });
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
    const repoHistory = new Map<string, FileHistory>(); // Tracks the line-by-line history of each file

    // ── 3. Per-commit analysis ──────────────────────────────────────────────
    for (let i = 0; i < ordered.length; i++) {
      const commit = ordered[i];
      const commitDateStr = toDateStr(commit.timestamp);
      const commitPeriod = getPeriod(new Date(commit.timestamp * 1000), options?.granularity);

      if (onProgress) {
        onProgress(`Analyzing snapshot ${i + 1}/${ordered.length}: ${commit.oid.substring(0, 7)}...`);
      }

      let filesAtCommit = await withTimeout(
        listAllFiles(this.dir, commit.oid),
        30_000,
        `Listing files at ${commit.oid.substring(0, 7)}`
      );

      // Filter out non-code files unless specifically requested
      filesAtCommit = filesAtCommit.filter(f => {
        if (options?.extensions && options.extensions.length > 0) {
          return options.extensions.some(ext => f.toLowerCase().endsWith(ext.toLowerCase()));
        }
        return isCodeFile(f);
      });

      // Apply folder filters
      if (options?.folders && options.folders.length > 0) {
        filesAtCommit = filesAtCommit.filter(f => options.folders!.some(folder => f.startsWith(folder)));
      }
      
      const files = filesAtCommit;

      // Sample to avoid hitting browser memory limits for huge repos
      // But let's be more generous than 5, say 15
      const sampledFiles = files.slice(0, 15);
      
      console.log(`[GitProcessing] commit ${commit.oid.substring(0,7)} (${commitPeriod}): ${files.length} matching files, sampling ${sampledFiles.length}`);

      const snapshotLineAges: Record<string, number> = {}; // Aggregates line ages for the current commit snapshot

      for (const filepath of sampledFiles) {
        try {
          const content = await withTimeout(
            readFileAtCommit(this.dir, commit.oid, filepath),
            15_000,
            `Reading ${filepath} at ${commit.oid.substring(0, 7)}`
          );
          if (content === null) continue;

          const previousHistory = repoHistory.get(filepath) || null;
          const updatedHistory = computeFileHistory(previousHistory, content, commitPeriod, filepath);
          repoHistory.set(filepath, updatedHistory);

          // Aggregate line ages for THIS snapshot
          for (const line of updatedHistory.lines) {
            snapshotLineAges[line.period] = (snapshotLineAges[line.period] || 0) + 1;
          }
        } catch (e) {
          console.warn(`Skipping ${filepath} at ${commit.oid.substring(0, 7)}:`, e);
        }
      }

      // Record findings for this snapshot
      for (const [period, count] of Object.entries(snapshotLineAges)) {
        data.push({ commit_date: commitDateStr, period, line_count: count as number });
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
