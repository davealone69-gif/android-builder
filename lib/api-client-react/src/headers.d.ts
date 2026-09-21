export {};

declare global {
  interface Headers {
    entries(): IterableIterator<[string, string]>;
  }
}