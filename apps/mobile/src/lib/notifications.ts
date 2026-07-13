/**
 * Notification wiring (P8): the pure plan from @hearth/core reconciled
 * against what iOS actually has pending. Called after every med write and
 * on every app foreground; background execution is never load-bearing.
 */
import * as Notifications from 'expo-notifications';
import {
  planNotifications,
  reconcile,
  type DesiredNotification,
  type PlanMedInput,
} from '@hearth/core';
import { getNotificationPrefs, listAllMedications } from '../db/repo';
import { today } from './clock';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function ensureNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const req = await Notifications.requestPermissionsAsync();
  return req.granted;
}

function triggerFor(n: DesiredNotification): Notifications.NotificationTriggerInput {
  const [y, m, d] = n.fireDate.split('-').map(Number);
  const fire = new Date(y!, m! - 1, d!, Math.floor(n.fireMinutes / 60), n.fireMinutes % 60, 0);
  return { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fire };
}

/**
 * Diff-reconcile pending alerts with the desired plan. Safe to call often;
 * identical plans are a no-op.
 */
export async function syncNotifications(): Promise<{ scheduled: number; canceled: number }> {
  const granted = await ensureNotificationPermission();
  if (!granted) return { scheduled: 0, canceled: 0 };

  const meds: PlanMedInput[] = listAllMedications().map((m) => ({
    medicationId: m.id,
    patientId: m.patientId,
    active: m.active,
    prn: m.prn,
    runway: m.runway,
  }));
  const desired = planNotifications(meds, getNotificationPrefs(), today());

  const pending = await Notifications.getAllScheduledNotificationsAsync();
  const existingKeys = pending.map((p) => p.identifier);
  const plan = reconcile(desired, existingKeys);

  for (const key of plan.toCancel) {
    await Notifications.cancelScheduledNotificationAsync(key);
  }
  for (const n of plan.toSchedule) {
    await Notifications.scheduleNotificationAsync({
      identifier: n.key,
      content: {
        title: n.title,
        body: n.body,
        // PHI-free by rule; the route only carries opaque ids.
        data: { route: n.route },
      },
      trigger: triggerFor(n),
    });
  }
  return { scheduled: plan.toSchedule.length, canceled: plan.toCancel.length };
}
