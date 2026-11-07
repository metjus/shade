// 3MF export.
//  flavor 'standard': 3MF core with basematerials + per-object and per-triangle colors
//                     (Bambu Studio 2.x / OrcaSlicer / PrusaSlicer read the colors).
//  flavor 'bambu'   : the same geometry, marked as a Bambu Studio project, with
//                     Metadata/model_settings.config assigning filament slot N to color part N.
//  layout 'assembled': one object made of parts (multi-material printer, AMS).
//  layout 'separate' : each part a separate object laid out on the bed (print one color at a time).
import { zip, zipDeflate } from './zip.js';

const NS = 'http://schemas.microsoft.com/3dmanufacturing/core/2015/02';
const BED = { center: [128, 128], width: 240 };

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const num = (v) => {
  const r = Math.round(v * 10000) / 10000;
  return Object.is(r, -0) ? '0' : String(r);
};
const hex = (c) => (c.length === 7 ? c.toUpperCase() + 'FF' : c.toUpperCase());

function bboxOf(mesh) {
  const p = mesh.positions;
  const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (let i = 0; i < p.length; i += 3) {
    for (let c = 0; c < 3; c++) {
      if (p[i + c] < b[c]) b[c] = p[i + c];
      if (p[i + c] > b[c + 3]) b[c + 3] = p[i + c];
    }
  }
  return b;
}

// Returns a per-part translation that puts the model (or each part) on the bed.
export function layoutParts(parts, layout, bed = BED) {
  const boxes = parts.map((p) => bboxOf(p.mesh));
  if (layout !== 'separate') {
    const b = boxes.reduce((a, q) => [Math.min(a[0], q[0]), Math.min(a[1], q[1]), Math.min(a[2], q[2]), Math.max(a[3], q[3]), Math.max(a[4], q[4]), Math.max(a[5], q[5])]);
    const t = [bed.center[0] - (b[0] + b[3]) / 2, bed.center[1] - (b[1] + b[4]) / 2, -b[2]];
    return parts.map(() => t);
  }
  // simple shelf packing, then center the whole arrangement
  const gap = 6;
  const order = parts.map((_, i) => i).sort((a, b) => (boxes[b][4] - boxes[b][1]) - (boxes[a][4] - boxes[a][1]));
  const pos = new Array(parts.length);
  let x = 0, y = 0, rowH = 0, maxX = 0;
  for (const i of order) {
    const w = boxes[i][3] - boxes[i][0], d = boxes[i][4] - boxes[i][1];
    if (x > 0 && x + w > bed.width) { x = 0; y += rowH + gap; rowH = 0; }
    pos[i] = [x, y];
    x += w + gap; rowH = Math.max(rowH, d); maxX = Math.max(maxX, x - gap);
  }
  const totalY = y + rowH;
  return parts.map((_, i) => [
    bed.center[0] - maxX / 2 + pos[i][0] - boxes[i][0],
    bed.center[1] - totalY / 2 + pos[i][1] - boxes[i][1],
    -boxes[i][2],
  ]);
}

function meshXml(out, mesh, t, colorIndex) {
  const p = mesh.positions, ix = mesh.indices;
  out.push('<mesh><vertices>');
  for (let i = 0; i < p.length; i += 3) {
    out.push(`<vertex x="${num(p[i] + t[0])}" y="${num(p[i + 1] + t[1])}" z="${num(p[i + 2] + t[2])}"/>`);
  }
  out.push('</vertices><triangles>');
  const tail = colorIndex == null ? '/>' : ` pid="1" p1="${colorIndex}"/>`;
  for (let i = 0; i < ix.length; i += 3) out.push(`<triangle v1="${ix[i]}" v2="${ix[i + 1]}" v3="${ix[i + 2]}"${tail}`);
  out.push('</triangles></mesh>');
}

/**
 * parts: [{ name, color: '#rrggbb', mesh: { positions, indices } }]
 * options: { title, flavor: 'standard'|'bambu', layout: 'assembled'|'separate' }
 * Returns Uint8Array of the .3mf file.
 */
export function export3MF(parts, opts = {}) {
  return zip(files3MF(parts, opts));
}

// Compressed variant for the browser (much smaller files).
export function export3MFCompressed(parts, opts = {}) {
  return zipDeflate(files3MF(parts, opts));
}

function files3MF(parts, { title = 'Model', flavor = 'standard', layout = 'assembled' } = {}) {
  const bambu = flavor === 'bambu';
  const shifts = layoutParts(parts, layout);
  const out = [];
  out.push('<?xml version="1.0" encoding="UTF-8"?>\n');
  out.push(`<model unit="millimeter" xml:lang="en-US" xmlns="${NS}"${bambu ? ' xmlns:BambuStudio="http://schemas.bambulab.com/package/2021"' : ''}>\n`);
  out.push(`<metadata name="Title">${esc(title)}</metadata>\n`);
  out.push('<metadata name="Designer">shade.sk generátor</metadata>\n');
  out.push(`<metadata name="CreationDate">${new Date().toISOString().slice(0, 10)}</metadata>\n`);
  if (bambu) {
    out.push('<metadata name="Application">BambuStudio-02.00.00.00</metadata>\n');
    out.push('<metadata name="BambuStudio:3mfVersion">1</metadata>\n');
  } else {
    out.push('<metadata name="Application">shade.sk print generator</metadata>\n');
  }
  out.push('<resources>\n<basematerials id="1">');
  for (const part of parts) out.push(`<base name="${esc(part.name)}" displaycolor="${hex(part.color)}"/>`);
  out.push('</basematerials>\n');

  // mesh objects get ids 2..n+1
  parts.forEach((part, i) => {
    out.push(`<object id="${i + 2}" type="model" name="${esc(part.name)}" pid="1" pindex="${i}">`);
    meshXml(out, part.mesh, shifts[i], i);
    out.push('</object>\n');
  });

  const items = [];
  let config = null;
  if (layout === 'separate') {
    parts.forEach((_, i) => items.push(i + 2));
    if (bambu) {
      config = ['<?xml version="1.0" encoding="UTF-8"?>\n<config>\n'];
      parts.forEach((part, i) => {
        config.push(`  <object id="${i + 2}">\n    <metadata key="name" value="${esc(part.name)}"/>\n    <metadata key="extruder" value="${i + 1}"/>\n`);
        config.push(`    <part id="${i + 2}" subtype="normal_part">\n      <metadata key="name" value="${esc(part.name)}"/>\n      <metadata key="matrix" value="1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 1"/>\n    </part>\n  </object>\n`);
      });
    }
  } else {
    const asm = parts.length + 2;
    out.push(`<object id="${asm}" type="model" name="${esc(title)}"><components>`);
    parts.forEach((_, i) => out.push(`<component objectid="${i + 2}"/>`));
    out.push('</components></object>\n');
    items.push(asm);
    if (bambu) {
      config = ['<?xml version="1.0" encoding="UTF-8"?>\n<config>\n'];
      config.push(`  <object id="${asm}">\n    <metadata key="name" value="${esc(title)}"/>\n    <metadata key="extruder" value="1"/>\n`);
      parts.forEach((part, i) => {
        config.push(`    <part id="${i + 2}" subtype="normal_part">\n      <metadata key="name" value="${esc(part.name)}"/>\n      <metadata key="matrix" value="1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 1"/>\n      <metadata key="extruder" value="${i + 1}"/>\n    </part>\n`);
      });
      config.push('  </object>\n');
    }
  }
  out.push('</resources>\n<build>');
  for (const id of items) out.push(`<item objectid="${id}" printable="1"/>`);
  out.push('</build>\n</model>\n');

  const files = [
    {
      name: '[Content_Types].xml',
      data: '<?xml version="1.0" encoding="UTF-8"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/><Default Extension="config" ContentType="text/xml"/></Types>',
    },
    {
      name: '_rels/.rels',
      data: '<?xml version="1.0" encoding="UTF-8"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>',
    },
    { name: '3D/3dmodel.model', data: out.join('') },
  ];
  if (config) {
    config.push('  <plate>\n    <metadata key="plater_id" value="1"/>\n    <metadata key="plater_name" value=""/>\n    <metadata key="locked" value="false"/>\n');
    items.forEach((id) => config.push(`    <model_instance>\n      <metadata key="object_id" value="${id}"/>\n      <metadata key="instance_id" value="0"/>\n    </model_instance>\n`));
    config.push('  </plate>\n</config>\n');
    files.push({ name: 'Metadata/model_settings.config', data: config.join('') });
  }
  return files;
}
