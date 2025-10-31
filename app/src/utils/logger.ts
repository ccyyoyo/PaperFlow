export const logger = {
  info: (...args: unknown[]) => console.info('[PaperFlow]', ...args),
  error: (...args: unknown[]) => console.error('[PaperFlow]', ...args)
};
