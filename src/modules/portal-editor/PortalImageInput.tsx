import {useEffect, useId, useRef, useState} from 'react';
import {ImagePlus, Upload, X} from 'lucide-react';
import {uploadPortalImage} from './assetService';
import {safeUrl} from './contract';

interface Props {
  institutionId: string;
  value: string;
  onChange: (url: string) => void;
  onBusyChange: (busy: boolean) => void;
  label?: string;
}

export function PortalImageInput({institutionId, value, onChange, onBusyChange, label = 'Logotipo institucional'}: Props) {
  const id = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  async function upload(file?: File) {
    if (!file || lock.current) return;
    lock.current = true; setBusy(true); onBusyChange(true); setError('');
    try {
      const url = await uploadPortalImage(institutionId, file);
      if (mounted.current) onChange(url);
    } catch (cause) { if (mounted.current) setError(cause instanceof Error ? cause.message : 'No se pudo subir la imagen.'); }
    finally { lock.current = false; if (mounted.current) { setBusy(false); onBusyChange(false); } }
  }
  return <div className="editor-image-control">
    <span className="editor-label">{label}</span>
    <div className="editor-image-upload">
      <div className="editor-image-sample">{safeUrl(value) ? <img src={value} alt={`Vista previa: ${label}`} /> : <ImagePlus size={32} aria-hidden="true" />}</div>
      <div><label className="editor-upload-button" htmlFor={id}><Upload size={16} aria-hidden="true" />{busy ? 'Subiendo imagen…' : 'Seleccionar imagen'}</label>
        <input id={id} className="editor-file-input" type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={event => { void upload(event.target.files?.[0]); event.target.value = ''; }} />
        <p className="editor-hint">PNG, JPG o WebP · hasta 5 MB.</p>
        {value && <button type="button" className="editor-text-button" disabled={busy} onClick={() => { onChange(''); setError(''); }}><X size={14} aria-hidden="true" />Quitar de esta página</button>}
      </div>
    </div>
    <p className="editor-hint">El archivo será público al subirlo. Usa imágenes autorizadas; aparecerán en esta página cuando publiques.</p>
    <details className="editor-url-option"><summary>Usar una dirección web</summary><label>URL de la imagen<input type="url" placeholder="https://…" value={value} onChange={event => { onChange(event.target.value); setError(''); }} /></label></details>
    {busy && <p role="status" className="editor-hint">Guardando imagen…</p>}
    {error && <p role="alert" className="editor-error">{error}</p>}
  </div>;
}
