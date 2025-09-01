import { storage } from "../storage";
import { aiTrainingService } from "./ai-training";

interface AIAgentSignatureData {
  agentName: string;
  companyName?: string;
  companyWebsite?: string;
}

export class AIAgentSignatureService {
  
  /**
   * Generate AI agent email signature based on agent name and company info
   */
  async generateAIAgentSignature(userId: string): Promise<string> {
    try {
      // Get AI agent name, title, and salutation from system settings
      const systemSettings = await storage.getSystemSettings(userId);
      const agentName = systemSettings?.aiAgentName || 'Kai';
      const agentTitle = systemSettings?.aiAgentTitle || 'Customer Service Representative';
      const salutation = systemSettings?.salutation || 'Best regards';
      
      // Get user/company information from database
      const user = await storage.getUser(userId);
      
      // Use company name from system settings first, then user record, with intelligent fallback
      let companyName = systemSettings?.companyName || user?.company;
      
      // If no company name is set, use a more descriptive fallback instead of "Your Company"
      if (!companyName || companyName.trim() === '') {
        companyName = user?.email ? user.email.split('@')[1].replace(/\.[^.]*$/, '').replace(/[.-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Customer Service';
      }
      
      const companyWebsite = user?.signatureCompanyUrl;
      
      console.log('🔧 Generating AI signature:', {
        userId,
        agentName,
        agentTitle,
        companyName,
        salutation,
        fromSystemSettings: !!systemSettings?.companyName,
        fromUserRecord: !!user?.company
      });
      
      return this.createAISignature({
        agentName,
        agentTitle,
        companyName,
        companyWebsite: companyWebsite || undefined,
        salutation,
        signatureFooter: systemSettings?.signatureFooter || "We use AI to solve customer problems faster. Reply 'Human' for immediate escalation."
      });
    } catch (error) {
      console.error('Failed to generate AI agent signature:', error);
      return this.createDefaultSignature();
    }
  }

  /**
   * Create formatted AI agent signature
   */
  private createAISignature(data: AIAgentSignatureData & { agentTitle?: string; salutation?: string; signatureFooter?: string }): string {
    const { agentName, agentTitle = 'AI Customer Service Agent', companyName, companyWebsite, salutation = 'Best regards', signatureFooter = '' } = data;
    
    let signature = `${salutation},\n${agentName}\n`;
    signature += `${agentTitle}\n`;
    signature += `${companyName}`;
    
    // Add footer if provided
    if (signatureFooter && signatureFooter.trim()) {
      signature += `\n\n${signatureFooter}`;
    }
    
    return signature;
  }

  /**
   * Create HTML version of AI agent signature for emails
   */
  async generateAIAgentSignatureHTML(userId: string): Promise<string> {
    try {
      // Get settings from system settings (primary) and training config (fallback)
      const systemSettings = await storage.getSystemSettings(userId);
      const trainingConfig = await aiTrainingService.getTrainingConfig(userId);
      
      const agentName = systemSettings?.aiAgentName || trainingConfig?.aiAgentName || 'Kai';
      const agentTitle = systemSettings?.aiAgentTitle || 'Customer Service Representative';
      const salutation = systemSettings?.salutation || trainingConfig?.salutation || 'Best regards';
      const signatureFooter = systemSettings?.signatureFooter || "We use AI to solve customer problems faster. Reply 'Human' for immediate escalation.";
      
      const user = await storage.getUser(userId);
      
      // Use company name from system settings first, then user record, with intelligent fallback
      let companyName = systemSettings?.companyName || user?.company;
      
      // If no company name is set, use a more descriptive fallback instead of "Your Company"
      if (!companyName || companyName.trim() === '') {
        companyName = user?.email ? user.email.split('@')[1].replace(/\.[^.]*$/, '').replace(/[.-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Customer Service';
      }
      
      const companyWebsite = user?.signatureCompanyUrl;
      
      console.log('🔧 Generating AI HTML signature:', {
        userId,
        agentName,
        agentTitle,
        companyName,
        salutation,
        fromSystemSettings: !!systemSettings?.companyName,
        fromUserRecord: !!user?.company
      });
      
      return this.createAISignatureHTML({
        agentName,
        agentTitle,
        companyName,
        companyWebsite: companyWebsite || undefined,
        salutation,
        signatureFooter
      });
    } catch (error) {
      console.error('Failed to generate AI agent HTML signature:', error);
      return this.createDefaultSignatureHTML();
    }
  }

  /**
   * Create HTML formatted AI agent signature
   */
  private createAISignatureHTML(data: AIAgentSignatureData & { agentTitle?: string; salutation?: string; signatureFooter?: string }): string {
    const { agentName, agentTitle = 'AI Customer Service Agent', companyName, companyWebsite, salutation = 'Best regards', signatureFooter = '' } = data;
    
    let signatureHtml = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', sans-serif; font-size: 14px; line-height: 1.6; color: #333333; margin-top: 20px; border-top: 1px solid #e1e5e9; padding-top: 15px;">
  <div style="margin-bottom: 5px;">${salutation},</div>
  <div style="font-weight: 600; color: #1a1a1a; margin-bottom: 3px;">${agentName}</div>
  <div style="color: #666666; font-size: 13px; margin-bottom: 2px;">${agentTitle}</div>
  <div style="color: #666666; font-size: 13px;">
    ${companyWebsite && companyWebsite.startsWith('http') 
      ? `<a href="${companyWebsite}" style="color: #0066cc; text-decoration: none;">${companyName}</a>` 
      : `${companyName}`
    }
  </div>`;
  
    // Add footer if provided
    if (signatureFooter && signatureFooter.trim()) {
      signatureHtml += `
  <div style="color: #888888; font-size: 12px; margin-top: 10px; font-style: italic; border-top: 1px solid #f0f0f0; padding-top: 8px;">
    ${signatureFooter}
  </div>`;
    }
    
    signatureHtml += `
</div>`;
    
    return signatureHtml.trim();
  }

  /**
   * Default fallback signatures
   */
  private createDefaultSignature(): string {
    return `Best regards,\nKai\nAI Customer Service Agent\nYour Company Customer Service Team`;
  }

  private createDefaultSignatureHTML(): string {
    return `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', sans-serif; font-size: 14px; line-height: 1.6; color: #333333; margin-top: 20px; border-top: 1px solid #e1e5e9; padding-top: 15px;">
  <div style="margin-bottom: 5px;">Best regards,</div>
  <div style="font-weight: 600; color: #1a1a1a; margin-bottom: 3px;">Kai</div>
  <div style="color: #666666; font-size: 13px; margin-bottom: 2px;">AI Customer Service Agent</div>
  <div style="color: #666666; font-size: 13px;">Your Company Customer Service Team</div>
</div>`.trim();
  }

  /**
   * Check if AI agent name has been customized (not default)
   */
  async hasCustomAgentName(userId: string): Promise<boolean> {
    try {
      const trainingConfig = await aiTrainingService.getTrainingConfig(userId);
      return !!(trainingConfig?.aiAgentName && trainingConfig.aiAgentName !== 'Kai');
    } catch {
      return false;
    }
  }
}

export const aiAgentSignatureService = new AIAgentSignatureService();