import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

const ID = 'daily-art-reminder';

/** Schedules (or clears) the gentle 9am daily reminder. Returns false if permission was refused. */
export async function setDailyReminder(enabled: boolean): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  await Notifications.cancelScheduledNotificationAsync(ID).catch(() => {});
  if (!enabled) return true;
  const perm = await Notifications.requestPermissionsAsync();
  if (!perm.granted) return false;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('daily', { name: 'Daily art', importance: Notifications.AndroidImportance.DEFAULT });
  }
  await Notifications.scheduleNotificationAsync({
    identifier: ID,
    content: { title: "Today's masterwork is ready", body: 'A new public-domain artwork is waiting on your workbench.' },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: 9, minute: 0, channelId: 'daily' },
  });
  return true;
}
