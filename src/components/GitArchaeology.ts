/**
 * GitArchaeology.ts
 *
 * Composed entry point that re-exports everything from GitDownload and
 * GitProcessing, and provides a single convenient import for consumers.
 *
 * Component structure:
 *   GitArchaeology
 *   ├── GitDownload   – cloning, FS helpers, blob reading
 *   └── GitProcessing – pseudo-blame analysis, BlameDataPoint, GitArchaeology class
 */

export * from './gitComponents/GitDownload';
export * from './gitComponents/GitProcessing';
