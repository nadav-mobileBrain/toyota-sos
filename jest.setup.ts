import '@testing-library/jest-dom';

// Mock IntersectionObserver for jsdom
class MockIntersectionObserver {
  root: Element | null = null;
  rootMargin: string = '';
  thresholds: ReadonlyArray<number> = [];
  constructor() {}
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() { return []; }
}
// @ts-ignore
global.IntersectionObserver = MockIntersectionObserver as any;

// Polyfill PointerEvent for jsdom if missing
// @ts-ignore
if (typeof window !== 'undefined' && (window as any).PointerEvent === undefined) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  class MockPointerEvent extends MouseEvent {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(type: string, props?: any) {
      super(type, props);
      if (props) {
        const keys = [
          'clientX',
          'clientY',
          'pointerId',
          'pointerType',
          'button',
          'buttons',
          'altKey',
          'ctrlKey',
          'metaKey',
          'shiftKey',
          'pageX',
          'pageY',
          'screenX',
          'screenY',
        ] as const;
        for (const k of keys) {
          if (k in props) {
            // @ts-ignore
            Object.defineProperty(this, k, { value: props[k] });
          }
        }
      }
    }
  }
  // @ts-ignore
  (window as any).PointerEvent = MockPointerEvent;
}


