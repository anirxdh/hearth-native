import { Alert } from 'react-native';
import { seedDemoFamily } from '@hearth/schema';
import { getDb } from '../db/client';
import { bumpDataVersion } from './events';
import { syncNotifications } from './notifications';
import { today } from './clock';

/**
 * Confirm-and-load the fictional demo family. Offered on the empty home
 * (so a new user or App Review can explore in one tap) and in Settings.
 */
export function confirmLoadDemoFamily(): void {
  Alert.alert(
    'Load the demo family?',
    'Adds three fictional people with realistic medications. For trying Hearth out.',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Load demo',
        onPress: () => {
          seedDemoFamily(getDb(), today())
            .then(() => {
              bumpDataVersion();
              return syncNotifications();
            })
            .catch((e) => Alert.alert('Demo load failed', String(e)));
        },
      },
    ],
  );
}
