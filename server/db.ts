import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

// Configure WebSocket for Neon with proper error handling
neonConfig.webSocketConstructor = ws;

// Set connection timeout and retry configuration
neonConfig.wsProxy = (host) => `${host}?sslmode=require`;
neonConfig.useSecureWebSocket = true;
neonConfig.pipelineConnect = false; // Disable pipeline for better stability

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Enhanced pool configuration with better error handling
const poolConfig = {
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  allowExitOnIdle: true,
  maxUses: 7500,
  maxLifetimeSeconds: 300, // 5 minutes
};

export const pool = new Pool(poolConfig);

// Add error handlers to prevent crashes
pool.on('error', (err) => {
  console.error('[DATABASE] Pool error:', err);
});

pool.on('connect', () => {
  console.log('[DATABASE] Client connected');
});

pool.on('remove', () => {
  console.log('[DATABASE] Client removed');
});

export const db = drizzle({ client: pool, schema });

// Test connection on startup with retry logic
export async function testDatabaseConnection() {
  let retries = 3;
  while (retries > 0) {
    try {
      const client = await pool.connect();
      await client.query('SELECT 1');
      client.release();
      console.log('[DATABASE] Connection test successful');
      return true;
    } catch (error) {
      console.error(`[DATABASE] Connection test failed (${retries} retries left):`, (error as Error).message);
      retries--;
      if (retries > 0) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds before retry
      }
    }
  }
  console.warn('[DATABASE] Connection test failed after all retries. App will continue but database features may be limited.');
  return false;
}

// Initialize connection test on module load
testDatabaseConnection().catch(err => {
  console.error('[DATABASE] Failed to test connection:', err.message);
});