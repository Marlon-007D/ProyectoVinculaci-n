declare module "bootstrap/js/dist/carousel.js" {
  export default class Carousel {
    constructor(element: HTMLElement, options?: {
      interval?: number | false;
      keyboard?: boolean;
      pause?: string | false;
      ride?: boolean | string;
      touch?: boolean;
      wrap?: boolean;
    });
    next(): void;
    prev(): void;
    to(index: number): void;
    dispose(): void;
  }
}
