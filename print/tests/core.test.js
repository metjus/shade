import { PRESETS, makeScene, defaultParams } from '../js/core/presets.js';
import { buildModel } from '../js/core/model.js';

let fail = 0;
const modes = process.argv[2] ? [process.argv[2]] : ['single', 'ams', 'split'];
for (const preset of PRESETS) {
  for (const mode of modes) {
    const scene = makeScene(preset, defaultParams(preset));
    const res = buildModel(scene, { mode, voxel: 0.7 });
    const bad = res.parts.filter((p) => p.openEdges || p.badEdges || p.volume <= 0);
    const line = res.parts.map((p) => `${p.name}:${(p.volume / 1000).toFixed(1)}cm3/${p.islands}isl${p.openEdges || p.badEdges ? ` OPEN${p.openEdges}/BAD${p.badEdges}` : ''}`).join(' ');
    console.log(`${preset.id.padEnd(12)} ${mode.padEnd(6)} ${res.stats.sampleMs + res.stats.meshMs}ms pins=${res.pins.length} | ${line}`);
    if (bad.length) fail++;
    for (const p of res.parts) if (p.bbox[2] < -1e-3) { console.log('  below bed', p.name, p.bbox[2]); fail++; }
  }
}
console.log(fail ? `FAILED ${fail}` : 'OK');
process.exit(fail ? 1 : 0);
