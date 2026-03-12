import git from 'isomorphic-git';
import http from 'isomorphic-git/http/web';
import FS from '@isomorphic-git/lightning-fs';

const fs = new FS('gitcharts');
const pfs = fs.promises;

export interface BlameDataPoint {
  commit_date: string;
  period: string;
  line_count: number;
}

export class GitArchaeology {
  public repoUrl: string;
  public dir: string;

  constructor(repoFullName: string) {
    this.repoUrl = `https://github.com/${repoFullName}`;
    this.dir = `/${repoFullName}`;
  }

  private getPeriod(date: Date): string {
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth();
    const quarter = Math.floor(month / 3) + 1;
    return `${year}-Q${quarter}`;
  }

  async runLegacy(onProgress?: (progress: string) => void): Promise<BlameDataPoint[]> {
    try {
      if (onProgress) onProgress("Initializing filesystem...");
      try {
        await pfs.mkdir(this.dir);
      } catch (e) {
        // Directory might already exist
      }

      if (onProgress) onProgress(`Cloning ${this.repoUrl} (this may take a while)...`);
      await git.clone({
        fs,
        http,
        dir: this.dir,
        url: this.repoUrl,
        corsProxy: 'https://cors.isomorphic-git.org',
        singleBranch: true,
        depth: 25, 
        onProgress: (p) => {
          if (onProgress && p.phase) {
            onProgress(`Cloning: ${p.phase} ${p.loaded}/${p.total || '?'}`);
          }
        }
      });

      if (onProgress) onProgress("Reading commit history...");
      const commits = await git.log({
        fs,
        dir: this.dir,
        depth: 10 // Smaller sample for faster browser processing
      });

      if (onProgress) onProgress(`Analyzing ${commits.length} commits...`);
      const data: BlameDataPoint[] = [];

      // Cache for commit dates to avoid multiple readCommit calls
      const commitDateCache: Record<string, string> = {};

      for (let i = 0; i < commits.length; i++) {
        const commit = commits[i];
        const oid = commit.oid;
        const commitDate = new Date(commit.commit.author.timestamp * 1000);
        const commitDateStr = commitDate.toISOString().split('T')[0];
        
        if (onProgress) onProgress(`Analyzing snapshot ${i + 1}/${commits.length}: ${oid.substring(0, 7)}...`);

        const files = (await git.listFiles({ fs, dir: this.dir, ref: oid }))
          .filter(f => /\.(py|js|ts|tsx|java)$/.test(f)); // Focus on high-value files

        const periodCounts: Record<string, number> = {};
        const sampledFiles = files.slice(0, 4); // Aggressive sampling for performance

        for (const filepath of sampledFiles) {
          try {
            // Use isomorphic-git blame if available, otherwise fallback
            // We use (git as any) to bypass potential type mismatch
            const blameResults = await (git as any).blame({
              fs,
              dir: this.dir,
              ref: oid,
              filepath
            });

            for (const line of blameResults) {
              const originOid = line.commitId;
              let originPeriod = commitDateCache[originOid];
              
              if (!originPeriod) {
                const originCommit = await git.readCommit({ fs, dir: this.dir, oid: originOid });
                const originDate = new Date(originCommit.commit.author.timestamp * 1000);
                originPeriod = this.getPeriod(originDate);
                commitDateCache[originOid] = originPeriod;
              }
              
              periodCounts[originPeriod] = (periodCounts[originPeriod] || 0) + 1;
            }
          } catch (e) {
            // Fallback: Attribute all lines to current period if blame fails
            try {
               const { blob } = await git.readBlob({ fs, dir: this.dir, oid: (await git.readTree({ fs, dir: this.dir, oid })).tree.find(e => e.path === filepath)?.oid || '' });
               const content = new TextDecoder().decode(blob);
               const lineCount = content.split('\n').length;
               const currentPeriod = this.getPeriod(commitDate);
               periodCounts[currentPeriod] = (periodCounts[currentPeriod] || 0) + lineCount;
            } catch (innerE) {
               console.error(`Analysis failed for ${filepath}`, innerE);
            }
          }
        }

        for (const [period, count] of Object.entries(periodCounts)) {
          data.push({
            commit_date: commitDateStr,
            period,
            line_count: count
          });
        }
      }

      return data.sort((a, b) => a.commit_date.localeCompare(b.commit_date));

    } catch (error) {
      console.error("Git Archaeology Error:", error);
      throw error;
    }
  }
}
