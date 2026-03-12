/**
 * git_archeology.ts  –  re-export barrel
 *
 * This file exists only for backwards compatibility. All logic has been
 * moved to:
 *   - GitDownload.ts   (cloning, FS helpers, blob reading)
 *   - GitProcessing.ts (pseudo-blame analysis, BlameDataPoint, GitArchaeology)
 */

export { GitArchaeology, type BlameDataPoint } from './GitProcessing';
