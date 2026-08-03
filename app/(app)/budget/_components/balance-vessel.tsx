"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

/**
 * The month's money as a simple rectangular water tank — the budget's rhyme
 * to the water vessel and the timer ring. The third container.
 *
 * The water is what's left of what came in: the level is (income − expenses)
 * ÷ income, so a month that brought in 1000 and spent 900 shows a tank a
 * tenth full. A full tank is a month spent against nothing; an empty one is a
 * month that spent it all. An overspent month empties the tank and tints the
 * glass clay — the thing to notice, in the palette's one "wrong" colour.
 *
 * The motion budget is the app's own: the surface has inertia. When a spend
 * lands the level drops and a wave runs across the surface, decaying in about
 * a second — the physical consequence the level, not a number. Between
 * changes the tank is still (no ambient wobble), and it tilts toward the
 * pointer until you look away.
 *
 * If WebGL is unavailable the same tank renders in SVG, with the surface
 * animated instead of a loop.
 */

const REDUCED_MOTION =
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** The tank's footprint and full height, in scene units. */
const TANK_W = 1.0;
const TANK_D = 0.62;
const FULL_HEIGHT = 1.9;

/** The surface grid: how finely the water's top is cut for the wave. */
const SX = 28;
const SZ = 18;

function readHex(token: string): string {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(token)
    .trim();
  return value.startsWith("#") ? value : `#${value}`;
}

/**
 * The water band: four walls and a bottom, capped by a subdivided surface
 * grid. The grid vertices are tagged so the render loop can displace them as
 * a sloshing surface.
 */
function boxBand(y0: number, y1: number) {
  const hx = TANK_W / 2;
  const hz = TANK_D / 2;

  // Indices: 0..3 bottom corners, 4..7 top corners, then the surface grid.
  const verts: number[] = [
    -hx, y0, -hz,
    hx, y0, -hz,
    hx, y0, hz,
    -hx, y0, hz,
    -hx, y1, -hz,
    hx, y1, -hz,
    hx, y1, hz,
    -hx, y1, hz,
  ];
  const idx: number[] = [
    // Bottom.
    0, 1, 2, 0, 2, 3,
    // Front (+z).
    3, 2, 6, 3, 6, 7,
    // Back (−z).
    0, 1, 5, 0, 5, 4,
    // Left (−x).
    0, 3, 7, 0, 7, 4,
    // Right (+x).
    1, 2, 6, 1, 6, 5,
  ];

  const gridX = SX + 1;
  const gridZ = SZ + 1;
  const gridStart = 8;
  for (let ix = 0; ix < gridX; ix += 1) {
    const x = -hx + (TANK_W * ix) / SX;
    for (let iz = 0; iz < gridZ; iz += 1) {
      const z = -hz + (TANK_D * iz) / SZ;
      verts.push(x, y1, z);
    }
  }
  for (let ix = 0; ix < SX; ix += 1) {
    for (let iz = 0; iz < SZ; iz += 1) {
      const a = gridStart + ix * gridZ + iz;
      const b = a + 1;
      const c = a + gridZ;
      const d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();

  geo.userData = {
    gridStart,
    gridCount: gridX * gridZ,
    center: gridStart + Math.floor(SX / 2) * gridZ + Math.floor(SZ / 2),
    baseY: y1,
    halfX: hx,
    halfZ: hz,
  };
  return geo;
}

/** The tank's glass: an open-topped box, five planes. */
function openBoxGeometry(w: number, h: number, d: number) {
  const hx = w / 2;
  const hz = d / 2;
  const verts = [
    // Front (+z).
    -hx, 0, hz,
    hx, 0, hz,
    hx, h, hz,
    -hx, h, hz,
    // Back (−z).
    hx, 0, -hz,
    -hx, 0, -hz,
    -hx, h, -hz,
    hx, h, -hz,
    // Left (−x).
    -hx, 0, -hz,
    -hx, 0, hz,
    -hx, h, hz,
    -hx, h, -hz,
    // Right (+x).
    hx, 0, hz,
    hx, 0, -hz,
    hx, h, -hz,
    hx, h, hz,
    // Bottom.
    -hx, 0, -hz,
    hx, 0, -hz,
    hx, 0, hz,
    -hx, 0, hz,
  ];
  const idx: number[] = [];
  for (let face = 0; face < 5; face += 1) {
    const o = face * 4;
    idx.push(o, o + 1, o + 2, o, o + 2, o + 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

export function BalanceVessel({
  balanceCents,
  incomeCents,
}: {
  balanceCents: number;
  incomeCents: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [webglFailed, setWebglFailed] = useState(false);

  // The level is what's left of what came in: (income − expenses) ÷ income.
  const level =
    incomeCents <= 0
      ? 0
      : Math.min(1, Math.max(0, balanceCents / incomeCents));
  const overspent = balanceCents < 0;

  // The scene is set up once and told what to do via these refs — the setup
  // effect below captures nothing but itself. The refs are written in effect,
  // never during render.
  const levelRef = useRef(level);
  const overspentRef = useRef(overspent);
  const refreshFill = useRef<(level: number, flash: boolean) => void>(
    () => {},
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      // WebGL's absence is only discoverable synchronously, by trying — the
      // fallback tank is the one update this effect is allowed to make.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setWebglFailed(true);
      return;
    }

    const reduced = REDUCED_MOTION;

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 20);
    camera.position.set(0, 1.6, 4.2);
    camera.lookAt(0, 0.95, 0);

    scene.add(new THREE.AmbientLight(0xffffff, 0.62));
    const key = new THREE.DirectionalLight(0xfff1dd, 1.35);
    key.position.set(2.6, 4.4, 2.4);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xcfe0ff, 0.5);
    fill.position.set(-3, 1.6, -2);
    scene.add(fill);

    const tankGroup = new THREE.Group();
    scene.add(tankGroup);

    const glassMaterial = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(readHex("--foreground")),
      transparent: true,
      opacity: 0.16,
      roughness: 0.08,
      metalness: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const glass = new THREE.Mesh(
      openBoxGeometry(TANK_W, FULL_HEIGHT, TANK_D),
      glassMaterial,
    );
    glass.renderOrder = 2;
    tankGroup.add(glass);

    // The water, coloured by the situation.
    const waterMaterial = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(readHex("--primary")),
      roughness: 0.3,
      metalness: 0.02,
      side: THREE.DoubleSide,
    });

    let waterGeo = boxBand(0, 0);
    let waterTop = 0;

    const water = new THREE.Mesh(waterGeo, waterMaterial);
    water.renderOrder = 1;
    tankGroup.add(water);

    const applyPalette = () => {
      glassMaterial.color.set(
        overspentRef.current
          ? readHex("--destructive")
          : readHex("--foreground"),
      );
      waterMaterial.color.set(
        overspentRef.current
          ? readHex("--destructive")
          : readHex("--primary"),
      );
    };
    applyPalette();

    // The soft shadow the tank stands on.
    const shadowCanvas = document.createElement("canvas");
    shadowCanvas.width = 128;
    shadowCanvas.height = 64;
    const shadowCtx = shadowCanvas.getContext("2d");
    if (shadowCtx) {
      const gradient = shadowCtx.createRadialGradient(64, 32, 4, 64, 32, 62);
      gradient.addColorStop(0, "rgba(20, 18, 15, 0.28)");
      gradient.addColorStop(1, "rgba(20, 18, 15, 0)");
      shadowCtx.fillStyle = gradient;
      shadowCtx.fillRect(0, 0, 128, 64);
    }
    const shadowTexture = new THREE.CanvasTexture(shadowCanvas);
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1.8, 1.1),
      new THREE.MeshBasicMaterial({
        map: shadowTexture,
        transparent: true,
        depthWrite: false,
      }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.002;
    scene.add(shadow);

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);
    renderer.domElement.className = "absolute inset-0 h-full w-full";

    const resize = () => {
      const width = container.clientWidth || 1;
      const height = container.clientHeight || 1;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);

    const rebuild = (nextLevel: number) => {
      const top = nextLevel * FULL_HEIGHT;
      if (Math.abs(top - waterTop) < 0.0001) return;

      const next = boxBand(0, top);
      water.geometry.dispose();
      water.geometry = next;
      waterGeo = next;
      waterTop = top;
      water.visible = top > 0.001;
    };

    const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    const onPointerMove = (event: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      const nx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = ((event.clientY - rect.top) / rect.height) * 2 - 1;
      pointer.tx = nx * 0.09;
      pointer.ty = ny * 0.07;
    };
    const onPointerLeave = () => {
      pointer.tx = 0;
      pointer.ty = 0;
    };
    container.addEventListener("pointermove", onPointerMove);
    container.addEventListener("pointerleave", onPointerLeave);

    // The sloshing surface with inertia: an impulse decays over ~a second.
    const wave = { amp: 0, phase: 0.1 };

    const refresh = (nextLevel: number, flash: boolean) => {
      rebuild(nextLevel);
      applyPalette();
      if (flash && Math.abs(nextLevel * FULL_HEIGHT - waterTop) < 0.0001) {
        wave.amp = 1;
      }
    };
    refreshFill.current = refresh;

    let visible = true;
    const onVisibility = (entries: IntersectionObserverEntry[]) => {
      visible = entries[0]?.isIntersecting ?? true;
    };
    const visibilityObserver = new IntersectionObserver(onVisibility, { threshold: 0 });
    visibilityObserver.observe(container);

    const themeObserver = new MutationObserver(applyPalette);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    let frame = 0;
    const loop = () => {
      frame = requestAnimationFrame(loop);
      if (!visible) return;

      if (!reduced && wave.amp > 0.001) {
        // Draw the water's surface as a decaying ripple, only while it has
        // energy; idle it is flat, not busy.
        const geo = water.geometry;
        const pos = geo.getAttribute("position") as THREE.BufferAttribute;
        const meta = geo.userData;
        const base = meta.baseY;
        for (let i = 0; i < meta.gridCount; i += 1) {
          const vi = meta.gridStart + i;
          const x = pos.getX(vi);
          const z = pos.getZ(vi);
          const r = Math.hypot(x / meta.halfX, z / meta.halfZ);
          const dy =
            wave.amp * 0.05 *
            Math.sin(wave.phase + r * 7.5) *
            Math.max(0, 1 - r * 0.5);
          pos.setY(vi, base + dy);
        }
        pos.needsUpdate = true;
        wave.phase += 0.35;
        wave.amp *= 0.9;
      } else if (wave.amp <= 0.001 && wave.amp !== 0) {
        // Flat once still.
        wave.amp = 0;
        const geo = water.geometry;
        const pos = geo.getAttribute("position") as THREE.BufferAttribute;
        const meta = geo.userData;
        for (let i = 0; i < meta.gridCount; i += 1) {
          pos.setY(meta.gridStart + i, meta.baseY);
        }
        pos.needsUpdate = true;
      }

      pointer.x += (pointer.tx - pointer.x) * 0.08;
      pointer.y += (pointer.ty - pointer.y) * 0.08;
      tankGroup.rotation.y = pointer.x;
      tankGroup.rotation.x = -pointer.y * 0.8;

      renderer.render(scene, camera);
    };

    if (reduced) {
      renderer.render(scene, camera);
    } else {
      loop();
    }

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      visibilityObserver.disconnect();
      themeObserver.disconnect();
      container.removeEventListener("pointermove", onPointerMove);
      container.removeEventListener("pointerleave", onPointerLeave);
      water.geometry.dispose();
      glass.geometry.dispose();
      waterMaterial.dispose();
      glassMaterial.dispose();
      shadowTexture.dispose();
      renderer.domElement.remove();
      renderer.dispose();
    };
  }, []);

  // Prop-driven fill: when the month's numbers change the level moves and the
  // surface sloshes to say so.
  useEffect(() => {
    const prev = levelRef.current;
    levelRef.current = level;
    overspentRef.current = overspent;
    // A spend drops the level — the impulse is a shiver of confirmation.
    refreshFill.current(level, level !== prev);
  }, [level, overspent]);

  return (
    <div
      ref={containerRef}
      aria-hidden
      className="relative h-64 w-44 md:h-72 md:w-52"
    >
      {webglFailed && <SvgTank level={level} overspent={overspent} />}
    </div>
  );
}

/** The same tank, drawn without WebGL — the surface waves to its own clock. */
function SvgTank({ level, overspent }: { level: number; overspent: boolean }) {
  const waterH = 140 * level;
  const waterY = 146 - waterH;
  return (
    <svg viewBox="0 0 100 150" className="h-full w-full" fill="none" stroke="none" aria-hidden>
      <defs>
        <clipPath id="tank-interior">
          <rect x={28} y={4} width={44} height={142} rx={3} />
        </clipPath>
      </defs>
      <rect
        x={27}
        y={3}
        width={46}
        height={144}
        rx={3}
        stroke="var(--foreground)"
        strokeOpacity={overspent ? 0.8 : 0.35}
        strokeWidth={2}
        fill="none"
      />
      {level > 0.001 && (
        <g clipPath="url(#tank-interior)">
          <rect
            x={28}
            y={waterY}
            width={44}
            height={waterH}
            className="transition-[y,height] duration-500 ease-out motion-reduce:transition-none"
            style={{
              fill: overspent ? "var(--destructive)" : "var(--primary)",
              opacity: 0.92,
            }}
          />
          <ellipse
            cx={50}
            cy={waterY}
            rx={22}
            ry={2}
            fill={overspent ? "var(--destructive)" : "var(--primary)"}
            opacity={0.9}
          >
            <animate attributeName="ry" values="2;3.2;1.8;2.6;2" dur="1.4s" repeatCount="indefinite" />
          </ellipse>
        </g>
      )}
    </svg>
  );
}

// next/dynamic imports the module's default; the named export stays for any
// direct importer.
export default BalanceVessel;
