"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

import { Frog } from "./frog";

/**
 * The mood of the pond, mirroring the home screen's three states:
 * waiting — nothing picked yet; chosen — today's frog, front and centre;
 * eaten — the task is done and the whole pond is pleased about it.
 */
export type FrogMood = "waiting" | "chosen" | "eaten";

const REDUCED_MOTION =
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function readHex(token: string): string {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(token)
    .trim();
  return value.startsWith("#") ? value : "#" + value;
}

/** A soft radial gradient texture, used for glows, water and shadows. */
function radialTexture(inner: string, outer: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const gradient = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
    gradient.addColorStop(0, inner);
    gradient.addColorStop(1, outer);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
  }
  return new THREE.CanvasTexture(canvas);
}

/** A four-step luminance ramp that gives the toon materials their bands. */
function toonRamp(): THREE.DataTexture {
  const data = new Uint8Array([76, 76, 76, 255, 148, 148, 148, 255, 214, 214, 214, 255, 255, 255, 255, 255]);
  const texture = new THREE.DataTexture(data, 4, 1, THREE.RGBAFormat);
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

/** The lilypad's top view as an SVG: white disc, rim, and ten veins. */
function padSvg(): string {
  let veins = "";
  for (let i = 0; i < 10; i += 1) {
    const angle = (Math.PI * 2 * i) / 10;
    const x1 = 128 + Math.cos(angle) * 16;
    const y1 = 128 + Math.sin(angle) * 16;
    const x2 = 128 + Math.cos(angle) * 106;
    const y2 = 128 + Math.sin(angle) * 106;
    veins +=
      "<path d='M" + x1.toFixed(1) + " " + y1.toFixed(1) +
      " L" + x2.toFixed(1) + " " + y2.toFixed(1) + "'/>";
  }
  return (
    "<svg xmlns='http://www.w3.org/2000/svg' width='256' height='256' viewBox='0 0 256 256'>" +
    "<circle cx='128' cy='128' r='122' fill='#ffffff'/>" +
    "<circle cx='128' cy='128' r='118' fill='none' stroke='#000000' stroke-opacity='0.3' stroke-width='5'/>" +
    "<g stroke='#000000' stroke-opacity='0.15' stroke-width='2.5' fill='none'>" + veins + "</g>" +
    "<circle cx='128' cy='128' r='12' fill='#000000' fill-opacity='0.1'/>" +
    "</svg>"
  );
}

/** Rasterise an SVG string into a texture, then hand it back. */
function textureFromSvg(svg: string, onReady: (texture: THREE.CanvasTexture) => void): void {
  const image = new Image();
  image.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(image, 0, 0);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    onReady(texture);
  };
  image.src = "data:image/svg+xml;utf8," + encodeURIComponent(svg);
}

interface Rig {
  group: THREE.Group;
  body: THREE.Mesh;
  belly: THREE.Mesh;
  throat: THREE.Mesh;
  mouth: THREE.Mesh;
  sclera: THREE.Mesh[];
  pupils: THREE.Mesh[];
  eyes: THREE.Group;
  smileSmall: THREE.Mesh;
  smileBig: THREE.Mesh;
  phase: number;
  blinkAt: number;
  blinkUntil: number;
  hero: boolean;
  pupilBaseX: number[];
}

interface Station {
  group: THREE.Group;
  rig: Rig;
  x: number;
  z: number;
  phase: number;
}

/**
 * The pond: a hero frog on the front lilypad, two companions behind, soft
 * water, slow ripples, fireflies and twinkling glints. Everything is drawn
 * from primitives — plus one SVG, the lilypad's veins, rasterised into its
 * texture — and tinted from the CSS tokens so the pond re-colours with the
 * theme. Frogs are toon-shaded to match the app's flat illustration style,
 * and their eyes catch the light.
 *
 * The motion is alive but slow: breathing, blinks, the odd croak, one hop
 * every ten seconds or so, a celebratory bounce and a single squash-and-stretch
 * gulp when the frog is eaten. Reduced motion renders one still frame; without
 * WebGL the flat SVG frog takes over.
 */
export function FrogPond({
  mood,
  className = "relative mx-auto h-40 w-full max-w-md sm:h-48",
}: {
  mood: FrogMood;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [webglFailed, setWebglFailed] = useState(false);
  const moodRef = useRef(mood);
  const applyMood = useRef<(next: FrogMood) => void>(() => {});

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setWebglFailed(true);
      return;
    }

    const reduced = REDUCED_MOTION;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60);
    camera.position.set(0, 2.1, 6.2);
    camera.lookAt(0, 0.45, 0);

    scene.add(new THREE.AmbientLight(0xffffff, 0.85));
    const key = new THREE.DirectionalLight(0xfff1dd, 1.5);
    key.position.set(2.6, 4.4, 2.4);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xcfe0ff, 0.6);
    fill.position.set(-3, 1.6, -2);
    scene.add(fill);
    // A warm rim from behind lifts the frogs off the water.
    const rim = new THREE.DirectionalLight(0xffe2b8, 1.1);
    rim.position.set(-1.5, 3, -3);
    scene.add(rim);

    // Shared materials, re-tinted from the CSS tokens on theme change.
    const ramp = toonRamp();
    const ink = new THREE.MeshToonMaterial({
      color: new THREE.Color(readHex("--foreground")),
      gradientMap: ramp,
    });
    const accent = new THREE.MeshToonMaterial({
      color: new THREE.Color(readHex("--accent")),
      gradientMap: ramp,
    });
    const scleraMat = new THREE.MeshToonMaterial({
      color: new THREE.Color(readHex("--background")),
      gradientMap: ramp,
    });
    const padMat = new THREE.MeshToonMaterial({
      color: new THREE.Color(readHex("--primary")).multiplyScalar(0.9),
      gradientMap: ramp,
      side: THREE.DoubleSide,
    });
    const catchlightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const waterAlpha = radialTexture(
      "rgba(255,255,255,1)",
      "rgba(255,255,255,0)",
    );
    const waterMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(readHex("--primary")),
      transparent: true,
      opacity: 0.55,
      alphaMap: waterAlpha,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const backdropMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(readHex("--primary")),
      transparent: true,
      opacity: 0.26,
      alphaMap: waterAlpha,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const glowMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(readHex("--primary")),
      transparent: true,
      opacity: 0,
      alphaMap: waterAlpha,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const shadowTex = radialTexture(
      "rgba(28,26,23,0.5)",
      "rgba(28,26,23,0)",
    );
    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    });
    const fireflyTex = radialTexture(
      "rgba(255,246,214,1)",
      "rgba(255,246,214,0)",
    );

    const disposablesGeo: THREE.BufferGeometry[] = [];
    const disposablesMat: THREE.Material[] = [
      ink,
      accent,
      scleraMat,
      padMat,
      catchlightMat,
      waterMat,
      backdropMat,
      glowMat,
      shadowMat,
    ];
    const disposablesTex: THREE.Texture[] = [ramp, waterAlpha, shadowTex, fireflyTex];
    let disposed = false;

    const pond = new THREE.Group();
    scene.add(pond);

    // The pond itself: a wide soft backdrop, then the water disc.
    const backdrop = new THREE.Mesh(new THREE.CircleGeometry(9.5, 48), backdropMat);
    backdrop.rotation.x = -Math.PI / 2;
    backdrop.position.y = -0.16;
    pond.add(backdrop);
    disposablesGeo.push(backdrop.geometry);

    const water = new THREE.Mesh(new THREE.CircleGeometry(6.4, 48), waterMat);
    water.rotation.x = -Math.PI / 2;
    water.position.y = -0.02;
    pond.add(water);
    disposablesGeo.push(water.geometry);

    const rippleMats: THREE.MeshBasicMaterial[] = [];
    const ripples = [0, 1, 2].map((i) => {
      const mat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(readHex("--primary")),
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      rippleMats.push(mat);
      const mesh = new THREE.Mesh(new THREE.RingGeometry(0.86, 1, 64), mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(0, 0, 0);
      mesh.scale.setScalar(0.25);
      pond.add(mesh);
      disposablesGeo.push(mesh.geometry);
      return { mesh, mat, t: i / 3 };
    });

    // Twinkling glints on the water, each with its own opacity.
    const glints = Array.from({ length: 10 }, (_, i) => {
      const angle = i * 2.39996;
      const radius = 1.3 + ((i * 0.618) % 1) * 2.3;
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      disposablesMat.push(mat);
      const mesh = new THREE.Mesh(new THREE.CircleGeometry(0.022, 8), mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(Math.cos(angle) * radius, 0.012, Math.sin(angle) * radius);
      pond.add(mesh);
      disposablesGeo.push(mesh.geometry);
      return { mesh, mat, phase: i * 1.7, speed: 1.1 + ((i * 0.37) % 1) };
    });

    // Fireflies: a warm glow sprite with a bright core, drifting slowly.
    const fireflies = [0, 1, 2].map((i) => {
      const spriteMat = new THREE.SpriteMaterial({
        map: fireflyTex,
        transparent: true,
        opacity: 0.7,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      disposablesMat.push(spriteMat);
      const sprite = new THREE.Sprite(spriteMat);
      sprite.scale.setScalar(0.5);
      const core = new THREE.Mesh(
        new THREE.SphereGeometry(0.035, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xfff2cf }),
      );
      disposablesGeo.push(core.geometry);
      const group = new THREE.Group();
      group.add(sprite, core);
      pond.add(group);
      return {
        group,
        fx: (i - 1) * 1.8,
        fz: -0.4 - i * 0.9,
        speed: 0.26 + i * 0.09,
        phase: i * 2.1,
        spriteMat,
      };
    });

    /** A smile as a thin tube along a downward-curving arc on the face. */
    const smileGeo = (half: number, drop: number) =>
      new THREE.TubeGeometry(
        new THREE.QuadraticBezierCurve3(
          new THREE.Vector3(-half, 0.3, 0.44),
          new THREE.Vector3(0, 0.3 - drop, 0.47),
          new THREE.Vector3(half, 0.3, 0.44),
        ),
        16,
        0.02,
        8,
      );

    const makeFrog = (scale: number, hero: boolean): Rig => {
      const group = new THREE.Group();
      group.scale.setScalar(scale);

      const bodyGeo = new THREE.SphereGeometry(0.5, 40, 30);
      const body = new THREE.Mesh(bodyGeo, ink);
      body.scale.set(1, 0.82, 0.95);
      body.position.y = 0.42;
      group.add(body);
      disposablesGeo.push(bodyGeo);

      const bellyGeo = new THREE.SphereGeometry(0.34, 28, 20);
      const belly = new THREE.Mesh(bellyGeo, accent);
      belly.scale.set(1, 0.8, 0.7);
      belly.position.set(0, 0.29, 0.21);
      group.add(belly);
      disposablesGeo.push(bellyGeo);

      const throatGeo = new THREE.SphereGeometry(0.1, 16, 12);
      const throat = new THREE.Mesh(throatGeo, accent);
      throat.scale.setScalar(0.6);
      throat.position.set(0, 0.16, 0.42);
      group.add(throat);
      disposablesGeo.push(throatGeo);

      const mouthGeo = new THREE.CircleGeometry(0.055, 12);
      const mouth = new THREE.Mesh(mouthGeo, ink);
      mouth.position.set(0, 0.27, 0.5);
      mouth.visible = false;
      group.add(mouth);
      disposablesGeo.push(mouthGeo);

      for (const side of [-1, 1]) {
        const hindGeo = new THREE.SphereGeometry(0.22, 20, 16);
        const hind = new THREE.Mesh(hindGeo, ink);
        hind.scale.set(0.9, 0.6, 1.2);
        hind.position.set(0.37 * side, 0.12, -0.27);
        group.add(hind);
        disposablesGeo.push(hindGeo);

        const frontGeo = new THREE.CapsuleGeometry(0.06, 0.14, 4, 10);
        const frontLeg = new THREE.Mesh(frontGeo, ink);
        frontLeg.position.set(0.31 * side, 0.1, 0.3);
        frontLeg.rotation.set(0.85, 0, -0.2 * side);
        group.add(frontLeg);
        disposablesGeo.push(frontGeo);

        const cheekGeo = new THREE.SphereGeometry(0.075, 12, 10);
        const cheek = new THREE.Mesh(cheekGeo, accent);
        cheek.scale.set(1, 0.66, 0.6);
        cheek.position.set(0.29 * side, 0.24, 0.34);
        group.add(cheek);
        disposablesGeo.push(cheekGeo);
      }

      const eyes = new THREE.Group();
      eyes.position.y = 0.72;
      group.add(eyes);

      const sclera: THREE.Mesh[] = [];
      const pupils: THREE.Mesh[] = [];
      const pupilBaseX: number[] = [];
      for (const side of [-1, 1]) {
        const ballGeo = new THREE.SphereGeometry(0.16, 20, 16);
        const ball = new THREE.Mesh(ballGeo, scleraMat);
        ball.position.set(0.19 * side, 0.1, 0.1);
        eyes.add(ball);
        sclera.push(ball);
        disposablesGeo.push(ballGeo);

        const pupilGeo = new THREE.SphereGeometry(0.075, 14, 12);
        const pupil = new THREE.Mesh(pupilGeo, ink);
        pupil.position.set(0.19 * side, 0.095, 0.21);
        eyes.add(pupil);
        pupils.push(pupil);
        pupilBaseX.push(0.19 * side);
        disposablesGeo.push(pupilGeo);

        // The catchlight: the one thing that never takes the theme's colours.
        const glintGeo = new THREE.SphereGeometry(0.028, 8, 8);
        const glint = new THREE.Mesh(glintGeo, catchlightMat);
        glint.position.set(0.22 * side, 0.135, 0.24);
        eyes.add(glint);
        disposablesGeo.push(glintGeo);
      }

      const smileSmallGeo = smileGeo(0.09, 0.03);
      const smileSmall = new THREE.Mesh(smileSmallGeo, ink);
      group.add(smileSmall);
      disposablesGeo.push(smileSmallGeo);

      const smileBigGeo = smileGeo(0.12, 0.055);
      const smileBig = new THREE.Mesh(smileBigGeo, ink);
      smileBig.visible = false;
      group.add(smileBig);
      disposablesGeo.push(smileBigGeo);

      return {
        group,
        body,
        belly,
        throat,
        mouth,
        sclera,
        pupils,
        eyes,
        smileSmall,
        smileBig,
        phase: Math.random() * Math.PI * 2,
        blinkAt: 1 + Math.random() * 3,
        blinkUntil: 0,
        hero,
        pupilBaseX,
      };
    };

    const padUvs = (geo: THREE.BufferGeometry, radius: number) => {
      const pos = geo.getAttribute("position") as THREE.BufferAttribute;
      const uv = new Float32Array(pos.count * 2);
      for (let i = 0; i < pos.count; i += 1) {
        uv[i * 2] = pos.getX(i) / (radius * 2) + 0.5;
        uv[i * 2 + 1] = pos.getY(i) / (radius * 2) + 0.5;
      }
      geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    };

    const makeStation = (
      x: number,
      z: number,
      padRadius: number,
      frogScale: number,
      rotation: number,
      hero: boolean,
    ): Station => {
      const group = new THREE.Group();
      group.position.set(x, 0, z);
      group.rotation.y = rotation;
      pond.add(group);

      const padGeo = new THREE.ShapeGeometry(
        (() => {
          const shape = new THREE.Shape();
          const notch = 0.45;
          const to = Math.PI * 2 - notch;
          const steps = 56;
          shape.moveTo(Math.cos(notch) * padRadius, Math.sin(notch) * padRadius);
          for (let i = 1; i <= steps; i += 1) {
            const angle = notch + ((to - notch) * i) / steps;
            shape.lineTo(Math.cos(angle) * padRadius, Math.sin(angle) * padRadius);
          }
          shape.lineTo(0, 0);
          shape.closePath();
          return shape;
        })(),
        24,
      );
      padUvs(padGeo, padRadius);
      const pad = new THREE.Mesh(padGeo, padMat);
      pad.rotation.x = -Math.PI / 2;
      pad.position.y = 0.02;
      group.add(pad);
      disposablesGeo.push(padGeo);

      const shadow = new THREE.Mesh(
        new THREE.CircleGeometry(padRadius * 0.66, 24),
        shadowMat,
      );
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.y = 0.035;
      group.add(shadow);
      disposablesGeo.push(shadow.geometry);

      const rig = makeFrog(frogScale, hero);
      rig.group.position.set(0, 0.05, 0);
      group.add(rig.group);

      return { group, rig, x, z, phase: Math.random() * Math.PI * 2 };
    };

    // The hero: front and centre, on the biggest pad, with its own glow.
    const heroStation = makeStation(0, 1.1, 1.15, 1, 0, true);
    const heroRig = heroStation.rig;
    const glow = new THREE.Mesh(new THREE.CircleGeometry(1.6, 48), glowMat);
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.006;
    heroStation.group.add(glow);
    disposablesGeo.push(glow.geometry);

    // The companions: smaller, further back, minding their own business.
    const stations: Station[] = [
      heroStation,
      makeStation(-1.75, -0.9, 0.85, 0.8, 0.55, false),
      makeStation(1.85, -0.45, 0.7, 0.64, -0.5, false),
      makeStation(-0.35, -2.15, 0.55, 0.46, 0.25, false),
    ];

    // A small lily bloom on the furthest pad.
    const bloom = new THREE.Group();
    const bloomPad = stations[3];
    const petalMat = new THREE.MeshBasicMaterial({ color: 0xfdf8ec });
    const bloomCoreMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(readHex("--primary")),
    });
    disposablesMat.push(petalMat, bloomCoreMat);
    for (let i = 0; i < 6; i += 1) {
      const angle = (Math.PI * 2 * i) / 6;
      const petalGeo = new THREE.SphereGeometry(0.07, 10, 8);
      const petal = new THREE.Mesh(petalGeo, petalMat);
      petal.scale.set(0.5, 0.12, 1.4);
      petal.position.set(Math.cos(angle) * 0.09, 0, Math.sin(angle) * 0.09);
      petal.rotation.z = -Math.PI / 2 + 0.3;
      bloom.add(petal);
      disposablesGeo.push(petalGeo);
    }
    const bloomCoreGeo = new THREE.SphereGeometry(0.045, 10, 8);
    const bloomCore = new THREE.Mesh(bloomCoreGeo, bloomCoreMat);
    bloom.add(bloomCore);
    disposablesGeo.push(bloomCoreGeo);
    bloom.position.set(0.2, 0.04, 0.1);
    bloomPad.group.add(bloom);

    // The SVG veins arrive asynchronously; the pads stay flat until they do.
    textureFromSvg(padSvg(), (texture) => {
      if (disposed) {
        texture.dispose();
        return;
      }
      padMat.map = texture;
      padMat.needsUpdate = true;
      disposablesTex.push(texture);
    });

    let heroMood: FrogMood = moodRef.current;
    let glowTarget = 0.35;
    let glowOpacity = 0;

    const setOpenEyes = (rig: Rig, open: boolean) => {
      rig.sclera.forEach((s) => {
        s.scale.y = open ? 1 : 0.14;
      });
      rig.pupils.forEach((p) => {
        p.visible = open;
      });
    };

    const setMoodPose = (rig: Rig, m: FrogMood) => {
      const eaten = m === "eaten";
      setOpenEyes(rig, !eaten);
      rig.smileSmall.visible = !eaten;
      rig.smileBig.visible = eaten;
      rig.eyes.rotation.x = eaten ? 0.22 : 0;
      rig.belly.scale.y = eaten ? 0.8 * 1.12 : 0.8;
      rig.body.scale.x = 1;
      rig.body.scale.z = 0.95;
    };

    let gulping = false;
    let gulpT = 0;
    let croaking = false;
    let croakT = 0;
    let nextCroakAt = 5 + Math.random() * 6;
    let celebrating = false;
    let celebrateAt = 0;
    let hopping = false;
    let hopT = 0;
    let nextHopAt = 7 + Math.random() * 5;
    const hopper = stations[2];

    applyMood.current = (m: FrogMood) => {
      heroMood = m;
      if (m === "eaten") {
        gulping = true;
        gulpT = 0;
        croaking = false;
        glowTarget = 1;
        // The whole pond approves.
        for (const station of stations.slice(1)) {
          station.rig.smileSmall.visible = false;
          station.rig.smileBig.visible = true;
        }
      } else {
        gulping = false;
        setMoodPose(heroRig, m);
        glowTarget = m === "chosen" ? 1 : 0.35;
        for (const station of stations.slice(1)) {
          station.rig.smileSmall.visible = true;
          station.rig.smileBig.visible = false;
        }
      }
    };

    const applyPalette = () => {
      ink.color.set(readHex("--foreground"));
      accent.color.set(readHex("--accent"));
      scleraMat.color.set(readHex("--background"));
      padMat.color.set(readHex("--primary")).multiplyScalar(0.9);
      waterMat.color.set(readHex("--primary"));
      backdropMat.color.set(readHex("--primary"));
      glowMat.color.set(readHex("--primary"));
      bloomCoreMat.color.set(readHex("--primary"));
      for (const mat of rippleMats) {
        mat.color.set(readHex("--primary"));
      }
      if (reduced) renderer.render(scene, camera);
    };
    applyPalette();

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);
    renderer.domElement.className = "absolute inset-0 h-full w-full";

    const resize = () => {
      const width = container.clientWidth || 1;
      const height = container.clientHeight || 1;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      // Narrow screens pull the camera back so the pond stays in frame.
      camera.position.z = camera.aspect < 2 ? 7.4 : 6.2;
      camera.updateProjectionMatrix();
      camera.lookAt(0, 0.45, 0);
    };
    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);

    const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    const onPointerMove = (event: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      const nx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = ((event.clientY - rect.top) / rect.height) * 2 - 1;
      pointer.tx = nx * 0.1;
      pointer.ty = ny * 0.08;
    };
    const onPointerLeave = () => {
      pointer.tx = 0;
      pointer.ty = 0;
    };
    container.addEventListener("pointermove", onPointerMove);
    container.addEventListener("pointerleave", onPointerLeave);

    let visible = true;
    const visibilityObserver = new IntersectionObserver(
      (entries) => {
        visible = entries[0]?.isIntersecting ?? true;
      },
      { threshold: 0 },
    );
    visibilityObserver.observe(container);

    const themeObserver = new MutationObserver(applyPalette);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme"],
    });

    const clock = new THREE.Clock();
    let t = 0;
    let frame = 0;

    const loop = () => {
      frame = requestAnimationFrame(loop);
      if (!visible) return;

      const dt = Math.min(clock.getDelta(), 0.05);
      t += dt;

      // --- the hero frog ------------------------------------------------
      if (gulping) {
        // Eat the frog: squash, swallow, stretch, settle — then satisfied.
        gulpT += dt / 0.95;
        const p = Math.min(gulpT, 1);
        const bite = Math.sin(Math.PI * p);
        heroRig.body.scale.y = 0.82 * (1 - 0.12 * bite + 0.1 * Math.sin(p * Math.PI * 2));
        heroRig.body.scale.x = 1 + 0.1 * bite;
        heroRig.body.scale.z = 0.95 * (1 + 0.1 * bite);
        heroRig.belly.scale.y = 0.8 * (1 + 0.32 * bite);
        heroRig.body.position.y = 0.42 + 0.06 * bite;
        const closed = p > 0.3;
        heroRig.eyes.rotation.x = 0.22 * Math.min(1, p * 2);
        setOpenEyes(heroRig, !closed);
        heroRig.smileSmall.visible = !closed;
        heroRig.smileBig.visible = closed;
        if (!celebrating) {
          celebrating = true;
          celebrateAt = t;
        }
        if (p >= 1) {
          gulping = false;
          setMoodPose(heroRig, "eaten");
        }
      } else if (heroMood === "eaten") {
        // Content, not busy: a slow settle of the belly.
        heroRig.body.scale.y = 0.82 * (1 + 0.015 * Math.sin(t * 1.6));
        heroRig.body.position.y = 0.42 + 0.012 * Math.sin(t * 2.2);
      } else {
        const breathe = 1 + 0.02 * Math.sin(t * 1.7);
        heroRig.body.scale.y = 0.82 * breathe;
        heroRig.body.position.y = 0.42;
        heroRig.eyes.rotation.y =
          0.14 * Math.sin(t * 0.5) + pointer.x * 0.3;
        heroRig.eyes.rotation.x = pointer.y * -0.2;

        // The occasional croak: throat swells, eyes close, mouth opens.
        if (!croaking && t >= nextCroakAt) {
          croaking = true;
          croakT = 0;
        }
        if (croaking) {
          croakT += dt / 1.05;
          const swell = Math.sin(Math.PI * Math.min(croakT, 1));
          heroRig.throat.scale.setScalar(0.6 + 1.05 * swell);
          heroRig.mouth.visible = true;
          heroRig.mouth.scale.setScalar(0.5 + 0.6 * swell);
          setOpenEyes(heroRig, croakT < 0.25 || croakT > 0.75);
          heroRig.body.rotation.z = 0.025 * Math.sin(croakT * Math.PI * 6) * (1 - croakT);
          if (croakT >= 1) {
            croaking = false;
            heroRig.throat.scale.setScalar(0.6);
            heroRig.mouth.visible = false;
            heroRig.body.rotation.z = 0;
            nextCroakAt = t + 12 + Math.random() * 10;
          }
        } else {
          heroRig.body.rotation.z = 0;
          if (t > heroRig.blinkAt && t < heroRig.blinkUntil) {
            setOpenEyes(heroRig, false);
          } else {
            setOpenEyes(heroRig, true);
            if (t >= heroRig.blinkUntil) {
              heroRig.blinkAt = t + 2.5 + Math.random() * 3.5;
              heroRig.blinkUntil = heroRig.blinkAt + 0.16;
            }
          }
        }
      }

      // The hero's pupils follow the pointer.
      const trackX = THREE.MathUtils.clamp(pointer.x * 0.4, -0.035, 0.035);
      const trackY = THREE.MathUtils.clamp(pointer.y * 0.3, -0.02, 0.02);
      heroRig.pupils.forEach((pupil, i) => {
        pupil.position.x = heroRig.pupilBaseX[i] + trackX;
        pupil.position.y = 0.095 + trackY;
      });

      // --- the companions -----------------------------------------------
      for (const station of stations.slice(1)) {
        const rig = station.rig;
        rig.body.scale.y = 0.82 * (1 + 0.02 * Math.sin(t * 1.7 + rig.phase));
        rig.eyes.rotation.y = 0.1 * Math.sin(t * 0.5 + rig.phase);
        if (t > rig.blinkAt && t < rig.blinkUntil) {
          setOpenEyes(rig, false);
        } else {
          setOpenEyes(rig, true);
          if (t >= rig.blinkUntil) {
            rig.blinkAt = t + 3 + Math.random() * 4;
            rig.blinkUntil = rig.blinkAt + 0.16;
          }
        }
      }

      // One companion hops now and then, and rings the water on landing.
      if (!hopping && t >= nextHopAt) {
        hopping = true;
        hopT = 0;
      }
      if (hopping) {
        hopT += dt / 0.55;
        if (hopT >= 1) {
          hopping = false;
          nextHopAt = t + 9 + Math.random() * 6;
          hopper.rig.group.position.y = 0.05;
          ripples[0].t = 0;
          ripples[0].mesh.position.set(hopper.x, 0, hopper.z);
        } else {
          hopper.rig.group.position.y = 0.05 + Math.sin(Math.PI * hopT) * 0.35;
        }
      }

      // A single celebratory bounce while the frog is being eaten.
      if (celebrating && !gulping) {
        const elapsed = (t - celebrateAt) / 0.55;
        if (elapsed >= 1) {
          celebrating = false;
          stations[1].rig.group.position.y = 0.05;
        } else {
          stations[1].rig.group.position.y = 0.05 + Math.sin(elapsed * Math.PI) * 0.3;
        }
      }

      // --- the water -----------------------------------------------------
      for (const ripple of ripples) {
        ripple.t += dt / 4.4;
        if (ripple.t >= 1) {
          ripple.t = 0;
          ripple.mesh.position.set(0, 0, 0);
        }
        const r = ripple.t;
        ripple.mesh.scale.setScalar(0.25 + r * 3.4);
        ripple.mat.opacity = 0.12 * (1 - r);
      }

      for (const glint of glints) {
        const wave = Math.max(0, Math.sin(t * glint.speed + glint.phase));
        glint.mat.opacity = 0.12 + 0.6 * wave * wave;
        glint.mesh.scale.setScalar(0.8 + 0.5 * wave);
      }

      for (const fly of fireflies) {
        fly.group.position.set(
          fly.fx + Math.sin(t * fly.speed + fly.phase) * 1.5,
          0.55 + Math.sin(t * fly.speed * 1.31 + fly.phase) * 0.28,
          fly.fz + Math.cos(t * fly.speed * 0.83 + fly.phase) * 1.2,
        );
        fly.spriteMat.opacity = 0.5 + 0.4 * Math.sin(t * 3 + fly.phase);
      }

      // Pads ride the water; the bloom sways on its own.
      for (const station of stations) {
        station.group.position.y = 0.02 + Math.sin(t * 0.9 + station.phase) * 0.012;
      }
      bloom.rotation.z = 0.1 * Math.sin(t * 0.8 + 1.3);

      glowOpacity += (glowTarget - glowOpacity) * Math.min(1, dt * 4);
      glowMat.opacity = 0.24 * glowOpacity;

      pointer.x += (pointer.tx - pointer.x) * 0.06;
      pointer.y += (pointer.ty - pointer.y) * 0.06;
      pond.rotation.y = pointer.x;
      pond.rotation.x = -pointer.y * 0.7;

      // The camera breathes, very slowly.
      camera.position.x = Math.sin(t * 0.08) * 0.14;
      camera.position.y = 2.1 + Math.sin(t * 0.11) * 0.06;
      camera.lookAt(0, 0.45, 0);

      renderer.render(scene, camera);
    };

    if (reduced) {
      setMoodPose(heroRig, moodRef.current);
      renderer.render(scene, camera);
    } else {
      applyMood.current(moodRef.current);
      loop();
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      visibilityObserver.disconnect();
      themeObserver.disconnect();
      container.removeEventListener("pointermove", onPointerMove);
      container.removeEventListener("pointerleave", onPointerLeave);
      for (const geo of disposablesGeo) geo.dispose();
      for (const mat of disposablesMat) mat.dispose();
      for (const mat of rippleMats) mat.dispose();
      for (const tex of disposablesTex) tex.dispose();
      renderer.domElement.remove();
      renderer.dispose();
    };
  }, []);

  useEffect(() => {
    moodRef.current = mood;
    applyMood.current(mood);
  }, [mood]);

  return (
    <div ref={containerRef} aria-hidden className={className}>
      {webglFailed && (
        <div className="flex h-full w-full items-center justify-center">
          <Frog eaten={mood === "eaten"} className="h-14 w-auto" />
        </div>
      )}
    </div>
  );
}

export default FrogPond;
