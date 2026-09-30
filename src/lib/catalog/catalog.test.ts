import { readFileSync } from 'fs';
import { join } from 'path';

import {
  CatalogError,
  imageRequireMap,
  jpegSize,
  needsShrink,
  parseCropReport,
  parseCsv,
  photoFileName,
  planCatalog,
  resolveSourceDir,
  sourceCsvPath,
} from './catalog';

const SOURCE = '/photos';
const HEADER =
  '#,name,producer,expression,age,style,note,folder,distinct_photos,short_of_3,photo1,photo2,photo3,photo4';
const PHOTOS = [
  '1-front.jpg',
  '2-back.jpg',
  '3-label-closeup.jpg',
  '4-lifestyle-with-glass.jpg',
];
const photoCell = (file: string) =>
  `${file} | image: https://img.example.com/${file} | page: https://shop.example.com/p/1`;

type Row = { id: string; name: string; expression?: string; note?: string; folder: string };

const csvRow = ({ id, name, expression = 'Straight', note = 'Easy', folder }: Row) =>
  [id, name, 'Producer', expression, 'NAS', 'Bourbon', note, folder, '4', 'no', ...PHOTOS.map(photoCell)].join(',');

const lagavulin: Row = {
  id: '9',
  name: 'Lagavulin 16 Year Old',
  note: '"Peat smoke, iodine, dried fruit."',
  folder: '09 - Scotch – Islay - Lagavulin 16 Year Old',
};
const makersMark: Row = {
  id: '3',
  name: "Maker's Mark",
  folder: "03 - Bourbon - Maker's Mark",
};
const nikka: Row = {
  id: '33',
  name: 'Nikka Whisky From the Barrel',
  expression: '"From the Barrel (blend, 51.4%)"',
  note: '"Compact 51.4% blend; big flavour, great value."',
  folder: '33 - Japanese - Nikka Whisky From the Barrel',
};

const toCsv = (rows: Row[]) => [HEADER, ...rows.map(csvRow)].join('\r\n') + '\r\n';

const allPaths = (rows: Row[]) =>
  new Set([
    SOURCE,
    ...rows.flatMap((row) => [
      `${SOURCE}/${row.folder}`,
      ...PHOTOS.map((file) => `${SOURCE}/${row.folder}/${file}`),
    ]),
  ]);

const existsIn = (paths: Set<string>) => (path: string) => paths.has(path);

const planError = (run: () => unknown): CatalogError => {
  try {
    run();
  } catch (error) {
    if (error instanceof CatalogError) return error;
    throw error;
  }
  throw new Error('expected a CatalogError');
};

/** A DHT segment whose bytes would read as 0x1111 × 0x1111 if mistaken for a frame header. */
const HUFFMAN_TABLE = [0xff, 0xc4, 0x00, 0x09, 0x00, 0x11, 0x11, 0x11, 0x11, 0x00, 0x00];

/** Minimal JPEG: SOI, an APP0 segment, optional extra segments, then a frame header with the given size. */
const jpegBytes = (width: number, height: number, frameMarker = 0xc0, before: number[] = []) =>
  Uint8Array.from([
    0xff, 0xd8,
    0xff, 0xe0, 0x00, 0x06, 0x4a, 0x46, 0x49, 0x46,
    ...before,
    0xff, frameMarker, 0x00, 0x0b, 0x08, height >> 8, height & 0xff, width >> 8, width & 0xff, 0x01, 0x01, 0x11, 0x00,
    0xff, 0xd9,
  ]);

describe('parseCsv', () => {
  it('keeps quoted commas whole and splits CRLF rows', () => {
    expect(parseCsv('a,b,c\r\n1,"x, y","From the Barrel (blend, 51.4%)"\r\n')).toEqual([
      ['a', 'b', 'c'],
      ['1', 'x, y', 'From the Barrel (blend, 51.4%)'],
    ]);
  });

  it('unescapes doubled quotes, accepts LF rows and a missing final newline', () => {
    expect(parseCsv('\uFEFFa,b\n"say ""hi""",\n2,z')).toEqual([
      ['a', 'b'],
      ['say "hi"', ''],
      ['2', 'z'],
    ]);
  });

  it('fails on an unterminated quote', () => {
    expect(() => parseCsv('a,"b\r\n')).toThrow(CatalogError);
  });
});

describe('photoFileName', () => {
  it('keeps only the file and drops the image and page URLs', () => {
    expect(photoFileName(photoCell('1-front.jpg'))).toBe('1-front.jpg');
    expect(photoFileName('2-back.jpg')).toBe('2-back.jpg');
  });
});

describe('parseCropReport', () => {
  it('keeps cropped, partial and split outputs per folder and drops flagged rows', () => {
    const report = [
      'bottle,source_file,output_files,status,box,note',
      'A,1-front.jpg,1-front.jpg,cropped,"[1, 2, 3, 4]",',
      'A,3-closeup.jpg,partial/3-closeup.jpg,partial,full,label close-up',
      'A,4-lifestyle.jpg,flagged/4-lifestyle.jpg,flagged,,"ambiguous, blurred"',
      'B,2-pair.jpg,2-pair_a.jpg;2-pair_b.jpg,split,"[1];[2]",two bottles',
    ].join('\n');

    expect(parseCropReport(report)).toEqual(
      new Map([
        ['A', ['1-front.jpg', 'partial/3-closeup.jpg']],
        ['B', ['2-pair_a.jpg', '2-pair_b.jpg']],
      ]),
    );
  });

  it('names missing columns', () => {
    expect(() => parseCropReport('bottle,status\nA,cropped\n')).toThrow(
      'Crop report is missing columns: output_files',
    );
  });
});

describe('resolveSourceDir', () => {
  it('prefers the CLI folder over WHISKEY_PHOTOS_DIR', () => {
    expect(resolveSourceDir('/cli', '/env')).toBe('/cli');
    expect(resolveSourceDir(undefined, '/env')).toBe('/env');
  });

  it('explains how to pass the folder when neither is set', () => {
    expect(() => resolveSourceDir(undefined, ' ')).toThrow(
      /npm run catalog -- <source-folder>.*WHISKEY_PHOTOS_DIR/,
    );
  });
});

describe('sourceCsvPath', () => {
  it('returns the CSV path inside the source folder', () => {
    const exists = existsIn(new Set([SOURCE, `${SOURCE}/whiskey_bottles.csv`]));
    expect(sourceCsvPath(SOURCE, exists)).toBe('/photos/whiskey_bottles.csv');
  });

  it('names a missing source folder or CSV', () => {
    expect(() => sourceCsvPath(SOURCE, existsIn(new Set()))).toThrow(
      'Source folder not found: /photos',
    );
    expect(() => sourceCsvPath(SOURCE, existsIn(new Set([SOURCE])))).toThrow(
      'CSV not found: /photos/whiskey_bottles.csv',
    );
  });
});

describe('planCatalog', () => {
  const rows = [lagavulin, makersMark, nikka];

  it('copies text verbatim and maps photos under photos/<id>/', () => {
    const { catalog, photos } = planCatalog(toCsv(rows), SOURCE, existsIn(allPaths(rows)));

    expect(catalog.whiskeys.map((w) => w.id)).toEqual(['9', '3', '33']);
    expect(catalog.whiskeys[2]).toEqual({
      id: '33',
      name: 'Nikka Whisky From the Barrel',
      producer: 'Producer',
      expression: 'From the Barrel (blend, 51.4%)',
      age: 'NAS',
      category: 'Bourbon',
      note: 'Compact 51.4% blend; big flavour, great value.',
      image: 'photos/33/1-front.jpg',
      photos: PHOTOS.map((file) => `photos/33/${file}`),
    });
    expect(catalog.whiskeys[0].note).toBe('Peat smoke, iodine, dried fruit.');
    expect(catalog.whiskeys[1].name).toBe("Maker's Mark");
    expect(photos).toHaveLength(12);
    expect(photos[0]).toEqual({
      id: '9',
      source: '/photos/09 - Scotch – Islay - Lagavulin 16 Year Old/1-front.jpg',
      target: 'photos/9/1-front.jpg',
    });
    expect(photos[4].source).toBe("/photos/03 - Bourbon - Maker's Mark/1-front.jpg");
    expect(JSON.stringify(catalog)).not.toContain('https://');
  });

  it('uses the folder string exactly as written', () => {
    const paths = allPaths(rows);
    paths.delete(`${SOURCE}/${lagavulin.folder}`);
    paths.add(`${SOURCE}/09 - Scotch - Islay - Lagavulin 16 Year Old`);

    expect(planError(() => planCatalog(toCsv(rows), SOURCE, existsIn(paths))).problems).toEqual([
      'Whiskey 9: folder not found: /photos/09 - Scotch – Islay - Lagavulin 16 Year Old',
    ]);
  });

  it('names the id and path of every missing photo', () => {
    const paths = allPaths(rows);
    paths.delete(`${SOURCE}/${makersMark.folder}/2-back.jpg`);
    paths.delete(`${SOURCE}/${nikka.folder}/4-lifestyle-with-glass.jpg`);

    expect(planError(() => planCatalog(toCsv(rows), SOURCE, existsIn(paths))).problems).toEqual([
      "Whiskey 3: photo not found: /photos/03 - Bourbon - Maker's Mark/2-back.jpg",
      'Whiskey 33: photo not found: /photos/33 - Japanese - Nikka Whisky From the Barrel/4-lifestyle-with-glass.jpg',
    ]);
  });

  it('fails on a duplicate id', () => {
    const dupes = [lagavulin, { ...makersMark, id: '9' }];

    expect(planError(() => planCatalog(toCsv(dupes), SOURCE, existsIn(allPaths(dupes)))).problems).toEqual([
      "Whiskey 9: duplicate id: /photos/03 - Bourbon - Maker's Mark",
    ]);
  });

  it('fails on missing columns, broken rows, a blank id or a blank photo cell', () => {
    expect(() => planCatalog('#,name\r\n1,A\r\n', SOURCE, () => true)).toThrow(
      /CSV is missing columns: producer/,
    );

    const csv = [
      HEADER,
      '7,Short row',
      csvRow({ ...makersMark, id: '' }),
      csvRow(makersMark).replace(photoCell('3-label-closeup.jpg'), ''),
    ].join('\r\n');
    expect(planError(() => planCatalog(csv, SOURCE, () => true)).problems).toEqual([
      'Whiskey 7: has 2 fields, expected 14',
      'CSV line 3: missing #',
      "Whiskey 3: photo3 has no usable file name: /photos/03 - Bourbon - Maker's Mark",
    ]);
  });

  it('takes photos from the crop report, including partial/ and split files', () => {
    const cropPhotos = new Map([
      [lagavulin.folder, ['1-front.jpg', 'partial/3-label-closeup.jpg']],
      [makersMark.folder, ['1-front_a.jpg', '1-front_b.jpg']],
    ]);
    const paths = new Set([
      SOURCE,
      ...[lagavulin, makersMark].map((row) => `${SOURCE}/${row.folder}`),
      `${SOURCE}/${lagavulin.folder}/1-front.jpg`,
      `${SOURCE}/${lagavulin.folder}/partial/3-label-closeup.jpg`,
      `${SOURCE}/${makersMark.folder}/1-front_a.jpg`,
      `${SOURCE}/${makersMark.folder}/1-front_b.jpg`,
    ]);

    const { catalog, photos } = planCatalog(toCsv([lagavulin, makersMark]), SOURCE, existsIn(paths), cropPhotos);

    expect(catalog.whiskeys[0]).toMatchObject({
      image: 'photos/9/1-front.jpg',
      photos: ['photos/9/1-front.jpg', 'photos/9/partial/3-label-closeup.jpg'],
    });
    expect(catalog.whiskeys[1].photos).toEqual(['photos/3/1-front_a.jpg', 'photos/3/1-front_b.jpg']);
    expect(photos[1]).toEqual({
      id: '9',
      source: '/photos/09 - Scotch – Islay - Lagavulin 16 Year Old/partial/3-label-closeup.jpg',
      target: 'photos/9/partial/3-label-closeup.jpg',
    });
  });

  it('fails when the crop report has no photos for a whiskey or names an unsafe path', () => {
    const cropPhotos = new Map([[lagavulin.folder, ['../escape.jpg', 'a/b/c.jpg']]]);

    expect(
      planError(() =>
        planCatalog(toCsv([lagavulin, makersMark]), SOURCE, existsIn(allPaths(rows)), cropPhotos),
      ).problems,
    ).toEqual([
      'Whiskey 9: crop report entry has no usable file name: /photos/09 - Scotch – Islay - Lagavulin 16 Year Old',
      'Whiskey 9: crop report entry has no usable file name: /photos/09 - Scotch – Islay - Lagavulin 16 Year Old',
      "Whiskey 3: no photos in the crop report: /photos/03 - Bourbon - Maker's Mark",
    ]);
  });

  it('plans the committed data/whiskey_bottles.csv', () => {
    const csv = readFileSync(join(__dirname, '../../../data/whiskey_bottles.csv'), 'utf8');
    const { catalog, photos } = planCatalog(csv, SOURCE, () => true);
    const sources = photos.map((photo) => photo.source);

    expect(catalog.whiskeys).toHaveLength(50);
    expect(catalog.whiskeys.find((w) => w.id === '33')?.expression).toBe(
      'From the Barrel (blend, 51.4%)',
    );
    expect(sources).toContain('/photos/09 - Scotch – Islay - Lagavulin 16 Year Old/1-front.jpg');
    expect(sources).toContain("/photos/03 - Bourbon - Maker's Mark/1-front.jpg");
  });
});

describe('jpegSize and needsShrink', () => {
  it('reads the size from the start-of-frame header', () => {
    expect(jpegSize(jpegBytes(300, 600))).toEqual({ width: 300, height: 600 });
    expect(jpegSize(jpegBytes(2400, 1600))).toEqual({ width: 2400, height: 1600 });
  });

  it('skips a Huffman table before the frame and reads progressive frames', () => {
    expect(jpegSize(jpegBytes(2400, 1600, 0xc0, HUFFMAN_TABLE))).toEqual({ width: 2400, height: 1600 });
    expect(jpegSize(jpegBytes(300, 600, 0xc2))).toEqual({ width: 300, height: 600 });
  });

  it('byte-copies a long edge of 1024 or less and shrinks anything larger', () => {
    expect(needsShrink(jpegSize(jpegBytes(300, 600)))).toBe(false);
    expect(needsShrink({ width: 768, height: 1024 })).toBe(false);
    expect(needsShrink({ width: 1025, height: 700 })).toBe(true);
    expect(needsShrink(jpegSize(jpegBytes(1600, 2400)))).toBe(true);
  });

  it('rejects non-JPEG bytes and JPEGs without a frame header', () => {
    expect(() => jpegSize(Uint8Array.from([0x89, 0x50, 0x4e, 0x47]))).toThrow('not a JPEG');
    expect(() => jpegSize(Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]))).toThrow('JPEG size not found');
  });
});

describe('imageRequireMap', () => {
  it('keys a literal require by each photo target, relative to assets/catalog', () => {
    expect(imageRequireMap(['photos/1/1-front.jpg', 'photos/1/2-back.jpg'])).toBe(
      [
        'module.exports = {',
        '  "photos/1/1-front.jpg": require("./photos/1/1-front.jpg"),',
        '  "photos/1/2-back.jpg": require("./photos/1/2-back.jpg"),',
        '};',
        '',
      ].join('\n'),
    );
  });

  it('escapes quotes in file names and writes an empty map for no photos', () => {
    expect(imageRequireMap(['photos/3/"odd".jpg'])).toContain(
      '"photos/3/\\"odd\\".jpg": require("./photos/3/\\"odd\\".jpg")',
    );
    expect(imageRequireMap([])).toBe('module.exports = {\n};\n');
  });
});
