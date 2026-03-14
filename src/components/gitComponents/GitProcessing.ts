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
          depth: 100,
          onProgress: (msg) => onProgress && onProgress(msg),
        });
    }

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

    // ── Logic from Python snippet ──────────────────────────────────────────
    
    // data: Dict(date, List[FileLinesPreserved]) = {}
    const data: Record<string, FileLinesPreserved[]> = {}; 
    let previousDate: string | null = null;

    for (let i = 0; i < ordered.length; i++) {
        const commit = ordered[i];
        
        // date0 = get_date(time_point_list[i])
        const date0 = toDateStr(commit.timestamp);
        const period0 = getPeriod(new Date(commit.timestamp * 1000), options?.granularity);

        if (onProgress) onProgress(`Processing ${date0} (${i + 1}/${ordered.length})...`);

        // allFilesOnDate0 = get_all_files(date0)
        // (In our case, we get files for the specific commit)
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

        // Sampling for performance
        const sampledFiles = files.slice(0, 15);

        // data[date0] = get_all_file_lines(date0)
        const currentFileList: FileLinesPreserved[] = [];
        for (const filepath of sampledFiles) {
            try {
                const content = await withTimeout(
                    readFileAtCommit(this.dir, commit.oid, filepath),
                    15_000,
                    `Reading ${filepath}`
                );
                if (content !== null) {
                    currentFileList.push({
                        filename: filepath,
                        filelines: content.split('\n').map(line => ({ content: line, period: period0 }))
                    });
                }
            } catch {}
        }
        data[date0] = currentFileList;

        if (i > 0 && previousDate !== null) {
            // currentFiles = list(map(lambda x: x.filename), data[date0])
            const currentFiles = data[date0].map(x => x.filename);

            // for previousFileLinesPreservedList in data[previousDate]:
            // (Assuming data[previousDate] is the list of FileLinesPreserved)
            const previousList = data[previousDate];
            for (const previousFileLinesPreserved of previousList) {
                // fileName = previousFileLinesPerserved.filename
                const fileName = previousFileLinesPreserved.filename;
                
                // if fileName in currentFiles:
                if (currentFiles.includes(fileName)) {
                    // currentFileLinePreserved = filter(lambda x: x.filename == fileName, data[date0])[0]
                    const currentFileLinePreserved = data[date0].find(x => x.filename === fileName);
                    
                    if (currentFileLinePreserved) {
                        // currentFileLinePreserved = GitBlame.get_file_lines_preserved(previousFileLinesPerserved, currentFileLinePreserved)
                        const updated = get_file_lines_preserved(previousFileLinesPreserved, currentFileLinePreserved, period0);
                        
                        // Update in place in data[date0]
                        const idx = data[date0].findIndex(x => x.filename === fileName);
                        if (idx !== -1) data[date0][idx] = updated;
                    }
                }
            }
        }

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
}
