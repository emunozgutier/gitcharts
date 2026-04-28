import { readCommitLog, listAllFiles } from './GitDownload';

export const IGNORED_EXTENSIONS = [
  '.json', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.pdf', '.zip', '.gz', '.tar', 
  '.map', '.lock', '.woff', '.woff2', '.ttf', '.eot', '.mp4', '.webm', '.ogg', '.mp3', '.wav'
];

export function isCodeFile(filename: string): boolean {
  const lower = filename.toLowerCase();
  return !IGNORED_EXTENSIONS.some(ext => lower.endsWith(ext));
}

export async function GitScan(dir: string): Promise<{ 
  extensions: Record<string, number>; 
  folders: string[]; 
  folderLines: Record<string, number>;
  timeRange: { min: number; max: number };
  commitTimestamps: number[];
}> {
  const depth = 5000;
  const commits = await readCommitLog(dir, depth);
  if (commits.length === 0) throw new Error("No commits found");
  
  const latestOid = commits[0].oid;
  const commitTimestamps = commits.map(c => c.timestamp);
  
  const minRaw = Math.min(...commitTimestamps);
  const maxRaw = Math.max(...commitTimestamps);
  
  const minTime = Math.floor(minRaw / 86400) * 86400;
  const maxTime = Math.ceil(maxRaw / 86400) * 86400 - 1; 

  const allFiles = await listAllFiles(dir, latestOid);
  const files = allFiles.filter(isCodeFile);

  const extensionsCounts: Record<string, number> = {};
  const foldersCounts: Record<string, number> = {};

  for (const file of files) {
    let folder = '.';
    const parts = file.split('/');
    if (parts.length > 1) {
      folder = parts.slice(0, -1).join('/');
    }

    const extMatch = file.match(/\.([^.]+)$/);
    const ext = extMatch ? extMatch[0] : 'no-ext';

    extensionsCounts[ext] = (extensionsCounts[ext] || 0) + 1;
    foldersCounts[folder] = (foldersCounts[folder] || 0) + 1;
  }

  return {
    extensions: extensionsCounts,
    folders: Object.keys(foldersCounts).sort(),
    folderLines: foldersCounts,
    timeRange: { min: minTime, max: maxTime },
    commitTimestamps: commitTimestamps,
  };
}
