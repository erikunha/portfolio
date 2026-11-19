const OPEN_ATTRIBUTE = 'open';
const ESCAPE_KEY = 'Escape';
const CANCEL_EVENT = 'cancel';
const CLOSE_EVENT = 'close';
const INVALID_STATE = 'InvalidStateError';

const modalStack: HTMLDialogElement[] = [];

function closeDialog(dialog: HTMLDialogElement): void {
  if (!dialog.hasAttribute(OPEN_ATTRIBUTE)) return;
  dialog.removeAttribute(OPEN_ATTRIBUTE);
  const index = modalStack.indexOf(dialog);
  if (index >= 0) modalStack.splice(index, 1);
  queueMicrotask(() => dialog.dispatchEvent(new Event(CLOSE_EVENT)));
}

function requestClose(): void {
  const connected = modalStack.filter((dialog) => dialog.isConnected);
  modalStack.splice(0, modalStack.length, ...connected);
  const top = modalStack[modalStack.length - 1];
  if (!top) return;
  const cancel = new Event(CANCEL_EVENT, { cancelable: true });
  top.dispatchEvent(cancel);
  if (!cancel.defaultPrevented) closeDialog(top);
}

export function isModalDialog(dialog: HTMLDialogElement): boolean {
  return modalStack.includes(dialog);
}

export function installDialogShim(): void {
  if (typeof HTMLDialogElement === 'undefined') return;
  if (typeof HTMLDialogElement.prototype.showModal === 'function') return;
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    if (this.hasAttribute(OPEN_ATTRIBUTE)) {
      throw new DOMException('The dialog is already open.', INVALID_STATE);
    }
    this.setAttribute(OPEN_ATTRIBUTE, '');
    modalStack.push(this);
  };
  HTMLDialogElement.prototype.show = function show(this: HTMLDialogElement) {
    if (this.hasAttribute(OPEN_ATTRIBUTE) && modalStack.includes(this)) {
      throw new DOMException('The dialog is already open as a modal.', INVALID_STATE);
    }
    this.setAttribute(OPEN_ATTRIBUTE, '');
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    closeDialog(this);
  };
  document.addEventListener('keydown', (event) => {
    if (event.key === ESCAPE_KEY && !event.defaultPrevented) requestClose();
  });
}
