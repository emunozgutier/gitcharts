export interface BlameLine {
  lineContent: string;
  sourceTime: 0 | 1;
  lineNumberTime1: number;
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

    let sourceTime: 0 | 1 = 1; // Default to time 1

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
      lineNumberTime1: currentLineNumber,
    });

    currentLineNumber++;
  }

  return result;
}
