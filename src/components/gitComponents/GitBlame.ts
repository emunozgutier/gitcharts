/**
 * GitBlame.ts
 *
 * Extracting pseudo-blame analysis logic from GitProcessing.ts.
 */

// ── Public types ──────────────────────────────────────────────────────────────

export type GranularityUnit = 'year' | 'quarter' | 'month' | 'week' | 'day' | number;

export interface BlameDataPoint {
  commit_date: string; // YYYY-MM-DD snapshot date
  period: string;      // Label for the period the lines originated (e.g. "2024-Q1")
  line_count: number;
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

/**
 * Compare an older FileLinesPreserved with a newer content string.
 * Lines preserved from older history keep their original period.
 * New lines are assigned currentPeriod.
 */
export function get_file_lines_preserved(
  previous: FileLinesPreserved | null,
  current: FileLinesPreserved,
  currentPeriod: string
): FileLinesPreserved {
  const resultLines: LineHistory[] = [];

  // Pool of lines from previous version to match against
  const pool = previous ? [...previous.filelines] : [];

  for (const currentLine of current.filelines) {
    const idx = pool.findIndex(lh => lh.content === currentLine.content);
    if (idx !== -1) {
      // Line preserved, inherit history
      resultLines.push(pool[idx]);
      pool.splice(idx, 1);
    } else {
      // New line (assigned current period)
      resultLines.push({
        content: currentLine.content,
        period: currentPeriod,
      });
    }
  }

  return {
    filename: current.filename,
    filelines: resultLines,
  };
}

/**
 * Legacy pseudoBlame (kept for reference, not used in main scratch rewrite)
 */
export function pseudoBlame(olderContent: string, newerContent: string): {
  newLineCount: number;
  survivingLineCount: number;
  remainingOlderLines: string[];
} {
  const olderLines = olderContent.split('\n');
  const newerLines = newerContent.split('\n');

  // Build a mutable pool from older lines (allow duplicates via index tracking)
  const olderPool = [...olderLines];
  let survivingLineCount = 0;

  const newLines: string[] = [];

  for (const line of newerLines) {
    const idx = olderPool.indexOf(line);
    if (idx !== -1) {
      // Line exists in older snapshot → it survived (originated earlier)
      olderPool.splice(idx, 1);
      survivingLineCount++;
    } else {
      // Line is genuinely new at this snapshot
      newLines.push(line);
    }
  }

  return {
    newLineCount: newLines.length,
    survivingLineCount,
    remainingOlderLines: olderPool,
  };
}
