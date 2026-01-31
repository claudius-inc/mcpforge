import JSZip from 'jszip';

/**
 * Bundle generated files into a downloadable ZIP.
 */
export async function createZipBundle(
  files: Record<string, string>,
  folderName: string
): Promise<Buffer> {
  const zip = new JSZip();
  const folder = zip.folder(folderName);

  if (!folder) throw new Error('Failed to create zip folder');

  for (const [path, content] of Object.entries(files)) {
    folder.file(path, content);
  }

  const buffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
  });

  return buffer;
}
