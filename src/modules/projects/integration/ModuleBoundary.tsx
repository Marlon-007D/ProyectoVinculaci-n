import type {ReactNode} from 'react';
import {ConfirmHost} from '../../../shared/components/ConfirmDialog/ConfirmHost';
import {ErrorBoundary} from '../../../shared/components/ErrorPage/ErrorBoundary';
import {ErrorPage} from '../../../shared/components/ErrorPage/ErrorPage';
import {NotifyBridge} from '../../../shared/components/Toaster/NotifyBridge';
// A failed lazy chunk stays cached by React, so retrying needs a full reload requested by the person.
// The confirmation host renders only if App.tsx has not mounted its own (see singleInstance.ts).
export function ModuleBoundary({children}:{children:ReactNode}){
  return <>
    <ErrorBoundary fallback={()=><ErrorPage kind="module" onRetry={()=>window.location.reload()}/>}>{children}</ErrorBoundary>
    <NotifyBridge/><ConfirmHost/>
  </>;
}
