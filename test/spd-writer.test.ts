import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { Image, ImageColorModel } from 'image-js';
import { SupernoteAtelier } from 'supernote-typescript';
import { writeSpd } from '../src/converter.js';

test('writes a SQLite Atelier file with readable tile and canvas metadata', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'note-to-spd-'));
  const output = path.join(directory, 'drawing.spd');
  try {
    const pixels = new Uint8Array(129 * 70 * 4);
    pixels.fill(255);
    // A black pixel crossing the first tile boundary catches wrong tiling.
    const offset = (5 * 129 + 128) * 4;
    pixels.set([0, 0, 0, 255], offset);
    const image = new Image(129, 70, { colorModel: ImageColorModel.RGBA, data: pixels });
    await writeSpd(image, output);

    const bytes = await readFile(output);
    assert.equal(bytes.subarray(0, 15).toString(), 'SQLite format 3');
    assert.equal(bytes[15], 0);
    const spd = await SupernoteAtelier.open(bytes);
    assert.deepEqual(spd.canvasSize, { width: 129, height: 70 });
    assert.equal(spd.fmtVer, 2);
    assert.equal(spd.surfaces.surface_1.length, 0);
    assert.equal(spd.surfaces.surface_2.length, 3);
    const firstTile = spd.surfaces.surface_2[0].bitmapBuffer;
    assert.equal(firstTile[25], 4, 'tiles must use Manta-style greyscale+alpha PNG encoding');
    const reconstructed = await spd.toImage('surface_2');
    assert.ok(reconstructed);
    assert.equal(reconstructed.getPixel(192, 5)[0], 0);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
