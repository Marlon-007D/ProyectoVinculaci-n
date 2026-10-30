import { Toaster } from 'sonner';
import { CircleAlert, CircleCheck, Info, LoaderCircle, TriangleAlert, X } from 'lucide-react';
import styles from './AppToaster.module.css';

/** Single notification region for the whole application, panel and public portal. */
export function AppToaster() {
  return <Toaster
    position="bottom-right"
    closeButton
    visibleToasts={4}
    gap={10}
    offset={24}
    mobileOffset={12}
    containerAriaLabel="Notificaciones"
    icons={{
      success: <CircleCheck size={20} aria-hidden="true" />,
      error: <CircleAlert size={20} aria-hidden="true" />,
      warning: <TriangleAlert size={20} aria-hidden="true" />,
      info: <Info size={20} aria-hidden="true" />,
      loading: <LoaderCircle size={20} aria-hidden="true" className={styles.spin} />,
      close: <X size={14} aria-hidden="true" />,
    }}
    toastOptions={{
      unstyled: true,
      closeButtonAriaLabel: 'Cerrar notificación',
      classNames: {
        toast: styles.toast, icon: styles.icon, content: styles.content, title: styles.title,
        description: styles.description, actionButton: styles.action, closeButton: styles.close,
        success: styles.success, error: styles.error, warning: styles.warning, info: styles.info,
      },
    }}
  />;
}
