/**
 * GitProcessing.ts - REWRITTEN FROM SCRATCH
 * Following the provided Python snippet structure.
 */

import {
  cloneRepo,
  readCommitLog,
  listAllFiles,
  readFileAtCommit,
  withTimeout,
  // @ts-ignore
  cloneRepo as _cloneRepo,
} from './GitDownload';

import {
  type GranularityUnit,
  type BlameDataPoint,
  type FileLinesPreserved,
  getPeriod,
  toDateStr,
} from './GitBlame';

const IGNORED_EXTENSIONS = [
  '.json', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.pdf', '.zip', '.gz', '.tar', 
  '.map', '.lock', '.woff', '.woff2', '.ttf', '.eot', '.mp4', '.webm', '.ogg', '.mp3', '.wav'
];

function isCodeFile(filename: string): boolean {
  const lower = filename.toLowerCase();
  return !IGNORED_EXTENSIONS.some(ext => lower.endsWith(ext));
}

export class GitArchaeology {
  public repoUrl: string;
  public dir: string;

  constructor(repoFullName: string) {
    this.repoUrl = `https://github.com/${repoFullName}`;
    this.dir = `/${repoFullName}`;
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
    }
  ): Promise<BlameDataPoint[]> {
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
    let commits = await readCommitLog(this.dir, fetchDepth);

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

    for (let i = 0; i < timePoints.length; i++) {
        const snapshotTs = timePoints[i];
        const date0 = toDateStr(snapshotTs);
        const period0 = getPeriod(new Date(snapshotTs * 1000), options?.granularity);

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

        for (const filepath of files) {
            try {
                const content = await withTimeout(
                    readFileAtCommit(this.dir, commit.oid, filepath),
                    15_000,
                    `Reading ${filepath}`
                );
                if (content !== null) {
                    const lines = content.split('\n')
                        .filter(line => line.trim().length > 0)
                        .map(line => ({ content: line, period: period0 }));

                    currentFileList.push({
                        filename: filepath,
                        filelines: lines
                    });
                }
            } catch {}
        }

        data[date0] = currentFileList;
        previousResult = currentFileList;
        previousCommitHash = commit.oid;
        previousDate = date0;
    }

    // Convert data back to BlameDataPoint format with MANUAL MULTI-PASS attribution
    const results: BlameDataPoint[] = [];
    const dateKeys = Object.keys(data).sort();
    
    // We need a mapping of date -> period for attribution
    // timePoints should match dateKeys length and order
    const dateToPeriod: Record<string, string> = {};
    for (let k = 0; k < timePoints.length; k++) {
        const d = toDateStr(timePoints[k]);
        dateToPeriod[d] = getPeriod(new Date(timePoints[k] * 1000), options?.granularity);
    }

    // For each snapshot J, we find where its lines came from by checking 0 to J-1
    for (let j = 0; j < dateKeys.length; j++) {
        const currentDate = dateKeys[j];
        const currentFileList = data[currentDate];
        const currentPeriod = dateToPeriod[currentDate];

        if (!currentFileList) continue;

        const counts: Record<string, number> = {};
        // Initialize counts for all periods seen up to now to 0 for continuous traces
        for (let k = 0; k <= j; k++) {
            const p = dateToPeriod[dateKeys[k]];
            counts[p] = 0;
        }

        for (const currentFile of currentFileList) {
            // Pool of lines that we haven't assigned to a "surviving from previous batch" yet
            let remainingLines = [...currentFile.filelines];

            // 1. Check against ALL previous snapshots in order (Batch 1, then Batch 2...)
            for (let i = 0; i < j; i++) {
                const prevDate = dateKeys[i];
                const prevFileList = data[prevDate];
                const prevFile = prevFileList.find(f => f.filename === currentFile.filename);
                const prevPeriod = dateToPeriod[prevDate];

                if (prevFile && remainingLines.length > 0) {
                    const nextRemaining: any[] = [];
                    const prevLinesPool = [...prevFile.filelines];

                    for (const line of remainingLines) {
                        const matchIdx = prevLinesPool.findIndex(pl => pl.content === line.content);
                        if (matchIdx !== -1) {
                            // Line existed in period 'prevPeriod'
                            counts[prevPeriod]++;
                            // Remove from pool so it's not matched again in THIS snapshot
                            prevLinesPool.splice(matchIdx, 1);
                        } else {
                            nextRemaining.push(line);
                        }
                    }
                    remainingLines = nextRemaining;
                }
            }

            // 2. Finally, any lines that never appeared in any previous batch (0 to J-1)
            // are attributed to the current batch (J)
            counts[currentPeriod] += remainingLines.length;
        }

        for (const [period, count] of Object.entries(counts)) {
            results.push({ commit_date: currentDate, period, line_count: count });
        }
    }

    return results.sort((a, b) => a.commit_date.localeCompare(b.commit_date));
  }

  async runLegacy(onProgress?: (progress: string) => void): Promise<BlameDataPoint[]> {
    return this.run(onProgress);
  }

  async scanRepo(): Promise<{ 
    extensions: Record<string, number>; 
    folders: string[]; 
    folderLines: Record<string, number>;
    timeRange: { min: number; max: number };
    commitTimestamps: number[];
  }> {
    const depth = 5000;
    const commits = await readCommitLog(this.dir, depth);
    if (commits.length === 0) throw new Error("No commits found");
    
    const latestOid = commits[0].oid;
    const commitTimestamps = commits.map(c => c.timestamp);
    
    const minRaw = Math.min(...commitTimestamps);
    const maxRaw = Math.max(...commitTimestamps);
    
    const minTime = Math.floor(minRaw / 86400) * 86400;
    const maxTime = Math.ceil(maxRaw / 86400) * 86400 - 1; 

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
      }
    }

    return {
      extensions: extensionsLines,
      folders: Object.keys(foldersLines).sort(),
      folderLines: foldersLines,
      timeRange: { min: minTime, max: maxTime },
      commitTimestamps: commitTimestamps,
    };
  }
}
