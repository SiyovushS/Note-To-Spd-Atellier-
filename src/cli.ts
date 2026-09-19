#!/usr/bin/env node
import path from 'node:path';
import { convertNoteToSpd } from './converter.js';

function usage(): string {
  return `Usage: supernote-note-to-spd <notebook.note> [output-directory]\n\nConverts every notebook page into a separate, flattened Atelier .spd drawing.`;
}

const [input, outputDirectory] = process.argv.slice(2);
if (!input || input === '--help' || input === '-h') {
  console.log(usage());
  process.exit(input ? 0 : 1);
}

try {
  const result = await convertNoteToSpd(input, outputDirectory ?? path.dirname(path.resolve(input)));
  console.log(`Converted ${result.pageCount} page${result.pageCount === 1 ? '' : 's'}:`);
  result.outputs.forEach((file) => console.log(`  ${file}`));
} catch (error) {
  console.error(`Conversion failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
