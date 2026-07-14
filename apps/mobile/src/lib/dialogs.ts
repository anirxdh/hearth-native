import { Alert, Platform } from 'react-native';

/**
 * Cross-platform confirm: native Alert on iOS/Android; window.confirm on the
 * web test surface (react-native-web's Alert is a silent no-op, which would
 * make confirmations unfalsifiable in Playwright).
 */
export function confirmDialog(opts: {
  title: string;
  message: string;
  confirmText: string;
  destructive?: boolean;
  onConfirm: () => void;
}): void {
  if (Platform.OS === 'web') {
    // eslint-disable-next-line no-alert
    const ok = typeof window !== 'undefined' && window.confirm(`${opts.title}\n\n${opts.message}`);
    if (ok) opts.onConfirm();
    return;
  }
  Alert.alert(opts.title, opts.message, [
    { text: 'Cancel', style: 'cancel' },
    {
      text: opts.confirmText,
      style: opts.destructive ? 'destructive' : 'default',
      onPress: opts.onConfirm,
    },
  ]);
}

/** Cross-platform info dialog. */
export function infoDialog(title: string, message: string): void {
  if (Platform.OS === 'web') {
    // eslint-disable-next-line no-alert
    if (typeof window !== 'undefined') window.alert(`${title}\n\n${message}`);
    return;
  }
  Alert.alert(title, message);
}
