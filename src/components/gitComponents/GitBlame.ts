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


