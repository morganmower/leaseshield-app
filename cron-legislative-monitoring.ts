// Monthly legislative monitoring cron job
// This script is executed by Replit Scheduled Deployments on the 1st of each month

const CRON_SECRET = process.env.CRON_SECRET || 'dev-secret-change-in-production';
const APP_URL = process.env.REPLIT_DOMAINS?.split(',')[0] || 'http://localhost:5000';

async function runMonitoring() {
  try {
    console.log('🔄 Starting monthly legislative monitoring...');
    console.log(`📍 Target: ${APP_URL}/api/cron/legislative-monitoring`);

    const response = await fetch(`${APP_URL}/api/cron/legislative-monitoring`, {
      method: 'POST',
      headers: {
        'X-Cron-Secret': CRON_SECRET,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`Monitoring failed: ${JSON.stringify(data)}`);
    }

    console.log('✅ Legislative monitoring completed successfully');
    console.log('📊 Result:', JSON.stringify(data, null, 2));
    process.exit(0);
  } catch (error) {
    console.error('❌ Legislative monitoring failed:', error);
    process.exit(1);
  }
}

runMonitoring();
