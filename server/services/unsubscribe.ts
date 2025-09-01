import { nanoid } from 'nanoid';
import { storage } from '../storage';
import { logger, LogCategory } from './logger';
import type { EmailPreferences, InsertEmailPreferences } from '@shared/schema';

export interface UnsubscribeService {
  generateUnsubscribeToken(userId: string, email: string): Promise<string>;
  generateUnsubscribeUrl(email: string, type?: string): Promise<string>;
  processUnsubscribe(token: string, type?: string): Promise<{ success: boolean; email?: string; error?: string }>;
  getEmailPreferences(email: string): Promise<EmailPreferences | null>;
  updateEmailPreferences(email: string, preferences: Partial<EmailPreferences>): Promise<boolean>;
  isUnsubscribed(email: string, type: string): Promise<boolean>;
}

class UnsubscribeServiceImpl implements UnsubscribeService {
  private readonly baseUrl = process.env.REPLIT_URL || 'https://delightdesk.io';

  async generateUnsubscribeToken(userId: string, email: string): Promise<string> {
    // Check if preferences already exist
    let preferences = await storage.getEmailPreferences(email);
    
    if (!preferences) {
      // Create new preferences record
      const token = nanoid(32);
      const newPreferences: InsertEmailPreferences = {
        userId,
        email,
        unsubscribeToken: token,
        unsubscribedFromMarketing: false,
        unsubscribedFromTrialReminders: false,
        unsubscribedFromWeeklyReports: false,
        unsubscribedFromAll: false,
      };
      
      await storage.createEmailPreferences(newPreferences);
      return token;
    }
    
    return preferences.unsubscribeToken;
  }

  async generateUnsubscribeUrl(email: string, type: string = 'all'): Promise<string> {
    const preferences = await storage.getEmailPreferences(email);
    
    if (!preferences) {
      throw new Error('Email preferences not found');
    }
    
    const params = new URLSearchParams({
      token: preferences.unsubscribeToken,
      email: email,
      type: type
    });
    
    return `${this.baseUrl}/unsubscribe?${params.toString()}`;
  }

  async processUnsubscribe(token: string, type: string = 'all'): Promise<{ success: boolean; email?: string; error?: string }> {
    try {
      const preferences = await storage.getEmailPreferencesByToken(token);
      
      if (!preferences) {
        return { success: false, error: 'Invalid unsubscribe token' };
      }

      // Update preferences based on type
      const updates: Partial<EmailPreferences> = {};
      
      switch (type) {
        case 'marketing':
          updates.unsubscribedFromMarketing = true;
          break;
        case 'trial':
          updates.unsubscribedFromTrialReminders = true;
          break;
        case 'weekly':
          updates.unsubscribedFromWeeklyReports = true;
          break;
        case 'all':
        default:
          updates.unsubscribedFromAll = true;
          updates.unsubscribedFromMarketing = true;
          updates.unsubscribedFromTrialReminders = true;
          updates.unsubscribedFromWeeklyReports = true;
          break;
      }

      const success = await storage.updateEmailPreferences(preferences.email, updates);
      
      return { success, email: preferences.email };
    } catch (error) {
      logger.error(LogCategory.SYSTEM, 'Unsubscribe error', { error: error instanceof Error ? error.message : 'Unknown error' });
      return { success: false, error: 'Failed to process unsubscribe request' };
    }
  }

  async getEmailPreferences(email: string): Promise<EmailPreferences | null> {
    return await storage.getEmailPreferences(email);
  }

  async updateEmailPreferences(email: string, preferences: Partial<EmailPreferences>): Promise<boolean> {
    return await storage.updateEmailPreferences(email, preferences);
  }

  async isUnsubscribed(email: string, type: string): Promise<boolean> {
    const preferences = await storage.getEmailPreferences(email);
    
    if (!preferences) {
      return false; // If no preferences exist, assume they're subscribed
    }

    // Check if unsubscribed from all
    if (preferences.unsubscribedFromAll) {
      return true;
    }

    // Check specific type
    switch (type) {
      case 'marketing':
        return preferences.unsubscribedFromMarketing || false;
      case 'trial':
        return preferences.unsubscribedFromTrialReminders || false;
      case 'weekly':
        return preferences.unsubscribedFromWeeklyReports || false;
      default:
        return false;
    }
  }
}

export const unsubscribeService = new UnsubscribeServiceImpl();