
## Phyllis: characters (cinematic/world3d/characters/)
- `student.glb`: rigged human avatar from three.js examples `readyplayer.me.glb` (Ready Player Me sample avatar, shipped in https://github.com/mrdoob/three.js/tree/dev/examples/models/gltf). Textures downscaled; hat/hair hidden, own hair cap and wardrobe tints added in `Characters.js`. Check Ready Player Me terms before a public launch.
- `clips.json`: idle / walk / agree / headShake rotation tracks extracted from three.js example `Xbot.glb` (Mixamo animation data, via three.js examples; Mixamo terms: free for commercial use inside an app, not for redistribution as a standalone animation pack). Retargeted at load time.
- Vendored loaders (MIT, three.js r160): `vendor/addons/loaders/GLTFLoader.js`, `vendor/addons/utils/{BufferGeometryUtils,SkeletonUtils}.js`.
- (Phyllis) Characters.js reads `characters/manifest.json` {"model": "student.glb"}; to use a new rigged Mixamo-skeleton avatar, drop the .glb in `world3d/characters/` and set "model" (or open with `?avatar=file.glb`). `mixamorig`-prefixed bone names are handled.

## Jim: receptionist (cinematic/world3d/characters/receptionist.glb, 1.1 MB)
- Source: `avatars/brunette-t.glb` from https://github.com/met4citizen/TalkingHead (raw.githubusercontent.com/met4citizen/TalkingHead/main/avatars/brunette-t.glb). Ready Player Me avatar, T-pose, 67 ARKit/Oculus morph targets (blink, visemes, brows, smile). Repo is MIT; the avatar itself is **CC BY-NC 4.0 (non-commercial)** per that repo's README. Get a commercial licence or replace before a commercial launch.
- Processed with gltf-transform (textures to 1024 WebP, mesh quantization, sparse morph targets): 2.9 MB to 1.1 MB. Outfit recoloured navy/charcoal, glasses hidden at load.
- Animation: idle/nod clips from `characters/clips.json` (Mixamo-style data via three.js `Xbot.glb`), retargeted at load (`ReceptionistGLB.js`). Head/eye follow, blink, lip-flap and wave are driven in code.
- Rejected after viewing in a test scene: `Michelle.glb` (cartoon, crop top), three.js `readyplayer.me.glb` (male costume avatar), `avaturn.glb` / `avatarsdk.glb` (non-commercial; AvatarSDK one is a male avatar), `vroid.glb` (anime), `mpfb.glb` (CC0 MakeHuman woman, realistic but plain tee/jeans, 35 MB, MakeHuman bone names so the shared clips do not retarget).

## Stanley (Opus): golden-hour campus exterior + render pipeline (2026-10-08)
- three.js r186 (MIT), vendored in `cinematic/vendor/` (`three.module.js`, `three.core.js`, `three.webgpu.js`, addons: GLTFLoader, KTX2Loader + Basis transcoder, Reflector, BufferGeometryUtils, SkeletonUtils, meshopt decoder). Licence: `vendor/LICENSE-three.txt`. Replaces r160.
- pmndrs/postprocessing 6.39.5 (zlib licence) `vendor/postprocessing.js`; N8AO 2.0.1 by N8python (CC0) `vendor/N8AO.js` (imports rewritten to relative paths). Licences in `vendor/LICENSE-*.txt`.
- Textures (CC0, Poly Haven, https://polyhaven.com/license): `concrete_layers_02` by Rob Tuytel (board-formed retaining walls), `concrete_pavers_02` by Amal Kumar (terrace paving). 1k sources resized and encoded to KTX2 (ETC1S colour/roughness, UASTC normals, zstd) in `world3d/textures/`, about 740 KB total.
- Sky, clouds, terrain, trees, pool water and the building are procedural (no external assets).

## Jim: receptionist v2 (characters/receptionist.glb, 2.2 MB) replaces the Ready Player Me brunette
- Source: `avatars/avaturn.glb` from https://github.com/met4citizen/TalkingHead (raw.githubusercontent.com/met4citizen/TalkingHead/main/avatars/avaturn.glb). Created at Avaturn (avaturn.me), photo-based realistic adult woman in a black blazer with white blouse and trousers. **Non-commercial use only** per that repo's README; Avaturn's own terms say commercial use needs notifying the company plus extra terms. Needs a commercial arrangement before a paid launch.
- Processed with gltf-transform (textures to 768 px WebP, mesh quantization, sparse morphs, 21 of 72 morph targets kept; removed tongue, eye ambient-occlusion mesh and shoes): 13.8 MB to 2.2 MB (about 0.2 MB over the 2 MB target).
- Same Mixamo-style bone names as before, so `clips.json` retargets unchanged (eye-bone tracks are skipped on purpose). The previous brunette file is kept only in Jim's work folder.

## Jim: user supplied receptionist replacement (characters/girl12_op/)
- Source: `girl12_op.zip` supplied from the user's Downloads. It is a Reallusion Character Creator 3 Plus FBX export with 40 linked texture maps and facial morphs. The archive included no license or readme, so redistribution terms are unknown.
- FBX diffuse maps were recompressed to JPEG (2K for color, 1K for normals/opacity), yielding a 16 MiB model-and-texture set. The existing Mixamo-style idle/agreement clips are retargeted onto the CC3 skeleton; gaze, blink, lip, expression and greeting behavior use the CC3 eye bones and face morphs.
- `FBXLoader.js`, `NURBSCurve.js`, `NURBSUtils.js`, and `fflate.module.js` are vendored from three.js r186 under the existing `vendor/LICENSE-three.txt` license.
