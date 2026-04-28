/**
 * GitProcessing.ts - REWRITTEN FROM SCRATCH
 * Following the provided Python snippet structure.
 */

import {
  cloneRepo,
  readCommitLog,
  listAllFiles,
  getBlobOidAtCommit,
  readBlobContent,
  clearTreeCache,
  withTimeout,
} from './GitDownload';

import { isCodeFile } from './GitScan';


// ── Public types ──────────────────────────────────────────────────────────────

export type GranularityUnit = 'year' | 'quarter' | 'month' | 'week' | 'day' | number;

export interface BlameDataPoint {
  commit_date: string; // YYYY-MM-DD snapshot date
  period: string;      // Label for the period the lines originated (e.g. "2024-Q1")
  line_count: number;
  files?: Record<string, number>; // filename -> line_count
}

export interface FileLinesPreserved {
  filename: string;
  filelines: string[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function getPeriod(date: Date, granularity: GranularityUnit = 'quarter'): string {
  const year = date.getUTCFullYear();
  if (granularity === 'year') return `${year}`;

  if (granularity === 'quarter') {
    const quarter = Math.floor(date.getUTCMonth() / 3) + 1;
    return `${year}-Q${quarter}`;
  }

  if (granularity === 'month') {
    const month = date.getUTCMonth() + 1;
    return `${year}-${month.toString().padStart(2, '0')}`;
  }

  if (granularity === 'week') {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return `${d.getUTCFullYear()}-W${weekNo.toString().padStart(2, '0')}`;
  }

  if (granularity === 'day') {
    return date.toISOString().split('T')[0];
  }

  if (typeof granularity === 'number' && granularity > 0) {
    const dayMillis = 86400000;
    const intervalMillis = dayMillis * granularity;
    const bucket = Math.floor(date.getTime() / intervalMillis);
    const bucketDate = new Date(bucket * intervalMillis);
    return bucketDate.toISOString().split('T')[0];
  }

  return `${year}-Q${Math.floor(date.getUTCMonth() / 3) + 1}`;
}

export function toDateStr(timestampSeconds: number): string {
  return new Date(timestampSeconds * 1000).toISOString().split('T')[0];
}



export class GitArchaeology {
  public repoUrl: string;
  public dir: string;

  constructor(repoFullName: string) {
    this.repoUrl = `https://github.com/${repoFullName}`;
    const uniqueSuffix = Math.random().toString(36).substring(2, 8);
    this.dir = `/${repoFullName}-${uniqueSuffix}`;
  }

  private async GetFileLinesPerPeriod(
    onProgress?: (progress: string) => void,
    options?: {
      extensions?: string[];
      folders?: string[];
      skipClone?: boolean;
      depth?: number;
      startDate?: string;
      endDate?: string;
      granularity?: GranularityUnit;
      onPartialSnapshotData?: (snapshotData: { data: Record<string, FileLinesPreserved[]> }, timePoints: number[]) => void;
    }
  ): Promise<{ data: Record<string, FileLinesPreserved[]>; timePoints: number[] }> {
    if (!options?.skipClone) {
      await cloneRepo({
        dir: this.dir,
        repoUrl: this.repoUrl,
        depth: 2000,
        onProgress: (msg) => onProgress && onProgress(msg),
      });
    }

    const requestedPoints = options?.depth || 50;
    const fetchDepth = Math.max(2000, requestedPoints * 2);

    // Clear the tree cache at the start of a run to prevent memory leaks
    clearTreeCache();

    if (onProgress) onProgress('Reading commit history...');
    let commits = await readCommitLog(this.dir, fetchDepth);

    if (onProgress) onProgress('Generating snapshot timeline...');
    // Apply date filters if provided
    if (options?.startDate || options?.endDate) {
      const start = options.startDate ? new Date(options.startDate + 'T00:00:00.001Z').getTime() : 0;
      const end = options.endDate ? new Date(options.endDate + 'T23:59:59.999Z').getTime() : Infinity;

      commits = commits.filter(c => {
        const ts = c.timestamp * 1000;
        return ts >= start && ts <= end;
      });
    }

    // Generate evenly spaced time points (snapshots) based on requested depth
    const startTs = options?.startDate ? new Date(options.startDate + 'T00:00:00.000Z').getTime() / 1000 : Math.min(...commits.map(c => c.timestamp));
    const endTs = options?.endDate ? new Date(options.endDate + 'T23:59:59.000Z').getTime() / 1000 : Math.max(...commits.map(c => c.timestamp));

    const timePoints: number[] = [];
    if (requestedPoints > 1) {
      const step = (endTs - startTs) / (requestedPoints - 1);
      for (let i = 0; i < requestedPoints; i++) {
        timePoints.push(startTs + i * step);
      }
    } else {
      timePoints.push(endTs);
    }

    const data: Record<string, FileLinesPreserved[]> = {};
    let previousResult: FileLinesPreserved[] | null = null;
    let previousCommitHash: string | null = null;
    let previousDate: string | null = null;
    let lastPartialUpdateTs = Date.now();

    for (let i = 0; i < timePoints.length; i++) {
      const snapshotTs = timePoints[i];
      const date0 = toDateStr(snapshotTs);

      // Find the latest commit at or before this snapshot time
      const commit = commits.find(c => c.timestamp <= snapshotTs);

      if (!commit) {
        // No commits yet at this time point
        data[date0] = [];
        continue;
      }

      if (onProgress) onProgress(`Processing SNAPSHOT ${date0} (${i + 1}/${timePoints.length})...`);

      // OPTIMIZATION: If same commit as previous snapshot, reuse analysis
      if (commit.oid === previousCommitHash && previousResult !== null && previousDate !== null) {
        data[date0] = previousResult;
        previousDate = date0;

        const now = Date.now();
        if (options?.onPartialSnapshotData && (now - lastPartialUpdateTs > 3000)) {
          lastPartialUpdateTs = now;
          options.onPartialSnapshotData({ data }, timePoints);
          await new Promise(r => setTimeout(r, 0));
        }
        continue;
      }

      // List and filter files
      let files = await listAllFiles(this.dir, commit.oid);
      files = files.filter(f => {
        if (options?.extensions && options.extensions.length > 0) {
          return options.extensions.some(ext => f.toLowerCase().endsWith(ext.toLowerCase()));
        }
        return isCodeFile(f);
      });
      if (options?.folders && options.folders.length > 0) {
        files = files.filter(f => options.folders!.some(folder => f.startsWith(folder)));
      }

      const currentFileList: FileLinesPreserved[] = [];
      const totalFiles = files.length;
      let processedFiles = 0;

      const blobParsedCache = new Map<string, string[]>();

      for (let chunkStart = 0; chunkStart < totalFiles; chunkStart += 50) {
        const chunk = files.slice(chunkStart, chunkStart + 50);

        const chunkPromises: Promise<FileLinesPreserved | null>[] = [];
        for (const filepath of chunk) {
          chunkPromises.push((async () => {
            try {
              const blobOid = await getBlobOidAtCommit(this.dir, commit.oid, filepath);
              if (!blobOid) return null;

              if (blobParsedCache.has(blobOid)) {
                return {
                  filename: filepath,
                  filelines: blobParsedCache.get(blobOid)!
                };
              }

              const content = await withTimeout(
                readBlobContent(this.dir, blobOid),
                15_000,
                `Reading ${filepath}`
              );
              if (content !== null) {
                const lines: string[] = [];
                const splitLines = content.split('\n');
                for (const line of splitLines) {
                  if (line.trim().length > 0) {
                    lines.push(line);
                  }
                }

                blobParsedCache.set(blobOid, lines);

                return {
                  filename: filepath,
                  filelines: lines
                };
              }
            } catch { }
            return null;
          })());
        }

        const chunkResults = await Promise.all(chunkPromises);
        for (const r of chunkResults) {
          if (r !== null) currentFileList.push(r);
        }

        processedFiles += chunk.length;

        if (onProgress) {
          onProgress(`Processing SNAPSHOT ${date0} (${i + 1}/${timePoints.length}) - Files: ${processedFiles}/${totalFiles}...`);
        }

        // Yield partial data during long file loops
        const loopNow = Date.now();
        if (options?.onPartialSnapshotData && (loopNow - lastPartialUpdateTs > 5000)) {
          lastPartialUpdateTs = loopNow;
          data[date0] = currentFileList;
          options.onPartialSnapshotData({ data }, timePoints);
          await new Promise(r => setTimeout(r, 0));
        }
      }

      data[date0] = currentFileList;
      previousResult = currentFileList;
      previousCommitHash = commit.oid;
      previousDate = date0;

      // Always update the chart when a snapshot finishes, and reset the 5-second timer
      if (options?.onPartialSnapshotData) {
        lastPartialUpdateTs = Date.now();
        options.onPartialSnapshotData({ data }, timePoints);
        await new Promise(r => setTimeout(r, 0));
      }
    }

    return { data, timePoints };
  }

  private GetLinesThatSurvived(fileBefore: FileLinesPreserved, fileAfter: FileLinesPreserved): [number, FileLinesPreserved] {
    const poolCounts: Record<string, number> = {};
    for (const line of fileBefore.filelines) {
      poolCounts[line] = (poolCounts[line] || 0) + 1;
    }

    let survivingCount = 0;
    const notFoundLines: string[] = [];

    for (const line of fileAfter.filelines) {
      if (poolCounts[line] > 0) {
        survivingCount++;
        poolCounts[line]--;
      } else {
        notFoundLines.push(line);
      }
    }

    return [
      survivingCount,
      {
        filename: fileAfter.filename,
        filelines: notFoundLines
      }
    ];
  }

  private GetFilesLInesThatSurvivedOnEachPeriod(
    snapshotData: { data: Record<string, FileLinesPreserved[]> }
  ): BlameDataPoint[] {
    const { data } = snapshotData;
    const dateKeys = Object.keys(data).sort();
    const results: BlameDataPoint[] = [];

    // For each snapshot J, we find where its lines came from by checking 0 to J-1
    for (let j = 0; j < dateKeys.length; j++) {
      const currentDate = dateKeys[j];
      const currentFileList = data[currentDate];

      if (!currentFileList) continue;

      const counts: Record<string, number> = {};
      const fileBreakdown: Record<string, Record<string, number>> = {};

      // Initialize counts for all dates (periods) seen up to now to 0
      for (let k = 0; k <= j; k++) {
        counts[dateKeys[k]] = 0;
        fileBreakdown[dateKeys[k]] = {};
      }

      for (const currentFile of currentFileList) {
        if (currentFile.filelines.length === 0) continue;

        let fileToProcess = { ...currentFile, filelines: [...currentFile.filelines] };

        // Check against ALL previous snapshots in order
        for (let i = 0; i < j; i++) {
          const prevDate = dateKeys[i];
          const prevFileList = data[prevDate];

          // Find file in previous snapshot
          let prevFile: FileLinesPreserved | undefined;
          if (prevFileList) {
            for (const f of prevFileList) {
              if (f.filename === fileToProcess.filename) {
                prevFile = f;
                break;
              }
            }
          }

          if (prevFile && fileToProcess.filelines.length > 0) {
            const [countUpdate, remainingFile] = this.GetLinesThatSurvived(prevFile, fileToProcess);
            counts[prevDate] += countUpdate;
            if (countUpdate > 0) {
              fileBreakdown[prevDate][currentFile.filename] = countUpdate;
            }
            fileToProcess = remainingFile;
          }
        }

        // Finally, any lines that never appeared in any previous batch
        // are attributed to the current batch
        counts[currentDate] += fileToProcess.filelines.length;
        if (fileToProcess.filelines.length > 0) {
          fileBreakdown[currentDate][currentFile.filename] = fileToProcess.filelines.length;
        }
      }

      for (const period of Object.keys(counts)) {
        const count = counts[period];
        results.push({
          commit_date: currentDate,
          period,
          line_count: count,
          files: fileBreakdown[period]
        });
      }
    }

    return results.sort((a, b) => a.commit_date.localeCompare(b.commit_date));
  }

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
    },
    onPartialData?: (data: BlameDataPoint[], timePoints: number[]) => void
  ): Promise<BlameDataPoint[]> {

    const snapshotData = await this.GetFileLinesPerPeriod(onProgress, {
      ...options,
      onPartialSnapshotData: onPartialData ? (partialData, timePoints) => {
        onPartialData(this.GetFilesLInesThatSurvivedOnEachPeriod(partialData), timePoints);
      } : undefined
    });

    return this.GetFilesLInesThatSurvivedOnEachPeriod(snapshotData);
  }

}
