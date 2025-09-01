// OAuth-related storage methods for email routing
import { storage } from "./storage";

export async function getEmailAccounts(userId: string) {
  const { emailAccounts } = await import('@shared/schema');
  const { db } = await import('./db');
  const { eq } = await import('drizzle-orm');
  
  return await db
    .select()
    .from(emailAccounts)
    .where(eq(emailAccounts.userId, userId));
}

export async function updateOAuthConnectionStatus(userId: string, provider: 'gmail' | 'outlook', connected: boolean, email?: string) {
  const settings = await storage.getSystemSettings(userId);
  
  const updates: any = {};
  
  if (provider === 'gmail') {
    updates.gmailConnected = connected;
    if (!settings.preferredOAuthProvider) {
      updates.preferredOAuthProvider = 'gmail';
    }
  } else if (provider === 'outlook') {
    updates.outlookConnected = connected;
    if (!settings.preferredOAuthProvider) {
      updates.preferredOAuthProvider = 'outlook';
    }
  }
  
  // Set OAuth as primary method when first provider is connected
  if (connected && settings.primaryEmailMethod !== 'oauth') {
    updates.primaryEmailMethod = 'oauth';
  }
  
  return await storage.updateSystemSettings(userId, updates);
}

// Add to main storage class
declare module "./storage" {
  interface IStorage {
    getEmailAccounts(userId: string): Promise<any[]>;
    updateOAuthConnectionStatus(userId: string, provider: 'gmail' | 'outlook', connected: boolean, email?: string): Promise<any>;
    updateEmailAccountTokens(accountId: string, tokens: {
      accessToken: string;
      refreshToken?: string;
      expiresAt?: Date;
    }): Promise<void>;
  }
}

// Extend storage with new methods
Object.assign(storage, {
  getEmailAccounts,
  updateOAuthConnectionStatus
});