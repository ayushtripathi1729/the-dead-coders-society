let lastSyncTime = 0;
const SYNC_INTERVAL = 2 * 60 * 1000; // 2 minutes

export async function initializeBackgroundScheduler() {
  // This function would be called at app startup to initialize the scheduler
  // In production, you'd use a dedicated scheduler like node-cron or a service like Bull
  setInterval(triggerBackgroundSync, SYNC_INTERVAL);
}

async function triggerBackgroundSync() {
  const now = Date.now();
  if (now - lastSyncTime < SYNC_INTERVAL) return;
  lastSyncTime = now;

  // This would trigger the background sync endpoint
  // In production, use a proper scheduler or webhook
  try {
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    await fetch(`${baseUrl}/api/background/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret: process.env.BACKGROUND_JOB_SECRET }),
    });
  } catch (error) {
    console.error("Background sync failed:", error);
  }
}
