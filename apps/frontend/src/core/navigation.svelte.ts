export type AppView =
  | 'boot'
  | 'welcome'
  | 'gameplay'
  | 'result'
  | 'leaderboard';

export type ActiveOverlay = 'character' | 'difficulty' | 'settings' | null;
export type Difficulty = 'easy' | 'medium' | 'hard' | 'insane';

export const navigationState = $state({
  currentView: 'boot' as AppView,
  previousView: null as AppView | null,
  isTransitioning: false,
  selectedAvatarId: 'putin' as string,
  activeOverlay: null as ActiveOverlay,
  selectedDifficulty: 'medium' as Difficulty,
});

export function openOverlay(name: 'character' | 'difficulty' | 'settings'): void {
  navigationState.activeOverlay = name;
}

export function closeOverlay(): void {
  navigationState.activeOverlay = null;
}

export async function navigateTo(view: AppView, delayMs = 0): Promise<void> {
  if (navigationState.currentView === view) return;

  navigationState.isTransitioning = true;
  navigationState.previousView = navigationState.currentView;

  if (delayMs > 0) {
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }

  navigationState.currentView = view;
  navigationState.isTransitioning = false;
}

export function isView(view: AppView): boolean {
  return navigationState.currentView === view;
}
