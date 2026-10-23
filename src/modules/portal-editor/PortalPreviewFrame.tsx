import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import styles from './PortalPreviewFrame.module.css';
import { previewViewport } from './previewViewport';

const documentHtml = '<!doctype html><html lang="es" data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="preview-root"></div></body></html>';
// These adjustments belong only to the preview document, never to the public site.
const previewCss = `
html,body{margin:0;min-width:0;width:100%;background:#fff;color-scheme:light}
body{overflow-x:hidden} #preview-root{min-height:100vh}
.site-header{position:relative}
`;

export function PortalPreviewFrame({ device, children }: { device: 'desktop' | 'mobile'; children: ReactNode }) {
  const container = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [available, setAvailable] = useState(0);
  const { width, height, scale, visibleWidth, visibleHeight } = previewViewport(device, available);

  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const observer = new ResizeObserver(entries => setAvailable(entries[0].contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!target) return;
    const doc = target.ownerDocument;
    const syncStyles = () => {
      doc.head.querySelectorAll('[data-preview-style]').forEach(node => node.remove());
      document.head.querySelectorAll('style,link[rel="stylesheet"]').forEach(node => {
        const copy = node.cloneNode(true) as HTMLElement;
        copy.setAttribute('data-preview-style', '');
        doc.head.append(copy);
      });
      const override = doc.createElement('style');
      override.setAttribute('data-preview-style', '');
      override.textContent = previewCss;
      doc.head.append(override);
    };
    syncStyles();
    const observer = new MutationObserver(syncStyles);
    observer.observe(document.head, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [target]);

  return <div ref={container} className={styles.canvas}>
    <div className={`${styles.device} ${device === 'mobile' ? styles.mobile : ''}`} style={{ width: visibleWidth, height: visibleHeight, visibility: scale ? 'visible' : 'hidden' }}>
      <iframe ref={frame} title={`Vista previa del portal en ${device === 'desktop' ? 'computadora' : 'celular'}`}
        srcDoc={documentHtml} className={styles.frame}
        style={{ width, minWidth: width, maxWidth: 'none', height, minHeight: height, maxHeight: 'none', transform: `scale(${scale})` }}
        onLoad={() => setTarget(frame.current?.contentDocument?.getElementById('preview-root') ?? null)} />
      {target && createPortal(children, target)}
    </div>
    <p className={styles.dimensions}>{device === 'desktop' ? 'Computadora · Vista ajustada al ancho del panel' : 'Celular · Ancho de pantalla de 390 px'}</p>
  </div>;
}
