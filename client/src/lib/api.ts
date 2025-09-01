import { apiRequest } from "./queryClient";

export const api = {
  // Auth
  login: (email: string, password: string) =>
    apiRequest('POST', '/api/auth/login', { email, password }),
    
  register: (userData: { password: string; email: string }) =>
    apiRequest('POST', '/api/auth/register', userData),

  // Dashboard
  getDashboardStats: (userId: string) =>
    apiRequest('GET', `/api/dashboard/stats/${userId}`, undefined),

  // Emails
  getEmails: (userId: string, limit?: number) =>
    apiRequest('GET', `/api/emails/${userId}${limit ? `?limit=${limit}` : ''}`, undefined),

  // Auto-responder rules
  getAutoResponderRules: (userId: string) =>
    apiRequest('GET', `/api/auto-responder-rules/${userId}`, undefined),
    
  createAutoResponderRule: (rule: any) =>
    apiRequest('POST', '/api/auto-responder-rules', rule),
    
  updateAutoResponderRule: (id: string, updates: any) =>
    apiRequest('PUT', `/api/auto-responder-rules/${id}`, updates),
    
  deleteAutoResponderRule: (id: string) =>
    apiRequest('DELETE', `/api/auto-responder-rules/${id}`, undefined),

  // Escalation queue
  getEscalationQueue: (userId: string) =>
    apiRequest('GET', `/api/escalation-queue/${userId}`, undefined),
    
  updateEscalation: (id: string, updates: any) =>
    apiRequest('PUT', `/api/escalation-queue/${id}`, updates),

  // Settings
  getSettings: (userId: string) =>
    apiRequest('GET', `/api/settings/${userId}`, undefined),
    
  updateSettings: (userId: string, settings: any) =>
    apiRequest('PUT', `/api/settings/${userId}`, settings),

  // OAuth
  getGmailAuthUrl: () =>
    apiRequest('GET', '/api/oauth/gmail/auth', undefined),
    
  getOutlookAuthUrl: () =>
    apiRequest('GET', '/api/oauth/outlook/auth', undefined),
    
  connectGmail: (userId: string, code: string) =>
    apiRequest('POST', '/api/oauth/gmail/connect', { userId, code }),
    
  connectOutlook: (userId: string, code: string) =>
    apiRequest('POST', '/api/oauth/outlook/connect', { userId, code }),

  // Store connections
  getStoreConnections: async (userId: string) => {
    const response = await apiRequest('GET', `/api/store-connections/${userId}`, undefined);
    return response.json();
  },
    
  createStoreConnection: (connection: any) =>
    apiRequest('POST', '/api/store-connections', connection),
    
  deleteStoreConnection: (id: string) =>
    apiRequest('DELETE', `/api/store-connections/${id}`, undefined),
    
  testStoreConnection: (connectionData: any) =>
    apiRequest('POST', '/api/store-connections/test', connectionData),

  // Email accounts
  getEmailAccounts: (userId: string) =>
    apiRequest('GET', `/api/email-accounts/${userId}`, undefined),
    
  deleteEmailAccount: (id: string) =>
    apiRequest('DELETE', `/api/email-accounts/${id}`, undefined),

  // System
  testConnections: (userId: string) =>
    apiRequest('POST', `/api/test-connections/${userId}`, {}),
    
  processEmails: (userId: string) =>
    apiRequest('POST', `/api/process-emails/${userId}`, {}),
    
  verifyDomain: (userId: string, domain: string) =>
    apiRequest('POST', '/api/verify-domain', { userId, domain }),

  // Logs
  getLogs: (params?: { category?: string; level?: string; limit?: number }) =>
    apiRequest('GET', `/api/logs${params ? '?' + new URLSearchParams(params as any).toString() : ''}`, undefined),
};
