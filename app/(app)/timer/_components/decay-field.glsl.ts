/**
 * The face, as a signed-distance field.
 *
 * Everything here is drawn from two numbers — `uMacro` and `uMicro`, both
 * "fraction remaining", both 1 at the start and 0 when spent. They arrive fresh
 * every frame, recomputed from `Date.now()`; nothing in this shader eases,
 * interpolates or animates *toward* a value. What you see is the clock, not a
 * transition standing in for it.
 *
 * Two containers, drawn as concentric annuli:
 *
 *   macro  a thin outer ring — the whole plan, breaks included
 *   micro  a thick inner well — the interval you are in right now
 *
 * The middle is left empty on purpose: the digits sit there, and a filled
 * container behind warm-paper-coloured mono type is unreadable at this
 * contrast.
 *
 * Written against GLSL ES 1.00 (three's default for `ShaderMaterial`), so: no
 * dynamic loop bounds, no `switch`, and array indices must be constant. The
 * tick array is padded with a sentinel rather than bounded by a uniform, which
 * is what keeps the loop legal on ES 1.00 without a `break` on a uniform.
 */

export const VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    // The quad is already in clip space, so there is no model/view/projection
    // to apply. Skipping the matrices keeps the draw to a single attribute.
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

/** Ticks are padded out to this length with `TICK_SENTINEL`. */
export const MAX_TICKS = 12;

/**
 * Any negative value. The shader tests the sign to tell a real boundary from an
 * unused slot, which is how the loop draws the right number of gaps without
 * a bound it is not allowed to have on GLSL ES 1.00.
 */
export const TICK_SENTINEL = -1.0;

export const FRAGMENT_SHADER = /* glsl */ `
  precision highp float;

  varying vec2 vUv;

  uniform float uMacro;      // fraction of the whole plan remaining, 0..1
  uniform float uMicro;      // fraction of the current interval remaining, 0..1
  uniform float uOvertime;   // 0..1 past the goal, FLOW only
  uniform float uTime;       // seconds since mount; drives the flourish only
  uniform float uFlourish;   // 0 under prefers-reduced-motion, else 1
  uniform float uDual;       // 1 when both containers are worth drawing
  uniform vec2  uResolution; // drawing-buffer size in device pixels
  uniform vec3  uRun;        // the live colour: blue on focus, teal on a break
  uniform vec3  uTrack;      // the spent groove
  uniform float uTicks[${MAX_TICKS}];

  const float TAU = 6.283185307179586;

  // ---- geometry, in units where 1.0 is half the quad -----------------------

  const float MACRO_OUT = 0.905;
  const float MACRO_IN  = 0.845;
  const float WELL_OUT  = 0.800;
  const float WELL_IN   = 0.600;
  const float OVER_IN   = 0.930;
  const float OVER_OUT  = 0.965;

  // Half-width of the gap cut at an interval boundary, in turns.
  const float TICK_HALF = 0.0055;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  /** Antialiased annulus coverage. */
  float ring(float r, float inner, float outer, float aa) {
    return smoothstep(inner - aa, inner + aa, r)
         * (1.0 - smoothstep(outer - aa, outer + aa, r));
  }

  /**
   * Coverage of the wedge that is still to come.
   *
   * \`a\` runs 0..1 clockwise from twelve o'clock, so the remaining wedge is
   * always the leading \`f\` of the sweep and its boundary retreats
   * anticlockwise back toward twelve — which is the way a physical Time Timer
   * empties, and the reason the shape reads as "left" rather than "done".
   */
  float wedge(float a, float f, float aa) {
    // A full container has no boundary to draw. Without this the seam at
    // twelve o'clock gets a hairline of background through it.
    if (f >= 1.0) return 1.0;
    return 1.0 - smoothstep(f - aa, f + aa, a);
  }

  /** Standard source-over, so the layers can be stacked back to front. */
  vec4 over(vec4 dst, vec4 src) {
    float a = src.a + dst.a * (1.0 - src.a);
    vec3 c = (src.rgb * src.a + dst.rgb * dst.a * (1.0 - src.a)) / max(a, 1e-4);
    return vec4(c, a);
  }

  void main() {
    // -1..1 across the quad, origin at the centre.
    vec2 p = (vUv - 0.5) * 2.0;
    float r = length(p);

    // Angle measured clockwise from straight up. atan(x, y) rather than the
    // usual atan(y, x) is what rotates the origin to twelve o'clock, so no
    // -90deg correction is needed anywhere downstream.
    float a = atan(p.x, p.y) / TAU;
    if (a < 0.0) a += 1.0;

    // One device pixel, expressed in each coordinate. Deriving the angular
    // width from the radius instead of fwidth(a) keeps the twelve o'clock
    // seam — where the angle wraps and fwidth explodes — from smearing.
    float px  = 2.0 / uResolution.y;
    float aaR = px * 0.75;
    float aaA = px / max(r * TAU, 1e-3);

    vec4 col = vec4(0.0);

    // ---- the well, spent ---------------------------------------------------
    // Widen to fill the macro ring's space when there is only one scale to
    // show, so a plain countdown doesn't render as a thin ring adrift in a gap.
    float wellOut = mix(MACRO_OUT, WELL_OUT, uDual);

    float wellTrack = ring(r, WELL_IN, wellOut, aaR);
    // A soft darkening toward the inner lip: this is the whole "well" reading,
    // and the only thing standing in for the elevation the flat design budget
    // spends here.
    float depth = smoothstep(WELL_IN, wellOut, r);
    vec3 trackCol = uTrack * mix(0.88, 1.04, depth);
    col = over(col, vec4(trackCol, wellTrack));

    // ---- the well, remaining ----------------------------------------------
    float wellFill = wellTrack * wedge(a, uMicro, aaA);
    // Brighter toward the centre so the two containers stay distinguishable
    // without a legend, and so the shape has somewhere to fall off to.
    vec3 fillCol = uRun * mix(1.16, 0.92, depth);
    col = over(col, vec4(fillCol, wellFill));

    // The boundary itself: a short additive bloom that hugs the live edge from
    // the inside and falls off within a few degrees. This is the part that
    // cannot be done in SVG, and the reason the face is rendered rather than
    // transitioned.
    //
    // \`inside\` is load-bearing. Without it the falloff term reads 1.0 across
    // the whole spent arc — exp(0.0) — and the container glows brightest
    // exactly where nothing is left, which is the opposite of the thing being
    // communicated.
    float inside = step(a, uMicro);
    float behind = clamp(uMicro - a, 0.0, 1.0);
    float edge = exp(-behind * 46.0) * inside * wellFill
               * step(0.001, uMicro) * (1.0 - step(1.0, uMicro));
    col.rgb += uRun * edge * 0.45;

    // ---- the macro ring ----------------------------------------------------
    float macroTrack = ring(r, MACRO_IN, MACRO_OUT, aaR) * uDual;

    // Interval boundaries, cut clean through both the ring and its groove so
    // a three-pomodoro block is legible as three before anything has started.
    float gap = 0.0;
    for (int i = 0; i < ${MAX_TICKS}; i++) {
      float t = uTicks[i];

      // A real boundary is a fraction in 0..1; an unused slot is negative.
      // The guard cannot be folded into the distance below: \`min(d, 1.0 - d)\`
      // sends a large \`d\` negative, which then reads as *right on top of* a
      // tick and cuts the whole ring away.
      float live = step(0.0, t);

      // Nearest wrapped distance, so a boundary near the seam still cuts.
      float d = abs(a - t);
      d = min(d, 1.0 - d);

      float cut = 1.0 - smoothstep(TICK_HALF - aaA, TICK_HALF + aaA, d);
      gap = max(gap, cut * live);
    }
    macroTrack *= (1.0 - gap);

    col = over(col, vec4(uTrack, macroTrack));
    col = over(col, vec4(uRun, macroTrack * wedge(a, uMacro, aaA)));

    // ---- overtime ----------------------------------------------------------
    // Past the goal the face grows instead of draining. Overtime is
    // information, not failure, so it is drawn in the same live colour rather
    // than a warning one.
    float overRing = ring(r, OVER_IN, OVER_OUT, aaR) * step(0.0001, uOvertime);
    col = over(col, vec4(uRun, overRing * wedge(a, uOvertime, aaA)));

    // ---- surface -----------------------------------------------------------
    // Dither. Wide gamuts band badly across a gradient this shallow, and a
    // little noise is cheaper than more bits. It drifts only as a flourish;
    // the dithering itself stays on under reduced motion because it is there
    // to fix a rendering artefact, not to be seen.
    float drift = floor(uTime * 12.0) * uFlourish;
    col.rgb += (hash(gl_FragCoord.xy + drift) - 0.5) * 0.016 * col.a;

    // Nothing else here modulates over time. A face waiting to be started is
    // completely still, and so is a paused one — on a screen built for people
    // who are easily pulled off task, the only thing allowed to move
    // continuously is the quantity actually being measured.
    gl_FragColor = vec4(col.rgb, clamp(col.a, 0.0, 1.0));
  }
`;
