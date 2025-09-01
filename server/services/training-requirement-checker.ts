import { db } from "../db";
import { eq, and } from "drizzle-orm";
import { trainingUrls, manualTrainingContent } from "@shared/schema";
import { logger, LogCategory } from "./logger";

export interface TrainingRequirement {
  hasMinimumContent: boolean;
  urlCount: number;
  manualContentCount: number;
  totalSources: number;
  warning?: string;
}

export class TrainingRequirementChecker {
  
  /**
   * Check if user has minimum training content required for AI automation
   */
  async checkTrainingRequirements(userId: string): Promise<TrainingRequirement> {
    try {
      // Count completed training URLs
      const completedUrls = await db
        .select({ count: trainingUrls.id })
        .from(trainingUrls)
        .where(
          and(
            eq(trainingUrls.userId, userId),
            eq(trainingUrls.status, 'completed')
          )
        );

      const urlCount = completedUrls.length;

      // Count manual training content
      const manualContent = await db
        .select({ count: manualTrainingContent.id })
        .from(manualTrainingContent)
        .where(eq(manualTrainingContent.userId, userId));

      const manualContentCount = manualContent.length;
      const totalSources = urlCount + manualContentCount;

      // Minimum requirement: at least 1 piece of training content
      const hasMinimumContent = totalSources >= 1;

      let warning: string | undefined;
      if (!hasMinimumContent) {
        warning = "AI automation requires at least 1 training source (URL or manual content) to prevent generic responses that could harm your business.";
      }

      logger.info(LogCategory.SYSTEM, 'Training requirement check completed', {
        userId,
        urlCount,
        manualContentCount,
        totalSources,
        hasMinimumContent
      });

      return {
        hasMinimumContent,
        urlCount,
        manualContentCount,
        totalSources,
        warning
      };

    } catch (error) {
      logger.error(LogCategory.SYSTEM, 'Failed to check training requirements', { userId, error });
      
      // Default to safe mode - require training data
      return {
        hasMinimumContent: false,
        urlCount: 0,
        manualContentCount: 0,
        totalSources: 0,
        warning: "Unable to verify training content. Please add training data before enabling automation."
      };
    }
  }

  /**
   * Validate if automation can be enabled for this user
   */
  async canEnableAutomation(userId: string): Promise<{ allowed: boolean; reason?: string }> {
    const requirements = await this.checkTrainingRequirements(userId);
    
    if (!requirements.hasMinimumContent) {
      return {
        allowed: false,
        reason: "AI automation requires at least 1 training source (URL or manual content). Add training data in the AI Team Center before enabling automation."
      };
    }

    return { allowed: true };
  }

  /**
   * Get training requirement status for UI display
   */
  async getTrainingStatus(userId: string): Promise<{
    status: 'sufficient' | 'insufficient' | 'error';
    message: string;
    details: TrainingRequirement;
  }> {
    const requirements = await this.checkTrainingRequirements(userId);
    
    if (requirements.hasMinimumContent) {
      return {
        status: 'sufficient',
        message: `Training data available: ${requirements.totalSources} source${requirements.totalSources === 1 ? '' : 's'} (${requirements.urlCount} URLs, ${requirements.manualContentCount} manual content)`,
        details: requirements
      };
    } else {
      return {
        status: 'insufficient',
        message: requirements.warning || 'No training data found. Add at least 1 URL or manual training content.',
        details: requirements
      };
    }
  }
}

export const trainingRequirementChecker = new TrainingRequirementChecker();