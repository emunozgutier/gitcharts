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
    // 1. Identify all unique periods and their latest commits in the range
    const startTs = options?.startDate ? new Date(options.startDate + 'T00:00:00.000Z').getTime() / 1000 : 0;
    const endTs = options?.endDate ? new Date(options.endDate + 'T23:59:59.000Z').getTime() / 1000 : Infinity;

    const periodMap = new Map<string, { ts: number, oid: string }>();
    for (const c of commits) {
        if (c.timestamp < startTs || c.timestamp > endTs) continue;
        
        const p = getPeriod(new Date(c.timestamp * 1000), options?.granularity);
        const existing = periodMap.get(p);
        if (!existing || c.timestamp > existing.ts) {
            periodMap.set(p, { ts: c.timestamp, oid: c.oid });
        }
    }

    const sortedPeriods = Array.from(periodMap.keys()).sort();
    
    // 2. We process these periods as our "Batches"
    // data: Record<periodLabel, FileLinesPreserved[]>
    const snapshotsData: Record<string, FileLinesPreserved[]> = {};

    for (let i = 0; i < sortedPeriods.length; i++) {
        const periodLabel = sortedPeriods[i];
        const commit = periodMap.get(periodLabel)!;

        if (onProgress) onProgress(`Processing BATCH ${periodLabel} (${i + 1}/${sortedPeriods.length})...`);

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
                        .map(line => ({ content: line, period: periodLabel }));

                    currentFileList.push({
                        filename: filepath,
                        filelines: lines
                    });
                }
            } catch {}
        }
        snapshotsData[periodLabel] = currentFileList;
    }

    // 3. Multi-pass attribution for each batch
    const results: BlameDataPoint[] = [];

    for (let j = 0; j < sortedPeriods.length; j++) {
        const currentPeriod = sortedPeriods[j];
        const currentFileList = snapshotsData[currentPeriod];
        
        // Date to show on the X axis (last day of the period)
        const commitTs = periodMap.get(currentPeriod)!.ts;
        const snapshotDateStr = toDateStr(commitTs);

        const counts: Record<string, number> = {};
        // Initialize counts for ALL periods seen so far to 0 (for continuous traces)
        for (let k = 0; k <= j; k++) {
            counts[sortedPeriods[k]] = 0;
        }

        for (const currentFile of currentFileList) {
            let remainingLines = [...currentFile.filelines];

            // Compare against each PREVIOUS batch sequentially (Batch 1, then Batch 2...)
            for (let i = 0; i < j; i++) {
                const prevPeriod = sortedPeriods[i];
                const prevFileList = snapshotsData[prevPeriod];
                const prevFile = prevFileList.find(f => f.filename === currentFile.filename);

                if (prevFile && remainingLines.length > 0) {
                    const nextRemaining: any[] = [];
                    const prevLinesPool = [...prevFile.filelines];

                    for (const line of remainingLines) {
                        const matchIdx = prevLinesPool.findIndex(pl => pl.content === line.content);
                        if (matchIdx !== -1) {
                            counts[prevPeriod]++;
                            prevLinesPool.splice(matchIdx, 1);
                        } else {
                            nextRemaining.push(line);
                        }
                    }
                    remainingLines = nextRemaining;
                }
            }

            // Finally, lines that never appeared in previous batches are attributed to current
            counts[currentPeriod] += remainingLines.length;
        }

        // Add to results
        for (const [period, count] of Object.entries(counts)) {
            results.push({ 
                commit_date: snapshotDateStr, 
                period: period, 
                line_count: count 
            });
        }
    }

    return results.sort((a, b) => a.commit_date.localeCompare(b.commit_date));
  }

  async runLegacy(onProgress?: (progress: string) => void): Promise<BlameDataPoint[]> {
    return this.run(onProgress);
  }

  /**
   * Scans the latest commit to get an overview of file types (by line count) and folders.
   */
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
    
    // Align to UTC day boundaries: start of first day, end of last day
    const minRaw = Math.min(...commitTimestamps);
    const maxRaw = Math.max(...commitTimestamps);
    
    const minTime = Math.floor(minRaw / 86400) * 86400;
    const maxTime = Math.ceil(maxRaw / 86400) * 86400 - 1; // End of the day

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
      commitTimestamps: commitTimestamps,
    };
  }
}
