import { useId, useLayoutEffect, useRef } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import { X } from 'lucide-react';
import { Button } from './Button';
import { IconButton } from './IconButton';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(',');

interface OverlayStackEntry {
  id: string;
  overlay: HTMLElement;
  dialog: HTMLElement;
  restoreFocus: HTMLElement | null;
  requestClose: () => void;
  closeDisabled: () => boolean;
}

interface BackgroundInteractionState {
  element: HTMLElement;
  inert: boolean;
  ariaHidden: string | null;
}

const overlayStack: OverlayStackEntry[] = [];
let backgroundInteractionState: BackgroundInteractionState[] = [];

function getFocusableElements(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((element) =>
    !element.hasAttribute('hidden')
    && element.getAttribute('aria-hidden') !== 'true'
    && !element.closest('[inert]')
  );
}

function focusFirst(entry: OverlayStackEntry) {
  const firstFocusable = getFocusableElements(entry.dialog)[0];
  (firstFocusable ?? entry.dialog).focus({ preventScroll: true });
}

function restoreBackgroundInteraction() {
  backgroundInteractionState.forEach(({ element, inert, ariaHidden }) => {
    element.inert = inert;
    if (ariaHidden === null) element.removeAttribute('aria-hidden');
    else element.setAttribute('aria-hidden', ariaHidden);
  });
  backgroundInteractionState = [];
}

function suppressBackgroundInteraction(overlay: HTMLElement) {
  restoreBackgroundInteraction();
  let current: HTMLElement = overlay;

  while (current.parentElement) {
    const parent = current.parentElement;
    Array.from(parent.children).forEach((child) => {
      if (child === current || !(child instanceof HTMLElement)) return;
      backgroundInteractionState.push({
        element: child,
        inert: child.inert,
        ariaHidden: child.getAttribute('aria-hidden'),
      });
      child.inert = true;
      child.setAttribute('aria-hidden', 'true');
    });
    current = parent;
    if (parent === document.body) break;
  }
}

function syncBackgroundInteraction() {
  const top = overlayStack.at(-1);
  if (top) suppressBackgroundInteraction(top.overlay);
  else restoreBackgroundInteraction();
}

function trapFocus(event: KeyboardEvent, entry: OverlayStackEntry) {
  const focusable = getFocusableElements(entry.dialog);
  if (focusable.length === 0) {
    event.preventDefault();
    entry.dialog.focus({ preventScroll: true });
    return;
  }

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = document.activeElement;
  const focusIsOutside = !(active instanceof Node) || !entry.dialog.contains(active);

  if (event.shiftKey && (active === first || focusIsOutside)) {
    event.preventDefault();
    last.focus({ preventScroll: true });
    return;
  }

  if (!event.shiftKey && (active === last || focusIsOutside)) {
    event.preventDefault();
    first.focus({ preventScroll: true });
  }
}

function handleOverlayKeyDown(event: KeyboardEvent) {
  const top = overlayStack.at(-1);
  if (!top) return;

  if (event.key === 'Escape') {
    event.preventDefault();
    event.stopPropagation();
    if (!top.closeDisabled()) top.requestClose();
    return;
  }

  if (event.key === 'Tab') trapFocus(event, top);
}

function isTopOverlay(id: string) {
  return overlayStack.at(-1)?.id === id;
}

function registerOverlay(entry: OverlayStackEntry) {
  overlayStack.push(entry);
  if (overlayStack.length === 1) document.addEventListener('keydown', handleOverlayKeyDown, true);
  syncBackgroundInteraction();

  const focusFrame = window.requestAnimationFrame(() => {
    if (isTopOverlay(entry.id)) focusFirst(entry);
  });

  return () => {
    window.cancelAnimationFrame(focusFrame);
    const index = overlayStack.findIndex((item) => item.id === entry.id);
    if (index < 0) return;
    const wasTop = index === overlayStack.length - 1;
    overlayStack.splice(index, 1);
    if (overlayStack.length === 0) document.removeEventListener('keydown', handleOverlayKeyDown, true);
    syncBackgroundInteraction();

    if (!wasTop) return;
    window.requestAnimationFrame(() => {
      if (entry.restoreFocus?.isConnected && !entry.restoreFocus.closest('[inert]')) {
        entry.restoreFocus.focus({ preventScroll: true });
        return;
      }
      const nextTop = overlayStack.at(-1);
      if (nextTop) focusFirst(nextTop);
    });
  };
}

function useOverlayLayer(open: boolean, onClose: () => void, closeDisabled = false) {
  const id = useId();
  const overlayRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);
  const closeDisabledRef = useRef(closeDisabled);
  onCloseRef.current = onClose;
  closeDisabledRef.current = closeDisabled;

  useLayoutEffect(() => {
    if (!open || !overlayRef.current || !dialogRef.current) return undefined;
    const active = document.activeElement;
    return registerOverlay({
      id,
      overlay: overlayRef.current,
      dialog: dialogRef.current,
      restoreFocus: active instanceof HTMLElement ? active : null,
      requestClose: () => onCloseRef.current(),
      closeDisabled: () => closeDisabledRef.current,
    });
  }, [id, open]);

  return {
    id,
    overlayRef,
    dialogRef,
    isTop: () => isTopOverlay(id),
  };
}

export interface ModalProps {
  open: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  closeLabel?: string;
  closeOnBackdrop?: boolean;
  closeDisabled?: boolean;
  onClose: () => void;
}

export function Modal({
  open,
  title,
  description,
  children,
  footer,
  size = 'md',
  closeLabel = '关闭弹窗',
  closeOnBackdrop = true,
  closeDisabled = false,
  onClose,
}: ModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const layer = useOverlayLayer(open, onClose, closeDisabled);

  if (!open) return null;
  const handleBackdrop = (event: MouseEvent<HTMLDivElement>) => {
    if (!closeDisabled && closeOnBackdrop && layer.isTop() && event.currentTarget === event.target) onClose();
  };

  return (
    <div ref={layer.overlayRef} className="ui-overlay" role="presentation" onMouseDown={handleBackdrop}>
      <section
        ref={layer.dialogRef}
        className={`ui-modal ${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
      >
        <header className="ui-modal-header">
          <div className="ui-modal-title">
            <h2 id={titleId}>{title}</h2>
            {description ? <p id={descriptionId}>{description}</p> : null}
          </div>
          <IconButton icon={X} label={closeLabel} size="sm" disabled={closeDisabled} onClick={onClose} />
        </header>
        <div className="ui-modal-body">{children}</div>
        {footer ? <footer className="ui-modal-footer">{footer}</footer> : null}
      </section>
    </div>
  );
}

export interface DrawerProps {
  open: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  closeLabel?: string;
  closeOnBackdrop?: boolean;
  closeDisabled?: boolean;
  onClose: () => void;
}

export function Drawer({
  open,
  title,
  description,
  children,
  footer,
  closeLabel = '关闭抽屉',
  closeOnBackdrop = true,
  closeDisabled = false,
  onClose,
}: DrawerProps) {
  const titleId = useId();
  const descriptionId = useId();
  const layer = useOverlayLayer(open, onClose, closeDisabled);

  if (!open) return null;
  const handleBackdrop = (event: MouseEvent<HTMLDivElement>) => {
    if (!closeDisabled && closeOnBackdrop && layer.isTop() && event.currentTarget === event.target) onClose();
  };

  return (
    <div ref={layer.overlayRef} className="ui-overlay drawer-overlay" role="presentation" onMouseDown={handleBackdrop}>
      <aside
        ref={layer.dialogRef}
        className="ui-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
      >
        <header className="ui-drawer-header">
          <div className="ui-drawer-title">
            <h2 id={titleId}>{title}</h2>
            {description ? <p id={descriptionId}>{description}</p> : null}
          </div>
          <IconButton icon={X} label={closeLabel} size="sm" disabled={closeDisabled} onClick={onClose} />
        </header>
        <div className="ui-drawer-body">{children}</div>
        {footer ? <footer className="ui-drawer-footer">{footer}</footer> : null}
      </aside>
    </div>
  );
}

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = '确认',
  danger = false,
  busy = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      title={title}
      size="sm"
      closeOnBackdrop={!busy}
      closeDisabled={busy}
      onClose={onClose}
      footer={
        <>
          <Button disabled={busy} onClick={onClose}>取消</Button>
          <Button variant={danger ? 'danger' : 'primary'} loading={busy} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="ui-confirm-copy">{description}</p>
    </Modal>
  );
}
