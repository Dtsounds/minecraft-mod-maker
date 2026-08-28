import JSZip from 'jszip';
import { buildAddon } from './pack';
import type { BuiltAddon, ModProject } from './types';

/**
 * Zip a built add-on. `.mcaddon` is an ordinary zip — the extension is what
 * tells the OS to hand the file to Minecraft.
 */
export async function zipAddon(addon: BuiltAddon): Promise<Blob> {
  const zip = new JSZip();
  for (const file of addon.files) {
    if (file.kind === 'text') {
      zip.file(file.path, file.content);
    } else {
      zip.file(file.path, file.content);
    }
  }
  return zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
    mimeType: 'application/octet-stream',
  });
}

/** Same as zipAddon but yields bytes — used by the packaging tests. */
export async function zipAddonBytes(addon: BuiltAddon): Promise<Uint8Array> {
  const zip = new JSZip();
  for (const file of addon.files) zip.file(file.path, file.content);
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}

export async function buildAndZip(project: ModProject): Promise<{ blob: Blob; fileName: string }> {
  const addon = buildAddon(project);
  const blob = await zipAddon(addon);
  return { blob, fileName: addon.fileName };
}

/** Trigger a browser download. No-op outside the browser. */
export function downloadBlob(blob: Blob, fileName: string): void {
  if (typeof document === 'undefined') return;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Revoking immediately can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function exportProject(project: ModProject): Promise<string> {
  const { blob, fileName } = await buildAndZip(project);
  downloadBlob(blob, fileName);
  return fileName;
}
