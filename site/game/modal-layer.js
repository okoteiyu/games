/* One modal owner at a time, including the native close-event handoff. */
let owner = null;

export function isModalBlocked() {
  // Removed components must not retain the shared lock.
  if (owner && !owner.isConnected) owner = null;
  return owner !== null || document.querySelector('dialog[open]') !== null;
}

export function tryOpenModal(dialog) {
  if (isModalBlocked()) return false;
  if (!dialog || typeof dialog.showModal !== 'function') {
    throw new TypeError('モーダルの表示先が正しくありません。');
  }
  owner = dialog;
  try {
    dialog.showModal();
  } catch (error) {
    if (owner === dialog) owner = null;
    throw error;
  }
  return true;
}

export function releaseModal(dialog) {
  if (owner === dialog) owner = null;
}
