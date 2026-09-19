#!/usr/bin/env node
import path from 'node:path';
import { convertNoteToSpd } from './converter.js';

function usage(): string {
  return `Usage: supernote-note-to-spd <notebook.note> [output-directory] [--template working-drawing.spd]\n\nConverts every notebook page into a separate, flattened but drawable Atelier .spd drawing.`;
}

const args = process.argv.slice(2);
const input = args[0];
const outputDirectory = args[1]?.startsWith('--') ? undefined : args[1];
const templateFlag = args.indexOf('--template');
const templatePath = templateFlag === -1 ? undefined : args[templateFlag + 1];
if (!input || input === '--help' || input === '-h') {
  console.log(usage());
  process.exit(input ? 0 : 1);
}
if (templateFlag !== -1 && !templatePath) {
  console.error('Conversion failed: --template needs the path to a working .spd file.');
  process.exit(1);
}

try {
  const result = await convertNoteToSpd(input, outputDirectory ?? path.dirname(path.resolve(input)), templatePath);
  console.log(`Converted ${result.pageCount} page${result.pageCount === 1 ? '' : 's'}:`);
  result.outputs.forEach((file) => console.log(`  ${file}`));
} catch (error) {
  console.error(`Conversion failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
