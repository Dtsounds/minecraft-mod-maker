import JSZip from 'jszip';
import { vi } from 'vitest';

export interface CapturedDownload {
  fileName: string;
  bytes: Uint8Array;
}

/**
 * Intercepts the browser download the app triggers, so a UI test can assert
 * on the bytes a kid would actually receive. jsdom has no download machinery,
 * so we capture the Blob handed to URL.createObjectURL and the filename set
 * on the anchor.
 */
export function captureDownloads(): {
  downloads: CapturedDownload[];
  restore: () => void;
  waitForDownload: (timeoutMs?: number) => Promise<CapturedDownload>;
} {
  const downloads: CapturedDownload[] = [];
  const blobsByUrl = new Map<string, Blob>();
  let counter = 0;

  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;
  const originalClick = HTMLAnchorElement.prototype.click;

  URL.createObjectURL = vi.fn((blob: Blob) => {
    const url = `blob:mock/${counter++}`;
    blobsByUrl.set(url, blob);
    return url;
  }) as unknown as typeof URL.createObjectURL;

  URL.revokeObjectURL = vi.fn() as unknown as typeof URL.revokeObjectURL;

  HTMLAnchorElement.prototype.click = function click(this: HTMLAnchorElement) {
    const blob = blobsByUrl.get(this.href);
    if (blob && this.download) {
      const fileName = this.download;
      void blobToBytes(blob).then((bytes) => downloads.push({ fileName, bytes }));
    }
  };

  return {
    downloads,
    restore() {
      URL.createObjectURL = originalCreate;
      URL.revokeObjectURL = originalRevoke;
      HTMLAnchorElement.prototype.click = originalClick;
    },
    async waitForDownload(timeoutMs = 4000) {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        const last = downloads.at(-1);
        if (last) return last;
        await new Promise((r) => setTimeout(r, 20));
      }
      throw new Error('no download was triggered');
    },
  };
}


/** jsdom's Blob has no arrayBuffer(), so read it through FileReader. */
function blobToBytes(blob: Blob): Promise<Uint8Array> {
  if (typeof blob.arrayBuffer === 'function') {
    return blob.arrayBuffer().then((buffer) => new Uint8Array(buffer));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error ?? new Error('failed to read blob'));
    reader.readAsArrayBuffer(blob);
  });
}

export async function openMcaddon(bytes: Uint8Array) {
  const zip = await JSZip.loadAsync(bytes);
  const paths = Object.keys(zip.files).filter((p) => !zip.files[p]?.dir);
  return {
    paths,
    json: async (path: string) => JSON.parse(await zip.file(path)!.async('string')),
    text: (path: string) => zip.file(path)!.async('string'),
    bytes: (path: string) => zip.file(path)!.async('uint8array'),
    has: (path: string) => paths.includes(path),
  };
}
