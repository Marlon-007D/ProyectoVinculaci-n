import {moduleClass} from './projectStyles';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../core/supabaseClient';
import { projectError } from './projectService';
const receiptBucket = 'project-receipts';
interface Receipt {
    expense_file_id: string;
    file_name: string;
    file_path: string;
}
export function ExpenseFiles({ institutionId, expenseId, readOnly = false }: {
    institutionId: string;
    expenseId: string;
    readOnly?: boolean;
}) {
    const [files, setFiles] = useState<Receipt[]>([]);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const lock = useRef(false);
    useEffect(() => {
        let active = true;
        void (async () => {
            setError('');
            setFiles([]);
            try {
                const { data, error: failure } = await supabase.from('expense_files').select('*').eq('expense_id', expenseId);
                if (active) {
                    if (failure)
                        setError(projectError(failure));
                    else
                        setFiles((data ?? []).filter(item => !item.deleted_at));
                }
            }
            catch (cause) {
                if (active)
                    setError(projectError(cause));
            }
        })();
        return () => { active = false; };
    }, [expenseId]);
    async function upload(file?: File) {
        if (!file || readOnly || lock.current)
            return;
        if (!['application/pdf', 'image/png', 'image/jpeg'].includes(file.type) || file.size > 10485760 || !file.size) {
            setError('Selecciona un PDF, JPG o PNG de hasta 10 MB.');
            return;
        }
        lock.current = true;
        setBusy(true);
        setError('');
        const path = `${institutionId}/${expenseId}/${crypto.randomUUID()}`;
        try {
            const { error: failure } = await supabase.storage.from(receiptBucket).upload(path, file, { contentType: file.type, upsert: false });
            if (failure)
                throw failure;
            const { data, error: metadataError } = await supabase.from('expense_files').insert({ expense_id: expenseId, file_path: path, file_name: file.name.slice(0, 255) }).select('expense_file_id,file_name,file_path').single();
            if (metadataError) {
                throw new Error('El archivo se conservó, pero no pudo vincularse al gasto. Referencia para recuperar el registro: ' + path + '. ' + projectError(metadataError));
            }
            setFiles(previous => [...previous, data]);
        }
        catch (cause) {
            setError(projectError(cause));
        }
        finally {
            lock.current = false;
            setBusy(false);
        }
    }
    async function remove(file: Receipt) {
        if (readOnly || lock.current || !window.confirm('¿Retirar este respaldo? El archivo se conservará de forma privada.'))
            return;
        lock.current = true;
        setBusy(true);
        setError('');
        try {
            const result = await supabase.rpc('project_retire_receipt', {target_institution:institutionId,target_expense:expenseId,target_file:file.expense_file_id});
            if (result.error)
                throw result.error;
            setFiles(previous => previous.filter(item => item.expense_file_id !== file.expense_file_id));
        }
        catch (cause) {
            setError(projectError(cause));
        }
        finally {
            lock.current = false;
            setBusy(false);
        }
    }
    async function download(file: Receipt) {
        if (lock.current)
            return;
        if (!receiptBucket) {
            setError('El almacenamiento de respaldos aún no está configurado en la aplicación.');
            return;
        }
        lock.current = true;
        setBusy(true);
        setError('');
        try {
            const { data, error: failure } = await supabase.storage.from(receiptBucket).download(file.file_path);
            if (failure)
                throw failure;
            const url = URL.createObjectURL(data);
            const link = document.createElement('a');
            link.href = url;
            link.download = file.file_name;
            link.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        }
        catch (cause) {
            setError(projectError(cause));
        }
        finally {
            lock.current = false;
            setBusy(false);
        }
    }
    return <details className={moduleClass("project-receipts")}><summary>{files.length ? `${files.length} comprobantes` : 'Adjuntar comprobante'}</summary><div>
    {files.map(file => <div key={file.expense_file_id}><button type="button" className={moduleClass("block underline")} disabled={busy} onClick={() => void download(file)}>{file.file_name}</button><button type="button" disabled={busy || readOnly} onClick={() => void remove(file)} aria-label={`Eliminar respaldo ${file.file_name}`}>Retirar respaldo</button></div>)}
    {!receiptBucket && <p>Respaldos pendientes de conectar al almacenamiento privado existente.</p>}
    <label className={moduleClass("block")}>Adjuntar respaldo privado (PDF/JPG/PNG, 10 MB)
      <input aria-label="Adjuntar respaldo privado" type="file" accept="application/pdf,image/png,image/jpeg" disabled={busy || readOnly || !receiptBucket} onChange={event => { void upload(event.target.files?.[0]); event.target.value = ''; }} className={moduleClass("block max-w-48")}/>
    </label>
    {busy && <span role="status">Procesando archivo…</span>}
    {error && <p role="alert" className={moduleClass("text-red-700")}>{error}</p>}
  </div></details>;
}
