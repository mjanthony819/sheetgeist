import { validateData } from './validate';
import git from 'isomorphic-git';
import FS from '@isomorphic-git/lightning-fs';
import type { SheetData, CommitInfo, BranchInfo } from './types';

export const fs = new FS('sheetgeist-fs');

export const GIT_DIR = '/repo';
export const DATA_FILE = 'data.json';

/**
 * Initialize a new Git repository in IndexedDB
 */
export async function initRepo(): Promise<void> {
  try {
    await git.init({ fs, dir: GIT_DIR, defaultBranch: 'main' });
    
    // Configure user
    await git.setConfig({
      fs,
      dir: GIT_DIR,
      path: 'user.name',
      value: 'Sheetgeist User'
    });
    
    await git.setConfig({
      fs,
      dir: GIT_DIR,
      path: 'user.email',
      value: 'user@sheetgeist.local'
    });
  } catch (error) { throw error; }
}

/**
 * Check if repository exists
 */
export async function repoExists(): Promise<boolean> {
  try {
    const branches = await git.listBranches({ fs, dir: GIT_DIR });
    return branches.length > 0;
  } catch {
    return false;
  }
}

/**
 * Create initial commit with empty data
 */
export async function createInitialCommit(data: SheetData): Promise<string> {
  const csvContent = sheetDataToCSV(data);
  
  await fs.promises.writeFile(`${GIT_DIR}/${DATA_FILE}`, csvContent, 'utf8');
  
  await git.add({ fs, dir: GIT_DIR, filepath: DATA_FILE });
  
  const oid = await git.commit({
    fs,
    dir: GIT_DIR,
    message: 'Initial commit',
    author: {
      name: 'Sheetgeist User',
      email: 'user@sheetgeist.local'
    }
  });
  
  await flush();
  return oid;
}

/**
 * Get current branch name
 */
export async function getCurrentBranch(): Promise<string> {
  return await git.currentBranch({ fs, dir: GIT_DIR, fullname: false }) || 'main';
}

/**
 * List all branches
 */
export async function listBranches(): Promise<BranchInfo[]> {
  const branches = await git.listBranches({ fs, dir: GIT_DIR });
  
  const branchInfos: BranchInfo[] = [];
  
  for (const branch of branches) {
    try {
      const oid = await git.resolveRef({ fs, dir: GIT_DIR, ref: branch });
      branchInfos.push({ name: branch, oid });
    } catch {
      // Branch might not have commits yet
    }
  }
  
  return branchInfos;
}

/**
 * Create a new branch from current HEAD
 */
export async function createBranch(name: string): Promise<void> {
  await git.branch({ fs, dir: GIT_DIR, ref: name });
  await flush();
}

/**
 * Switch to a different branch
 */
export async function checkoutBranch(name: string): Promise<SheetData> {
  await git.checkout({ fs, dir: GIT_DIR, ref: name, force: false });
  await flush();
  return await readWorkingData();
}

/**
 * Read data from working directory
 */
export async function readWorkingData(): Promise<SheetData> {
  try {
    const content = await fs.promises.readFile(`${GIT_DIR}/${DATA_FILE}`, 'utf8');
    return csvToSheetData(content);
  } catch {
    throw new Error('Cannot read working data. Export a backup before resetting.');
  }
}

/**
 * Write data to working directory (doesn't commit)
 */
export async function writeWorkingData(data: SheetData): Promise<void> {
  const csvContent = sheetDataToCSV(data);
  await fs.promises.writeFile(`${GIT_DIR}/${DATA_FILE}`, csvContent, 'utf8');
}

/**
 * Check if working directory is dirty (has uncommitted changes)
 */
export async function isWorkingDirty(): Promise<boolean> {
  try {
    const status = await git.statusMatrix({ fs, dir: GIT_DIR, filepaths: [DATA_FILE] });
    
    // statusMatrix returns [filepath, HEAD, WORKDIR, STAGE]
    // If WORKDIR !== HEAD, there are uncommitted changes
    if (status.length > 0) {
      const [, head, workdir] = status[0];
      return head !== workdir;
    }
    
    return false;
  } catch { throw new Error('Unable to inspect repository status'); }
}

/**
 * Commit current working directory changes
 */
export async function commitChanges(message: string): Promise<string> {
  await git.add({ fs, dir: GIT_DIR, filepath: DATA_FILE });
  
  const oid = await git.commit({
    fs,
    dir: GIT_DIR,
    message,
    author: {
      name: 'Sheetgeist User',
      email: 'user@sheetgeist.local'
    }
  });
  
  await flush();
  return oid;
}

/**
 * Get commit history for current branch
 */
export async function getCommitLog(limit = 50): Promise<CommitInfo[]> {
  const commits = await git.log({ fs, dir: GIT_DIR, depth: limit });
  
  return commits.map(commit => ({
    oid: commit.oid,
    message: commit.commit.message,
    author: commit.commit.author.name,
    timestamp: commit.commit.author.timestamp * 1000,
    parents: commit.commit.parent
  }));
}

/**
 * Read data from a specific commit
 */
export async function readCommitData(oid: string): Promise<SheetData> {
  try {
    const { blob } = await git.readBlob({
      fs,
      dir: GIT_DIR,
      oid,
      filepath: DATA_FILE
    });
    
    const content = new TextDecoder().decode(blob);
    return csvToSheetData(content);
  } catch {
    throw new Error('Cannot read this commit snapshot.');
  }
}

/**
 * Find merge base between two commits
 */
export async function findMergeBase(ours: string, theirs: string): Promise<string | null> {
  try {
    const bases = await git.findMergeBase({ fs, dir: GIT_DIR, oids: [ours, theirs] });
    return bases.length > 0 ? bases[0] : null;
  } catch {
    return null;
  }
}

/**
 * Create a merge commit with two parents
 */
export async function createMergeCommit(
  message: string,
  theirBranch: string
): Promise<string> {
  const theirOid = await git.resolveRef({ fs, dir: GIT_DIR, ref: theirBranch });
  
  // First commit the merged data (should already be staged)
  await git.add({ fs, dir: GIT_DIR, filepath: DATA_FILE });
  
  // Get current HEAD
  const ourOid = await git.resolveRef({ fs, dir: GIT_DIR, ref: 'HEAD' });
  
  const oid = await git.commit({
    fs,
    dir: GIT_DIR,
    message,
    author: {
      name: 'Sheetgeist User',
      email: 'user@sheetgeist.local'
    },
    parent: [ourOid, theirOid]
  });
  
  await flush();
  return oid;
}

/**
 * Delete repository (for reset functionality)
 */
export async function deleteRepo(): Promise<void> {
  try {
    // Recursively delete the repo directory
    const deleteRecursive = async (path: string) => {
      const entries = await fs.promises.readdir(path);
      
      for (const entry of entries) {
        const fullPath = `${path}/${entry}`;
        const stat = await fs.promises.stat(fullPath);
        
        if (stat.isDirectory()) {
          await deleteRecursive(fullPath);
          await fs.promises.rmdir(fullPath);
        } else {
          await fs.promises.unlink(fullPath);
        }
      }
    };
    
    await deleteRecursive(GIT_DIR);
    await fs.promises.rmdir(GIT_DIR);
  } catch (error) {
    console.error('Error deleting repository:', error);
  }
}

/**
 * Export entire Git repository as a blob for ZIP download
 */
export async function exportRepoFiles(): Promise<Map<string, Uint8Array>> {
  const files = new Map<string, Uint8Array>();
  
  const readDirRecursive = async (path: string, prefix: string = '') => {
    const entries = await fs.promises.readdir(path);
    
    for (const entry of entries) {
      const fullPath = `${path}/${entry}`;
      const relativePath = prefix ? `${prefix}/${entry}` : entry;
      
      try {
        const stat = await fs.promises.stat(fullPath);
        
        if (stat.isDirectory()) {
          await readDirRecursive(fullPath, relativePath);
        } else {
          const content = await fs.promises.readFile(fullPath);
          files.set(relativePath, content);
        }
      } catch {
        // Skip files we can't read
      }
    }
  };
  
  await readDirRecursive(GIT_DIR);
  return files;
}

// Canonical JSON snapshots preserve scalar types, multiline strings and empty schema.
function sheetDataToCSV(data: SheetData): string { validateData(data); return JSON.stringify(data, null, 2) + '\n'; }
function csvToSheetData(content: string): SheetData { const data = JSON.parse(content); validateData(data); return data; }
export { validateData } from './validate';

async function flush(): Promise<void> { await (fs.promises as unknown as {flush:()=>Promise<void>}).flush(); }

/** Restore content as a new commit. Never reset refs or delete history. */
export async function restoreSnapshot(oid:string,expectedHead:string,expectedBranch:string):Promise<SheetData>{
 const {prepareRestore}=await import('./diff');
 const target=await readCommitData(oid);
 const currentBranch=await getCurrentBranch();
 const head=await git.resolveRef({fs,dir:GIT_DIR,ref:'HEAD'});
 if(currentBranch!==expectedBranch||head!==expectedHead)throw new Error('The branch changed. Reopen the restore preview.');
 const restored=prepareRestore(await readWorkingData(),target);
 await writeWorkingData(restored);
 await git.add({fs,dir:GIT_DIR,filepath:DATA_FILE});
 await git.commit({fs,dir:GIT_DIR,message:`Restore snapshot ${oid.slice(0,7)}`,author:{name:'Sheetgeist User',email:'user@sheetgeist.local'},parent:[head]});
 await flush();return restored;
}
