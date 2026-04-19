<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import {
    game,
    initGame,
    destroyGame,
  } from './core/gameController.svelte.js';
  import GamePage from './pages/GamePage.svelte';

  onMount(() => {
    initGame();
  });

  onDestroy(() => {
    destroyGame();
  });
</script>

<div class="app-root">
  {#if game.phase === 'initializing'}
    <div class="auth-gate">
      <div class="auth-spinner"></div>
      <p class="auth-msg">Connecting to game server…</p>
    </div>
  {:else if game.phase === 'error'}
    <div class="auth-gate">
      <div class="auth-error-icon">⚠️</div>
      <p class="auth-msg auth-error">{game.errorMessage ?? 'Connection failed'}</p>
      <button class="retry-btn" onclick={() => initGame()}>Retry</button>
    </div>
  {:else}
    <GamePage />
  {/if}

</div>

<style>
  :global(html),
  :global(body) {
    margin: 0;
    height: 100%;
    overflow: hidden;
  }

  :global(body) {
    font-family: 'Rajdhani', sans-serif;
    background: #020208;
    color: #dae2fd;
    -webkit-font-smoothing: antialiased;
  }

  :global(:root) {
    --neon-lime: #00ff88;
    --neon-cyan: #00d4ff;
    --neon-amber: #ffc800;
    --neon-red: #ff1e3c;
    --neon-danger: #ff0033;
    --stadium-dark: #020208;
  }

  .app-root {
    display: contents;
  }

  .auth-gate {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100vh;
    height: 100dvh;
    gap: 1.5rem;
    background: #020208;
  }

  .auth-spinner {
    width: 48px;
    height: 48px;
    border: 3px solid rgba(0, 255, 136, 0.15);
    border-top-color: #00ff88;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .auth-msg {
    color: rgba(218, 226, 253, 0.7);
    font-size: 0.95rem;
    font-weight: 600;
    letter-spacing: 0.04em;
  }

  .auth-error { color: #ff4466; }
  .auth-error-icon { font-size: 3rem; }

  .retry-btn {
    background: rgba(0, 255, 136, 0.12);
    border: 1px solid rgba(0, 255, 136, 0.3);
    color: #00ff88;
    padding: 0.6rem 2rem;
    border-radius: 8px;
    font-weight: 700;
    font-size: 0.9rem;
    cursor: pointer;
    transition: background 0.2s, transform 0.1s;
  }
  .retry-btn:hover { background: rgba(0, 255, 136, 0.2); }
  .retry-btn:active { transform: scale(0.95); }


</style>
