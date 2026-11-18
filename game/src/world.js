// Palmera Bay — the world: procedural coastal city.
// One job: build every static piece of the map (ground, roads, sidewalks,
// buildings, palms, streetlights, beach, ocean, marina, sky) and answer
// collision queries. No gameplay logic here.
import * as THREE from 'three';
import { CONFIG, makeRng, randRange, pick } from './config.js';

const PALETTE = {
  asphalt: 0x2e2e33,
  sidewalk: 0x9a938a,
  sand: 0xe8d29a,
  ocean: 0x1e6f8e,
  grass: 0x7fae62,
  building: [0xd9c9a8, 0xc4b49a, 0xb8a88e, 0xcfd6dd, 0xe0d3c0, 0xa8b8c4, 0xd8b48f, 0xbf9d7a],
  glass: [0x2a4a66, 0x35586e, 0x1f3a52, 0x4a6a7a],
  trunk: 0x7a5a38,
  frond: 0x3f8f4f,
};

/** Canvas texture with a lit-window grid, shared by every building. */
function makeWindowTexture(base, glass) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 128, 256);
  const rng = makeRng(base.length * 7919 + glass);
  for (let y = 12; y < 244; y += 22) {
    for (let x = 10; x < 118; x += 18) {
      const lit = rng() > 0.45;
      g.fillStyle = lit ? '#ffd98a' : glass;
      g.fillRect(x, y, 12, 14);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class World {
  constructor(scene) {
    this.scene = scene;
    this.colliders = [];   // {minX, maxX, minZ, maxZ} building footprints
    this.roadCentres = []; // x (and z) coordinates of road centrelines
    this.palms = [];
    this.ocean = null;
    this.build();
  }

  build() {
    const rng = makeRng(CONFIG.WORLD_SEED);
    const S = this.scene;
    const half = CONFIG.CITY_HALF;

    // --- Sky, sun, fog: warm late-afternoon light -------------------------
    const skyGeo = new THREE.SphereGeometry(900, 24, 12);
    const skyMat = new THREE.MeshBasicMaterial({ side: THREE.BackSide, vertexColors: true });
    const colors = [];
    const top = new THREE.Color(0x3d7ab8);
    const mid = new THREE.Color(0xf2a35e);
    const low = new THREE.Color(0xffd9a0);
    const pos = skyGeo.attributes.position;
    for (let i = 0; i < pos.count; i += 1) {
      const y = pos.getY(i) / 900;
      const c = y > 0.35 ? top.clone().lerp(mid, 1 - (y - 0.35) / 0.65) : mid.clone().lerp(low, 1 - (y + 0.1) / 0.45);
      colors.push(c.r, c.g, c.b);
    }
    skyGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const sky = new THREE.Mesh(skyGeo, skyMat);
    S.add(sky);

    const sun = new THREE.DirectionalLight(0xffc98a, 2.4);
    sun.position.set(-180, 140, 90);
    sun.castShadow = false;
    S.add(sun);
    S.add(new THREE.HemisphereLight(0xbfd9ff, 0x8a6f4d, 0.9));
    S.fog = new THREE.Fog(0xe8b98a, 220, 700);

    // --- Ground: grass base, sand strip, ocean ----------------------------
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(1100, 1100),
      new THREE.MeshLambertMaterial({ color: PALETTE.grass }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(120, -0.05, 0);
    S.add(ground);

    const sand = new THREE.Mesh(
      new THREE.PlaneGeometry(90, 560),
      new THREE.MeshLambertMaterial({ color: PALETTE.sand }),
    );
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(CONFIG.BEACH_X + 30, 0, 0);
    S.add(sand);

    this.ocean = new THREE.Mesh(
      new THREE.PlaneGeometry(500, 900),
      new THREE.MeshLambertMaterial({ color: PALETTE.ocean }),
    );
    this.ocean.rotation.x = -Math.PI / 2;
    this.ocean.position.set(CONFIG.OCEAN_X + 250, 0.15, 0);
    S.add(this.ocean);

    // Boardwalk along the beach
    const boardwalk = new THREE.Mesh(
      new THREE.BoxGeometry(6, 0.3, 420),
      new THREE.MeshLambertMaterial({ color: 0x8a6f4d }),
    );
    boardwalk.position.set(CONFIG.BEACH_X - 4, 0.15, 0);
    S.add(boardwalk);

    // --- Roads -------------------------------------------------------------
    const roadMat = new THREE.MeshLambertMaterial({ color: PALETTE.asphalt });
    const walkMat = new THREE.MeshLambertMaterial({ color: PALETTE.sidewalk });
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xd8d8c8 });
    for (let c = -3; c <= 3; c += 1) {
      const centre = c * CONFIG.ROAD_SPACING;
      this.roadCentres.push(centre);
      const roadNS = new THREE.Mesh(new THREE.PlaneGeometry(CONFIG.ROAD_WIDTH, half * 2 + 24), roadMat);
      roadNS.rotation.x = -Math.PI / 2;
      roadNS.position.set(centre, 0.02, 0);
      S.add(roadNS);
      const roadEW = new THREE.Mesh(new THREE.PlaneGeometry(half * 2 + 24, CONFIG.ROAD_WIDTH), roadMat);
      roadEW.rotation.x = -Math.PI / 2;
      roadEW.position.set(0, 0.02, centre);
      S.add(roadEW);
      // Centre dashes
      for (let d = -half; d < half; d += 14) {
        const dashNS = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 5), lineMat);
        dashNS.rotation.x = -Math.PI / 2;
        dashNS.position.set(centre, 0.04, d);
        S.add(dashNS);
        const dashEW = new THREE.Mesh(new THREE.PlaneGeometry(5, 0.5), lineMat);
        dashEW.rotation.x = -Math.PI / 2;
        dashEW.position.set(d, 0.04, centre);
        S.add(dashEW);
      }
      // Sidewalks flanking each road
      for (const off of [-8.5, 8.5]) {
        const walkNS = new THREE.Mesh(new THREE.PlaneGeometry(5, half * 2 + 24),
          new THREE.MeshLambertMaterial({ color: PALETTE.sidewalk }));
        walkNS.rotation.x = -Math.PI / 2;
        walkNS.position.set(centre + off, 0.03, 0);
        S.add(walkNS);
        const walkEW = new THREE.Mesh(new THREE.PlaneGeometry(half * 2 + 24, 5),
          new THREE.MeshLambertMaterial({ color: PALETTE.sidewalk }));
        walkEW.rotation.x = -Math.PI / 2;
        walkEW.position.set(0, 0.03, centre + off);
        S.add(walkEW);
      }
    }

    // --- Buildings ----------------------------------------------------------
    const winTexes = PALETTE.building.map((b) => makeWindowTexture(
      `#${b.toString(16).padStart(6, '0')}`,
      `#${pick(rng, PALETTE.glass).toString(16).padStart(6, '0')}`,
    ));
    const boxGeo = new THREE.BoxGeometry(1, 1, 1);
    for (let bx = -3; bx <= 2; bx += 1) {
      for (let bz = -3; bz <= 2; bz += 1) {
        const blockX = bx * CONFIG.ROAD_SPACING + CONFIG.ROAD_SPACING / 2;
        const blockZ = bz * CONFIG.ROAD_SPACING + CONFIG.ROAD_SPACING / 2;
        const downtown = Math.abs(blockX) < 70 && Math.abs(blockZ) < 70;
        const n = downtown ? 1 : (rng() > 0.5 ? 2 : 1);
        for (let k = 0; k < n; k += 1) {
          const w = randRange(rng, 12, downtown ? 26 : 20);
          const d = randRange(rng, 12, downtown ? 26 : 20);
          const h = downtown ? randRange(rng, 30, 85) : randRange(rng, 6, 22);
          const ox = n === 1 ? 0 : (k === 0 ? -9 : 9);
          const oz = n === 1 ? 0 : (k === 0 ? -9 : 9);
          const x = blockX + ox;
          const z = blockZ + oz;
          if (Math.abs(x) > half || Math.abs(z) > half) continue;
          const mat = new THREE.MeshLambertMaterial({ map: winTexes[Math.floor(rng() * winTexes.length)] });
          const b = new THREE.Mesh(boxGeo, mat);
          b.scale.set(w, h, d);
          b.position.set(x, h / 2, z);
          S.add(b);
          // Rooftop rim for high-rises
          if (h > 30) {
            const rim = new THREE.Mesh(new THREE.BoxGeometry(w + 1, 1, d + 1),
              new THREE.MeshLambertMaterial({ color: 0x8a94a0 }));
            rim.position.set(x, h + 0.5, z);
            S.add(rim);
          }
          this.colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
        }
      }
    }

    // --- Palm trees along the beach and the main avenue --------------------
    const trunkGeo = new THREE.CylinderGeometry(0.25, 0.4, 7, 6);
    const trunkMat = new THREE.MeshLambertMaterial({ color: PALETTE.trunk });
    const frondGeo = new THREE.ConeGeometry(2.6, 2.2, 6);
    const frondMat = new THREE.MeshLambertMaterial({ color: PALETTE.frond });
    const placePalm = (x, z) => {
      const g = new THREE.Group();
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.y = 3.5;
      trunk.rotation.z = randRange(rng, -0.08, 0.08);
      g.add(trunk);
      const fronds = new THREE.Mesh(frondGeo, frondMat);
      fronds.position.y = 7.6;
      g.add(fronds);
      const crown = new THREE.Mesh(new THREE.SphereGeometry(1.4, 8, 6), frondMat);
      crown.position.y = 7.1;
      crown.scale.y = 0.6;
      g.add(crown);
      g.position.set(x, 0, z);
      S.add(g);
      this.palms.push(g);
    };
    for (let z = -200; z <= 200; z += 22) {
      placePalm(CONFIG.BEACH_X - 9, z + randRange(rng, -3, 3));
      if (rng() > 0.4) placePalm(CONFIG.BEACH_X - 14, z + 11);
    }
    for (let x = -170; x <= 170; x += 28) {
      placePalm(x, -8.5 + randRange(rng, -1, 1));
      placePalm(x + 14, 8.5 + randRange(rng, -1, 1));
    }

    // --- Streetlights -------------------------------------------------------
    const poleGeo = new THREE.CylinderGeometry(0.12, 0.12, 7, 6);
    const poleMat = new THREE.MeshLambertMaterial({ color: 0x3a3a3f });
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
    for (const rc of this.roadCentres) {
      for (let d = -168; d <= 168; d += 56) {
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.set(rc + 6.5, 3.5, d);
        S.add(pole);
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), lampMat);
        lamp.position.set(rc + 6.5, 7.1, d);
        S.add(lamp);
      }
    }

    // --- Marina: pier + boats on the south-east shore -----------------------
    const pier = new THREE.Mesh(new THREE.BoxGeometry(70, 0.5, 8),
      new THREE.MeshLambertMaterial({ color: 0x9a7a52 }));
    pier.position.set(CONFIG.OCEAN_X + 25, 0.4, -140);
    S.add(pier);
    const hullMat = new THREE.MeshLambertMaterial({ color: 0xf2f2f2 });
    const hullMat2 = new THREE.MeshLambertMaterial({ color: 0x2a6a9a });
    for (let i = 0; i < 5; i += 1) {
      const boat = new THREE.Group();
      const hull = new THREE.Mesh(new THREE.BoxGeometry(8, 1.2, 3), i % 2 ? hullMat : hullMat2);
      hull.position.y = 0.4;
      boat.add(hull);
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(3, 1.4, 2.2),
        new THREE.MeshLambertMaterial({ color: 0xe8e0d0 }));
      cabin.position.set(-0.5, 1.6, 0);
      boat.add(cabin);
      boat.position.set(CONFIG.OCEAN_X + 12 + (i % 2) * 10, 0, -160 + i * 10);
      boat.rotation.y = randRange(rng, -0.15, 0.15);
      S.add(boat);
    }

    // Downtown plaza fountain (decorative)
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 0.8, 20),
      new THREE.MeshLambertMaterial({ color: 0xb8b0a4 }));
    basin.position.set(28, 0.4, 28);
    S.add(basin);
    const water = new THREE.Mesh(new THREE.CylinderGeometry(6.2, 6.2, 0.4, 20),
      new THREE.MeshLambertMaterial({ color: 0x3a8ab8 }));
    water.position.set(28, 0.7, 28);
    S.add(water);
  }

  /** True when point (x, z) with the given radius overlaps a building or leaves the map. */
  isBlocked(x, z, radius = 0.6) {
    if (x < -CONFIG.CITY_HALF - 10 || x > CONFIG.BEACH_X + 2 || z < -CONFIG.CITY_HALF - 10 || z > CONFIG.CITY_HALF + 10) return true;
    for (let i = 0; i < this.colliders.length; i += 1) {
      const c = this.colliders[i];
      if (x + radius > c.minX && x - radius < c.maxX && z + radius > c.minZ && z - radius < c.maxZ) return true;
    }
    return false;
  }

  /** Nearest road centreline coordinate to v (roads run both ways). */
  nearestRoad(v) {
    let best = this.roadCentres[0];
    let bd = Math.abs(v - best);
    for (const rc of this.roadCentres) {
      const d = Math.abs(v - rc);
      if (d < bd) { bd = d; best = rc; }
    }
    return best;
  }

  /** Gentle ocean swell for the water plane. */
  update(dt, time) {
    if (this.ocean) this.ocean.position.y = 0.15 + Math.sin(time * 0.7) * 0.08;
    for (let i = 0; i < this.palms.length; i += 1) {
      this.palms[i].rotation.z = Math.sin(time * 0.9 + i) * 0.03;
    }
  }
}
