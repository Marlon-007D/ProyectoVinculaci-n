export const NOTICE_MS = 3000;

export interface NoticeTimers {
  set: (callback: () => void, ms: number) => unknown;
  clear: (handle: unknown) => void;
}

const browserTimers: NoticeTimers = {
  set: (callback, ms) => setTimeout(callback, ms),
  clear: handle => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

/**
 * Temporary «trim» notice of an input, separate from the validation error shown on submit.
 * `show` replaces the text and restarts the countdown; `clear` and `dispose` cancel it.
 */
export function createTransientNotice(onChange: (text: string) => void, timers: NoticeTimers = browserTimers, ms = NOTICE_MS) {
  let handle: unknown;
  const cancel = () => {
    if (handle === undefined) return;
    timers.clear(handle);
    handle = undefined;
  };
  return {
    show(text: string) {
      cancel();
      onChange(text);
      handle = timers.set(() => { handle = undefined; onChange(''); }, ms);
    },
    clear() { cancel(); onChange(''); },
    dispose: cancel,
  };
}
