// utility functions, other utils.ts file comes from shadcn

export function sleep(ms = 0) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }