import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";

// Native taps in the iOS app; a short vibration where browsers support it
// (Android); nothing elsewhere. Failures are ignored: feedback is a nicety.

const native = () => Capacitor.isNativePlatform();

/** Light tap, e.g. marking a card owned. */
export function tapFeedback() {
  if (native()) Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
  else navigator.vibrate?.(8);
}

/** Success pattern, e.g. completing a set. */
export function successFeedback() {
  if (native()) Haptics.notification({ type: NotificationType.Success }).catch(() => {});
  else navigator.vibrate?.([12, 60, 24]);
}
