import {moduleClass} from './portalStyles';
import { useEffect, useId, useRef, useState } from 'react';
import { ImagePlus, Upload, X } from 'lucide-react';
import { uploadPortalImage } from './assetService';
import { safeUrl } from './contract';
import { notify } from '../../shared/components/Toaster/notify';
interface Props {
    institutionId: string;
    value: string;
    onChange: (url: string) => void;
    onBusyChange: (busy: boolean) => void;
    label?: string;
}
export function PortalImageInput({ institutionId, value, onChange, onBusyChange, label = 'Logotipo institucional' }: Props) {
    const id = useId();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const lock = useRef(false);
    const mounted = useRef(true);
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
    async function upload(file?: File) {
        if (!file || lock.current)
            return;
        lock.current = true;
        setBusy(true);
        onBusyChange(true);
        setError('');
        try {
            const url = await uploadPortalImage(institutionId, file);
            if (mounted.current) {
                onChange(url);
                notify.success('Imagen cargada', { description: 'Aparecerá en el portal cuando publiques.' });
            }
        }
        catch (cause) {
            const message = cause instanceof Error ? cause.message : 'No se pudo subir la imagen.';
            if (mounted.current)
                setError(message);
            notify.error('No se pudo subir la imagen', { description: message });
        }
        finally {
            lock.current = false;
            if (mounted.current) {
                setBusy(false);
                onBusyChange(false);
            }
        }
    }
    return <div className={moduleClass("editor-image-control")}>
    <span className={moduleClass("editor-label")}>{label}</span>
    <div className={moduleClass("editor-image-upload")}>
      <div className={moduleClass("editor-image-sample")}>{safeUrl(value) ? <img src={value} alt={`Vista previa: ${label}`}/> : <ImagePlus size={32} aria-hidden="true"/>}</div>
      <div><label className={moduleClass("editor-upload-button")} htmlFor={id}><Upload size={16} aria-hidden="true"/>{busy ? 'Subiendo imagen…' : 'Seleccionar imagen'}</label>
        <input id={id} className={moduleClass("editor-file-input")} type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={event => { void upload(event.target.files?.[0]); event.target.value = ''; }}/>
        <p className={moduleClass("editor-hint")}>PNG, JPG o WebP · hasta 5 MB.</p>
        {value && <button type="button" className={moduleClass("editor-text-button")} disabled={busy} onClick={() => { onChange(''); setError(''); }}><X size={14} aria-hidden="true"/>Quitar imagen</button>}
      </div>
    </div>
    <p className={moduleClass("editor-hint")}>El archivo será público al subirlo. Usa imágenes autorizadas; aparecerán en esta página cuando publiques.</p>
    <details className={moduleClass("editor-url-option")}><summary>Usar una dirección web</summary><label>URL de la imagen<input type="url" maxLength={2048} placeholder="https://…" value={value} onChange={event => { onChange(event.target.value); setError(''); }}/></label></details>
    {busy && <p role="status" className={moduleClass("editor-hint")}>Guardando imagen…</p>}
    {error && <p role="alert" className={moduleClass("editor-error")}>{error}</p>}
  </div>;
}
