// One GLTFLoader for everyone, wired for compressed assets: KTX2 (Basis) textures + meshopt geometry. Owner: Stanley (Opus).
// Usage: const gltf = await gltfLoader(renderer).loadAsync(url). Compress a model with:
//   npx @gltf-transform/cli optimize in.glb out.glb --compress meshopt --texture-compress ktx2
import { GLTFLoader } from '../vendor/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from '../vendor/addons/libs/meshopt_decoder.module.js';
import { ktx2Loader } from './pbr.js';

let loader = null;
export function gltfLoader(renderer) {
  if (!loader) loader = new GLTFLoader().setKTX2Loader(ktx2Loader(renderer)).setMeshoptDecoder(MeshoptDecoder);
  return loader;
}
