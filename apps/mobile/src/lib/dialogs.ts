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

/**
 * Cross-platform text prompt: Alert.prompt on native (iOS today; Android gets
 * a real modal when it ships), window.prompt on the web test surface.
 * Resolves the entered string, or null on cancel. `placeholder` prefills the
 * field where the platform supports it (web only; Alert.prompt has no
 * placeholder concept), and `secure` masks the input on native.
 */
export function promptDialog(opts: {
  title: string;
  message: string;
  placeholder?: string;
  secure?: boolean;
}): Promise<string | null> {
  if (Platform.OS === 'web') {
    // eslint-disable-next-line no-alert
    const value =
      typeof window !== 'undefined'
        ? window.prompt(`${opts.title}\n\n${opts.message}`, opts.placeholder ?? '')
        : null;
    return Promise.resolve(value);
  }
  return new Promise((resolve) => {
    Alert.prompt(
      opts.title,
      opts.message,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
        { text: 'Continue', onPress: (value?: string) => resolve(value ?? '') },
      ],
      opts.secure ? 'secure-text' : 'plain-text',
    );
  });
}
