"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

/**
 * The month's money as a liquid tank — the budget's rhyme to the water vessel
 * and the timer ring. The third container.
 *
 * The tank holds what came in (income) and is read by how much of it is still
 * loose. Money that has already gone out sits at the bottom as a darker, denser
 * layer — committed, and visibly unable to be poured back out. The fluid above
 * it is what's still yours. A spend locks a little more in at the bottom and
 * the loose level thins; read the ratio at a glance — near all dark is near
 * empty — without parsing a digit. An overspent month turns the whole tank clay.
 *
 * The motion budget is the app's own: the boundary between the locked layer and
 * the loose fluid is a real surface with inertia. When a spend lands, a wave
 * runs across it and decays in about a second — the physical consequence the
 * level, not a number. Between spends the tank is still (no ambient wobble).
 * The jar still tilts toward the pointer and stops when you look away.
 *
 * If WebGL is unavailable the same tank renders in SVG, with the boundary
 * animated instead of a loop.
 */

const REDUCED_MOTION =
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** The jar's profile, from base to rim — a belly and a neck. */
const PROFILE: [number, number][] = [
  [0, 0],
  [0.78, 0],
  [1.02, 0.18],
  [1.14, 0.62],
  [1.12, 1.18],
  [1.0, 1.74],
  [0.84, 2.0],
  [0.62, 2.18],
  [0, 2.18],
];

/** The tank's full height, in profile units. */
const FULL_HEIGHT = PROFILE[PROFILE.length - 1][1];

const RINGS = 24;
const SIDES = 48;

function readHex(token: string): string {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(token)
    .trim();
  return value.startsWith("#") ? value : `#${value}`;
}

function hexToRgb(hex: string): [number, number, number] {
  const cleaned = hex.replace("#", "");
  const full =
    cleaned.length === 3
      ? cleaned
          .split("")
          .map((c) => c + c)
          .join("")
      : cleaned;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** The radius of the tank's wall at a given height y, from the outer profile. */
function radialAt(y: number): number {
  for (let i = 0; i < PROFILE.length - 1; i += 1) {
    const a = PROFILE[i];
    const b = PROFILE[i + 1];
    if (y >= a[1] && y <= b[1]) {
      const span = b[1] - a[1] || 1;
      const t = (y - a[1]) / span;
      return a[0] + (b[0] - a[0]) * t;
    }
  }
  return 0;
}

/**
 * A solid band of fluid that fills the tank between two heights, capped at the
 * ends. The top cap (and the top ring of the wall) are tagged so the render
 * loop can displace them as a sloshing surface.
 */
function bandGeometry(y0: number, y1: number) {
  const verts: number[] = [];
  const idx: number[] = [];

  for (let r = 0; r <= RINGS; r += 1) {
    const y = y0 + ((y1 - y0) * r) / RINGS;
    const rad = radialAt(y);
    for (let c = 0; c < SIDES; c += 1) {
      const a = (c / SIDES) * Math.PI * 2;
      verts.push(Math.cos(a) * rad, y, Math.sin(a) * rad);
    }
  }

  const topRing = RINGS * SIDES;
  const topCenter = verts.length / 3;
  verts.push(0, y1, 0);
  const bottomCenter = verts.length / 3;
  verts.push(0, y0, 0);

  // Side walls.
  for (let r = 0; r < RINGS; r += 1) {
    const ring0 = r * SIDES;
    const ring1 = (r + 1) * SIDES;
    for (let c = 0; c < SIDES; c += 1) {
      const c2 = (c + 1) % SIDES;
      const a = ring0 + c;
      const b = ring0 + c2;
      const d = ring1 + c;
      const e = ring1 + c2;
      idx.push(a, d, b, b, d, e);
    }
  }
  // Top cap.
  for (let c = 0; c < SIDES; c += 1) {
    const c2 = (c + 1) % SIDES;
    idx.push(topCenter, topRing + c, topRing + c2);
  }
  // Bottom cap.
  for (let c = 0; c < SIDES; c += 1) {
    const c2 = (c + 1) % SIDES;
    idx.push(bottomCenter, c2, c);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();

  geo.userData = {
    ring: topRing,
    segs: SIDES,
    center: topCenter,
    baseY: y1,
    radius: radialAt(y1),
  };
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

  // How much of the tank is locked (spent) vs loose (available). The loose
  // thickness is 1 - committed, sitting on top of the committed band.
  const committed =
    incomeCents <= 0
      ? 0
      : Math.min(1, Math.max(0, (incomeCents - balanceCents) / incomeCents));
  const overspent = balanceCents < 0;

  // The scene is set up once and told what to do via these refs — the setup
  // effect below captures nothing but itself. The refs are written in effect,
  // never during render.
  const committedRef = useRef(committed);
  const overspentRef = useRef(overspent);
  const refreshFill = useRef<(committed: number, flash: boolean) => void>(
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

    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
    camera.position.set(0, 1.34, 4.9);
    camera.lookAt(0, 1.05, 0);

    scene.add(new THREE.AmbientLight(0xffffff, 0.62));
    const key = new THREE.DirectionalLight(0xfff1dd, 1.35);
    key.position.set(2.6, 4.4, 2.4);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xcfe0ff, 0.5);
    fill.position.set(-3, 1.6, -2);
    scene.add(fill);

    const jarGroup = new THREE.Group();
    scene.add(jarGroup);

    const glassMaterial = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(readHex("--foreground")),
      transparent: true,
      opacity: 0.14,
      roughness: 0.06,
      metalness: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const jarGeometry = new THREE.LatheGeometry(
      PROFILE.map(([x, y]) => new THREE.Vector2(x, y)),
      48,
    );
    const glass = new THREE.Mesh(jarGeometry, glassMaterial);
    glass.renderOrder = 2;
    jarGroup.add(glass);

    // The loose-liquid material that fills the tank, coloured by the situation.
    const looseMaterial = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(readHex("--primary")),
      roughness: 0.3,
      metalness: 0.02,
      side: THREE.DoubleSide,
    });
    // The locked-spent band is a denser, darker version of the same colour.
    const lockedMaterial = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(0x161413),
      roughness: 0.45,
      metalness: 0.06,
      side: THREE.DoubleSide,
    });

    let lockedGeo = bandGeometry(0, 0);
    let looseGeo = bandGeometry(0, FULL_HEIGHT);
    let committedTop = 0;

    const locked = new THREE.Mesh(lockedGeo, lockedMaterial);
    const loose = new THREE.Mesh(looseGeo, looseMaterial);
    locked.renderOrder = 1;
    loose.renderOrder = 1;
    jarGroup.add(locked, loose);

    const applyPalette = () => {
      glassMaterial.color.set(readHex("--foreground"));
      const base = overspentRef.current
        ? readHex("--destructive")
        : readHex("--primary");
      looseMaterial.color.set(base);
      // Locked is the same hue, pushed to the ink — darker, denser, matte.
      const [r, g, b] = hexToRgb(base);
      const darken = (n: number) => Math.max(0, Math.min(255, Math.round(n * 0.18)));
      lockedMaterial.color.setRGB(
        darken(r) / 255,
        darken(g) / 255,
        darken(b) / 255,
      );
      lockedMaterial.roughness = 0.55;
    };
    applyPalette();

    // The soft ellipse the tank stands on.
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
      new THREE.PlaneGeometry(2.6, 1.3),
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

    const rebuild = (committedLevel: number) => {
      const top = committedLevel * FULL_HEIGHT;
      if (Math.abs(top - committedTop) < 0.0001) return;

      const nextLocked = bandGeometry(0, top);
      const nextLoose = bandGeometry(top, FULL_HEIGHT);
      locked.geometry.dispose();
      loose.geometry.dispose();
      locked.geometry = nextLocked;
      loose.geometry = nextLoose;
      lockedGeo = nextLocked;
      looseGeo = nextLoose;
      committedTop = top;
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

    const refresh = (committedLevel: number, flash: boolean) => {
      rebuild(committedLevel);
      applyPalette();
      if (flash && Math.abs(committedLevel * FULL_HEIGHT - committedTop) < 0.0001) {
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
        // Draw the locked band's cap as a decaying ripple, only while it has
        // energy; idle it is a flat surface, not a busy one.
        const geo = locked.geometry;
        const pos = geo.getAttribute("position") as THREE.BufferAttribute;
        const meta = geo.userData;
        const base = meta.baseY;
        for (let i = 0; i < meta.segs; i += 1) {
          const vi = meta.ring + i;
          const x = pos.getX(vi);
          const z = pos.getZ(vi);
          const rad = Math.hypot(x, z);
          const d = rad / (meta.radius || 1);
          const dy =
            wave.amp * 0.045 *
            Math.sin(wave.phase + rad * 5.5) *
            Math.max(0, 1 - d * 0.6);
          pos.setY(vi, base + dy);
        }
        pos.setY(meta.center, base + wave.amp * 0.018);
        pos.needsUpdate = true;
        wave.phase += 0.35;
        wave.amp *= 0.9;
      } else if (wave.amp <= 0.001 && wave.amp !== 0) {
        // Flat once still.
        wave.amp = 0;
        const geo = locked.geometry;
        const pos = geo.getAttribute("position") as THREE.BufferAttribute;
        const meta = geo.userData;
        for (let i = 0; i < meta.segs; i += 1) {
          pos.setY(meta.ring + i, meta.baseY);
        }
        pos.setY(meta.center, meta.baseY);
        pos.needsUpdate = true;
      }

      pointer.x += (pointer.tx - pointer.x) * 0.08;
      pointer.y += (pointer.ty - pointer.y) * 0.08;
      jarGroup.rotation.y = pointer.x;
      jarGroup.rotation.x = -pointer.y * 0.8;

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
      locked.geometry.dispose();
      loose.geometry.dispose();
      jarGeometry.dispose();
      lockedMaterial.dispose();
      looseMaterial.dispose();
      glassMaterial.dispose();
      shadowTexture.dispose();
      renderer.domElement.remove();
      renderer.dispose();
    };
  }, []);

  // Prop-driven fill: when the month's numbers change the locked band grows
  // (or the tank goes clay) and the boundary sloshes to say so.
  useEffect(() => {
    const prev = committedRef.current;
    committedRef.current = committed;
    overspentRef.current = overspent;
    // A spend locks more in — the impulse is a shiver of confirmation.
    refreshFill.current(committed, committed > prev);
  }, [committed, overspent]);

  return (
    <div
      ref={containerRef}
      aria-hidden
      className="relative h-64 w-44 md:h-72 md:w-52"
    >
      {webglFailed && (
        <SvgTank committed={committed} overspent={overspent} />
      )}
    </div>
  );
}

/** The same tank, drawn without WebGL — the boundary waves to its own clock. */
function SvgTank({ committed, overspent }: { committed: number; overspent: boolean }) {
  const loose = 1 - committed;
  const boundY = 150 - 146 * committed;
  return (
    <svg viewBox="0 0 100 150" className="h-full w-full" fill="none" stroke="none" aria-hidden>
      <defs>
        <clipPath id="tank-interior">
          <path d="M14 2 h22 c6 0 8 5 9 14 c2 16 4 44 2 72 c-2 28-6 52-22 52 h-14 c-14 0-20-20-22-48 c-2-26 0-52 1-70 c1-12 5-20 24-20 Z" />
        </clipPath>
      </defs>
      <path
        d="M14 2 h22 c6 0 8 5 9 14 c2 16 4 44 2 72 c-2 28-6 52-22 52 h-14 c-22-20-22-48 c-2-26 0-52 1-70 c1-12 5-20 24-20 Z"
        stroke="var(--foreground)"
        strokeOpacity={0.35}
        strokeWidth={2}
      />
      <g clipPath="url(#tank-interior)">
        {loose > 0.001 && (
          <rect
            x={8}
            y={4}
            width={84}
            height={146 * loose}
            className="transition-[y,height] duration-500 ease-out motion-reduce:transition-none"
            style={{ fill: overspent ? "var(--destructive)" : "var(--primary)", opacity: 0.92 }}
          />
        )}
        <rect
          x={8}
          y={150 - 146 * committed}
          width={84}
          height={146 * committed}
          className="transition-[y,height] duration-500 ease-out motion-reduce:transition-none"
          style={{
            fill: overspent ? "var(--destructive)" : "var(--primary)",
            opacity: 0.92,
            filter: "brightness(0.6)",
          }}
        />
        {committed > 0.001 && (
          // The locked layer's own denser cap, the sloshing surface.
          <ellipse
            cx={31}
            cy={boundY}
            rx={17}
            ry={2}
            fill={overspent ? "var(--destructive)" : "var(--primary)"}
            opacity={0.9}
          >
            <animate attributeName="ry" values="2;3.4;1.8;2.6;2" dur="1.4s" repeatCount="indefinite" />
          </ellipse>
        )}
      </g>
    </svg>
  );
}

// next/dynamic imports the module's default; the named export stays for any
// direct importer.
export default BalanceVessel;