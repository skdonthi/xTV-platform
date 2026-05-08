export interface NavigationEngine {
  attach(root: Element): void;
}

export function createNavigationEngine(): NavigationEngine {
  return {
    attach(root) {
      root.addEventListener("keydown", (event) => {
        if (!(event instanceof KeyboardEvent)) {
          return;
        }

        if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter"].includes(event.key)) {
          event.preventDefault();
        }
      });
    },
  };
}
