import { useEffect, useState } from 'react';
import { supabase } from '../../core/supabaseClient';
import { projectError } from './projectService';

const receiptBucket = import.meta.env.VITE_PROJECT_RECEIPTS_BUCKET?.trim() ?? '';
interface Receipt { expense_file_id: string; file_name: string; file_path: string }
export function ExpenseFiles({ institutionId, expenseId }: { institutionId: string; expenseId: string }) {
  const [files, setFiles] = useState<Receipt[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    void (async () => {
      const { data, error: failure } = await supabase.from('expense_files').select('expense_file_id,file_name,file_path').eq('expense_id', expenseId);
      if (active) { if (failure) setError(projectError(failure)); else setFiles(data ?? []); }
    })();
    return () => { active = false; };
  }, [expenseId]);
  async function upload(file?: File) {
    if (!file || busy || !receiptBucket) return;
    if (!['application/pdf', 'image/png', 'image/jpeg'].includes(file.type) || file.size > 10485760 || !file.size) {
      setError('Selecciona un PDF, JPG o PNG de hasta 10 MB.'); return;
    }
    setBusy(true); setError('');
    const path = `${institutionId}/${expenseId}/${crypto.randomUUID()}`;
    try {
      const { error: failure } = await supabase.storage.from(receiptBucket).upload(path, file, { contentType: file.type, upsert: false });
      if (failure) throw failure;
      const { data, error: metadataError } = await supabase.from('expense_files').insert({ expense_id: expenseId, file_path: path, file_name: file.name.slice(0,255) }).select('expense_file_id,file_name,file_path').single();
      if (metadataError) {
        await supabase.storage.from(receiptBucket).remove([path]);
        throw metadataError;
      }
      setFiles(previous => [...previous, data]);
    } catch (cause) { setError(projectError(cause)); }
    finally { setBusy(false); }
  }
  async function download(file: Receipt) {
    if(!receiptBucket){setError('El almacenamiento de respaldos aún no está configurado en la aplicación.');return;}
    setBusy(true); setError('');
    try {
      const { data, error: failure } = await supabase.storage.from(receiptBucket).download(file.file_path);
      if (failure) throw failure;
      const url = URL.createObjectURL(data); const link = document.createElement('a');
      link.href = url; link.download = file.file_name; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (cause) { setError(projectError(cause)); }
    finally { setBusy(false); }
  }
  return <div className="my-2 text-xs">
    {files.map(file => <button key={file.expense_file_id} type="button" className="block underline" disabled={busy} onClick={() => void download(file)}>{file.file_name}</button>)}
    {!receiptBucket && <p>Respaldos pendientes de conectar al almacenamiento privado existente.</p>}
    <label className="block">Adjuntar respaldo privado (PDF/JPG/PNG, 10 MB)
      <input aria-label="Adjuntar respaldo privado" type="file" accept="application/pdf,image/png,image/jpeg" disabled={busy || !receiptBucket} onChange={event => { void upload(event.target.files?.[0]); event.target.value = ''; }} className="block max-w-48" />
    </label>
    {busy && <span role="status">Procesando archivo…</span>}
    {error && <p role="alert" className="text-red-700">{error}</p>}
  </div>;
}
