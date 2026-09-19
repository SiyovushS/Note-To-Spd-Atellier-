# Supernote Note → SPD

Convert a Supernote Manta/Nomad `.note` notebook into Supernote Atelier `.spd`
drawing files, directly on your computer.

## What this does

`.note` and Atelier `.spd` are fundamentally different formats. A notebook is a
multi-page, editable Supernote document; an SPD is a SQLite database containing
tiled PNG artwork. This program renders each notebook page and writes it as one
Atelier drawing:

```text
meeting-notes.note  →  meeting-notes-page-1.spd
                       meeting-notes-page-2.spd
                       …
```

The visual page content is retained, but the SPD result is flattened: it will
not retain editable pen strokes, handwriting-recognition data, links, layers,
or notebook page structure. Import/open the resulting `.spd` files in Atelier
on the Supernote.

## Install and run

Requires Node.js 20 or later.

```sh
git clone https://github.com/SiyovushS/Note-To-Spd-Atellier-.git
cd Note-To-Spd-Atellier-
npm install
npm run build
node dist/src/cli.js "/path/to/notebook.note" "/path/to/output-folder"
```

Or run without cloning after installing dependencies:

```sh
npx supernote-note-to-spd "/path/to/notebook.note" "/path/to/output-folder"
```

If the output folder is omitted, converted drawings are placed next to the
source notebook.

## Development checks

```sh
npm test
```

The test creates an SPD, verifies its SQLite signature and metadata, then reads
it back through an independent Atelier SPD reader supplied by the Supernote
format library.

## Compatibility and status

The writer follows the community-reverse-engineered Atelier schema (`config`,
`surface_1`, PNG tiles, and the usual virtual-canvas tile coordinates). Ratta
has not published an official writer specification, so keep the original note
file and test a converted drawing on your device before relying on it for
important work. The project intentionally writes simple, one-layer drawings to
maximize compatibility.

## License

GPL-3.0-or-later. This is required because the converter uses the GPL-licensed
[`supernote-typescript`](https://github.com/philips/supernote-typescript)
parser and renderer.
