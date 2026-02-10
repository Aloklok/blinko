import { PgBoss } from 'pg-boss';

let boss: PgBoss | null = null;

/**
 * Get or create the pg-boss instance
 * Uses singleton pattern to ensure only one instance exists
 */
export async function getPgBoss(): Promise<PgBoss> {
  if (!boss) {
    const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is not set');
    }

    // Use DIRECT_URL directly if available, otherwise apply Supabase fix
    let bossConnectionString = connectionString;
    if (!process.env.DIRECT_URL && connectionString.includes('pooler.supabase.com') && connectionString.includes('6543')) {
      console.log('[pg-boss] DIRECT_URL not set. Detected Supabase Transaction Pooler (6543) in DATABASE_URL. Switching to Session Mode (5432) for pg-boss...');
      try {
        const url = new URL(connectionString);
        url.port = '5432';
        url.searchParams.delete('pgbouncer');
        bossConnectionString = url.toString();
      } catch (e) {
        console.warn('[pg-boss] Failed to parse connection string, falling back to string replacement', e);
        bossConnectionString = connectionString.replace('6543', '5432').replace('?pgbouncer=true', '').replace('&pgbouncer=true', '');
      }
    } else if (process.env.DIRECT_URL) {
      console.log('[pg-boss] Using DIRECT_URL for stable connection.');
    }

    boss = new PgBoss({
      connectionString: bossConnectionString,
      schema: 'pgboss',
      // Limit connection pool for background jobs
      // Reduced to 2 to avoid "MaxClientsInSessionMode" error on free tier Supabase
      max: 2,
      // Retry configuration
      retryLimit: 3,
      retryDelay: 60, // seconds
      retryBackoff: true,
      // Archive completed jobs after 1 day
      archiveCompletedAfterSeconds: 60 * 60 * 24,
      // Delete archived jobs after 7 days
      deleteAfterSeconds: 60 * 60 * 24 * 7,
      // Monitor state every 30 seconds
      monitorStateIntervalSeconds: 30,
    });

    boss.on('error', (error) => {
      console.error('[pg-boss] Error:', error);
    });

    boss.on('monitor-states', (states) => {
      if (states.all.active > 0) {
        console.log(`[pg-boss] Active jobs: ${states.all.active}`);
      }
    });

    await boss.start();
    console.log('[pg-boss] Started successfully');
  }

  return boss;
}

/**
 * Stop the pg-boss instance gracefully
 */
export async function stopPgBoss(): Promise<void> {
  if (boss) {
    console.log('[pg-boss] Stopping...');
    await boss.stop({ graceful: true, timeout: 30000 });
    boss = null;
    console.log('[pg-boss] Stopped successfully');
  }
}

/**
 * Check if pg-boss is running
 */
export function isPgBossRunning(): boolean {
  return boss !== null;
}

