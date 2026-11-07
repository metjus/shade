// Wavefront OBJ export, Z up, millimetres. Each color part is its own object ("o") with a
// material name and per-vertex colors (v x y z r g b), which Blender and most viewers read.
// An accompanying .mtl text is returned too so material colors survive in tools that need it.
import { layoutParts } from './threemf.js';

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
const n = (v) => (Math.round(v * 10000) / 10000).toString();
const safe = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9_-]+/g, '_');

export function exportOBJ(parts, { title = 'model', layout = 'assembled', mtlName = 'model.mtl' } = {}) {
  const shifts = layoutParts(parts, layout, { center: [0, 0], width: 240 });
  const out = [`# ${title} — shade.sk print generator`, '# units: mm, Z up', `mtllib ${mtlName}`];
  const mtl = [`# ${title}`];
  let base = 1;
  parts.forEach((part, i) => {
    const [r, g, b] = rgb(part.color);
    const name = safe(part.name) || `part_${i + 1}`;
    const t = shifts[i];
    mtl.push(`newmtl ${name}`, `Kd ${n(r)} ${n(g)} ${n(b)}`, 'Ka 0 0 0', 'Ks 0.1 0.1 0.1', 'd 1', '');
    out.push(`o ${name}`, `usemtl ${name}`);
    const p = part.mesh.positions, ix = part.mesh.indices;
    const col = ` ${n(r)} ${n(g)} ${n(b)}`;
    const lines = [];
    for (let k = 0; k < p.length; k += 3) lines.push(`v ${n(p[k] + t[0])} ${n(p[k + 1] + t[1])} ${n(p[k + 2] + t[2])}${col}`);
    for (let k = 0; k < ix.length; k += 3) lines.push(`f ${ix[k] + base} ${ix[k + 1] + base} ${ix[k + 2] + base}`);
    out.push(lines.join('\n'));
    base += p.length / 3;
  });
  return { obj: out.join('\n') + '\n', mtl: mtl.join('\n') };
}
