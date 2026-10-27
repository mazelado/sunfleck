/**
 * Preparing photos for upload. Phone photos are often 4000+ px and several MB, so the browser
 * shrinks them first, which makes uploads much faster on mobile data. The server resizes them
 * again anyway and removes their metadata.
 */

/** Photos are stored at most this many pixels on their long edge (matches the server). */
export const MAX_EDGE = 2048;
const JPEG_QUALITY = 0.9;

export interface PreparedPhoto {
  file: Blob;
  filename: string;
  /** When the photo was taken, as a local date and time ("2026-05-01T12:30:00"), if known. */
  takenAt: string | null;
}

/**
 * Shrink a photo for upload and read when it was taken (shrinking loses that, so it's sent
 * separately). Photos the browser can't decode, such as HEIC on most browsers, are uploaded as
 * they are; the server handles them.
 */
export async function preparePhoto(file: File): Promise<PreparedPhoto> {
  const takenAt = await readDateTaken(file).catch(() => null);
  const shrunk = await shrink(file).catch(() => null);
  if (!shrunk) {
    return { file, filename: file.name, takenAt };
  }
  return { file: shrunk, filename: file.name.replace(/\.\w+$/, "") + ".jpg", takenAt };
}

/** A smaller JPEG copy of the photo, or null if it's small enough already. */
async function shrink(file: File): Promise<Blob | null> {
  // Browsers turn the picture upright (from its EXIF orientation) while decoding it.
  const bitmap = await createImageBitmap(file);
  try {
    const scale = MAX_EDGE / Math.max(bitmap.width, bitmap.height);
    if (scale >= 1) {
      return null;
    }
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext("2d");
    if (!context) {
      return null;
    }
    context.imageSmoothingQuality = "high";
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return await new Promise((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY);
    });
  } finally {
    bitmap.close();
  }
}

// --- Reading the date taken from a JPEG's EXIF data -------------------------------------------
// EXIF is a small TIFF structure inside the JPEG's APP1 segment. Only the date is needed, so
// this reads just enough of it rather than pulling in a library.

const JPEG_START = 0xffd8;
const APP1 = 0xffe1;
const START_OF_SCAN = 0xffda;
const EXIF_IFD_POINTER = 0x8769;
const DATE_TIME_ORIGINAL = 0x9003;
const OFFSET_TIME_ORIGINAL = 0x9011;
const ASCII = 2;
const LONG = 4;
// Dates before digital cameras existed are clock errors (the server ignores them too).
const EARLIEST_YEAR = 1990;

/** When a JPEG photo was taken, from its EXIF data: "2026-05-01T12:30:00[+02:00]" or null. */
export async function readDateTaken(file: Blob): Promise<string | null> {
  // The EXIF segment comes first and is at most 64 KB.
  const view = new DataView(await file.slice(0, 128 * 1024).arrayBuffer());
  if (view.byteLength < 4 || view.getUint16(0) !== JPEG_START) {
    return null;
  }
  let offset = 2;
  while (offset + 4 <= view.byteLength) {
    const marker = view.getUint16(offset);
    const length = view.getUint16(offset + 2);
    if (marker === START_OF_SCAN || (marker & 0xff00) !== 0xff00) {
      return null;
    }
    if (marker === APP1 && readAscii(view, offset + 4, 4) === "Exif") {
      return readTiffDate(view, offset + 10);
    }
    offset += 2 + length;
  }
  return null;
}

function readTiffDate(view: DataView, tiff: number): string | null {
  const littleEndian = view.getUint16(tiff) === 0x4949; // "II" (Intel) or "MM" (Motorola)
  const uint16 = (at: number) => view.getUint16(tiff + at, littleEndian);
  const uint32 = (at: number) => view.getUint32(tiff + at, littleEndian);

  /** The tags of the directory at `at`: tag → [type, count, value or offset]. */
  function entries(at: number): Map<number, [number, number, number]> {
    const tags = new Map<number, [number, number, number]>();
    const count = uint16(at);
    for (let i = 0; i < count; i++) {
      const entry = at + 2 + i * 12;
      tags.set(uint16(entry), [uint16(entry + 2), uint32(entry + 4), entry + 8]);
    }
    return tags;
  }

  function ascii(tag: [number, number, number] | undefined): string | null {
    if (!tag || tag[0] !== ASCII) return null;
    const [, count, valueAt] = tag;
    // Up to 4 bytes are stored in place; longer values elsewhere.
    const start = count > 4 ? tiff + uint32(valueAt) : tiff + valueAt;
    return readAscii(view, start, count).replace(/\0+$/, "");
  }

  const pointer = entries(uint32(4)).get(EXIF_IFD_POINTER);
  if (!pointer || pointer[0] !== LONG) {
    return null;
  }
  const exif = entries(uint32(pointer[2]));
  const date = ascii(exif.get(DATE_TIME_ORIGINAL));
  const match = date ? /^(\d{4}):(\d{2}):(\d{2}) (\d{2}:\d{2}:\d{2})$/.exec(date.trim()) : null;
  if (!match) {
    return null;
  }
  const [, year = "", month = "", day = "", time = ""] = match;
  if (!isRealDate(Number(year), Number(month), Number(day))) {
    return null;
  }
  const zone = ascii(exif.get(OFFSET_TIME_ORIGINAL))?.trim() ?? "";
  const local = `${year}-${month}-${day}T${time}`;
  return /^[+-]\d{2}:\d{2}$/.test(zone) ? local + zone : local;
}

/** Whether it's a real calendar date (cameras with unset clocks write "0000:00:00"). */
function isRealDate(year: number, month: number, day: number): boolean {
  const date = new Date(year, month - 1, day);
  return year >= EARLIEST_YEAR && date.getMonth() === month - 1 && date.getDate() === day;
}

function readAscii(view: DataView, start: number, length: number): string {
  let text = "";
  for (let i = start; i < start + length && i < view.byteLength; i++) {
    text += String.fromCharCode(view.getUint8(i));
  }
  return text;
}
