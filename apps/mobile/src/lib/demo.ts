import { confirmDialog, infoDialog } from './dialogs';
import { seedDemoFamily } from '@rua/schema';
import { getDb } from '../db/client';
import { bumpDataVersion } from './events';
import { syncNotifications } from './notifications';
import { today } from './clock';

/**
 * Confirm-and-load the fictional demo family. Offered on the empty home
 * (so a new user or App Review can explore in one tap) and in Settings.
 */
export function confirmLoadDemoFamily(onDone?: () => void): void {
  confirmDialog({
    title: 'Load the demo family?',
    message: 'Adds three fictional people with realistic medications. For trying RUA out.',
    confirmText: 'Load demo',
    onConfirm: () => {
      seedDemoFamily(getDb(), today())
        .then(() => {
          bumpDataVersion();
          return syncNotifications();
        })
        .then(() => onDone?.())
        .catch((e) => infoDialog('Demo load failed', String(e)));
    },
  });
}
