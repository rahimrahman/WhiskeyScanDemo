export const MAX_LONG_EDGE = 1024;
export const CSV_FILE_NAME = 'whiskey_bottles.csv';
export const CROP_REPORT_FILE_NAME = 'crop_report.csv';

const PHOTO_COLUMNS = ['photo1', 'photo2', 'photo3', 'photo4'] as const;
const CROP_REPORT_COLUMNS = ['bottle', 'output_files', 'status'];
const KEPT_CROP_STATUSES = new Set(['cropped', 'partial', 'split']);
const REQUIRED_COLUMNS = [
  '#',
  'name',
  'producer',
  'expression',
  'age',
  'style',
  'note',
  'folder',
  ...PHOTO_COLUMNS,
];

export type CatalogWhiskey = {
  id: string;
  name: string;
  producer: string;
  expression: string;
  age: string;
  category: string;
  note: string;
  image: string;
  photos: string[];
};

export type Catalog = { whiskeys: CatalogWhiskey[] };

/** `source` is a path under the source folder; `target` is relative to `assets/catalog/`. */
export type PhotoCopy = { id: string; source: string; target: string };

export type CatalogPlan = { catalog: Catalog; photos: PhotoCopy[] };

export type ImageSize = { width: number; height: number };

export type PathExists = (path: string) => boolean;

export class CatalogError extends Error {
  constructor(readonly problems: string[]) {
    super(problems.join('\n'));
    this.name = 'CatalogError';
  }
}

/** RFC 4180 CSV: quoted fields may hold commas, `""` escapes and line breaks; rows end in LF or CRLF. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const input = text.startsWith('\uFEFF') ? text.slice(1) : text;

  const endRow = () => {
    row.push(field);
    if (row.length > 1 || row[0] !== '') rows.push(row);
    row = [];
    field = '';
  };

  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (quoted) {
      if (char === '"' && input[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n' || (char === '\r' && input[i + 1] === '\n')) {
      if (char === '\r') i++;
      endRow();
    } else {
      field += char;
    }
  }
  if (quoted) throw new CatalogError(['CSV has an unterminated quoted field']);
  if (field !== '' || row.length > 0) endRow();
  return rows;
}

/** A photo cell is `<file> | image: <url> | page: <url>`; only `<file>` is kept. */
export function photoFileName(cell: string): string {
  return cell.split('|')[0].trim();
}

/** Photo files per bottle folder from a crop report, in report order; `flagged` and unknown statuses are dropped. */
export function parseCropReport(text: string): Map<string, string[]> {
  const [header = [], ...rows] = parseCsv(text);
  const missingColumns = CROP_REPORT_COLUMNS.filter((c) => !header.includes(c));
  if (missingColumns.length > 0) {
    throw new CatalogError([`Crop report is missing columns: ${missingColumns.join(', ')}`]);
  }
  const cell = (cells: string[], column: string) => (cells[header.indexOf(column)] ?? '').trim();
  const photos = new Map<string, string[]>();
  for (const cells of rows) {
    if (!KEPT_CROP_STATUSES.has(cell(cells, 'status'))) continue;
    const folder = cell(cells, 'bottle');
    const files = cell(cells, 'output_files')
      .split(';')
      .map((file) => file.trim())
      .filter(Boolean);
    photos.set(folder, [...(photos.get(folder) ?? []), ...files]);
  }
  return photos;
}

/** A plain file name, or `<subfolder>/<file>` when `allowSubfolder`; never absolute or `..`. */
function isUsableFileName(name: string, allowSubfolder: boolean): boolean {
  const parts = name.split('/');
  if (parts.length > (allowSubfolder ? 2 : 1)) return false;
  return parts.every((part) => part !== '' && part !== '.' && part !== '..' && !part.includes('\\'));
}

export function resolveSourceDir(cliArg?: string, envDir?: string): string {
  const sourceDir = cliArg?.trim() || envDir?.trim();
  if (!sourceDir) {
    throw new CatalogError([
      'No source folder. Run `npm run catalog -- <source-folder>` or set WHISKEY_PHOTOS_DIR.',
    ]);
  }
  return sourceDir;
}

export function joinPath(dir: string, name: string): string {
  return `${dir.replace(/\/+$/, '')}/${name}`;
}

/** Returns the CSV path inside `sourceDir`, failing if the folder or CSV is missing. */
export function sourceCsvPath(sourceDir: string, exists: PathExists): string {
  if (!exists(sourceDir)) {
    throw new CatalogError([`Source folder not found: ${sourceDir}`]);
  }
  const csvPath = joinPath(sourceDir, CSV_FILE_NAME);
  if (!exists(csvPath)) throw new CatalogError([`CSV not found: ${csvPath}`]);
  return csvPath;
}

/**
 * Plans the whole catalog and checks every named folder and photo; throws one error listing every problem.
 * With `cropPhotos` (from `parseCropReport`), each folder's photos come from the report instead of photo1..photo4.
 */
export function planCatalog(
  csvText: string,
  sourceDir: string,
  exists: PathExists,
  cropPhotos?: Map<string, string[]>,
): CatalogPlan {
  const [header = [], ...rows] = parseCsv(csvText);
  const missingColumns = REQUIRED_COLUMNS.filter((c) => !header.includes(c));
  if (missingColumns.length > 0) {
    throw new CatalogError([`CSV is missing columns: ${missingColumns.join(', ')}`]);
  }

  const problems: string[] = [];
  const seenIds = new Set<string>();
  const whiskeys: CatalogWhiskey[] = [];
  const photos: PhotoCopy[] = [];

  rows.forEach((cells, index) => {
    const line = index + 2;
    const cell = (column: string) => cells[header.indexOf(column)] ?? '';
    const id = cell('#').trim();
    const label = id ? `Whiskey ${id}` : `CSV line ${line}`;

    if (cells.length !== header.length) {
      problems.push(`${label}: has ${cells.length} fields, expected ${header.length}`);
      return;
    }
    if (!id) {
      problems.push(`${label}: missing #`);
      return;
    }
    const folder = joinPath(sourceDir, cell('folder'));
    if (seenIds.has(id)) {
      problems.push(`${label}: duplicate id: ${folder}`);
      return;
    }
    seenIds.add(id);

    if (!cell('folder') || !exists(folder)) {
      problems.push(`${label}: folder not found: ${folder}`);
      return;
    }

    const entries = cropPhotos
      ? (cropPhotos.get(cell('folder')) ?? []).map((fileName) => ({ source: 'crop report entry', fileName }))
      : PHOTO_COLUMNS.map((column) => ({ source: column, fileName: photoFileName(cell(column)) }));
    if (entries.length === 0) {
      problems.push(`${label}: no photos in the crop report: ${folder}`);
      return;
    }

    const targets: string[] = [];
    for (const { source: entry, fileName } of entries) {
      if (!isUsableFileName(fileName, Boolean(cropPhotos))) {
        problems.push(`${label}: ${entry} has no usable file name: ${folder}`);
        continue;
      }
      const source = joinPath(folder, fileName);
      if (!exists(source)) {
        problems.push(`${label}: photo not found: ${source}`);
        continue;
      }
      const target = `photos/${id}/${fileName}`;
      targets.push(target);
      photos.push({ id, source, target });
    }

    whiskeys.push({
      id,
      name: cell('name'),
      producer: cell('producer'),
      expression: cell('expression'),
      age: cell('age'),
      category: cell('style'),
      note: cell('note'),
      image: targets[0] ?? '',
      photos: targets,
    });
  });

  if (problems.length > 0) throw new CatalogError(problems);
  return { catalog: { whiskeys }, photos };
}

const isStartOfFrame = (marker: number) =>
  marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);

/** Reads width and height from a JPEG's start-of-frame header. */
export function jpegSize(bytes: Uint8Array): ImageSize {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error('not a JPEG');
  let offset = 2;
  while (offset + 3 < bytes.length) {
    if (bytes[offset] !== 0xff) break;
    const marker = bytes[offset + 1];
    if (marker === 0xff) {
      offset += 1;
      continue;
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
      offset += 2;
      continue;
    }
    if (marker === 0xda || marker === 0xd9) break;
    if (isStartOfFrame(marker) && offset + 8 < bytes.length) {
      return {
        height: (bytes[offset + 5] << 8) | bytes[offset + 6],
        width: (bytes[offset + 7] << 8) | bytes[offset + 8],
      };
    }
    offset += 2 + ((bytes[offset + 2] << 8) | bytes[offset + 3]);
  }
  throw new Error('JPEG size not found');
}

/** Source of `assets/catalog/image-map.js`; Metro only bundles images named in a literal `require`. */
export function imageRequireMap(targets: string[]): string {
  const entries = targets.map(
    (target) => `  ${JSON.stringify(target)}: require(${JSON.stringify(`./${target}`)}),\n`,
  );
  return `module.exports = {\n${entries.join('')}};\n`;
}

/** True when the long edge is above `MAX_LONG_EDGE`; smaller JPEGs are copied byte for byte. */
export function needsShrink({ width, height }: ImageSize): boolean {
  return Math.max(width, height) > MAX_LONG_EDGE;
}
