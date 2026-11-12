import JSZip from 'jszip';
import { exportRepoFiles } from './git';

/**
 * Export Git repository as a ZIP file download
 */
export async function exportGitArchive(): Promise<void> {
  const zip = new JSZip();
  
  // Get all repository files
  const files = await exportRepoFiles();
  
  // Add files to ZIP
  for (const [path, content] of files) {
    zip.file(path, content);
  }
  
  // Generate ZIP blob
  const blob = await zip.generateAsync({ type: 'blob' });
  
  // Download
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `sheetgeist-repo-${Date.now()}.zip`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}
