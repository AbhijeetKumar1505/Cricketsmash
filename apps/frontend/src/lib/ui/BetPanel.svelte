<script lang="ts">
  import { gsap } from 'gsap';
  import { playBlip } from '../gameAudio';

  let {
    amount = $bindable(10),
    autoCashout = $bindable(2.0),
    disabled = false,
    balance = 1000,
    onMainAction = () => {},
    actionState = 'bet' as 'bet' | 'cashout' | 'cancel' | 'waiting' | 'betting' | 'watching' | 'next',
    payout = 0,
    accentColor = '#a78bfa',
    accentRgb = '167,139,250',
    mode = 'OVER' as 'OVER' | 'POWERPLAY',
    onCashout = () => {},
    onModeChange = (_mode: 'OVER' | 'POWERPLAY') => {},
  } = $props<{
    amount: number;
    autoCashout: number | null;
    disabled?: boolean;
    balance: number;
    onMainAction?: () => void;
    onCashout?: () => void;
    onModeChange?: (mode: 'OVER' | 'POWERPLAY') => void;
    actionState?: 'bet' | 'cashout' | 'cancel' | 'waiting' | 'betting' | 'watching' | 'next';
    mode?: 'OVER' | 'POWERPLAY';
    payout?: number;
    profitMultiplier?: number; // Added: relative profit for current bet
    accentColor?: string;
    accentRgb?: string;
  }>();

  let mainBtn = $state<HTMLElement>();

  function adjust(fn: (v: number) => number) {
    if (disabled && actionState !== 'cashout') return;
    amount = Math.max(1, fn(amount));
    playBlip(520, 0.05);
  }

  function handleChipClick(delta: number, btnEl: HTMLElement | null) {
    adjust(v => v + delta);
    if (btnEl) {
      gsap.fromTo(btnEl,
        { scale: 0.88, filter: 'brightness(1.8)' },
        { scale: 1, filter: 'brightness(1)', duration: 0.3, ease: 'back.out(2.5)' }
      );
    }
  }

  function handleMainDown() {
    if (!mainBtn || actionState === 'waiting' || actionState === 'betting' || actionState === 'watching') return;
    gsap.to(mainBtn, { scale: 0.94, duration: 0.1, ease: 'power2.out' });
  }

  function handleMainUp() {
    if (!mainBtn) return;
    gsap.to(mainBtn, { scale: 1, duration: 0.25, ease: 'back.out(2)' });
  }

  function handleMainClick() {
    if (actionState === 'waiting' || actionState === 'betting' || actionState === 'watching') return;
    playBlip(actionState === 'cashout' ? 700 : actionState === 'next' ? 480 : 400, 0.06);
    
    if (actionState === 'cashout' && onCashout) {
      onCashout();
      return;
    }

    if (mainBtn && actionState === 'bet') {
      gsap.fromTo(mainBtn,
        { filter: 'brightness(1.8)' },
        { filter: 'brightness(1)', duration: 0.35, ease: 'power2.out' }
      );
    }
    onMainAction();
  }

  const quickDeltas = [1, 5, 10, 25];

  const isLocked = $derived(
    actionState === 'waiting' || actionState === 'betting' || actionState === 'watching'
  );

  const mainBtnStyle = $derived.by(() => {
    if (actionState === 'cashout') {
      return `background: linear-gradient(135deg, #4a2800 0%, #ffc800 100%); color: #0a0500; font-weight: 900; box-shadow: 0 0 40px rgba(255,200,0,0.55), 0 0 80px rgba(255,200,0,0.2), 0 4px 20px rgba(0,0,0,0.5); border-color: rgba(255,200,0,0.6);`;
    }
    if (actionState === 'cancel') {
      return `background: linear-gradient(135deg, #5a0010 0%, #ff1e3c 100%); color: white; box-shadow: 0 0 25px rgba(255,30,60,0.4); border-color: rgba(255,30,60,0.4);`;
    }
    if (actionState === 'next') {
      return `background: linear-gradient(135deg, #001a3a 0%, #0066ff 100%); color: white; font-weight: 900; box-shadow: 0 0 30px rgba(0,102,255,0.45), 0 4px 20px rgba(0,0,0,0.5); border-color: rgba(0,102,255,0.6); cursor: pointer;`;
    }
    if (actionState === 'betting') {
      return `background: linear-gradient(135deg, #0d1f0d 0%, #003a0f 100%); color: #00ff88; border-color: rgba(0,255,136,0.25); cursor: default; opacity: 0.85;`;
    }
    if (actionState === 'watching') {
      return `background: linear-gradient(135deg, #0d0d0d 0%, #1a1a2e 100%); color: rgba(${accentRgb}, 0.9); border-color: rgba(${accentRgb}, 0.3); cursor: default;`;
    }
    if (actionState === 'waiting') {
      return `background: #0a1220; color: #334155; border-color: #1a2438; cursor: default;`;
    }
    // 'bet' default (also used for 'bet_again')
    return `background: linear-gradient(135deg, #003320 0%, #00ff88 100%); color: #001a0f; font-weight: 900; box-shadow: 0 0 35px rgba(0,255,136,0.45), 0 0 70px rgba(0,255,136,0.15), 0 4px 20px rgba(0,0,0,0.5); border-color: rgba(0,255,136,0.55); cursor: pointer;`;
  });

  const mainBtnLabel = $derived.by(() => {
    if (actionState === 'bet') return 'PLACE BET';
    if (actionState === 'cashout') return 'CASHOUT NOW';
    if (actionState === 'waiting') return 'WAITING...';
    if (actionState === 'betting') return 'BETTING...';
    if (actionState === 'watching') return 'WATCHING OVER';
    if (actionState === 'next') return 'DISMISS';
    if (actionState === 'cancel') return 'CANCEL';
    return 'PLACE BET';
  });
</script>

<div
  class="bet-panel glass-panel p-5 rounded-3xl border relative overflow-hidden flex flex-col gap-5"
  class:live={actionState === 'watching' || actionState === 'betting'}
  style="
    border-color: rgba({accentRgb}, calc(0.08 + {actionState === 'cashout' ? 0.3 : actionState === 'watching' ? 0.25 : 0}));
    box-shadow: 0 8px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba({accentRgb}, {actionState === 'watching' ? 0.12 : 0.04});
    transition: border-color 0.5s ease, box-shadow 0.5s ease;
  "
>
  <!-- Reactive top shine bar -->
  <div
    class="absolute top-0 left-0 right-0 h-px pointer-events-none"
    style="background: linear-gradient(90deg, transparent, rgba({accentRgb}, {actionState === 'watching' ? 0.6 : 0.35}), transparent); transition: opacity 0.4s ease"
  ></div>

  <!-- Live game overlay glow (when watching) -->
  {#if actionState === 'watching' || actionState === 'betting'}
    <div
      class="absolute inset-0 pointer-events-none rounded-3xl"
      style="box-shadow: inset 0 0 40px rgba({accentRgb}, 0.07); animation: panel-breathe 1.8s ease-in-out infinite;"
    ></div>
  {/if}

  <!-- Mode Selector -->
  <div class="flex p-1 bg-surface-container-high rounded-2xl border border-white/5">
    <button
      class="flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all"
      style="background: {mode === 'OVER' ? `rgba(${accentRgb}, 0.15)` : 'transparent'}; 
             color: {mode === 'OVER' ? accentColor : 'rgba(255,255,255,0.3)'};"
      onclick={() => onModeChange?.('OVER')}
      disabled={disabled}
    >
      Regular (6 Balls)
    </button>
    <button
      class="flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all"
      style="background: {mode === 'POWERPLAY' ? `rgba(${accentRgb}, 0.15)` : 'transparent'}; 
             color: {mode === 'POWERPLAY' ? accentColor : 'rgba(255,255,255,0.3)'};"
      onclick={() => onModeChange?.('POWERPLAY')}
      disabled={disabled}
    >
      Bonus (1 Ball)
    </button>
  </div>

  <!-- Stake Amount Section -->
  <div>
    <div class="flex justify-between items-center mb-3">
      <label for="stake-input" class="font-label font-bold text-[10px] text-on-surface-variant/60 uppercase tracking-widest">
        Stake
      </label>
      <div class="flex gap-1.5">
        <button
          class="text-[9px] font-bold px-2.5 py-1 rounded-lg border transition-all active:scale-95 hover:brightness-125"
          style="background: rgba({accentRgb}, 0.08); color: {accentColor}; border-color: rgba({accentRgb}, 0.2)"
          onclick={() => adjust(() => 1)}
          disabled={disabled}
        >MIN</button>
        <button
          class="text-[9px] font-bold px-2.5 py-1 rounded-lg border transition-all active:scale-95 hover:brightness-125"
          style="background: rgba({accentRgb}, 0.08); color: {accentColor}; border-color: rgba({accentRgb}, 0.2)"
          onclick={() => adjust(() => balance)}
          disabled={disabled}
        >MAX</button>
      </div>
    </div>

    <div class="relative group">
      <span class="absolute left-4 top-1/2 -translate-y-1/2 font-black text-lg" style="color: {accentColor}">$</span>
      <input
        id="stake-input"
        class="w-full bg-surface-container-lowest border rounded-2xl py-3.5 pl-10 pr-16 text-2xl font-black text-on-surface focus:outline-none transition-all"
        style="border-color: rgba({accentRgb}, 0.12);"
        type="number"
        bind:value={amount}
        disabled={disabled}
        min="1"
        onfocus={(e) => (e.target as HTMLInputElement).style.setProperty('border-color', `rgba(${accentRgb}, 0.4)`)}
        onblur={(e) => (e.target as HTMLInputElement).style.setProperty('border-color', `rgba(${accentRgb}, 0.12)`)}
      />
      <span class="absolute right-4 top-1/2 -translate-y-1/2 font-label font-bold text-on-surface-variant/30 text-xs">USD</span>

      <!-- Quick Adjust -->
      <div class="absolute right-20 top-1/2 -translate-y-1/2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button class="bg-surface-container-high hover:bg-surface-bright px-2 py-1 rounded text-[10px] font-bold active:scale-95" onclick={() => adjust(v => Math.max(1, v/2))} disabled={disabled}>½</button>
        <button class="bg-surface-container-high hover:bg-surface-bright px-2 py-1 rounded text-[10px] font-bold active:scale-95" onclick={() => adjust(v => v*2)} disabled={disabled}>2×</button>
      </div>
    </div>

    <!-- Quick Chips — click adds to current amount -->
    <div class="flex gap-2 mt-3 overflow-x-auto no-scrollbar pb-0.5">
      {#each quickDeltas as delta}
        <button
          class="chip-btn flex-shrink-0 px-4 py-2 rounded-xl text-[10px] font-black transition-all"
          style="
            background: rgba({accentRgb}, 0.08);
            border: 1px solid rgba({accentRgb}, 0.18);
            color: {accentColor};
          "
          onclick={(e) => handleChipClick(delta, e.currentTarget as HTMLElement)}
          disabled={disabled}
        >+${delta}</button>
      {/each}
    </div>
  </div>

  <!-- Main Action Button -->
  <div class="z-20">
    <button
      bind:this={mainBtn}
      class="w-full py-5 rounded-2xl border transition-all active:scale-95 btn-shimmer flex flex-col items-center gap-1"
      style={mainBtnStyle}
      onmousedown={handleMainDown}
      onmouseup={handleMainUp}
      onclick={handleMainClick}
      disabled={isLocked && actionState !== 'cashout'}
    >
      <span class="text-xs font-label font-bold tracking-[0.3em] uppercase opacity-70">
        {actionState === 'cashout' ? 'PROFIT' : 'ACTION'}
      </span>
      <span class="text-xl font-headline font-black tracking-widest uppercase">
        {mainBtnLabel}
      </span>
      {#if actionState === 'cashout'}
        <span class="text-sm font-headline font-black bg-black/20 px-3 py-0.5 rounded-full mt-1">
          ${payout.toFixed(2)}
        </span>
      {/if}
    </button>
  </div>
</div>

<style>
  input::-webkit-outer-spin-button,
  input::-webkit-inner-spin-button {
    -webkit-appearance: none;
    appearance: none;
    margin: 0;
  }
  input[type=number] {
    -moz-appearance: textfield;
    appearance: textfield;
  }

  .chip-btn {
    transition: transform 0.15s ease, filter 0.15s ease;
    will-change: transform;
  }
  .chip-btn:hover:not(:disabled) {
    filter: brightness(1.25);
  }
  .chip-btn:active:not(:disabled) {
    transform: scale(0.92);
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  @keyframes live-pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.5; transform: scale(0.7); }
  }

  @keyframes panel-breathe {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
  }
</style>
