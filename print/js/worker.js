// Web Worker: runs the heavy geometry generation off the UI thread.
import { presetById, makeScene } from './core/presets.js';
import { buildModel } from './core/model.js';

self.onmessage = (e) => {
  const { id, presetId, params, options } = e.data;
  try {
    const preset = presetById(presetId);
    const scene = makeScene(preset, params);
    const res = buildModel(scene, options);
    const transfer = [];
    const parts = res.parts.map((p) => {
      transfer.push(p.mesh.positions.buffer, p.mesh.indices.buffer);
      return { index: p.index, name: p.name, positions: p.mesh.positions, indices: p.mesh.indices, volume: p.volume, bbox: p.bbox, islands: p.islands, openEdges: p.openEdges, badEdges: p.badEdges, triangles: p.triangles };
    });
    self.postMessage({ id, ok: true, parts, pins: res.pins, voxel: res.voxel, stats: res.stats }, transfer);
  } catch (err) {
    self.postMessage({ id, ok: false, error: String(err && err.stack || err) });
  }
};
