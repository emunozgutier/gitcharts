import type { FileLinesPreserved, BlameDataPoint } from './GitProcessing';

export interface BlameLine {
  lineContent: string;
  sourceTime: number;
}

/**
 * Compares two versions of a file (time 0 and time 1) and returns an array indicating
 * whether each non-empty line in time 1 originated from time 0 or time 1.
 * 
 * Empty lines are ignored in both versions.
 * 
 * @param fileATime0 The file content at time 0
 * @param fileATime1 The file content at time 1
 * @returns Array of BlameLine objects
 */
export function GitBlame(fileATime0: string, fileATime1: string): BlameLine[] {
  const lines1 = fileATime1.split('\n');
  const result: BlameLine[] = [];

  // Fast path: if fileATime0 is empty, all lines in fileATime1 originate from time 1
  if (!fileATime0 || fileATime0.trim() === '') {
    for (let i = 0; i < lines1.length; i++) {
      const line = lines1[i];
      if (line.trim() !== '') {
        result.push({ lineContent: line, sourceTime: 1 });
      }
    }
    return result;
  }

  const lines0 = fileATime0.split('\n');
  const availableLinesTime0 = new Map<string, number>();

  for (let i = 0; i < lines0.length; i++) {
    const line = lines0[i];
    if (line.trim() === '') continue; // Ignore empty lines
    availableLinesTime0.set(line, (availableLinesTime0.get(line) || 0) + 1);
  }

  for (let i = 0; i < lines1.length; i++) {
    const line = lines1[i];
    if (line.trim() === '') continue;

    let sourceTime: number = 1; // Default to time 1

    // Check if we have an available copy of this line from time 0
    const availableCount = availableLinesTime0.get(line);
    if (availableCount !== undefined && availableCount > 0) {
      sourceTime = 0;
      // Consume one copy from time 0
      availableLinesTime0.set(line, availableCount - 1);
    }

    result.push({
      lineContent: line,
      sourceTime,
    });
  }

  return result;
}

export function GitBlameChain(previousBlame: BlameLine[], nextTimeFile: string, newTimeIndex?: number): BlameLine[] {
  const nextTime = newTimeIndex !== undefined
    ? newTimeIndex
    : (previousBlame.length > 0 ? Math.max(...previousBlame.map(b => b.sourceTime)) + 1 : 2);

  const nextLines = nextTimeFile.split('\n');
  const result: BlameLine[] = [];

  // Fast path: if there is no previous blame state, all lines are from nextTime
  if (previousBlame.length === 0) {
    for (let i = 0; i < nextLines.length; i++) {
      const line = nextLines[i];
      if (line.trim() !== '') {
        result.push({ lineContent: line, sourceTime: nextTime });
      }
    }
    return result;
  }

  const nextLineCounts = new Map<string, number>();

  for (let i = 0; i < nextLines.length; i++) {
    const line = nextLines[i];
    if (line.trim() === '') continue;
    nextLineCounts.set(line, (nextLineCounts.get(line) || 0) + 1);
  }

  // To ensure we keep the oldest source times, we process previousBlame
  // from oldest to newest. Sort is fast for this array since it's just numbers.
  const sortedPrevious = [...previousBlame].sort((a, b) => a.sourceTime - b.sourceTime);

  for (let i = 0; i < sortedPrevious.length; i++) {
    const blame = sortedPrevious[i];
    if (blame.lineContent.trim() === '') continue;
    
    const count = nextLineCounts.get(blame.lineContent);
    if (count !== undefined && count > 0) {
      result.push(blame);
      nextLineCounts.set(blame.lineContent, count - 1);
    }
  }

  for (const [lineContent, count] of nextLineCounts.entries()) {
    for (let i = 0; i < count; i++) {
      result.push({
        lineContent,
        sourceTime: nextTime
      });
    }
  }

  return result;
}

export class GitBlameAnalyzer {
  private fileBlameStates = new Map<string, BlameLine[]>();
  private dateKeys: string[] = [];
  private results: BlameDataPoint[] = [];

  public processSnapshot(currentDate: string, currentFileList: FileLinesPreserved[]) {
    this.dateKeys.push(currentDate);
    const counts: Record<string, number> = {};
    const fileBreakdown: Record<string, Record<string, number>> = {};

    for (const date of this.dateKeys) {
      counts[date] = 0;
      fileBreakdown[date] = {};
    }

    for (const currentFile of currentFileList) {
      if (currentFile.filelines.length === 0) continue;

      const previousBlame = this.fileBlameStates.get(currentFile.filename) || [];
      const currentContent = currentFile.filelines.join('\n');
      
      const newTimeIndex = this.dateKeys.length - 1;
      const newBlame = GitBlameChain(previousBlame, currentContent, newTimeIndex);
      this.fileBlameStates.set(currentFile.filename, newBlame);

      for (const line of newBlame) {
        if (line.lineContent.trim() === '') continue;
        
        const sourceDate = this.dateKeys[line.sourceTime];
        counts[sourceDate] = (counts[sourceDate] || 0) + 1;
        
        if (!fileBreakdown[sourceDate][currentFile.filename]) {
            fileBreakdown[sourceDate][currentFile.filename] = 0;
        }
        fileBreakdown[sourceDate][currentFile.filename]++;
      }
    }

    for (const period of Object.keys(counts)) {
      const count = counts[period];
      this.results.push({
        commit_date: currentDate,
        period,
        line_count: count,
        files: fileBreakdown[period]
      });
    }
  }

  public getResults(): BlameDataPoint[] {
    return [...this.results].sort((a, b) => a.commit_date.localeCompare(b.commit_date));
  }
}

export async function GetFilesLInesThatSurvivedOnEachPeriod(
  snapshotData: { data: Record<string, FileLinesPreserved[]> },
  onPartialData?: (data: BlameDataPoint[], timePoints: number[]) => void,
  timePoints?: number[]
): Promise<BlameDataPoint[]> {
  const { data } = snapshotData;
  const dateKeys = Object.keys(data).sort();
  const results: BlameDataPoint[] = [];

  let lastUpdateTs = Date.now();

  // Map to maintain the blame state for each file across snapshots
  // filename -> BlameLine[]
  const fileBlameStates = new Map<string, BlameLine[]>();

  // For each snapshot J, we update the blame state for all its files
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

    // Update state for all files present in the current snapshot
    for (const currentFile of currentFileList) {
      if (currentFile.filelines.length === 0) continue;

      const previousBlame = fileBlameStates.get(currentFile.filename) || [];
      const currentContent = currentFile.filelines.join('\n');
      
      const newBlame = GitBlameChain(previousBlame, currentContent, j);
      fileBlameStates.set(currentFile.filename, newBlame);

      // Aggregate the sourceTimes from newBlame
      for (const line of newBlame) {
        if (line.lineContent.trim() === '') continue;
        
        const sourceDate = dateKeys[line.sourceTime];
        counts[sourceDate] = (counts[sourceDate] || 0) + 1;
        
        if (!fileBreakdown[sourceDate][currentFile.filename]) {
            fileBreakdown[sourceDate][currentFile.filename] = 0;
        }
        fileBreakdown[sourceDate][currentFile.filename]++;
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

    if (onPartialData && timePoints) {
      const now = Date.now();
      if (now - lastUpdateTs > 200 || j === dateKeys.length - 1) {
        lastUpdateTs = now;
        onPartialData([...results].sort((a, b) => a.commit_date.localeCompare(b.commit_date)), timePoints);
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
  }

  return results.sort((a, b) => a.commit_date.localeCompare(b.commit_date));
}