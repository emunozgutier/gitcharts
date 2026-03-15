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
  get_file_lines_preserved,
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

    // data: Dict(date, List[FileLinesPreserved]) = {}
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
            // We still need to create a new entry for this date0, but we can reuse the lines
            // However, the "period" for new lines depends on the current snapshot's period0.
            // But since it's the SAME commit, no new lines were added between previousDate and date0.
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

        const sampledFiles = files.slice(0, 15);
        const currentFileList: FileLinesPreserved[] = [];

        for (const filepath of sampledFiles) {
            try {
                const content = await withTimeout(
                    readFileAtCommit(this.dir, commit.oid, filepath),
                    15_000,
                    `Reading ${filepath}`
                );
                if (content !== null) {
                    // EXCLUDE EMPTY LINES
                    const lines = content.split('\n')
                        .filter(line => line.trim().length > 0) // MUST be a WHOLE number of days... wait, no, "except from empty lines"
                        .map(line => ({ content: line, period: period0 }));

                    currentFileList.push({
                        filename: filepath,
                        filelines: lines
                    });
                }
            } catch {}
        }

        // Apply preservation logic from previous snapshot
        if (previousResult !== null) {
            const currentFilesMap = new Map(currentFileList.map(f => [f.filename, f]));
            
            for (const prevFile of previousResult) {
                const currentFile = currentFilesMap.get(prevFile.filename);
                if (currentFile) {
                    const updated = get_file_lines_preserved(prevFile, currentFile, period0);
                    // Update in the list
                    const idx = currentFileList.findIndex(f => f.filename === prevFile.filename);
                    if (idx !== -1) currentFileList[idx] = updated;
                }
            }
        }

        data[date0] = currentFileList;
        previousResult = currentFileList;
        previousCommitHash = commit.oid;
        previousDate = date0;
    }

    // Convert data back to BlameDataPoint format for the chart
    const results: BlameDataPoint[] = [];
    for (const [date, fileList] of Object.entries(data)) {
        const counts: Record<string, number> = {};
        for (const file of fileList) {
            for (const line of file.filelines) {
                counts[line.period] = (counts[line.period] || 0) + 1;
            }
        }
        for (const [period, count] of Object.entries(counts)) {
            results.push({ commit_date: date, period, line_count: count });
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
