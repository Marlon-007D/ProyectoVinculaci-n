import { useEffect, useId, useRef, useState } from "react";
import { DEFAULT_PREFS, applyPrefs, loadPrefs, savePrefs, type AccessibilityPrefs } from "../../utils/accessibilityPrefs";

type Scale = AccessibilityPrefs["textScale"];
const SCALE_STEPS: { value: Scale; label: string }[] = [
  { value: 0, label: "100 %" },
  { value: 1, label: "112 %" },
  { value: 2, label: "125 %" },
  { value: 3, label: "150 %" },
];

function IconAccessibility() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="4.5" r="1.8" />
      <path d="M5.5 8.5h13M12 8.5v5.5l-2.8 5.5M12 14l2.8 5.5" />
    </svg>
  );
}
function IconMoon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
    </svg>
  );
}
function IconContrast() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="8" />
      <path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" />
    </svg>
  );
}

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

  useEffect(() => {
    applyPrefs(prefs, document.querySelector<HTMLElement>(".site-root"));
    savePrefs(prefs);
  }, [prefs]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  const update = (patch: Partial<AccessibilityPrefs>) => setPrefs((p) => ({ ...p, ...patch }));
  const changed = prefs.darkMode || prefs.highContrast || prefs.textScale !== 0;

  return (
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
        <IconAccessibility />
      </button>

      {open && (
        <div id={panelId} className="site-a11y__panel" role="dialog" aria-labelledby={titleId}>
          <div className="site-a11y__head">
            <h2 id={titleId}>Accesibilidad</h2>
          </div>

          <div className="site-a11y__row">
            <span className="site-a11y__name" id={darkId}>
              <span className="site-a11y__icon"><IconMoon /></span>
              Modo oscuro
            </span>
            <Switch checked={prefs.darkMode} onChange={(v) => update({ darkMode: v })} labelId={darkId} />
          </div>

          <div className="site-a11y__row">
            <span className="site-a11y__name" id={contrastId}>
              <span className="site-a11y__icon"><IconContrast /></span>
              Alto contraste
            </span>
            <Switch checked={prefs.highContrast} onChange={(v) => update({ highContrast: v })} labelId={contrastId} />
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
  );
}
