import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Image, ImageColorModel, encodeJpeg, encodePng } from 'image-js';
import initSqlJs from 'sql.js';
import { SupernoteX, toImage } from 'supernote-typescript';

const TILE_SIZE = 128;
// Atelier places normal documents near the center of its large virtual canvas.
// These coordinates were reverse-engineered from device-created drawings.
const FIRST_TILE_COLUMN = 1945;
const FIRST_TILE_ROW = 1943;
const TILE_ID_STRIDE = 4096;
const HORIZONTAL_TILE_PADDING = 64;
const LAYER_LIST = Uint8Array.from([
  // The layer list observed in a drawing created on a Manta: a drawable
  // foreground layer (surface_1), a background layer (surface_2), and a
  // secondary empty layer (surface_0).
  0x0a, 0x0b, 0x08, 0x01, 0x12, 0x07, 0x6c, 0x61, 0x79, 0x65, 0x72, 0x20, 0x31,
  0x0a, 0x0e, 0x08, 0x02, 0x12, 0x0a, 0x62, 0x61, 0x63, 0x6b, 0x67, 0x72, 0x6f,
  0x75, 0x6e, 0x64, 0x0a, 0x0b, 0x08, 0x00, 0x12, 0x07, 0x4c, 0x61, 0x79, 0x65,
  0x72, 0x20, 0x30, 0x10, 0x03, 0x18, 0x01,
]);

export interface ConversionResult {
  input: string;
  outputs: string[];
  pageCount: number;
}

/**
 * Converts a Supernote notebook to one Atelier drawing per notebook page.
 * Atelier's SPD format stores PNG tiles, so this intentionally rasterizes the
 * source pages: pen strokes, handwriting recognition, links, and note pages
 * cannot remain editable in the resulting drawing.
 */
export async function convertNoteToSpd(
  inputPath: string,
  outputDirectory: string,
  templatePath?: string,
  targetLayer: 1 | 2 = 2,
): Promise<ConversionResult> {
  if (path.extname(inputPath).toLowerCase() !== '.note') {
    throw new Error(`Expected a .note file, received: ${inputPath}`);
  }

  const bytes = await readFile(inputPath);
  let note: SupernoteX;
  try {
    note = new SupernoteX(bytes);
  } catch (error) {
    throw new Error(`Could not parse Supernote notebook: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (note.pages.length === 0) throw new Error('The notebook has no pages to convert.');

  const pages = await toImage(note);
  await mkdir(outputDirectory, { recursive: true });
  const stem = path.basename(inputPath, path.extname(inputPath));
  const outputs: string[] = [];
  for (const [index, page] of pages.entries()) {
    const output = path.join(outputDirectory, `${stem}-page-${index + 1}.spd`);
    await writeSpd(page, output, templatePath, targetLayer);
    outputs.push(output);
  }
  return { input: inputPath, outputs, pageCount: pages.length };
}

/**
 * Write a flattened image as an Atelier drawing. The page is stored on the
 * Manta's background surface, leaving its normal foreground layer empty and
 * ready for new pen strokes in Atelier. Supplying a drawing made by the same
 * device as `templatePath` additionally preserves its exact SQLite details.
 */
export async function writeSpd(
  source: Image,
  outputPath: string,
  templatePath?: string,
  targetLayer: 1 | 2 = 2,
): Promise<void> {
  const canvas = flattenOntoWhite(source);
  const tileColumns = Math.ceil((canvas.width + 2 * HORIZONTAL_TILE_PADDING) / TILE_SIZE);
  const tileRows = Math.ceil(canvas.height / TILE_SIZE);
  const paddedHeight = Math.ceil(canvas.height / TILE_SIZE) * TILE_SIZE;
  const SQL = await initSqlJs();
  const db = templatePath ? new SQL.Database(await readFile(templatePath)) : new SQL.Database();
  try {
    ensureMantaSchema(db);
    db.run('DELETE FROM surface_0; DELETE FROM surface_1; DELETE FROM surface_2;');
    const config: Array<[string, Uint8Array]> = [
      ['fmt_ver', utf8('2')],
      ['ls', LAYER_LIST],
      ['thumbnail', createThumbnail(canvas)],
      ['vp.x', utf8('249984.000000')],
      ['vp.y', utf8('249984.000000')],
      ['vp.scale', utf8('1.000000')],
      ['surface.width', utf8(String(canvas.width))],
      ['surface.height', utf8(String(canvas.height))],
      ['ppi', utf8('72')],
      ['submit_count', utf8('1')],
    ];
    for (const [name, value] of config) db.run('INSERT OR REPLACE INTO config (name, value) VALUES (?, ?)', [name, value]);

    for (let row = 0; row < tileRows; row++) {
      for (let column = 0; column < tileColumns; column++) {
        const tile = extractTile(canvas, column, row);
        const tid = (FIRST_TILE_COLUMN + column) * TILE_ID_STRIDE + FIRST_TILE_ROW + row;
        // Device-generated drawings use GREYA (PNG color type 4) tiles on the
        // background surface. Keeping surface_1 empty makes the document
        // immediately drawable in Atelier.
        db.run(`INSERT INTO surface_${targetLayer} (tid, tile) VALUES (?, ?)`, [tid, encodePng(tile.convertColor(ImageColorModel.GREYA))]);
      }
    }
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, db.export());
  } finally {
    db.close();
  }
}

function flattenOntoWhite(source: Image): Image {
  const rgba = source.convertBitDepth(8).convertColor(ImageColorModel.RGBA);
  const raw = rgba.getRawImage();
  const data = new Uint8Array(raw.data.length);
  for (let i = 0; i < data.length; i += 4) {
    const alpha = raw.data[i + 3] / 255;
    data[i] = Math.round(raw.data[i] * alpha + 255 * (1 - alpha));
    data[i + 1] = Math.round(raw.data[i + 1] * alpha + 255 * (1 - alpha));
    data[i + 2] = Math.round(raw.data[i + 2] * alpha + 255 * (1 - alpha));
    data[i + 3] = 255;
  }
  return new Image(rgba.width, rgba.height, { colorModel: ImageColorModel.RGBA, data });
}

function extractTile(source: Image, column: number, row: number): Image {
  const sourceData = source.getRawImage().data;
  const data = new Uint8Array(TILE_SIZE * TILE_SIZE * 4);
  data.fill(255);
  for (let y = 0; y < TILE_SIZE; y++) {
    const sourceY = row * TILE_SIZE + y;
    if (sourceY >= source.height) continue;
    for (let x = 0; x < TILE_SIZE; x++) {
      const sourceX = column * TILE_SIZE + x - HORIZONTAL_TILE_PADDING;
      if (sourceX >= source.width) continue;
      const from = (sourceY * source.width + sourceX) * 4;
      const to = (y * TILE_SIZE + x) * 4;
      data.set(sourceData.subarray(from, from + 4), to);
    }
  }
  return new Image(TILE_SIZE, TILE_SIZE, { colorModel: ImageColorModel.RGBA, data });
}

function createThumbnail(source: Image): Uint8Array {
  return encodeJpeg(source.resize({ width: 600, height: 800, preserveAspectRatio: false }), { quality: 50 });
}

function ensureMantaSchema(db: { run(sql: string): void }): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS config(name TEXT PRIMARY KEY, value BLOB);
    CREATE TABLE IF NOT EXISTS surface_0(tid INTEGER PRIMARY KEY, tile BLOB);
    CREATE TABLE IF NOT EXISTS surface_1(tid INTEGER PRIMARY KEY, tile BLOB);
    CREATE TABLE IF NOT EXISTS surface_2(tid INTEGER PRIMARY KEY, tile BLOB);
  `);
}

function utf8(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}
