import { useId } from 'react';
import { Paperclip } from 'lucide-react';
import { moduleClass } from './projectStyles';

interface Props {
  label: string;
  accept: string;
  disabled?: boolean;
  fileName?: string;
  onPick: (file: File) => void;
}

/** Project-styled button over a visually hidden native input; it names the chosen file instead of the browser text. */
export function FilePicker({ label, accept, disabled, fileName, onPick }: Props) {
  const id = useId();
  return <div className={moduleClass('project-file')}>
    <input id={id} className={moduleClass('project-file-input')} type="file" accept={accept} disabled={disabled}
      onChange={event => { const file = event.target.files?.[0]; if (file) onPick(file); event.target.value = ''; }} />
    <label htmlFor={id} className={moduleClass('project-file-button')}><Paperclip size={16} aria-hidden="true" />{label}</label>
    <span className={moduleClass('project-file-name')} title={fileName}>{fileName || 'Ningún archivo elegido'}</span>
  </div>;
}
