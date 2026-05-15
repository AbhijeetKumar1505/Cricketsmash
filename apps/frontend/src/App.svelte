<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { fade } from 'svelte/transition';
  import {
    game,
    initGame,
    destroyGame,
  } from './core/gameController.svelte.js';
  import { navigationState, navigateTo } from './core/navigation.svelte.js';

  import WelcomePage from './pages/WelcomePage.svelte';
  import GamePage from './pages/GamePage.svelte';

  let gameEntered = $state(false);

  $effect(() => {
    if (navigationState.currentView === 'gameplay' && !gameEntered) {
      gameEntered = true;
    }
  });

  onMount(async () => {
    try {
      await initGame();
      await new Promise(r => setTimeout(r, 1500));
      navigateTo('welcome');
    } catch (err) {
      console.error('Boot failed:', err);
    }
  });

  onDestroy(() => {
    destroyGame();
  });
</script>

<div class="app-root">
  {#if navigationState.currentView === 'boot'}
    <div class="boot-screen" out:fade={{ duration: 800 }}>
      <div class="boot-content">
        <div class="logo-container">
          <div class="logo-ring"></div>
          <div class="logo-inner">CC</div>
        </div>
        <div class="boot-loader">
          <div class="loader-bar"></div>
        </div>
        <p class="boot-msg">ESTABLISHING SECURE CONNECTION…</p>
      </div>
    </div>
  {:else if game.phase === 'error'}
    <div class="error-screen">
      <div class="error-icon">⚠️</div>
      <p class="error-msg">{game.errorMessage ?? 'Connection failed'}</p>
      <button class="retry-btn" onclick={() => window.location.reload()}>RELOAD GAME</button>
    </div>
  {:else}
    <!-- GamePage mounted once and never destroyed after first gameplay navigation -->
    {#if gameEntered}
      <GamePage />
    {/if}
    <!-- Welcome overlays on top of persistent game canvas -->
    {#if navigationState.currentView === 'welcome'}
      <div class="welcome-layer" out:fade={{ duration: 600 }}>
        <WelcomePage />
      </div>
    {/if}
  {/if}
</div>

<style>
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;900&family=Rajdhani:wght@400;600;700&display=swap');

  :global(html),
  :global(body) {
    margin: 0;
    height: 100%;
    overflow: hidden;
    background: #020208;
  }

  :global(body) {
    font-family: 'Rajdhani', sans-serif;
    color: #dae2fd;
    -webkit-font-smoothing: antialiased;
  }

  .app-root {
    display: contents;
  }

  .welcome-layer {
    position: fixed;
    inset: 0;
    z-index: 200;
  }

  /* Boot Screen */
  .boot-screen {
    position: fixed;
    inset: 0;
    background: #020208;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .boot-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2rem;
  }

  .logo-container {
    position: relative;
    width: 100px;
    height: 100px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .logo-ring {
    position: absolute;
    inset: 0;
    border: 2px solid rgba(255, 200, 0, 0.1);
    border-top-color: #ffc800;
    border-radius: 50%;
    animation: spin 1s cubic-bezier(0.68, -0.55, 0.27, 1.55) infinite;
  }

  .logo-inner {
    font-family: 'Outfit', sans-serif;
    font-weight: 900;
    font-size: 2rem;
    color: #ffc800;
    text-shadow: 0 0 20px rgba(255, 200, 0, 0.5);
  }

  .boot-loader {
    width: 200px;
    height: 2px;
    background: rgba(255, 255, 255, 0.05);
    position: relative;
    overflow: hidden;
  }

  .loader-bar {
    position: absolute;
    inset: 0;
    background: #ffc800;
    width: 50%;
    animation: loader-slide 2s infinite ease-in-out;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  @keyframes loader-slide {
    0% { transform: translateX(-100%); }
    50% { transform: translateX(100%); }
    100% { transform: translateX(-100%); }
  }

  .boot-msg {
    font-size: 0.7rem;
    letter-spacing: 0.3em;
    color: rgba(255, 255, 255, 0.4);
    font-weight: 600;
  }

  /* Error Screen */
  .error-screen {
    position: fixed;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1.5rem;
    background: #020208;
    z-index: 2000;
  }

  .error-icon {
    font-size: 3rem;
    color: #ff4466;
  }

  .error-msg {
    color: #ff4466;
    font-weight: 600;
    letter-spacing: 0.04em;
  }

  .retry-btn {
    background: rgba(255, 68, 102, 0.1);
    border: 1px solid rgba(255, 68, 102, 0.3);
    color: #ff4466;
    padding: 0.8rem 2.5rem;
    border-radius: 4px;
    font-weight: 700;
    font-size: 0.9rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .retry-btn:hover {
    background: rgba(255, 68, 102, 0.2);
    border-color: #ff4466;
  }
</style>
