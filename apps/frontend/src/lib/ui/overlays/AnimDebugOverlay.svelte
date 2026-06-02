<script lang="ts">
  /**
   * AnimDebugOverlay — animation recovery debugger.
   * Toggle with Ctrl+Shift+A.
   * Remove before production.
   */
  import { animDebug } from '../../../game/animation/animDebugState.svelte.js';

  function boneColor(n: number): string {
    if (n === 0)  return '#ff4444';
    if (n < 20)   return '#ffaa00';
    return '#44ff88';
  }

  function fmtTime(t: number, dur: number): string {
    if (dur === 0) return '—';
    return `${t.toFixed(2)}s / ${dur.toFixed(2)}s`;
  }

  function fmtWeight(w: number): string {
    return (w * 100).toFixed(0) + '%';
  }

  function onKey(e: KeyboardEvent) {
    if (e.ctrlKey && e.shiftKey && e.key === 'A') {
      animDebug.active = !animDebug.active;
    }
  }
</script>

<svelte:window onkeydown={onKey} />

{#if animDebug.active}
  <div class="anim-debug">
    <div class="title">
      ANIM DEBUG <kbd>Ctrl+Shift+A</kbd>
      <span class="flag" class:on={animDebug.proceduralEnabled}>
        PROCEDURAL: {animDebug.proceduralEnabled ? 'ON' : 'OFF'}
      </span>
      {#if animDebug.locoTestMode}
        <span class="flag on">LOCO TEST</span>
      {/if}
    </div>

    <div class="row">
      <span class="label">BOWLER</span>
      <span class="val">clip: <b>{animDebug.bowlerClip}</b></span>
      <span class="val">FSM: <b>{animDebug.bowlerPhase}</b></span>
      <span class="bones" style="color:{boneColor(animDebug.bowlerBones)}">
        bones: <b>{animDebug.bowlerBones}</b>
      </span>
      <span class="val">
        mixer: <b class:active={animDebug.bowlerMixerActive}>{animDebug.bowlerMixerActive ? 'OK' : 'EMPTY'}</b>
      </span>
    </div>
    <div class="row sub">
      <span class="label"></span>
      <span class="val">t: <b>{fmtTime(animDebug.bowlerClipTime, animDebug.bowlerClipDuration)}</b></span>
      <span class="val">w: <b>{fmtWeight(animDebug.bowlerClipWeight)}</b></span>
    </div>

    <div class="row">
      <span class="label">BATSMAN</span>
      <span class="val">clip: <b>{animDebug.batsmanClip}</b></span>
      <span class="val">FSM: <b>{animDebug.batsmanPhase}</b></span>
      <span class="bones" style="color:{boneColor(animDebug.batsmanBones)}">
        bones: <b>{animDebug.batsmanBones}</b>
      </span>
    </div>
    <div class="row sub">
      <span class="label"></span>
      <span class="val">t: <b>{fmtTime(animDebug.batsmanClipTime, animDebug.batsmanClipDuration)}</b></span>
      <span class="val">w: <b>{fmtWeight(animDebug.batsmanClipWeight)}</b></span>
    </div>

    <div class="row">
      <span class="label">FIELDER[0]</span>
      <span class="val">clip: <b>{animDebug.fielderClip}</b></span>
    </div>

    {#if animDebug.bowlTestPhase !== '—'}
      <div class="cap-divider"></div>
      <div class="cap-test">
        <div class="ct-header">
          <span class="ct-label bowl">BOWL TEST</span>
          <span class="ct-name">{animDebug.bowlTestPhase}</span>
          {#if animDebug.bowlTestRelease}
            <span class="release-flash">● RELEASE</span>
          {/if}
        </div>
        <div class="ct-bar">
          <div class="ct-fill bowl" style="width:{animDebug.bowlTestT * 100}%"></div>
        </div>
      </div>
    {/if}

    {#if animDebug.capTestPhase !== '—'}
      <div class="cap-divider"></div>
      <div class="cap-test">
        <div class="ct-header">
          <span class="ct-label">CAP TEST</span>
          <span class="ct-name">{animDebug.capTestPhase}</span>
          <span class="ct-phase">{Math.floor(animDebug.capTestProgress * 6) + 1}/6</span>
        </div>
        <div class="ct-look">look for: {animDebug.capTestLookFor}</div>
        <div class="ct-bar">
          <div class="ct-fill" style="width:{animDebug.capTestProgress * 100}%"></div>
        </div>
      </div>
    {/if}
  </div>
{/if}

<style>
  .anim-debug {
    position: fixed;
    top: 8px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.85);
    border: 1px solid rgba(255,255,255,0.15);
    border-radius: 6px;
    padding: 8px 16px;
    font-family: monospace;
    font-size: 11px;
    color: #ccc;
    z-index: 9999;
    pointer-events: none;
    min-width: 540px;
  }

  .title {
    color: #666;
    font-size: 10px;
    letter-spacing: 0.08em;
    margin-bottom: 6px;
    display: flex;
    align-items: center;
    gap: 10px;
  }

  kbd {
    background: rgba(255,255,255,0.08);
    border-radius: 3px;
    padding: 0 4px;
    font-size: 9px;
    color: #888;
  }

  .flag {
    font-size: 9px;
    padding: 1px 5px;
    border-radius: 3px;
    background: rgba(255, 80, 80, 0.2);
    color: #ff6666;
    border: 1px solid rgba(255, 80, 80, 0.3);
  }

  .flag.on {
    background: rgba(80, 255, 120, 0.15);
    color: #44ff88;
    border-color: rgba(80, 255, 120, 0.3);
  }

  .row {
    display: flex;
    gap: 18px;
    margin-bottom: 2px;
    align-items: center;
  }

  .row.sub {
    margin-bottom: 6px;
    opacity: 0.75;
  }

  .label {
    width: 80px;
    color: #ffcc44;
    font-weight: bold;
    font-size: 10px;
    flex-shrink: 0;
  }

  .val { color: #999; }
  .val b { color: #eee; }
  .val b.active { color: #44ff88; }

  .bones b { font-weight: bold; }

  .cap-divider {
    margin: 8px 0 6px;
    border-top: 1px solid rgba(255,255,255,0.1);
  }

  .cap-test { font-size: 11px; }

  .ct-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 3px;
  }

  .ct-label {
    font-size: 9px;
    padding: 1px 5px;
    border-radius: 3px;
    background: rgba(255, 200, 0, 0.15);
    color: #ffcc44;
    border: 1px solid rgba(255, 200, 0, 0.3);
    font-weight: bold;
    flex-shrink: 0;
  }

  .ct-name {
    color: #fff;
    font-weight: bold;
    font-size: 13px;
  }

  .ct-phase {
    color: #666;
    font-size: 10px;
    margin-left: auto;
  }

  .ct-look {
    color: #888;
    font-size: 10px;
    margin-bottom: 5px;
  }

  .ct-bar {
    height: 3px;
    background: rgba(255,255,255,0.1);
    border-radius: 2px;
    overflow: hidden;
  }

  .ct-fill {
    height: 100%;
    background: #44ff88;
    border-radius: 2px;
    transition: width 0.05s linear;
  }

  .ct-label.bowl {
    background: rgba(255, 140, 0, 0.15);
    color: #ff9922;
    border-color: rgba(255, 140, 0, 0.3);
  }

  .ct-fill.bowl { background: #ff9922; }

  .release-flash {
    margin-left: auto;
    font-size: 10px;
    color: #ff4444;
    font-weight: bold;
    animation: flash 0.12s steps(1) infinite;
  }

  @keyframes flash {
    50% { opacity: 0; }
  }
</style>
