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

The visual page content is retained as an Atelier **background layer**. The
result opens as a drawing with a blank foreground layer, so you can add new
pen strokes, layers, and other Atelier edits. The source notebook's existing
strokes cannot remain individually editable: SPD stores raster image tiles,
not Supernote notebook stroke data. Handwriting recognition, links, and
notebook page structure are also not retained.

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

For the closest device-specific output, use any small drawing you created and
can open on your own Manta as a template:

```sh
node dist/src/cli.js "/path/to/notebook.note" "/path/to/output-folder" \
  --template "/path/to/working-manta-drawing.spd"
```

By default the converted page is kept on the background layer. To put its ink
on Atelier's normal drawing layer (so pixel erasing and drawing happen on the
same layer), add `--layer drawing`. This still cannot restore the individual
notebook stroke events.

## Development checks

```sh
npm test
```

The test creates an SPD, verifies its SQLite signature and metadata, then reads
it back through an independent Atelier SPD reader supplied by the Supernote
format library.

## Compatibility and status

The writer follows a Manta device-created drawing: its three `surface_*` tables,
greyscale PNG tile encoding, background-layer placement, virtual-canvas
coordinates, JPEG thumbnail, and metadata. Ratta has not published an official
writer specification, so keep the original note and test a converted drawing on
your device before relying on it for important work.

## License

GPL-3.0-or-later. This is required because the converter uses the GPL-licensed
[`supernote-typescript`](https://github.com/philips/supernote-typescript)
parser and renderer.
