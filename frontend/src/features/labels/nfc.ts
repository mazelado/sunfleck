// Web NFC (Chrome on Android) isn't in TypeScript's own types yet: just what's used here.
interface NdefWriter {
  write(message: { records: { recordType: "url"; data: string }[] }): Promise<void>;
}

declare global {
  interface Window {
    NDEFReader?: new () => NdefWriter;
  }
}

/** Whether this browser can write NFC tags. */
export function canWriteNfc(): boolean {
  return typeof window !== "undefined" && typeof window.NDEFReader === "function";
}

/**
 * Write `url` to the NFC tag next held to the device. Resolves once it's written; rejects if
 * the person doesn't allow NFC, the tag can't be written, or nothing is held to it in time.
 */
export async function writeUrlToTag(url: string): Promise<void> {
  if (!window.NDEFReader) {
    throw new Error("Web NFC isn't available");
  }
  const writer = new window.NDEFReader();
  await writer.write({ records: [{ recordType: "url", data: url }] });
}
