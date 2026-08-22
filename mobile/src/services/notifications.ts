// Notifications disabled until backend admin notification service is ready

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  return null;
}

export async function scheduleLocalNotification(_title: string, _body: string, _seconds = 1): Promise<void> {
  // Notification function disabled
  return;
}
