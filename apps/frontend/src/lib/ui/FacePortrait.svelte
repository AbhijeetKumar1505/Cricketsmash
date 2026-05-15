<script lang="ts">
  import type { AvatarProfile } from '../../characters/human/AvatarGallery.js';

  let { avatar, width = 120, height = 180 }: {
    avatar: AvatarProfile;
    width?: number;
    height?: number;
  } = $props();

  // ── Helpers ────────────────────────────────────────────────────────────────
  function hex(n: number): string {
    return '#' + n.toString(16).padStart(6, '0');
  }
  function darken(n: number, f = 0.76): string {
    const r = Math.min(255, Math.round(((n >> 16) & 0xff) * f));
    const g = Math.min(255, Math.round(((n >> 8)  & 0xff) * f));
    const b = Math.min(255, Math.round( (n        & 0xff) * f));
    return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
  }

  // ── Coordinate constants (independent of avatar) ───────────────────────────
  const cx = 60;
  const cy = 72;
  const RX = 30;  // base head half-width (near-circular matches 3D hrx≈hry≈0.16m)
  const RY = 30;

  // ── All avatar-dependent computations in one reactive block ───────────────
  // Using $derived.by so every value updates when avatar prop changes.
  const f = $derived.by(() => {
    const fp = avatar.face;

    // FaceProfile parameters (same defaults as HumanCharacter.ts)
    const jawWidth    = fp?.jawWidth    ?? 1.00;
    const cheekFull   = fp?.cheekFull   ?? 0.20;
    const foreheadH   = fp?.foreheadH   ?? 1.00;
    const noseW       = fp?.noseW       ?? 1.00;
    const noseL       = fp?.noseL       ?? 1.00;
    const eyeScale    = fp?.eyeScale    ?? 1.00;
    const eyeSpacing  = fp?.eyeSpacing  ?? 1.00;
    const browThick   = fp?.browThick   ?? 1.00;
    const browTilt    = fp?.browTilt    ?? 0.00;
    const browHeight  = fp?.browHeight  ?? 0.00;
    const mouthW      = fp?.mouthW      ?? 1.00;
    const mouthYShift = fp?.mouthYShift ?? 0.00;

    // Head geometry
    const rx    = RX * jawWidth;
    const ryTop = RY * foreheadH;
    const ryBot = RY;
    const ckX   = rx * cheekFull * 0.18;  // cheek bulge

    // ── Feature positions — same ratios as HumanCharacter.ts ──────────────
    // 3D: eyeY = hry*0.10 above center  →  SVG: cy - RY*0.10
    const eyeY    = cy   - RY * 0.10;
    // 3D: eyeX = hrx*0.34*eyeSpacing    →  SVG: ±RX*0.34*eyeSpacing
    const eyeXOff = RX   * 0.34 * eyeSpacing;
    // Eye disc radii (slightly enlarged vs 3D ratios for portrait readability)
    const eW      = RX   * 0.136 * eyeScale;
    const eH      = RY   * 0.204 * eyeScale;

    // 3D: browX = ±hrx*0.31
    const browCXL = cx   - RX * 0.31;
    const browCXR = cx   + RX * 0.31;
    // 3D: browY = eyeY + hry*(0.068+browHeight) above center
    const browY   = eyeY - RY * (0.068 + browHeight);
    const browW   = RX   * 0.30 * Math.min(1.0 + (browThick - 1.0) * 0.40, 1.5);
    const browH   = Math.max(2.0, 3.8 * browThick);
    // browDeg: base 0.28 rad tilt minus avatar offset; sign inverted per side for SVG Y-flip
    const browDeg = (0.28 - browTilt) * (180 / Math.PI);

    // 3D: nose at -hry*0.07 below center  →  SVG: cy + RY*0.07
    const noseY    = cy  + RY * 0.07;
    const nRx      = Math.max(1.8, RX * 0.10 * noseW);
    const nRy      = Math.max(2.2, RY * 0.085 * noseL);
    const nostrOff = RX  * 0.055 * noseW;
    const nostrY   = noseY + nRy * 0.75;
    const nostrR   = Math.max(1.0, RX * 0.030 * noseW);

    // 3D: mouthY = -hry*(0.44-mYShift*0.06)  →  SVG: cy + RY*(0.44-mYShift*0.06)
    const mouthY   = cy  + RY * (0.44 - mouthYShift * 0.06);
    const mHalf    = RX  * 0.58 * mouthW;

    // Colors
    const skinH    = hex(avatar.skinColor);
    const skinD    = darken(avatar.skinColor, 0.74);
    const hairH    = hex(avatar.hairColor);
    const shirtH   = hex(avatar.shirtColor);
    const shortsH  = hex(avatar.shortsColor);
    const eyeH     = hex(avatar.eyeColor);
    const uid      = avatar.id;

    // Hair base Y (top of head)
    const hairBase = cy - ryTop;

    // ── Path generators ──────────────────────────────────────────────────────
    function headPath(): string {
      const tY  = cy - ryTop;
      const bY  = cy + ryBot * 0.94;
      const mxX = rx + ckX;
      const jwX = rx * 0.70;
      return (
        `M ${cx} ${tY} ` +
        `C ${cx + rx * 0.82} ${tY}  ${cx + mxX} ${cy - ryTop * 0.28}  ${cx + mxX} ${cy} ` +
        `C ${cx + mxX} ${cy + ryBot * 0.50}  ${cx + jwX * 0.52} ${cy + ryBot * 0.86}  ${cx} ${bY} ` +
        `C ${cx - jwX * 0.52} ${cy + ryBot * 0.86}  ${cx - mxX} ${cy + ryBot * 0.50}  ${cx - mxX} ${cy} ` +
        `C ${cx - mxX} ${cy - ryTop * 0.28}  ${cx - rx * 0.82} ${tY}  ${cx} ${tY} Z`
      );
    }

    function standardCap(rise = 12): string {
      const hw  = rx * 1.06 + ckX;
      const top = hairBase - rise;
      return (
        `M ${cx - hw} ${hairBase + 5} ` +
        `C ${cx - hw * 1.14} ${hairBase + 1}  ${cx - hw * 0.72} ${top}  ${cx} ${top} ` +
        `C ${cx + hw * 0.72} ${top}  ${cx + hw * 1.14} ${hairBase + 1}  ${cx + hw} ${hairBase + 5} Z`
      );
    }

    function pompadourCap(): string {
      const hw = rx + ckX;
      return (
        `M ${cx - hw * 0.48} ${hairBase + 6} ` +
        `C ${cx - hw * 0.12} ${hairBase - 6}  ${cx + hw * 0.22} ${hairBase - 26}  ${cx + hw * 0.40} ${hairBase - 40} ` +
        `C ${cx + hw * 0.60} ${hairBase - 38}  ${cx + hw * 0.72} ${hairBase - 20}  ${cx + hw * 0.86} ${hairBase + 2} ` +
        `C ${cx + hw * 1.06} ${hairBase + 4}  ${cx + hw * 0.68} ${hairBase + 7}  ${cx - hw * 0.48} ${hairBase + 6} Z`
      );
    }

    function flatTopCap(): string {
      const hw  = rx * 1.22 + ckX;
      return `M ${cx - hw} ${hairBase + 5} L ${cx - hw} ${hairBase - 8} L ${cx + hw} ${hairBase - 8} L ${cx + hw} ${hairBase + 5} Z`;
    }

    function spikyCap(): string {
      const hw = rx * 1.04 + ckX;
      return (
        `M ${cx - hw} ${hairBase + 5} ` +
        `L ${cx - hw * 0.66} ${hairBase - 22} ` +
        `L ${cx - hw * 0.30} ${hairBase + 1} ` +
        `L ${cx}             ${hairBase - 30} ` +
        `L ${cx + hw * 0.30} ${hairBase + 1} ` +
        `L ${cx + hw * 0.66} ${hairBase - 22} ` +
        `L ${cx + hw}        ${hairBase + 5} Z`
      );
    }

    function torsoPath(): string {
      const neckBot = cy + ryBot * 0.94;
      return (
        `M ${cx - 46} ${neckBot + 10} ` +
        `Q ${cx - 52} ${neckBot + 16}  ${cx - 44} ${neckBot + 22} ` +
        `L ${cx - 32} 180 L ${cx + 32} 180 ` +
        `L ${cx + 44} ${neckBot + 22} ` +
        `Q ${cx + 52} ${neckBot + 16}  ${cx + 46} ${neckBot + 10} Z`
      );
    }

    return {
      // geometry
      rx, ryTop, ryBot, ckX, hairBase,
      eyeY, eyeXOff, eW, eH,
      browCXL, browCXR, browY, browW, browH, browDeg,
      noseY, nRx, nRy, nostrOff, nostrY, nostrR,
      mouthY, mHalf,
      // avatar flags
      eyeScale,
      hairType: avatar.hairType,
      beardType: avatar.beardType,
      // colors
      skinH, skinD, hairH, shirtH, shortsH, eyeH, uid,
      // paths
      headPath: headPath(),
      standardCap12: standardCap(12),
      standardCap11: standardCap(11),
      standardCap4:  standardCap(4),
      pompadourCap:  pompadourCap(),
      flatTopCap:    flatTopCap(),
      spikyCap:      spikyCap(),
      torsoPath:     torsoPath(),
    };
  });
</script>

<!--
  SVG face portrait driven by AvatarProfile + FaceProfile.
  All feature positions use the exact same ratios as HumanCharacter.ts so
  the 2D card and 3D in-game character look identical.
-->
<svg viewBox="0 0 120 180" width={width} height={height} style="display:block">
  <defs>
    <radialGradient id="bg-{f.uid}" cx="50%" cy="78%" r="58%">
      <stop offset="0%"   stop-color={f.skinH} stop-opacity="0.22"/>
      <stop offset="100%" stop-color="#040412" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="hShd-{f.uid}" cx="33%" cy="26%" r="68%">
      <stop offset="0%"   stop-color="rgba(255,255,255,0.14)"/>
      <stop offset="55%"  stop-color="rgba(0,0,0,0)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0.22)"/>
    </radialGradient>
    <!-- Clip beard to lower-face region (below nose) -->
    <clipPath id="brd-{f.uid}">
      <rect
        x={cx - f.rx - 14} y={f.noseY - 4}
        width={(f.rx + 14) * 2} height={f.ryBot * 2 + 22}
      />
    </clipPath>
  </defs>

  <!-- ① Atmospheric skin-tone glow -->
  <rect width="120" height="180" fill="url(#bg-{f.uid})"/>

  <!-- ② Neck -->
  <rect x={cx - 7} y={cy + f.ryBot * 0.90} width="14" height="24" fill={f.skinH} rx="5"/>

  <!-- ③ Torso (shirt color) -->
  <path d={f.torsoPath} fill={f.shirtH} opacity="0.94"/>

  <!-- ④ Shorts strip at bottom -->
  <rect x={cx - 30} y="150" width="60" height="32" fill={f.shortsH} rx="3"/>

  <!-- ⑤ Ears — drawn before head so head edge overlaps them naturally -->
  <ellipse
    cx={cx - (f.rx + f.ckX) * 0.90} cy={cy + RY * 0.025}
    rx={RX * 0.20} ry={RY * 0.30}
    fill={f.skinH} opacity="0.86"
  />
  <ellipse
    cx={cx + (f.rx + f.ckX) * 0.90} cy={cy + RY * 0.025}
    rx={RX * 0.20} ry={RY * 0.30}
    fill={f.skinH} opacity="0.86"
  />

  <!-- ⑥ Head base -->
  <path d={f.headPath} fill={f.skinH} stroke={f.skinD} stroke-width="0.8"/>
  <path d={f.headPath} fill="url(#hShd-{f.uid})"/>

  <!-- ⑦ Beard (clipped to lower face) -->
  {#if f.beardType === 'full' || f.beardType === 'stubble'}
    {@const bFull = f.beardType === 'full'}
    <ellipse
      cx={cx} cy={cy + f.ryBot * 0.28}
      rx={f.rx * 0.88} ry={f.ryBot * (bFull ? 0.78 : 0.42)}
      fill={f.hairH}
      opacity={bFull ? 0.70 : 0.34}
      clip-path="url(#brd-{f.uid})"
    />
  {/if}

  <!-- ⑧ Hair per hairType -->
  {#if f.hairType === 'pompadour'}
    <path d={f.pompadourCap} fill={f.hairH}/>
  {:else if f.hairType === 'flat-top'}
    <path d={f.standardCap4} fill={f.hairH} opacity="0.88"/>
    <path d={f.flatTopCap}   fill={f.hairH}/>
    <!-- Undercut shadow line at disc / scalp boundary -->
    <rect
      x={cx - f.rx * 1.22 - f.ckX} y={f.hairBase - 1}
      width={(f.rx * 1.22 + f.ckX) * 2} height="2.5"
      fill={f.skinD} opacity="0.55"
    />
  {:else if f.hairType === 'spiky'}
    <path d={f.spikyCap} fill={f.hairH}/>
  {:else if f.hairType === 'side-part'}
    <g transform="rotate(-11 {cx} {cy})">
      <path d={f.standardCap11} fill={f.hairH}/>
    </g>
    <!-- Parting line -->
    <line
      x1={cx + 1} y1={f.hairBase + 4}
      x2={cx + f.rx * 0.36} y2={f.hairBase + 10}
      stroke={f.skinH} stroke-width="1.8" stroke-linecap="round" opacity="0.62"
    />
  {:else if f.hairType === 'standard'}
    <path d={f.standardCap12} fill={f.hairH}/>
  {:else}
    <!-- bald: crown specular shine only -->
    <ellipse
      cx={cx - f.rx * 0.10} cy={cy - f.ryTop * 0.50}
      rx={f.rx * 0.50} ry={f.ryTop * 0.18}
      fill="rgba(255,255,255,0.07)"
    />
  {/if}

  <!-- ⑨ Nose (shadow + highlight + nostril dots) -->
  <ellipse cx={cx} cy={f.noseY + f.nRy * 0.32}
    rx={f.nRx * 1.35} ry={f.nRy * 1.50} fill={f.skinD} opacity="0.26"/>
  <ellipse cx={cx} cy={f.noseY - f.nRy * 0.18}
    rx={f.nRx * 0.78} ry={f.nRy * 0.68} fill={f.skinH} opacity="0.72"/>
  <ellipse cx={cx - f.nostrOff} cy={f.nostrY}
    rx={f.nostrR} ry={f.nostrR * 0.62} fill="rgba(0,0,0,0.26)"/>
  <ellipse cx={cx + f.nostrOff} cy={f.nostrY}
    rx={f.nostrR} ry={f.nostrR * 0.62} fill="rgba(0,0,0,0.26)"/>

  <!-- ⑩ Eyebrows (tilt sign mirrors 3D rotation.z, inverted for SVG Y-axis flip) -->
  <!-- Left: negative SVG degrees = CCW = inner corner raised (matches 3D +Z rotation) -->
  <rect
    x={f.browCXL - f.browW / 2} y={f.browY - f.browH / 2}
    width={f.browW} height={f.browH}
    fill={f.hairH} rx="1.4"
    transform="rotate({-f.browDeg} {f.browCXL} {f.browY})"
  />
  <!-- Right: positive SVG degrees = CW = inner corner raised -->
  <rect
    x={f.browCXR - f.browW / 2} y={f.browY - f.browH / 2}
    width={f.browW} height={f.browH}
    fill={f.hairH} rx="1.4"
    transform="rotate({f.browDeg} {f.browCXR} {f.browY})"
  />

  <!-- ⑪ Left eye -->
  <ellipse cx={cx - f.eyeXOff} cy={f.eyeY} rx={f.eW * 1.55} ry={f.eH * 1.15} fill="#f5f0e8"/>
  <ellipse cx={cx - f.eyeXOff} cy={f.eyeY} rx={f.eW}         ry={f.eH}         fill={f.eyeH}/>
  <ellipse cx={cx - f.eyeXOff} cy={f.eyeY} rx={f.eW * 0.52}  ry={f.eH * 0.52}  fill="#050505"/>
  <!-- Iris highlight (matches 3D irisHlL offset) -->
  <ellipse
    cx={cx - f.eyeXOff + f.eW * 0.22} cy={f.eyeY - f.eH * 0.24}
    rx={f.eW * 0.30} ry={f.eH * 0.27}
    fill="rgba(255,255,255,0.58)"
  />
  <!-- Eyelash bar -->
  <rect
    x={cx - f.eyeXOff - f.eW * 1.58} y={f.eyeY - f.eH * 1.17}
    width={f.eW * 3.16} height={f.eH * 0.28}
    fill="#0a0604" rx="1" opacity="0.90"
  />
  <!-- Upper eyelid skin overlay — squinting for eyeScale < 0.92 (Kim, Trump, Putin) -->
  {#if f.eyeScale < 0.92}
    {@const lidH = (0.92 - f.eyeScale) * f.eH * 5.5}
    <rect
      x={cx - f.eyeXOff - f.eW * 1.58} y={f.eyeY - f.eH * 1.17}
      width={f.eW * 3.16} height={lidH}
      fill={f.skinH} rx="1.6"
    />
  {/if}

  <!-- ⑫ Right eye -->
  <ellipse cx={cx + f.eyeXOff} cy={f.eyeY} rx={f.eW * 1.55} ry={f.eH * 1.15} fill="#f5f0e8"/>
  <ellipse cx={cx + f.eyeXOff} cy={f.eyeY} rx={f.eW}         ry={f.eH}         fill={f.eyeH}/>
  <ellipse cx={cx + f.eyeXOff} cy={f.eyeY} rx={f.eW * 0.52}  ry={f.eH * 0.52}  fill="#050505"/>
  <ellipse
    cx={cx + f.eyeXOff + f.eW * 0.22} cy={f.eyeY - f.eH * 0.24}
    rx={f.eW * 0.30} ry={f.eH * 0.27}
    fill="rgba(255,255,255,0.58)"
  />
  <rect
    x={cx + f.eyeXOff - f.eW * 1.58} y={f.eyeY - f.eH * 1.17}
    width={f.eW * 3.16} height={f.eH * 0.28}
    fill="#0a0604" rx="1" opacity="0.90"
  />
  {#if f.eyeScale < 0.92}
    {@const lidH = (0.92 - f.eyeScale) * f.eH * 5.5}
    <rect
      x={cx + f.eyeXOff - f.eW * 1.58} y={f.eyeY - f.eH * 1.17}
      width={f.eW * 3.16} height={lidH}
      fill={f.skinH} rx="1.6"
    />
  {/if}

  <!-- ⑬ Mouth — upper + lower lip (matches HumanCharacter upperLip/lowerLip pair) -->
  <ellipse cx={cx} cy={f.mouthY - 1.6} rx={f.mHalf}        ry={2.2} fill="#1a0808"/>
  <ellipse cx={cx} cy={f.mouthY + 1.8} rx={f.mHalf * 0.86} ry={2.6} fill="#221010" opacity="0.82"/>
</svg>
