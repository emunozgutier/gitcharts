export interface BlameLine {
  lineContent: string;
  sourceTime: number;
  lineNumber: number;
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
  const lines0 = fileATime0.split('\n');
  const lines1 = fileATime1.split('\n');

  // Keep a frequency map of available lines from time 0
  const availableLinesTime0 = new Map<string, number>();

  for (const line of lines0) {
    if (line.trim() === '') continue; // Ignore empty lines

    const currentCount = availableLinesTime0.get(line) || 0;
    availableLinesTime0.set(line, currentCount + 1);
  }

  const result: BlameLine[] = [];
  let currentLineNumber = 1; // 1-indexed

  for (const line of lines1) {
    if (line.trim() === '') {
      // If we ignore empty lines, we just increment the line number and move on
      currentLineNumber++;
      continue;
    }

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
      lineNumber: currentLineNumber,
    });

    currentLineNumber++;
  }

  return result;
}

/**
 * Chains a new file version onto an existing blame array.
 * This takes the output of a previous GitBlame or GitBlameChain call
 * and compares it with the next file version in sequence.
 * 
 * @param previousBlame The result from the previous blame operation
 * @param nextTimeFile The content of the file at the new time index
 * @param newTimeIndex Optional explicit time index for new lines. If omitted, it will use max(sourceTime) + 1, or 2.
 * @returns Array of BlameLine objects
 */
export function GitBlameChain(previousBlame: BlameLine[], nextTimeFile: string, newTimeIndex?: number): BlameLine[] {
  const nextTime = newTimeIndex !== undefined
    ? newTimeIndex
    : (previousBlame.length > 0 ? Math.max(...previousBlame.map(b => b.sourceTime)) + 1 : 2);

  const nextLines = nextTimeFile.split('\n');

  // Map to store available source times for each line content
  const availableLines = new Map<string, number[]>();

  for (const line of previousBlame) {
    if (line.lineContent.trim() === '') continue;

    if (!availableLines.has(line.lineContent)) {
      availableLines.set(line.lineContent, []);
    }
    availableLines.get(line.lineContent)!.push(line.sourceTime);
  }

  // Sort so that we consume the oldest origins first
  for (const times of availableLines.values()) {
    times.sort((a, b) => a - b);
  }

  const result: BlameLine[] = [];
  let currentLineNumber = 1;

  for (const line of nextLines) {
    if (line.trim() === '') {
      currentLineNumber++;
      continue;
    }

    let sourceTime = nextTime;

    const times = availableLines.get(line);
    if (times !== undefined && times.length > 0) {
      sourceTime = times.shift()!;
    }

    result.push({
      lineContent: line,
      sourceTime,
      lineNumber: currentLineNumber,
    });

    currentLineNumber++;
  }

  return result;
}
function GetFilesLInesThatSurvivedOnEachPeriod(
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
          ...
    }
  }

  return results.sort((a, b) => a.commit_date.localeCompare(b.commit_date));
}