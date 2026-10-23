import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  DEFAULT_PREFS,
  applyPrefs,
  loadPrefs,
  savePrefs,
  type AccessibilityColorMode,
  type AccessibilityPrefs,
  type CustomColorTarget,
} from "../../utils/accessibilityPrefs";

type FontSetting = "textScale" | "lineSpacing" | "wordSpacing" | "letterSpacing";
type SettingValue = AccessibilityPrefs[FontSetting];

const COLOR_MODES: { value: AccessibilityColorMode; label: string; icon: string }[] = [
  { value: "monochrome", label: "Monocromo", icon: "remove_red_eye" },
  { value: "dark-high-contrast", label: "Oscuro alto contraste", icon: "dark_mode" },
  { value: "bright-high-contrast", label: "Claro alto contraste", icon: "light_mode" },
  { value: "low-saturation", label: "Baja saturación", icon: "water_drop" },
  { value: "high-saturation", label: "Alta saturación", icon: "hdr_strong" },
  { value: "contrast", label: "Contraste", icon: "contrast" },
];

const COLOR_TARGETS: { value: CustomColorTarget; label: string }[] = [
  { value: "background", label: "Fondos" },
  { value: "headings", label: "Encabezados" },
  { value: "contents", label: "Contenidos" },
];

const FONT_SETTINGS: { value: FontSetting; label: string; short: string; max: number }[] = [
  { value: "textScale", label: "Tamaño del texto", short: "Tamaño", max: 4 },
  { value: "lineSpacing", label: "Espaciado de línea", short: "Línea", max: 3 },
  { value: "wordSpacing", label: "Espaciado de palabras", short: "Palabras", max: 3 },
  { value: "letterSpacing", label: "Espaciado de letras", short: "Letras", max: 3 },
];

const COLOR_ICONS: Record<CustomColorTarget, string> = { background: "water_drop", headings: "title", contents: "format_color_text" };

function Symbol({ children }: { children: string }) {
  return <span className="site-a11y__symbol" aria-hidden="true">{children}</span>;
}

function hueToHex(hue: number, target: CustomColorTarget): string {
  const saturation = target === "background" ? 36 : 68;
  const lightness = target === "background" ? 96 : 20;
  const chroma = (1 - Math.abs(2 * lightness / 100 - 1)) * saturation / 100;
  const segment = (hue % 360) / 60;
  const secondary = chroma * (1 - Math.abs(segment % 2 - 1));
  const rgb = segment < 1 ? [chroma, secondary, 0]
    : segment < 2 ? [secondary, chroma, 0]
      : segment < 3 ? [0, chroma, secondary]
        : segment < 4 ? [0, secondary, chroma]
          : segment < 5 ? [secondary, 0, chroma] : [chroma, 0, secondary];
  const offset = lightness / 100 - chroma / 2;
  return `#${rgb.map((channel) => Math.round((channel + offset) * 255).toString(16).padStart(2, "0")).join("")}`;
}

function hexToHue(color: string | null): number {
  if (!color) return 210;
  const channels = color.slice(1).match(/.{2}/g)?.map((channel) => Number.parseInt(channel, 16) / 255);
  if (!channels || channels.length !== 3) return 210;
  const [red, green, blue] = channels;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  if (!delta) return 210;
  const hue = max === red ? ((green - blue) / delta) % 6 : max === green ? (blue - red) / delta + 2 : (red - green) / delta + 4;
  return Math.round((hue * 60 + 360) % 360);
}

function displayValue(setting: FontSetting, value: SettingValue): string {
  if (setting === "textScale") return ["100 %", "125 %", "150 %", "175 %", "200 %"][value] ?? "100 %";
  return ["Normal", "Medio", "Amplio", "Muy amplio"][value] ?? "Normal";
}

export function AccessibilityControls() {
  const [prefs, setPrefs] = useState<AccessibilityPrefs>(loadPrefs);
  const [open, setOpen] = useState(false);
  const [colorTarget, setColorTarget] = useState<CustomColorTarget>("background");
  const [fontSetting, setFontSetting] = useState<FontSetting>("textScale");
  const [guideY, setGuideY] = useState(() => typeof window === "undefined" ? 0 : Math.round(window.innerHeight / 2));
  const guideRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const uid = useId();
  const panelId = `${uid}-panel`;
  const titleId = `${uid}-title`;
  const guideTitleId = `${uid}-guide-title`;
  const guideDescriptionId = `${uid}-guide-description`;

  useEffect(() => {
    applyPrefs(prefs, document.querySelector<HTMLElement>(".site-root"));
    savePrefs(prefs);
  }, [prefs]);

  useEffect(() => {
    if (!open) return;
    const panel = document.getElementById(panelId);
    const focusable = () => panel?.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])');
    focusable()?.[0]?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      } else if (event.key === "Tab") {
        const items = focusable();
        if (!items?.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    const onDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open, panelId]);

  useEffect(() => {
    if (!prefs.readingGuide) return;
    const onPointerMove = (event: PointerEvent) => {
      if (guideRef.current) guideRef.current.style.top = `${event.clientY}px`;
    };
    const onResize = () => setGuideY((current) => Math.min(current, window.innerHeight - 20));
    document.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("resize", onResize);
    };
  }, [prefs.readingGuide]);

  const update = (patch: Partial<AccessibilityPrefs>) => setPrefs((current) => ({ ...current, ...patch }));
  const setFontValue = (value: number) => update({ [fontSetting]: value } as Pick<AccessibilityPrefs, FontSetting>);
  const activeFontSetting = FONT_SETTINGS.find((setting) => setting.value === fontSetting) ?? FONT_SETTINGS[0];
  const fontValue = prefs[fontSetting];
  const customColor = prefs.customColors[colorTarget];
  const changed = prefs.colorMode !== "normal"
    || Object.values(prefs.customColors).some(Boolean)
    || prefs.textScale !== 0 || prefs.lineSpacing !== 0 || prefs.wordSpacing !== 0 || prefs.letterSpacing !== 0
    || prefs.readingGuide;

  return createPortal((
    <>
      {prefs.readingGuide && <div ref={guideRef} className="site-a11y__reading-guide" style={{ top: `${guideY}px` }} aria-hidden="true" />}
      <div className="site-a11y" ref={rootRef}>
        <button
          ref={triggerRef}
          type="button"
          className="site-a11y__trigger"
          aria-label="Opciones de accesibilidad"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((current) => !current)}
        >
          <Symbol>accessibility_new</Symbol>
        </button>

        {open && (
          <div id={panelId} className="site-a11y__panel" role="dialog" aria-labelledby={titleId}>
            <div className="site-a11y__head">
              <div>
                <h2 id={titleId}>Accesibilidad</h2>
                <p>Ajusta los colores y el texto a tu preferencia.</p>
              </div>
              <button type="button" className="site-a11y__close" aria-label="Cerrar accesibilidad" onClick={() => { setOpen(false); triggerRef.current?.focus(); }}>
                <Symbol>close</Symbol>
              </button>
            </div>

            <section className="site-a11y__section" aria-labelledby={`${uid}-custom-colors`}>
              <div className="site-a11y__section-heading">
                <span className="site-a11y__feature-icon"><Symbol>{COLOR_ICONS[colorTarget]}</Symbol></span>
                <div><h3 id={`${uid}-custom-colors`}>Colores personalizados</h3><p>Elige el tono de cada parte del sitio</p></div>
              </div>
              <div className="site-a11y__tabs" role="group" aria-label="Parte del sitio para personalizar">
                {COLOR_TARGETS.map((target) => (
                  <button key={target.value} type="button" aria-pressed={colorTarget === target.value} onClick={() => setColorTarget(target.value)}>
                    {target.label}
                  </button>
                ))}
              </div>
              <label className="site-a11y__hue-label">
                <span className="site-sr-only">Tono para {COLOR_TARGETS.find((target) => target.value === colorTarget)?.label}</span>
                <input
                  className="site-a11y__hue"
                  type="range"
                  min="0"
                  max="359"
                  value={hexToHue(customColor)}
                  aria-label={`Tono de ${COLOR_TARGETS.find((target) => target.value === colorTarget)?.label}`}
                  onChange={(event) => {
                    const color = hueToHex(Number(event.currentTarget.value), colorTarget);
                    update({ customColors: { ...prefs.customColors, [colorTarget]: color } });
                  }}
                />
              </label>
              <div className="site-a11y__color-actions">
                <span><i className="site-a11y__color-swatch" style={{ backgroundColor: customColor ?? (colorTarget === "background" ? "#ffffff" : "#1f2933") }} />Tono seleccionado</span>
                <button type="button" className="site-a11y__reset" disabled={!Object.values(prefs.customColors).some(Boolean)} onClick={() => update({ customColors: { ...DEFAULT_PREFS.customColors } })}>
                  <Symbol>restart_alt</Symbol>Restablecer colores
                </button>
              </div>
            </section>

            <section className="site-a11y__section" aria-labelledby={`${uid}-color-adjustment`}>
              <div className="site-a11y__section-heading site-a11y__section-heading--compact">
                <h3 id={`${uid}-color-adjustment`}>Ajuste de color</h3>
                <span className="site-a11y__sr-hint">Elige un modo</span>
              </div>
              <div className="site-a11y__mode-grid">
                {COLOR_MODES.map((mode) => (
                  <button key={mode.value} type="button" className="site-a11y__mode" aria-pressed={prefs.colorMode === mode.value} onClick={() => update({ colorMode: mode.value })}>
                    <Symbol>{mode.icon}</Symbol><span>{mode.label}</span>
                  </button>
                ))}
                <button type="button" className="site-a11y__mode site-a11y__mode--normal" aria-pressed={prefs.colorMode === "normal"} onClick={() => update({ colorMode: "normal" })}>
                  <Symbol>palette</Symbol><span>Colores normales</span>
                </button>
              </div>
            </section>

            <section className="site-a11y__section" aria-labelledby={`${uid}-font-sizing`}>
              <div className="site-a11y__section-heading">
                <span className="site-a11y__feature-icon"><Symbol>text_fields</Symbol></span>
                <div><h3 id={`${uid}-font-sizing`}>Tamaño y espaciado del texto</h3><p>Ajusta la lectura sin deformar la página</p></div>
              </div>
              <div className="site-a11y__tabs site-a11y__tabs--font" role="group" aria-label="Ajuste de texto">
                {FONT_SETTINGS.map((setting) => (
                <button key={setting.value} type="button" aria-pressed={fontSetting === setting.value} onClick={() => setFontSetting(setting.value)}>
                    {setting.short}
                  </button>
                ))}
              </div>
              <div className="site-a11y__range-row">
                <button type="button" className="site-a11y__step" aria-label={`Reducir ${activeFontSetting.label.toLowerCase()}`} disabled={fontValue <= 0} onClick={() => setFontValue(fontValue - 1)}>
                  <Symbol>remove</Symbol>
                </button>
                <input
                  className="site-a11y__font-range"
                  type="range"
                  min="0"
                  max={activeFontSetting.max}
                  step="1"
                  value={fontValue}
                  aria-label={activeFontSetting.label}
                  aria-valuetext={displayValue(fontSetting, fontValue)}
                  onChange={(event) => setFontValue(Number(event.currentTarget.value))}
                />
                <button type="button" className="site-a11y__step" aria-label={`Aumentar ${activeFontSetting.label.toLowerCase()}`} disabled={fontValue >= activeFontSetting.max} onClick={() => setFontValue(fontValue + 1)}>
                  <Symbol>add</Symbol>
                </button>
              </div>
              <div className="site-a11y__font-footer">
                <span aria-live="polite">{displayValue(fontSetting, fontValue)}</span>
                <button type="button" className="site-a11y__reset" disabled={!prefs.textScale && !prefs.lineSpacing && !prefs.wordSpacing && !prefs.letterSpacing} onClick={() => update({ textScale: 0, lineSpacing: 0, wordSpacing: 0, letterSpacing: 0 })}>
                  <Symbol>restart_alt</Symbol>Restablecer texto
                </button>
              </div>
            </section>

            <section className="site-a11y__section site-a11y__section--guide" aria-labelledby={guideTitleId}>
              <div className="site-a11y__guide-card">
                <span className="site-a11y__feature-icon"><Symbol>my_location</Symbol></span>
                <div className="site-a11y__guide-copy">
                  <h3 id={guideTitleId}>Seguimiento de lectura</h3>
                  <p id={guideDescriptionId}>La guía acompaña el puntero para ayudarte a seguir el texto.</p>
                </div>
                <button type="button" className="site-a11y__guide-switch" role="switch" aria-checked={prefs.readingGuide} aria-labelledby={guideTitleId} aria-describedby={guideDescriptionId} onClick={() => update({ readingGuide: !prefs.readingGuide })}>
                  <span aria-hidden="true" />
                </button>
              </div>
              {prefs.readingGuide && (
                <label className="site-a11y__guide-control">
                  <span>Posición de la guía</span>
                  <input type="range" min="0" max={typeof window === "undefined" ? 1 : window.innerHeight} value={Math.min(guideY, typeof window === "undefined" ? 1 : window.innerHeight)} aria-label="Posición vertical de la guía de lectura" onChange={(event) => {
                    const position = Number(event.currentTarget.value);
                    setGuideY(position);
                    if (guideRef.current) guideRef.current.style.top = `${position}px`;
                  }} />
                </label>
              )}
            </section>

            <div className="site-a11y__foot">
              <span>Las preferencias se guardan en este navegador.</span>
              <button type="button" className="site-a11y__reset" disabled={!changed} onClick={() => setPrefs({ ...DEFAULT_PREFS, customColors: { ...DEFAULT_PREFS.customColors } })}>
                Restablecer todo
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  ), document.body);
}
