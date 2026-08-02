"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

/**
 * The month's money as a jar of liquid — the budget's rhyme to the water
 * vessel and the timer ring. The third draining container.
 *
 * The level is the month's balance: what came in fills the jar, what went out
 * empties it. A full jar is a good month, a near-empty one is not, and an
 * overspent month turns the liquid clay — the same two semantic colours as
 * the charts, spoken in a material instead of a bar.
 *
 * The motion budget is the app's own: the fill rises once when the month
 * arrives (the story arriving, like the calendar's strips), the jar tilts
 * toward the pointer (interactive, stops when you look away), and the level
 * settles when an expense lands (confirmation, not decoration). No idle
 * motion — an ambient wobble would cost attention.
 *
 * If WebGL is unavailable the same jar renders in SVG, with the level moving
 * by CSS transition instead of a loop.
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

function readHex(token: string): string {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(token)
    .trim();
  return value.startsWith("#") ? value : `#${value}`;
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

  const level = incomeCents <= 0 ? 0 : Math.min(1, Math.max(0, balanceCents / incomeCents));
  const overspent = balanceCents < 0;

  // The scene is set up once and told what to do via these refs — the setup
  // effect below captures nothing but itself. The refs are written in an
  // effect, never during render.
  const levelRef = useRef(level);
  const overspentRef = useRef(overspent);
  const settleTarget = useRef<(level: number) => void>(() => {});

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      // WebGL's absence is only discoverable synchronously, by trying — the
      // fallback jar is the one update this effect is allowed to make.
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

    const liquidMaterial = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(readHex("--primary")),
      roughness: 0.3,
      metalness: 0.02,
    });
    const liquid = new THREE.Mesh(jarGeometry.clone(), liquidMaterial);
    liquid.renderOrder = 1;
    jarGroup.add(liquid);

    const applyPalette = () => {
      glassMaterial.color.set(readHex("--foreground"));
      liquidMaterial.color.set(
        overspentRef.current ? readHex("--destructive") : readHex("--primary"),
      );
    };
    applyPalette();

    // The soft ellipse the jar stands on.
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

    // The liquid's animated level. The profile scales about its base, so the
    // surface always sits where the wall is at that height.
    const display = {
      level: reduced ? levelRef.current : 0,
      target: levelRef.current,
    };
    liquid.scale.y = display.level;

    // Arrival: the month's story rising into the jar.
    let arrival = reduced ? 1 : 0;
    const LEVEL_SPEED = 2.2;

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

    const settle = (target: number) => {
      display.target = Math.min(1, Math.max(0, target));
    };
    settleTarget.current = settle;

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

      if (arrival < 1) {
        // Arrival is a rise with an ease-out; prop changes settle alone.
        arrival = Math.min(1, arrival + 0.045);
        const eased = 1 - Math.pow(1 - arrival, 3);
        display.target =
          levelRef.current * eased + (overspentRef.current ? 0.05 * eased : 0);
        display.level += (display.target - display.level) * 0.18;
      } else {
        display.level += (display.target - display.level) * LEVEL_SPEED * 0.016;
      }
      if (Math.abs(display.level - display.target) < 0.0015) {
        display.level = display.target;
      }
      liquid.scale.y = display.level;

      // Pointer parallax — the jar turns toward you, and only while you
      // point at it.
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
      renderer.dispose();
      jarGeometry.dispose();
      liquidMaterial.dispose();
      glassMaterial.dispose();
      shadowTexture.dispose();
      renderer.domElement.remove();
    };
  }, []);

  // Prop-driven settle: when the month's numbers change, the level moves.
  // The refs get the same update, so the render loop reads fresh values.
  useEffect(() => {
    levelRef.current = level;
    overspentRef.current = overspent;
    settleTarget.current(level);
  }, [level, overspent]);

  return (
    <div
      ref={containerRef}
      aria-hidden
      className="relative h-64 w-44 md:h-72 md:w-52"
    >
      {webglFailed && <SvgJar level={level} overspent={overspent} />}
    </div>
  );
}

/** The same jar, drawn without WebGL — the level moves by CSS transition. */
function SvgJar({ level, overspent }: { level: number; overspent: boolean }) {
  return (
    <svg
      viewBox="0 0 100 150"
      className="h-full w-full"
      fill="none"
      stroke="none"
      aria-hidden
    >
      <defs>
        <clipPath id="jar-interior">
          <path d="M14 2 h22 c6 0 8 5 9 14 c2 16 4 44 2 72 c-2 28-6 52-22 52 h-14 c-14 0-20-20-22-48 c-2-26 0-52 1-70 c1-12 5-20 24-20 Z" />
        </clipPath>
      </defs>
      <path
        d="M14 2 h22 c6 0 8 5 9 14 c2 16 4 44 2 72 c-2 28-6 52-22 52 h-14 c-14 0-20-20-22-48 c-2-26 0-52 1-70 c1-12 5-20 24-20 Z"
        stroke="var(--foreground)"
        strokeOpacity={0.35}
        strokeWidth={2}
      />
      <g clipPath="url(#jar-interior)">
        <rect
          x={8}
          y={150 - 146 * level}
          width={84}
          height={146 * level}
          className="transition-[y,height] duration-500 ease-out motion-reduce:transition-none"
          style={{
            fill: overspent ? "var(--destructive)" : "var(--primary)",
            opacity: 0.92,
          }}
        />
      </g>
      <ellipse cx={31} cy={4} rx={16} ry={3} fill="var(--foreground)" opacity={0.25} />
    </svg>
  );
}

// next/dynamic imports the module's default; the named export stays for any
// direct importer.
export default BalanceVessel;
