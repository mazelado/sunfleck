import { describe, expect, it } from "vitest";

import { preparePhoto, readDateTaken } from "./photos";

/** A minimal JPEG whose EXIF data holds the date taken (and its offset from UTC, if given). */
function jpegWithDate(date: string, zone: string | null, littleEndian: boolean): Blob {
  const strings = [`${date}\0`, ...(zone ? [`${zone}\0`] : [])];
  const exifIfd = 26; // after the 8-byte header and IFD0 (2 + 12 + 4 bytes)
  const exifIfdSize = 2 + 12 * strings.length + 4;
  const tiff = new DataView(new ArrayBuffer(exifIfd + exifIfdSize + 32));
  const u16 = (at: number, value: number) => {
    tiff.setUint16(at, value, littleEndian);
  };
  const u32 = (at: number, value: number) => {
    tiff.setUint32(at, value, littleEndian);
  };
  tiff.setUint16(0, littleEndian ? 0x4949 : 0x4d4d);
  u16(2, 42);
  u32(4, 8);
  // IFD0: a pointer to the EXIF directory.
  u16(8, 1);
  u16(10, 0x8769);
  u16(12, 4);
  u32(14, 1);
  u32(18, exifIfd);
  // The EXIF directory: DateTimeOriginal, then OffsetTimeOriginal.
  u16(exifIfd, strings.length);
  let data = exifIfd + exifIfdSize;
  [0x9003, 0x9011].slice(0, strings.length).forEach((tag, i) => {
    const entry = exifIfd + 2 + i * 12;
    const text = strings[i] ?? "";
    u16(entry, tag);
    u16(entry + 2, 2);
    u32(entry + 4, text.length);
    u32(entry + 8, data);
    for (const char of text) tiff.setUint8(data++, char.charCodeAt(0));
  });
  const header = new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0, 0, 0x45, 0x78, 0x69, 0x66, 0, 0]);
  new DataView(header.buffer).setUint16(4, 2 + 6 + tiff.byteLength);
  return new Blob([header, tiff.buffer, new Uint8Array([0xff, 0xd9])], { type: "image/jpeg" });
}

describe("readDateTaken", () => {
  it.each([true, false])("reads the date and time zone (little-endian: %s)", async (little) => {
    const photo = jpegWithDate("2026:05:01 12:30:00", "+02:00", little);

    expect(await readDateTaken(photo)).toBe("2026-05-01T12:30:00+02:00");
  });

  it("reads a date without a time zone as local time", async () => {
    const photo = jpegWithDate("2025:12:24 08:00:00", null, true);

    expect(await readDateTaken(photo)).toBe("2025-12-24T08:00:00");
  });

  it.each([
    ["an unset camera clock", jpegWithDate("0000:00:00 00:00:00", null, true)],
    ["an impossible date", jpegWithDate("2026:02:30 12:00:00", null, true)],
    ["a PNG", new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0])])],
    ["a JPEG without EXIF", new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0, 2])])],
    ["an empty file", new Blob([])],
  ])("returns nothing for %s", async (_name, photo) => {
    expect(await readDateTaken(photo)).toBeNull();
  });
});

describe("preparePhoto", () => {
  it("uploads photos the browser can't decode as they are, with their date", async () => {
    // The test environment can't decode images, just like most browsers with HEIC photos.
    const photo = new File([jpegWithDate("2026:05:01 12:30:00", null, false)], "IMG_1.jpg");

    const prepared = await preparePhoto(photo);

    expect(prepared).toEqual({
      file: photo,
      filename: "IMG_1.jpg",
      takenAt: "2026-05-01T12:30:00",
    });
  });
});
