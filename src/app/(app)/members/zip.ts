// Minimal ZIP builder (STORED / no compression) — pure JS, no dependency.
// Member photos are already-compressed JPEGs and the spreadsheet is small, so
// store-only keeps this tiny and fast while producing a standard .zip.

const CRC_TABLE: Uint32Array = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

const u16 = (n: number) => new Uint8Array([n & 0xff, (n >>> 8) & 0xff]);
const u32 = (n: number) =>
  new Uint8Array([n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff]);

function concat(parts: Uint8Array[]): Uint8Array {
  let len = 0;
  for (const p of parts) len += p.length;
  const out = new Uint8Array(len);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

export type ZipFile = { name: string; data: Uint8Array };

/** Build a standard (STORED) .zip Blob from the given files. */
export function makeZip(files: ZipFile[]): Blob {
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  const dosTime = u16(0);
  const dosDate = u16(0x21); // 1980-01-01
  let offset = 0;

  for (const f of files) {
    const name = enc.encode(f.name);
    const crc = crc32(f.data);
    const size = f.data.length;

    const local = concat([
      u32(0x04034b50), u16(20), u16(0x0800), u16(0), // sig, ver, flags(UTF-8), method=stored
      dosTime, dosDate,
      u32(crc), u32(size), u32(size),
      u16(name.length), u16(0),
      name,
    ]);
    chunks.push(local, f.data);

    central.push(
      concat([
        u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0),
        dosTime, dosDate,
        u32(crc), u32(size), u32(size),
        u16(name.length), u16(0), u16(0), u16(0), u16(0),
        u32(0), u32(offset),
        name,
      ]),
    );
    offset += local.length + size;
  }

  const centralStart = offset;
  let centralSize = 0;
  for (const c of central) {
    chunks.push(c);
    centralSize += c.length;
  }
  chunks.push(
    concat([
      u32(0x06054b50), u16(0), u16(0),
      u16(files.length), u16(files.length),
      u32(centralSize), u32(centralStart),
      u16(0),
    ]),
  );

  return new Blob(chunks as BlobPart[], { type: "application/zip" });
}
