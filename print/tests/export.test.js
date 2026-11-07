import { writeFileSync, mkdirSync } from 'node:fs';
import { PRESETS, makeScene, defaultParams } from '../js/core/presets.js';
import { buildModel } from '../js/core/model.js';
import { export3MF } from '../js/export/threemf.js';
import { exportOBJ } from '../js/export/obj.js';
const dir = process.argv[2] || 'out';
mkdirSync(dir, { recursive: true });
const preset = PRESETS.find((p) => p.id === 'bird');
for (const mode of ['ams', 'split']) {
  const res = buildModel(makeScene(preset, defaultParams(preset)), { mode, voxel: 0.8 });
  const layout = mode === 'split' ? 'separate' : 'assembled';
  for (const flavor of ['standard', 'bambu']) writeFileSync(`${dir}/bird-${mode}-${flavor}.3mf`, export3MF(res.parts, { title: 'Vtáčik', flavor, layout }));
  const { obj, mtl } = exportOBJ(res.parts, { title: 'Vtáčik', layout });
  writeFileSync(`${dir}/bird-${mode}.obj`, obj); writeFileSync(`${dir}/model.mtl`, mtl);
}
console.log('written', dir);
import { export3MFCompressed } from '../js/export/threemf.js';
{
  const res = buildModel(makeScene(preset, defaultParams(preset)), { mode: 'ams', voxel: 0.8 });
  writeFileSync(`${dir}/bird-ams-deflate.3mf`, await export3MFCompressed(res.parts, { title: 'Vtáčik', flavor: 'bambu' }));
}
