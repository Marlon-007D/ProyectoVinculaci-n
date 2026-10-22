import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import BootstrapCarousel from "bootstrap/js/dist/carousel.js";
import styles from "./ScrollSnapCarousel.module.css";

interface Props<T> {
  items: readonly T[];
  label: string;
  itemKey: (item: T, index: number) => string;
  renderItem: (item: T, index: number, peek?: T) => ReactNode;
  itemClassName?: string;
  showIndicators?: boolean;
  variant?: "team" | "gallery";
}

interface CarouselInstance {
  next(): void;
  prev(): void;
  to(index: number): void;
  dispose(): void;
}

const CarouselConstructor = BootstrapCarousel as unknown as new (
  element: HTMLElement,
  options: { interval: number; keyboard: boolean; pause: "hover"; ride: "carousel"; touch: boolean; wrap: boolean }
) => CarouselInstance;

export function ScrollSnapCarousel<T>({ items, label, itemKey, renderItem, itemClassName = "", showIndicators = false, variant }: Props<T>) {
  const root = useRef<HTMLDivElement>(null);
  const carousel = useRef<CarouselInstance | null>(null);
  const id = useId();
  const [activeIndex, setActiveIndex] = useState(0);
  const perSlide = variant === "team" ? 3 : 1;
  const slides = Array.from({ length: Math.ceil(items.length / perSlide) }, (_, slideIndex) =>
    items.slice(slideIndex * perSlide, (slideIndex + 1) * perSlide).map((item, offset) => ({ item, index: slideIndex * perSlide + offset }))
  );

  useEffect(() => {
    const element = root.current;
    if (!element || slides.length < 2) return;
    const instance = new CarouselConstructor(element, {
      interval: 5000,
      keyboard: true,
      pause: "hover",
      ride: "carousel",
      touch: true,
      wrap: true,
    });
    const syncIndex = () => {
      const current = Array.from(element.querySelectorAll<HTMLElement>(".carousel-item")).findIndex((slide) => slide.classList.contains("active"));
      if (current >= 0) setActiveIndex(current);
    };
    element.addEventListener("slid.bs.carousel", syncIndex);
    carousel.current = instance;
    return () => {
      element.removeEventListener("slid.bs.carousel", syncIndex);
      carousel.current = null;
      instance.dispose();
    };
  }, [slides.length]);

  const move = (direction: -1 | 1) => {
    if (direction < 0) carousel.current?.prev();
    else carousel.current?.next();
  };

  return (
    <div
      ref={root}
      className={`carousel slide ${styles.carousel}`}
      role="region"
      aria-roledescription="carrusel"
      aria-label={label}
      aria-controls={id}
      tabIndex={0}
    >
      <div id={id} className={`carousel-inner ${styles.viewport}`}>
        {slides.map((slide, slideIndex) => <div key={itemKey(slide[0].item, slide[0].index)} className={`carousel-item ${slideIndex === 0 ? "active" : ""} ${styles.slide}`}>
          {variant === "team"
            ? <ul className={styles.teamItems}>{slide.map(({ item, index }) => <li key={itemKey(item, index)} className={itemClassName}>{renderItem(item, index)}</li>)}</ul>
            : renderItem(slide[0].item, slide[0].index, slides[slideIndex + 1]?.[0]?.item)}
        </div>)}
      </div>
      {slides.length > 1 && <div className={styles.controls}>
        <button type="button" onClick={() => move(-1)} aria-label="Anterior" aria-controls={id}>Anterior</button>
        <button type="button" onClick={() => move(1)} aria-label="Siguiente" aria-controls={id}>Siguiente</button>
      </div>}
      {showIndicators && slides.length > 1 && <div className={styles.indicators} role="group" aria-label="Indicadores de posición">
        {slides.map((slide, index) => <button key={itemKey(slide[0].item, slide[0].index)} type="button" aria-label={`Mostrar grupo ${index + 1} de ${slides.length}`} aria-current={index === activeIndex ? "true" : undefined} onClick={() => carousel.current?.to(index)} />)}
      </div>}
    </div>
  );
}
