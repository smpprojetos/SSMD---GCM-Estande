import * as THREE from 'three';
import { mergeGeometries } from './vendor/BufferGeometryUtils.js';

// Batch static surfaces by material and attribute layout without simplifying faces.
// Movable door parts stay outside these groups. Transparent surfaces keep their sorting.
export function batchStatic(root) {
  root.updateWorldMatrix(true, true);
  const inverse = root.matrixWorld.clone().invert(), buckets = new Map();
  let before = 0, after = 0;
  root.traverse(o => {
    if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || Array.isArray(o.material)) return;
    before++;
    if (o.material.transparent || o.geometry.morphAttributes.position) { after++; return; }
    const layout = Object.keys(o.geometry.attributes).sort().map(k => `${k}:${o.geometry.attributes[k].itemSize}:${o.geometry.attributes[k].normalized}`).join('|');
    const key = `${o.material.uuid}:${layout}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(o);
  });
  for (const meshes of buckets.values()) {
    if (meshes.length < 2) { after++; continue; }
    const geometry = meshes.map(mesh => {
      const g = mesh.geometry.clone();
      const matrix = inverse.clone().multiply(mesh.matrixWorld);
      if (!g.index) g.setIndex(Array.from({length:g.attributes.position.count}, (_,i)=>i));
      if (matrix.determinant() < 0) {
        const a = g.index.array;
        for (let i=0;i<a.length;i+=3) [a[i+1],a[i+2]]=[a[i+2],a[i+1]];
      }
      g.applyMatrix4(matrix);return g;
    });
    const merged=mergeGeometries(geometry, false);
    geometry.forEach(g=>g.dispose());
    if (!merged) { after+=meshes.length;continue; }
    const mesh=new THREE.Mesh(merged,meshes[0].material);
    mesh.castShadow=meshes.some(o=>o.castShadow);mesh.receiveShadow=true;
    mesh.name='StaticBatch';merged.computeBoundingBox();merged.computeBoundingSphere();
    meshes.forEach(o=>o.removeFromParent());root.add(mesh);after++;
  }
  function prune(node) {
    for (const child of [...node.children]) {
      prune(child);
      if (!child.isMesh && !child.isLight && !child.isCamera && !child.children.length) child.removeFromParent();
    }
  }
  prune(root);
  root.traverse(o=>{o.updateMatrix();o.matrixAutoUpdate=false;});
  return {before,after};
}
