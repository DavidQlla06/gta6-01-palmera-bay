// Palmera Bay — procedural coastal city.
// Builds the ground, road grid, buildings, beach, sea, marina, palms and
// streetlights from a seeded RNG. Returns the collision boxes and the list
// of road centre-lines the traffic and police use.

import * as THREE from 'three';
import { CFG, PALETTE, mulberry32, pick } from './config.js';

function box(w, h, d, color, x, y, z, parent) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({ color }),
  );
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

/** A simple palm tree: trunk cylinder plus a ring of flat leaf boxes. */
function palm(x, z, scale, parent, rng) {
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22 * scale, 0.34 * scale, 5.4 * scale, 6),
    new THREE.MeshLambertMaterial({ color: PALETTE.palmTrunk }),
  );
  trunk.position.y = 2.7 * scale;
  trunk.rotation.z = (rng() - 0.5) * 0.16;
  group.add(trunk);
  for (let i = 0; i < 6; i++) {
    const leaf = new THREE.Mesh(
      new THREE.BoxGeometry(3.4 * scale, 0.08, 0.9 * scale),
      new THREE.MeshLambertMaterial({ color: PALETTE.palmLeaf }),
    );
    const a = (i / 6) * Math.PI * 2;
    leaf.position.set(Math.cos(a) * 1.4 * scale, 5.5 * scale, Math.sin(a) * 1.4 * scale);
    leaf.rotation.y = -a;
    leaf.rotation.z = 0.45;
    group.add(leaf);
  }
  group.position.set(x, 0, z);
  parent.add(group);
  return group;
}

export function buildWorld(g) {
  const rng = mulberry32(g.seed);
  const scene = g.scene;
  const colliders = [];
  const roadLines = [];

  // Sky, sun and a soft ambient lift so shaded faces stay readable.
  scene.background = new THREE.Color(PALETTE.sky);
  scene.fog = new THREE.Fog(PALETTE.sky, 260, 620);
  const sun = new THREE.DirectionalLight(0xffe6b0, 2.4);
  sun.position.set(120, 180, -80);
  scene.add(sun);
  scene.add(new THREE.AmbientLight(0xbfd8e8, 0.85));
  const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x8a7a5f, 0.5);
  scene.add(hemi);

  // Base ground: grass everywhere, then asphalt roads and sand on top.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(760, 760),
    new THREE.MeshLambertMaterial({ color: PALETTE.grass }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.05, 40);
  scene.add(ground);

  // Road strips (both directions) with centre dashes.
  const roads = [];
  for (let c = -CFG.cityHalf; c <= CFG.cityHalf; c += CFG.roadSpacing) {
    roads.push({ axis: 'x', at: c });
    roads.push({ axis: 'z', at: c });
  }
  for (const r of roads) {
    const len = CFG.cityHalf * 2 + 40;
    const strip = new THREE.Mesh(
      new THREE.PlaneGeometry(r.axis === 'x' ? len : CFG.roadHalf * 2, r.axis === 'x' ? CFG.roadHalf * 2 : len),
      new THREE.MeshLambertMaterial({ color: PALETTE.asphalt }),
    );
    strip.rotation.x = -Math.PI / 2;
    strip.position.set(r.axis === 'x' ? 0 : r.at, 0, r.axis === 'x' ? r.at : 0);
    scene.add(strip);
    roadLines.push(r);
    // Dashed centre line.
    const dashCount = Math.floor(len / 12);
    for (let i = 0; i < dashCount; i++) {
      const d = -len / 2 + 6 + i * 12;
      // Dash long side runs along the road: 3 m along X for x-roads,
      // 3 m along Z for z-roads.
      const dash = new THREE.Mesh(
        r.axis === 'x' ? new THREE.PlaneGeometry(3, 0.5) : new THREE.PlaneGeometry(0.5, 3),
        new THREE.MeshBasicMaterial({ color: 0xf5e9a0 }),
      );
      dash.rotation.x = -Math.PI / 2;
      if (r.axis === 'x') dash.position.set(d, 0.02, r.at);
      else dash.position.set(r.at, 0.02, d);
      scene.add(dash);
    }
  }

  // Buildings: one or two boxes per block, taller near the centre
  // (downtown), low and pastel near the beach.
  const half = CFG.blockSize / 2;
  for (let bx = -CFG.cityHalf + CFG.roadSpacing / 2; bx <= CFG.cityHalf - CFG.roadSpacing / 2; bx += CFG.roadSpacing) {
    for (let bz = -CFG.cityHalf + CFG.roadSpacing / 2; bz <= CFG.cityHalf - CFG.roadSpacing / 2; bz += CFG.roadSpacing) {
      if (bz > CFG.beachZ - 60) continue; // keep the beachfront open
      const distCentre = Math.hypot(bx, bz);
      const downtown = distCentre < 110;
      const count = downtown && rng() < 0.55 ? 2 : 1;
      for (let k = 0; k < count; k++) {
        const w = 16 + rng() * 26;
        const d = 16 + rng() * 26;
        const h = downtown ? 18 + rng() * 46 : 7 + rng() * 12;
        const ox = count === 2 ? (k === 0 ? -half / 2 : half / 2) : 0;
        const oz = count === 2 ? (k === 0 ? -half / 2 : half / 2) : 0;
        const x = bx + ox * 0.7 + (rng() - 0.5) * 8;
        const z = bz + oz * 0.7 + (rng() - 0.5) * 8;
        const colour = pick(rng, PALETTE.building);
        const mesh = box(w, h, d, colour, x, h / 2, z, scene);
        // Flat roof cap in a contrasting tone.
        box(w + 0.6, 0.7, d + 0.6, pick(rng, PALETTE.roof), x, h + 0.35, z, scene);
        // Lit windows: a slightly emissive front face strip.
        const win = new THREE.Mesh(
          new THREE.PlaneGeometry(w * 0.7, h * 0.55),
          new THREE.MeshLambertMaterial({ color: 0x2c3e50, emissive: 0xffe9a8, emissiveIntensity: 0.25 }),
        );
        win.position.set(x, h * 0.55, z + d / 2 + 0.06);
        scene.add(win);
        void mesh;
        colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
      }
      // Sidewalk slab for the block.
      const walk = new THREE.Mesh(
        new THREE.PlaneGeometry(CFG.blockSize, CFG.blockSize),
        new THREE.MeshLambertMaterial({ color: PALETTE.sidewalk }),
      );
      walk.rotation.x = -Math.PI / 2;
      walk.position.set(bx, 0.01, bz);
      scene.add(walk);
    }
  }

  // Beach sand and the sea.
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(760, 90),
    new THREE.MeshLambertMaterial({ color: PALETTE.sand }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.02, CFG.beachZ + 24);
  scene.add(sand);
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(760, 160),
    new THREE.MeshLambertMaterial({ color: PALETTE.sea }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, 0.0, CFG.seaZ + 70);
  scene.add(sea);

  // Marina: wooden docks and moored boats on the east edge.
  const dockMat = new THREE.MeshLambertMaterial({ color: 0x7a5a38 });
  for (let i = 0; i < 3; i++) {
    const dock = new THREE.Mesh(new THREE.BoxGeometry(6, 1, 42), dockMat);
    dock.position.set(226, 0.5, -120 + i * 60);
    scene.add(dock);
    colliders.push({ minX: 223, maxX: 229, minZ: -141 + i * 60, maxZ: -99 + i * 60 });
    // A little white boat beside each dock.
    const hull = new THREE.Mesh(
      new THREE.BoxGeometry(4, 1.6, 12),
      new THREE.MeshLambertMaterial({ color: 0xf0f0ea }),
    );
    hull.position.set(234, 0.8, -120 + i * 60);
    scene.add(hull);
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(3, 1.6, 5),
      new THREE.MeshLambertMaterial({ color: 0x2e6f9e }),
    );
    cabin.position.set(234, 2.2, -120 + i * 60);
    scene.add(cabin);
  }

  // Palms along the beachfront and a few on the avenues.
  for (let x = -220; x <= 220; x += 22) {
    palm(x + (rng() - 0.5) * 6, CFG.beachZ + 6 + rng() * 14, 0.9 + rng() * 0.5, scene, rng);
  }
  for (let i = 0; i < 26; i++) {
    const road = pick(rng, roadLines);
    const along = (rng() - 0.5) * (CFG.cityHalf * 2);
    const off = (rng() < 0.5 ? -1 : 1) * (CFG.roadHalf + 4);
    if (road.axis === 'x') palm(along, road.at + off, 0.8 + rng() * 0.4, scene, rng);
    else palm(road.at + off, along, 0.8 + rng() * 0.4, scene, rng);
  }

  // Streetlights at intersections.
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x2b2f36 });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  for (let x = -160; x <= 160; x += 80) {
    for (let z = -160; z <= 160; z += 80) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 7, 6), poleMat);
      pole.position.set(x + 9, 3.5, z + 9);
      scene.add(pole);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), lampMat);
      lamp.position.set(x + 9, 7.1, z + 9);
      scene.add(lamp);
    }
  }

  // A big "PALMERA BAY" sign arch over the main avenue, facing the start.
  const signCanvas = document.createElement('canvas');
  signCanvas.width = 512;
  signCanvas.height = 96;
  const sctx = signCanvas.getContext('2d');
  sctx.fillStyle = '#123a5c';
  sctx.fillRect(0, 0, 512, 96);
  sctx.fillStyle = '#ffd76a';
  sctx.font = 'bold 52px sans-serif';
  sctx.textAlign = 'center';
  sctx.textBaseline = 'middle';
  sctx.fillText('PALMERA BAY', 256, 52);
  const signTex = new THREE.CanvasTexture(signCanvas);
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(34, 6.4),
    new THREE.MeshBasicMaterial({ map: signTex }),
  );
  sign.position.set(0, 12, -168);
  scene.add(sign);
  box(1.2, 12, 1.2, 0x2b2f36, -17, 6, -168, scene);
  box(1.2, 12, 1.2, 0x2b2f36, 17, 6, -168, scene);

  g.colliders = colliders;
  g.roadLines = roadLines;
  return { colliders, roadLines };
}

/** Circle-vs-AABB push-out. Returns true when a collision happened. */
export function resolveCollision(pos, radius, colliders) {
  let hit = false;
  for (const c of colliders) {
    const nx = Math.max(c.minX, Math.min(pos.x, c.maxX));
    const nz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
    const dx = pos.x - nx;
    const dz = pos.z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      hit = true;
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        pos.x = nx + (dx / d) * radius;
        pos.z = nz + (dz / d) * radius;
      } else {
        // Centre inside the box: push out along the smallest penetration.
        const pl = pos.x - c.minX;
        const pr = c.maxX - pos.x;
        const pt = pos.z - c.minZ;
        const pb = c.maxZ - pos.z;
        const m = Math.min(pl, pr, pt, pb);
        if (m === pl) pos.x = c.minX - radius;
        else if (m === pr) pos.x = c.maxX + radius;
        else if (m === pt) pos.z = c.minZ - radius;
        else pos.z = c.maxZ + radius;
      }
    }
  }
  return hit;
}

/** True when the point is on a road (within the asphalt half-width). */
export function onRoad(x, z) {
  for (let c = -CFG.cityHalf; c <= CFG.cityHalf; c += CFG.roadSpacing) {
    if (Math.abs(x - c) <= CFG.roadHalf || Math.abs(z - c) <= CFG.roadHalf) return true;
  }
  return false;
}
