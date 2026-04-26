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

import _ from 'lodash';


// ── Public types ──────────────────────────────────────────────────────────────

export type GranularityUnit = 'year' | 'quarter' | 'month' | 'week' | 'day' | number;

export interface BlameDataPoint {
  commit_date: string; // YYYY-MM-DD snapshot date
  period: string;      // Label for the period the lines originated (e.g. "2024-Q1")
  line_count: number;
  files?: Record<string, number>; // filename -> line_count
}

export interface LineHistory {
  content: string;
  period: string; // The period this line was first introduced
}

export interface FileLinesPreserved {
  filename: string;
  filelines: LineHistory[];
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
      timePoints.push(..._.times(requestedPoints, i => startTs + i * step));
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
        const fileChunks = _.chunk(files, 50);
        let processedFiles = 0;

        for (const chunk of fileChunks) {
            const chunkResults = await Promise.all(
                chunk.map(async (filepath) => {
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

                            return {
                                filename: filepath,
                                filelines: lines
                            };
                        }
                    } catch {}
                    return null;
                })
            );
            
            currentFileList.push(...chunkResults.filter((r): r is FileLinesPreserved => r !== null));
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
    // Optimization: Use _.countBy instead of _.groupBy to avoid array allocations
    // and expensive O(N) .shift() operations on large arrays of identical lines.
    const poolCounts = _.countBy(fileBefore.filelines, 'content');
    let survivingCount = 0;
    const notFoundLines = fileAfter.filelines.filter(line => {
      if (poolCounts[line.content] > 0) {
        survivingCount++;
        poolCounts[line.content]--;
        return false;
      }
      return true;
    });

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
    
    // Filter out dates with no snapshot data and flatMap to generate all data points
    const results = _.flatMap(_.filter(dateKeys, date => !!data[date]), currentDate => {
        const originalIndex = dateKeys.indexOf(currentDate);
        const currentFileList = data[currentDate];
        const previousDates = dateKeys.slice(0, originalIndex + 1);
        
        // Initialize counts and fileBreakdown using lodash mapping
        const counts = _.fromPairs(_.map(previousDates, date => [date, 0]));
        const fileBreakdown: Record<string, Record<string, number>> = _.fromPairs(_.map(previousDates, date => [date, {}]));

        // Process only files that have lines
        const validFiles = _.filter(currentFileList, file => file.filelines.length > 0);
        
        _.forEach(validFiles, currentFile => {
            const initialFileToProcess = { ...currentFile, filelines: [...currentFile.filelines] };
            const previousDatesToCheck = dateKeys.slice(0, originalIndex);

            // Functionally reduce the file's lines against all previous snapshots
            const finalFileToProcess = _.reduce(previousDatesToCheck, (fileState, prevDate) => {
                if (fileState.filelines.length === 0) return fileState;

                const prevFileList = data[prevDate];
                const prevFile = _.find(prevFileList, f => f.filename === fileState.filename);

                if (prevFile) {
                    const [countUpdate, remainingFile] = this.GetLinesThatSurvived(prevFile, fileState);
                    counts[prevDate] += countUpdate;
                    if (countUpdate > 0) {
                        fileBreakdown[prevDate][fileState.filename] = countUpdate;
                    }
                    return remainingFile;
                }
                return fileState;
            }, initialFileToProcess);

            // Any remaining lines are attributed to the current batch
            counts[currentDate] += finalFileToProcess.filelines.length;
            if (finalFileToProcess.filelines.length > 0) {
                fileBreakdown[currentDate][currentFile.filename] = finalFileToProcess.filelines.length;
            }
        });

        // Transform the counts dictionary into an array of BlameDataPoints
        return _.map(counts, (count, period) => ({
            commit_date: currentDate,
            period,
            line_count: count,
            files: fileBreakdown[period]
        }));
    });

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
        onPartialSnapshotData: (partialSnapshot, timePoints) => {
            if (onPartialData) {
                const partialBlame = this.GetFilesLInesThatSurvivedOnEachPeriod(partialSnapshot);
                onPartialData(partialBlame, timePoints);
            }
        }
    });
    return this.GetFilesLInesThatSurvivedOnEachPeriod(snapshotData);
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

    const extensionsCounts = _.countBy(files, file => {
      const extMatch = file.match(/\.([^.]+)$/);
      return extMatch ? extMatch[0] : 'no-ext';
    });

    const foldersCounts = _.countBy(files, file => {
      const parts = file.split('/');
      return parts.length > 1 ? parts.slice(0, -1).join('/') : '.';
    });

    return {
      extensions: extensionsCounts,
      folders: Object.keys(foldersCounts).sort(),
      folderLines: foldersCounts,
      timeRange: { min: minTime, max: maxTime },
      commitTimestamps: commitTimestamps,
    };
  }
}
