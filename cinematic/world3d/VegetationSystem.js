// Zone-aware vegetation assembly. Geometry is cached by TreeLibrary and all repeated trees use InstancedMesh.
// Four static depth bands are tailored to the existing fixed central camera route, so detail falls off without LOD popping.
import * as THREE from 'three';
import { treeGeometry, shrubGeometry } from './TreeLibrary.js';

const MATRIX = new THREE.Matrix4(), QUAT = new THREE.Quaternion(), SCALE = new THREE.Vector3(), POS = new THREE.Vector3(), EULER = new THREE.Euler();
// Stylised "anime open-world" look: saturated yellow-greens, flat colour bands instead of soft realistic shading, a lighter canopy top, a warm rim.
const palette = [0x74b83a, 0x8ac94a, 0x62a834, 0x9fd352, 0x56a03e];
const barkPalette = [0x8a6244, 0x9c7350, 0x74513a];
const grassPalette = [0xa7dc55, 0x8fcf45, 0xb9e45f, 0x7cc43f];
const rand = seed => { let x = seed >>> 0; return () => (((x = Math.imul(x ^ x >>> 15, 1 | x)) ^ (x + Math.imul(x ^ x >>> 7, 61 | x))) >>> 0) / 4294967296; };

// Toon-style patch for MeshStandardMaterial. Keeps the scene's lights, fog and tone mapping, but snaps the lighting into three soft bands
// (shadow / mid / lit), brightens and yellows the top of the crown, and adds a warm backlit rim.
//   sway: world units of wind motion (0 = none)   height: local y at which the crown gradient reaches the top   rim: rim strength (0 = off)
function stylised(base, { sway = 0, height = 7, gradient = 0, rim = 0, key }) {
  const m = new THREE.MeshStandardMaterial(base); const wind = { value: 0 };
  m.onBeforeCompile = shader => {
    shader.uniforms.uFschoolWindTime = wind;
    shader.vertexShader = `uniform float uFschoolWindTime;\nvarying float vFsH;\n${shader.vertexShader}`.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
       vFsH = clamp(position.y / ${height.toFixed(2)}, 0.0, 1.0);
       ${sway ? `#ifdef USE_INSTANCING
         float fsPhase = instanceMatrix[3][0] * .17 + instanceMatrix[3][2] * .11;
         float fsW = smoothstep(0.0, 1.0, vFsH);
         transformed.x += sin(uFschoolWindTime * .9 + fsPhase + position.y * 1.4) * ${sway.toFixed(3)} * fsW;
         transformed.z += cos(uFschoolWindTime * .7 + fsPhase + position.y * 1.1) * ${(sway * .65).toFixed(3)} * fsW;
       #endif` : ''}`);
    shader.fragmentShader = `varying float vFsH;\n${shader.fragmentShader}`.replace(
      '#include <opaque_fragment>',
      `float fsL = dot(outgoingLight, vec3(.299, .587, .114));
       float fsA = max(dot(diffuseColor.rgb, vec3(.299, .587, .114)), .001);
       float fsS = fsL / fsA;
       float fsBand = .62 + .24 * smoothstep(.30, .38, fsS) + .24 * smoothstep(.78, .86, fsS);
       vec3 fsCol = diffuseColor.rgb;
       ${gradient ? `fsCol *= mix(vec3(.74, .86, .78), vec3(1.22, 1.2, .82), pow(vFsH, .8) * ${gradient.toFixed(2)});` : ''}
       outgoingLight = fsCol * fsBand + (outgoingLight - diffuseColor.rgb * fsS) * .35;
       ${rim ? `float fsR = pow(1.0 - clamp(dot(normalize(vNormal), normalize(vViewPosition)), 0.0, 1.0), 2.6);
       outgoingLight += vec3(.95, .88, .35) * fsR * ${rim.toFixed(2)} * smoothstep(.2, .9, fsS);` : ''}
       #include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => `fschool-stylised-${key}`;
  m.userData.wind = wind;
  return m;
}

const material = (color, vertexColors = true) => stylised({ color, vertexColors, roughness: 1, metalness: 0 }, { key: 'bark' });
const leafMaterial = () => stylised({ color: 0xffffff, vertexColors: true, roughness: 1, metalness: 0 }, { sway: .05, height: 7, gradient: 1, rim: .45, key: 'leaf' });

// Grass blade: three rows (root, middle, tip) so the blade can bend. Vertex colours run dark root -> bright yellow tip.
function bladeGeometry() {
  const pos = [-.045, 0, 0, .045, 0, 0, -.036, .22, 0, .036, .22, 0, 0, .46, .05];
  const col = [.42, .62, .26, .42, .62, .26, .78, .94, .42, .78, .94, .42, 1.0, 1.0, .55];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex([0, 1, 2, 1, 3, 2, 2, 3, 4]); g.computeVertexNormals();
  for (let i = 0; i < 5; i++) g.attributes.normal.setXYZ(i, 0, 1, 0);   // all blades shade like the ground: soft, even tops
  return g;
}

function grassField(clumps, random, count, groundY) {
  if (!clumps.length || !count) return null;
  const mat = stylised({ color: 0xffffff, vertexColors: true, roughness: 1, metalness: 0, side: THREE.DoubleSide }, { sway: .09, height: .46, gradient: .35, rim: .25, key: 'grass' });
  const items = [];
  for (let i = 0; i < count; i++) {
    const c = clumps[i % clumps.length], a = random() * Math.PI * 2, r = c.r * Math.sqrt(random());
    const x = c.x + Math.cos(a) * r, z = c.z + Math.sin(a) * r;
    items.push({ x, y: groundY(x, z), z, scale: 1.6 + random() * 1.8, rotation: random() * Math.PI * 2, tint: Math.floor(random() * grassPalette.length) });
  }
  const mesh = instances(bladeGeometry(), mat, items, { colors: grassPalette });
  mesh.frustumCulled = false; mesh.name = 'grass';
  return { mesh, mat };
}

function instances(geometry, material, items, { cast = false, colors = palette } = {}) {
  const mesh = new THREE.InstancedMesh(geometry, material, items.length);
  const color = new THREE.Color();
  for (let i = 0; i < items.length; i++) {
    const it = items[i]; EULER.set(0, it.rotation || 0, 0); QUAT.setFromEuler(EULER);
    POS.set(it.x, it.y, it.z); SCALE.setScalar(it.scale); MATRIX.compose(POS, QUAT, SCALE); mesh.setMatrixAt(i, MATRIX);
    mesh.setColorAt(i, color.setHex(colors[it.tint % colors.length]));
  }
  mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.castShadow = cast; mesh.receiveShadow = false; mesh.userData.keep = true; mesh.computeBoundingSphere();
  return mesh;
}

function addCluster(out, random, cx, cz, n, radius, kinds, groundY, minDistance = 0) {
  for (let i = 0; i < n; i++) {
    const a = random() * Math.PI * 2, r = radius * Math.sqrt(random());
    const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
    if (Math.abs(x) < minDistance) continue;
    out.push({ x, y: groundY(x, z), z, scale: .78 + random() * .55, rotation: random() * Math.PI * 2, tint: Math.floor(random() * palette.length), kind: kinds[Math.floor(random() * kinds.length)] });
  }
}

function bandData(quality, groundY) {
  const high = quality.tier === 'high', low = quality.tier === 'low';
  const scale = low ? .22 : high ? 1 : .72, random = rand(0x4e554a41);
  const foreground = [], campus = [], forest = [], distant = [], shrubs = [];
  // Zone 1: curated asymmetrical landscaping. The centre axis, pool and stairs stay completely clear.
  [[-48, -7, 'rain', 1.2], [47, -4, 'neem', 1.0], [-49, 31, 'ashoka', .95], [50, 37, 'rain', 1.05], [-45, 57, 'neem', .9], [46, 62, 'ashoka', .98], [-39, -27, 'rain', 1.18], [38, -30, 'neem', 1.1]]
    .slice(0, low ? 3 : Math.max(4, Math.round(8 * scale))).forEach(([x, z, kind, s], i) => foreground.push({ x, y: groundY(x, z), z, kind, scale: s, rotation: i * .73, tint: i % palette.length }));
  [[-35, 9], [35, 10], [-32, 31], [32, 32], [-29, 55], [29, 56], [-39, 46], [39, 49]].slice(0, low ? 2 : Math.round(8 * scale)).forEach(([x, z], i) => {
    for (let j = 0; j < 3; j++) shrubs.push({ x: x + (j - 1) * .72, y: groundY(x, z), z: z + (j % 2) * .48, scale: .85 + random() * .48, rotation: random() * 6.2, tint: (i + j) % palette.length });
  });
  // Zone 2: loose groups rather than a perimeter row.
  const campusClusters = [[-62, -24, 5, 16], [64, -18, 5, 18], [-60, 45, 5, 18], [64, 54, 6, 20], [-18, -47, 7, 24], [24, -53, 7, 25]];
  campusClusters.forEach(([x, z, n, r]) => addCluster(campus, random, x, z, Math.max(2, Math.round(n * scale)), r, ['rain', 'neem', 'ashoka'], groundY));
  // Zone 3: dense natural hills, seeded in clusters with open gaps around the hero building.
  const forestClusters = [[-120, -70, 22, 46], [-62, -94, 22, 38], [55, -93, 24, 42], [125, -62, 24, 48], [-132, 42, 18, 44], [130, 54, 20, 50], [-95, 104, 16, 42], [102, 112, 18, 46]];
  forestClusters.forEach(([x, z, n, r]) => addCluster(forest, random, x, z, Math.max(4, Math.round(n * scale)), r, ['dense', 'neem', 'ashoka'], groundY));
  // Zone 4: very distant low-cost silhouettes, deliberately condensed by haze and fog.
  const count = low ? 36 : Math.round((high ? 300 : 190) * .9);
  for (let i = 0; i < count; i++) {
    const back = i % 3 !== 0, x = (random() - .5) * (back ? 510 : 390), z = back ? -115 - random() * 180 : 92 + random() * 145;
    distant.push({ x, y: groundY(x, z), z, scale: 1.2 + random() * 1.9, rotation: random() * 6.2, tint: Math.floor(random() * 4), kind: 'dense' });
  }
  return { foreground, campus, forest, distant, shrubs };
}

export function createVegetationSystem({ quality, groundY, shadows }) {
  const group = new THREE.Group(); group.name = 'vegetation-system';
  const leaves = leafMaterial(), leavesDistant = stylised({ color: 0xffffff, vertexColors: true, roughness: 1, metalness: 0 }, { height: 5, gradient: .8, key: 'distant' }), bark = material(0xffffff), shrubMat = stylised({ color: 0xffffff, vertexColors: true, roughness: 1, metalness: 0 }, { sway: .03, height: 1.0, gradient: 1, rim: .35, key: 'shrub' });
  const allWind = [leaves, shrubMat];
  const bands = bandData(quality, groundY);
  const specs = [
    { items: bands.foreground, lod: 0, cast: !!shadows },
    { items: bands.campus, lod: 1, cast: false },
    { items: bands.forest, lod: 2, cast: false },
    { items: bands.distant, lod: 3, cast: false },
  ];
  for (const band of specs) {
    const byKind = new Map();
    // Low tier keeps the same zones but collapses each depth band to one shared model, preserving the 60-call scene budget.
    band.items.forEach(it => {
      const kind = quality.tier === 'low' ? (band.lod === 0 ? 'rain' : band.lod === 1 ? 'neem' : 'dense') : it.kind;
      const a = byKind.get(kind) || []; a.push(it); byKind.set(kind, a);
    });
    for (const [kind, items] of byKind) {
      const geo = treeGeometry(kind, band.lod), leafMat = band.lod === 3 ? leavesDistant : leaves;
      group.add(instances(geo.trunk, bark, items, { cast: band.cast, colors: barkPalette }), instances(geo.foliage, leafMat, items, { cast: band.cast }));
    }
  }
  group.add(instances(shrubGeometry(), shrubMat, bands.shrubs, { cast: false }));
  // Grass grows in lush clumps around the landscaped trees, shrubs and campus groves, never on the clear centre axis.
  const clumps = [...bands.foreground.map(t => ({ x: t.x, z: t.z, r: 5.5 })), ...bands.shrubs.filter((_, i) => i % 3 === 0).map(t => ({ x: t.x, z: t.z, r: 3.2 })), ...bands.campus.map(t => ({ x: t.x, z: t.z, r: 6 }))].filter(c => Math.abs(c.x) > 14);
  const grass = grassField(clumps, rand(0x67726173), quality.tier === 'low' ? 2200 : quality.tier === 'high' ? 22000 : 9000, groundY);
  if (grass) { group.add(grass.mesh); allWind.push(grass.mat); }
  return {
    group,
    update(time) { allWind.forEach(m => { m.userData.wind.value = time; }); },
    stats: Object.freeze({ foreground: bands.foreground.length, campus: bands.campus.length, forest: bands.forest.length, distant: bands.distant.length, shrubs: bands.shrubs.length }),
  };
}
