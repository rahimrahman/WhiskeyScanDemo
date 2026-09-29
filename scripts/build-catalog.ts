import { existsSync, promises as fs } from 'fs';
import path from 'path';
import sharp from 'sharp';

import {
  MAX_LONG_EDGE,
  imageRequireMap,
  jpegSize,
  needsShrink,
  planCatalog,
  resolveSourceDir,
  sourceCsvPath,
  type PhotoCopy,
} from '../src/lib/catalog/catalog';

const appRoot = path.resolve(__dirname, '..');
const assetsDir = path.join(appRoot, 'assets');
const catalogDir = path.join(assetsDir, 'catalog');

async function writePhoto(photo: PhotoCopy, buildDir: string) {
  const target = path.join(buildDir, photo.target);
  try {
    await fs.mkdir(path.dirname(target), { recursive: true });
    const bytes = await fs.readFile(photo.source);
    if (needsShrink(jpegSize(bytes))) {
      await sharp(bytes)
        .rotate()
        .resize({ width: MAX_LONG_EDGE, height: MAX_LONG_EDGE, fit: 'inside' })
        .jpeg()
        .toFile(target);
    } else {
      await fs.writeFile(target, bytes);
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Whiskey ${photo.id}: could not process ${photo.source}: ${reason}`);
  }
}

/** Swaps the finished build in; the previous catalog is restored if the swap fails. */
async function replaceCatalog(buildDir: string) {
  const previousDir = `${buildDir}-previous`;
  const hadCatalog = existsSync(catalogDir);
  if (hadCatalog) await fs.rename(catalogDir, previousDir);
  try {
    await fs.rename(buildDir, catalogDir);
  } catch (error) {
    if (hadCatalog) await fs.rename(previousDir, catalogDir);
    throw error;
  }
  if (hadCatalog) await fs.rm(previousDir, { recursive: true, force: true });
}

async function main() {
  const sourceDir = path.resolve(
    resolveSourceDir(process.argv[2], process.env.WHISKEY_PHOTOS_DIR),
  );
  const csvPath = sourceCsvPath(sourceDir, existsSync);
  const plan = planCatalog(await fs.readFile(csvPath, 'utf8'), sourceDir, existsSync);

  // Same filesystem as assets/catalog so the final rename is atomic.
  const buildDir = await fs.mkdtemp(path.join(assetsDir, '.catalog-build-'));
  try {
    for (const photo of plan.photos) await writePhoto(photo, buildDir);
    await fs.writeFile(
      path.join(buildDir, 'catalog.json'),
      `${JSON.stringify(plan.catalog, null, 2)}\n`,
    );
    await fs.writeFile(
      path.join(buildDir, 'image-map.js'),
      imageRequireMap(plan.photos.map((photo) => photo.target)),
    );
    await replaceCatalog(buildDir);
  } finally {
    await fs.rm(buildDir, { recursive: true, force: true });
  }

  console.log(
    `Wrote ${plan.catalog.whiskeys.length} whiskeys and ${plan.photos.length} photos to ${path.relative(appRoot, catalogDir)}/`,
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
