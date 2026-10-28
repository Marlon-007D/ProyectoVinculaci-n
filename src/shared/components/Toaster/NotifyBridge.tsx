import { useEffect } from 'react';
import { useToast } from '../Toast/Toast';
import { connectNotifier } from './notify';

/** Connects notify() to the shared ToastProvider; renders nothing. Several instances are harmless. */
export function NotifyBridge() {
  const toast = useToast();
  useEffect(() => connectNotifier(toast), [toast]);
  return null;
}
