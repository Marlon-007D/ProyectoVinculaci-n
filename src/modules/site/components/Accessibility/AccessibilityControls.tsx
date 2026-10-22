import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DEFAULT_PREFS, applyPrefs, loadPrefs, savePrefs, type AccessibilityPrefs } from "../../utils/accessibilityPrefs";

type Scale = AccessibilityPrefs["textScale"];
const SCALE_STEPS: { value: Scale; label: string }[] = [
  { value: 0, label: "100 %" },
  { value: 1, label: "112 %" },
  { value: 2, label: "125 %" },
  { value: 3, label: "150 %" },
];

function Symbol({ children }: { children: string }) { return <span className="site-a11y__symbol" aria-hidden="true">{children}</span>; }

function Switch({ checked, onChange, labelId }: { checked: boolean; onChange: (v: boolean) => void; labelId: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelId}
      className="site-a11y-switch"
      onClick={() => onChange(!checked)}
    />
  );
}

export function AccessibilityControls() {
  const [prefs, setPrefs] = useState<AccessibilityPrefs>(loadPrefs);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const uid = useId();
  const panelId = `${uid}-panel`;
  const titleId = `${uid}-title`;
  const darkId = `${uid}-dark`;
  const contrastId = `${uid}-contrast`;
  const scaleId = `${uid}-scale`;
  const colorId = `${uid}-color`;
  const distinguishId = `${uid}-distinguish`;
  const motionId = `${uid}-motion`;

  useEffect(() => {
    applyPrefs(prefs, document.querySelector<HTMLElement>(".site-root"));
    savePrefs(prefs);
  }, [prefs]);

  useEffect(() => {
    if (!open) return;
    document.getElementById(panelId)?.querySelector<HTMLButtonElement>("button")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open, panelId]);

  const update = (patch: Partial<AccessibilityPrefs>) => setPrefs((p) => ({ ...p, ...patch }));
  const changed = prefs.darkMode || prefs.highContrast || prefs.grayscale || prefs.reducedColor || prefs.distinguishColor || prefs.reduceMotion || prefs.textScale !== 0;

  return createPortal((
    <div className="site-a11y" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="site-a11y__trigger"
        aria-label="Opciones de accesibilidad"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
      >
        <Symbol>accessibility_new</Symbol>
      </button>

      {open && (
        <div id={panelId} className="site-a11y__panel" role="dialog" aria-labelledby={titleId}>
          <div className="site-a11y__head">
            <h2 id={titleId}>Accesibilidad</h2>
          </div>

          <div className="site-a11y__row">
            <span className="site-a11y__name" id={darkId}>
              <span className="site-a11y__icon"><Symbol>dark_mode</Symbol></span>
              Modo oscuro
            </span>
            <Switch checked={prefs.darkMode} onChange={(v) => update({ darkMode: v })} labelId={darkId} />
          </div>

          <div className="site-a11y__row">
            <span className="site-a11y__name" id={contrastId}>
              <span className="site-a11y__icon"><Symbol>contrast</Symbol></span>
              Alto contraste
            </span>
            <Switch checked={prefs.highContrast} onChange={(v) => update({ highContrast: v })} labelId={contrastId} />
          </div>

          <div className="site-a11y__block" role="group" aria-labelledby={colorId}>
            <span className="site-a11y__name" id={colorId}>Color de pantalla</span>
            <div className="site-a11y__seg site-a11y__seg--colors">
              <button type="button" aria-pressed={!prefs.grayscale && !prefs.reducedColor} onClick={() => update({ grayscale: false, reducedColor: false })}>Normal</button>
              <button type="button" aria-pressed={prefs.grayscale} onClick={() => update({ grayscale: true, reducedColor: false })}>Grises</button>
              <button type="button" aria-pressed={prefs.reducedColor} onClick={() => update({ grayscale: false, reducedColor: true })}>Menos color</button>
            </div>
          </div>

          <div className="site-a11y__row">
            <span className="site-a11y__name" id={distinguishId}><span className="site-a11y__icon"><Symbol>palette</Symbol></span>Reforzar señales visuales</span>
            <Switch checked={prefs.distinguishColor} onChange={(v) => update({ distinguishColor: v })} labelId={distinguishId} />
          </div>

          <div className="site-a11y__row">
            <span className="site-a11y__name" id={motionId}><span className="site-a11y__icon"><Symbol>motion_photos_off</Symbol></span>Reducir movimiento</span>
            <Switch checked={prefs.reduceMotion} onChange={(v) => update({ reduceMotion: v })} labelId={motionId} />
          </div>

          <div className="site-a11y__block" role="group" aria-labelledby={scaleId}>
            <span className="site-a11y__name" id={scaleId}>Tamaño del texto</span>
            <div className="site-a11y__seg">
              {SCALE_STEPS.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  aria-pressed={prefs.textScale === s.value}
                  onClick={() => update({ textScale: s.value })}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="site-a11y__foot">
            <span>Se guarda en este navegador.</span>
            <button
              type="button"
              className="site-a11y__reset"
              disabled={!changed}
              onClick={() => setPrefs({ ...DEFAULT_PREFS })}
            >
              Restablecer
            </button>
          </div>
        </div>
      )}
    </div>
  ), document.body);
}
