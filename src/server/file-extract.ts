import { inflateRawSync } from 'node:zlib';

export interface IncomingFile {
  name: string;
  mimeType: string;
  base64: string;
  size: number;
}

const MAX_ARCHIVE_ENTRIES = 10_000;
const MAX_EXTRACTED_ENTRY_BYTES = 16 * 1024 * 1024;
const MAX_TOTAL_EXTRACTED_BYTES = 24 * 1024 * 1024;
const MAX_COMPRESSION_RATIO = 200;

export interface ExtractionBudget {
  remainingBytes: number;
  remainingTextChars: number;
}

export function createExtractionBudget(
  maxBytes = MAX_TOTAL_EXTRACTED_BYTES,
  maxTextChars = 240_000,
): ExtractionBudget {
  return { remainingBytes: maxBytes, remainingTextChars: maxTextChars };
}

function archiveLimit(message = 'Archive expands beyond safe processing limits'): never {
  throw Object.assign(new Error(message), { code: 'ARCHIVE_LIMIT', status: 413 });
}

function consumeBytes(budget: ExtractionBudget, size: number) {
  if (!Number.isSafeInteger(size) || size < 0 || size > budget.remainingBytes) archiveLimit();
  budget.remainingBytes -= size;
}

function limitText(value: string, budget: ExtractionBudget) {
  if (budget.remainingTextChars <= 0) return '';
  const text = value.slice(0, budget.remainingTextChars);
  budget.remainingTextChars -= text.length;
  return text;
}

function decodeXml(value: string) {
  return value
    .replace(/<w:tab\s*\/>/g, '\t')
    .replace(/<w:br\s*\/>/g, '\n')
    .replace(/<a:br\s*\/>/g, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    // Decode &amp; last so that already-decoded entities (e.g. "&amp;lt;")
    // are not double-unescaped into markup characters.
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function findEndOfCentralDirectory(buffer: Buffer) {
  // EOCD can be followed by a ZIP comment of up to 65,535 bytes.
  const min = Math.max(0, buffer.length - 65_557);
  for (let offset = buffer.length - 22; offset >= min; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) return offset;
  }
  return -1;
}

/**
 * Minimal, dependency-free ZIP reader for Office Open XML files.
 * It reads the central directory instead of trusting local-header sizes, so
 * files that use ZIP data descriptors (bit 3) work correctly as well.
 */
function unzipEntries(buffer: Buffer, budget: ExtractionBudget): Map<string, Buffer> {
  const entries = new Map<string, Buffer>();
  const eocd = findEndOfCentralDirectory(buffer);
  if (eocd < 0) return entries;

  const entryCount = buffer.readUInt16LE(eocd + 10);
  const centralSize = buffer.readUInt32LE(eocd + 12);
  const centralOffset = buffer.readUInt32LE(eocd + 16);
  if (entryCount === 0xffff || centralSize === 0xffffffff || centralOffset === 0xffffffff) {
    throw Object.assign(new Error('ZIP64 Office files are not supported by the lightweight parser'), { code: 'ZIP64_UNSUPPORTED' });
  }
  if (entryCount > MAX_ARCHIVE_ENTRIES || centralOffset + centralSize > buffer.length) {
    throw Object.assign(new Error('Archive exceeds safe processing limits'), { code: 'ARCHIVE_LIMIT' });
  }

  let offset = centralOffset;
  let totalExtracted = 0;
  for (let index = 0; index < entryCount && offset + 46 <= buffer.length; index += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) break;
    const flags = buffer.readUInt16LE(offset + 8);
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const nameStart = offset + 46;
    const name = buffer.subarray(nameStart, nameStart + nameLength).toString((flags & 0x800) ? 'utf8' : 'utf8');

    if (uncompressedSize > MAX_EXTRACTED_ENTRY_BYTES || totalExtracted + uncompressedSize > MAX_TOTAL_EXTRACTED_BYTES || uncompressedSize > budget.remainingBytes) archiveLimit();
    if (localOffset + 30 > buffer.length || buffer.readUInt32LE(localOffset) !== 0x04034b50) {
      throw Object.assign(new Error('Invalid ZIP local header'), { code: 'INVALID_ARCHIVE' });
    }
    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    if (dataStart + compressedSize > buffer.length) {
      throw Object.assign(new Error('Corrupted ZIP entry'), { code: 'INVALID_ARCHIVE' });
    }

    // Directories have no data and do not need to be surfaced.
    if (!name.endsWith('/')) {
      const compressed = buffer.subarray(dataStart, dataStart + compressedSize);
      let data: Buffer;
      if (method === 0) data = compressed;
      else if (method === 8) {
        const maxOutputLength = Math.min(MAX_EXTRACTED_ENTRY_BYTES, budget.remainingBytes);
        if (maxOutputLength <= 0) archiveLimit();
        try {
          data = inflateRawSync(compressed, { maxOutputLength });
        } catch (error: any) {
          if (error?.code === 'ERR_BUFFER_TOO_LARGE' || /output length/i.test(String(error?.message || ''))) archiveLimit();
          throw error;
        }
      }
      else {
        offset = nameStart + nameLength + extraLength + commentLength;
        continue;
      }
      if (data.length > MAX_EXTRACTED_ENTRY_BYTES || data.length !== uncompressedSize) archiveLimit('Archive entry size does not match its verified output');
      if (data.length > 1024 * 1024 && data.length > Math.max(1, compressed.length) * MAX_COMPRESSION_RATIO) archiveLimit('Archive compression ratio exceeds safe processing limits');
      totalExtracted += data.length;
      if (totalExtracted > MAX_TOTAL_EXTRACTED_BYTES) archiveLimit();
      consumeBytes(budget, data.length);
      entries.set(name, data);
    }
    offset = nameStart + nameLength + extraLength + commentLength;
  }
  return entries;
}

function extractDocx(buffer: Buffer, budget: ExtractionBudget) {
  const entries = unzipEntries(buffer, budget);
  const document = entries.get('word/document.xml');
  if (!document) return '';
  return decodeXml(document.toString('utf8'));
}

function extractPptx(buffer: Buffer, budget: ExtractionBudget) {
  const entries = unzipEntries(buffer, budget);
  const slides = [...entries.entries()]
    .filter(([name]) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }));
  return slides.map(([, data], index) => `Slide ${index + 1}: ${decodeXml(data.toString('utf8'))}`).join('\n');
}

function extractXlsx(buffer: Buffer, budget: ExtractionBudget) {
  const entries = unzipEntries(buffer, budget);
  const sharedXml = entries.get('xl/sharedStrings.xml')?.toString('utf8') || '';
  const shared = [...sharedXml.matchAll(/<si[^>]*>([\s\S]*?)<\/si>/g)].map(m => decodeXml(m[1]));
  const sheets = [...entries.entries()]
    .filter(([name]) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name))
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }));

  return sheets.map(([, data], sheetIndex) => {
    const xml = data.toString('utf8');
    const cells: string[] = [];
    for (const match of xml.matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
      const attrs = match[1];
      const body = match[2];
      const ref = /\br="([^"]+)"/.exec(attrs)?.[1] || '?';
      const type = /\bt="([^"]+)"/.exec(attrs)?.[1];
      const raw = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1] || /<t[^>]*>([\s\S]*?)<\/t>/.exec(body)?.[1] || '';
      const value = type === 's' ? shared[Number(raw)] ?? raw : raw;
      if (value !== '') cells.push(`${ref}=${decodeXml(value)}`);
    }
    return `Sheet ${sheetIndex + 1}:\n${cells.join('\n')}`;
  }).join('\n\n');
}

function extractGenericZip(buffer: Buffer, budget: ExtractionBudget) {
  const entries = unzipEntries(buffer, budget);
  const accepted = /\.(txt|md|csv|json|xml|html|css|js|mjs|cjs|ts|tsx|jsx|py|java|c|h|cpp|hpp|cs|go|rs|sql|yaml|yml|toml|ini|env|sh)$/i;
  const parts: string[] = [];
  let chars = 0;
  for (const [name, data] of entries) {
    if (!accepted.test(name) || data.length > 2 * 1024 * 1024) continue;
    const text = data.toString('utf8').replace(/\u0000/g, '');
    if (!text.trim()) continue;
    const slice = text.slice(0, Math.max(0, 240_000 - chars));
    parts.push(`--- ${name} ---\n${slice}`); chars += slice.length;
    if (chars >= 240_000 || parts.length >= 80) break;
  }
  return parts.join('\n\n');
}

// ---------------------------------------------------------------------------
// Content-signature (magic bytes) validation
//
// A client-supplied mimeType and filename extension are both trivially forged,
// so uploads are additionally checked against the real leading bytes of the
// payload. Only the families the product actually consumes are accepted:
// PDF, raster images, OOXML/ZIP office documents and plain text.
// ---------------------------------------------------------------------------

export type FileContentFamily = 'pdf' | 'image' | 'zip' | 'text';

const TEXT_EXTENSIONS =
  /\.(txt|md|markdown|csv|tsv|json|xml|html|htm|css|js|mjs|cjs|ts|tsx|jsx|py|java|c|h|cpp|hpp|cs|go|rb|rs|php|sh|sql|yml|yaml|svg|bib|tex|rtf)$/i;
const ZIP_EXTENSIONS = /\.(docx|pptx|xlsx|odt|odp|ods|zip)$/i;
const IMAGE_EXTENSIONS = /\.(png|jpg|jpeg|gif|webp|bmp|tif|tiff|heic|heif|avif|ico)$/i;

function startsWithBytes(buffer: Buffer, bytes: number[], offset = 0) {
  if (buffer.length < offset + bytes.length) return false;
  for (let index = 0; index < bytes.length; index += 1)
    if (buffer[offset + index] !== bytes[index]) return false;
  return true;
}

/** Family implied by the real leading bytes, or '' when no known signature matches. */
function detectBinaryFamily(buffer: Buffer): FileContentFamily | '' {
  if (startsWithBytes(buffer, [0x25, 0x50, 0x44, 0x46])) return 'pdf'; // %PDF
  // Local file header, empty archive and spanned archive markers.
  if (
    startsWithBytes(buffer, [0x50, 0x4b, 0x03, 0x04]) ||
    startsWithBytes(buffer, [0x50, 0x4b, 0x05, 0x06]) ||
    startsWithBytes(buffer, [0x50, 0x4b, 0x07, 0x08])
  )
    return 'zip';
  if (startsWithBytes(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image'; // PNG
  if (startsWithBytes(buffer, [0xff, 0xd8, 0xff])) return 'image'; // JPEG
  if (startsWithBytes(buffer, [0x47, 0x49, 0x46, 0x38])) return 'image'; // GIF87a/GIF89a
  if (startsWithBytes(buffer, [0x52, 0x49, 0x46, 0x46]) && startsWithBytes(buffer, [0x57, 0x45, 0x42, 0x50], 8))
    return 'image'; // RIFF....WEBP
  if (startsWithBytes(buffer, [0x42, 0x4d])) return 'image'; // BMP
  if (startsWithBytes(buffer, [0x49, 0x49, 0x2a, 0x00]) || startsWithBytes(buffer, [0x4d, 0x4d, 0x00, 0x2a]))
    return 'image'; // TIFF LE/BE
  if (startsWithBytes(buffer, [0x66, 0x74, 0x79, 0x70], 4)) return 'image'; // ISO-BMFF: HEIC/HEIF/AVIF
  if (startsWithBytes(buffer, [0x00, 0x00, 0x01, 0x00])) return 'image'; // ICO
  return '';
}

/** True when the payload is plausibly decodable text rather than an unknown binary. */
function looksLikeText(buffer: Buffer) {
  const sample = buffer.subarray(0, Math.min(buffer.length, 8192));
  if (sample.includes(0)) return false;
  const decoded = new TextDecoder('utf-8', { fatal: false }).decode(sample);
  if (decoded.includes('�') && buffer.length >= 4) return false;
  let control = 0;
  for (const code of decoded) {
    const point = code.codePointAt(0)!;
    if (point < 0x09 || (point > 0x0d && point < 0x20)) control += 1;
  }
  return control === 0 || control / decoded.length < 0.02;
}

/** Families the declared mimeType and filename claim the payload belongs to. */
function declaredFamilies(name: string, mimeType: string): Set<FileContentFamily> {
  const families = new Set<FileContentFamily>();
  const lower = String(name || '').toLowerCase();
  const mime = String(mimeType || '').toLowerCase().split(';')[0].trim();

  if (mime === 'application/pdf' || mime === 'application/x-pdf') families.add('pdf');
  else if (mime === 'image/svg+xml') families.add('text');
  else if (mime.startsWith('image/')) families.add('image');
  else if (mime.startsWith('text/')) families.add('text');
  else if (
    mime === 'application/zip' ||
    mime === 'application/x-zip-compressed' ||
    mime.includes('officedocument') ||
    mime.includes('opendocument')
  )
    families.add('zip');
  else if (mime === 'application/json' || mime === 'application/xml' || mime === 'application/javascript')
    families.add('text');

  if (lower.endsWith('.pdf')) families.add('pdf');
  if (ZIP_EXTENSIONS.test(lower)) families.add('zip');
  if (IMAGE_EXTENSIONS.test(lower)) families.add('image');
  if (TEXT_EXTENSIONS.test(lower)) families.add('text');
  return families;
}

function rejectFile(message: string, code: string): never {
  throw Object.assign(new Error(message), { status: 400, code });
}

/**
 * Verifies that the real bytes of an upload match a supported file family and
 * that the family agrees with what the client declared. Returns the family the
 * content actually belongs to.
 */
export function assertSupportedFileContent(file: IncomingFile): FileContentFamily {
  const buffer = Buffer.from(file.base64, 'base64');
  if (!buffer.length) rejectFile('File content is empty', 'INVALID_FILE_CONTENT');

  const declared = declaredFamilies(file.name, file.mimeType);
  if (!declared.size)
    rejectFile(
      'Unsupported file type. Upload a PDF, image, Office document or text file.',
      'UNSUPPORTED_FILE_TYPE',
    );

  const detected = detectBinaryFamily(buffer);
  if (detected) {
    if (!declared.has(detected))
      rejectFile(
        'File content does not match its declared type',
        'FILE_SIGNATURE_MISMATCH',
      );
    return detected;
  }

  // No known binary signature: the only remaining supported family is text.
  if (!declared.has('text') || !looksLikeText(buffer))
    rejectFile(
      'File content does not match its declared type',
      'FILE_SIGNATURE_MISMATCH',
    );
  return 'text';
}

export function extractFileText(file: IncomingFile, budget: ExtractionBudget = createExtractionBudget()): { text: string; multimodal: boolean } {
  const buffer = Buffer.from(file.base64, 'base64');
  const lower = file.name.toLowerCase();
  const mime = (file.mimeType || '').toLowerCase();

  if (mime.startsWith('text/') || /\.(txt|md|csv|json|xml|html|css|js|ts|tsx|jsx|py|java|c|cpp|sql)$/i.test(lower)) {
    const safe = buffer.subarray(0, Math.min(buffer.length, budget.remainingBytes));
    consumeBytes(budget, safe.length);
    return { text: limitText(safe.toString('utf8'), budget), multimodal: false };
  }
  if (lower.endsWith('.docx') || mime.includes('wordprocessingml')) return { text: limitText(extractDocx(buffer, budget), budget), multimodal: false };
  if (lower.endsWith('.pptx') || mime.includes('presentationml')) return { text: limitText(extractPptx(buffer, budget), budget), multimodal: false };
  if (lower.endsWith('.xlsx') || mime.includes('spreadsheetml')) return { text: limitText(extractXlsx(buffer, budget), budget), multimodal: false };
  if (lower.endsWith('.zip') || mime === 'application/zip' || mime === 'application/x-zip-compressed') return { text: limitText(extractGenericZip(buffer, budget), budget), multimodal: false };

  // PDF, images, audio and video are sent to the configured multimodal AI provider.
  if (mime === 'application/pdf' || mime.startsWith('image/') || mime.startsWith('audio/') || mime.startsWith('video/')) {
    return { text: '', multimodal: true };
  }

  return { text: '', multimodal: false };
}
