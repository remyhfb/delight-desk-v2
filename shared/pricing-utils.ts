// Centralized pricing utility to ensure consistency across the application

// Plan configuration - Single source of truth for all plan details
export const PLAN_CONFIGS = {
  solopreneur: {
    id: 'cf730916-6324-4849-9446-e2e4c49ec7e9',
    name: 'solopreneur',
    displayName: 'Solopreneur',
    price: 9.00,
    resolutions: 10,
    storeLimit: 1,
    emailLimit: null,
    costPerResolution: 0.80,
    features: [
      'Unlimited access to AI Assistant',
      'Full Platform Access Included',
      'AI automations and Quick Actions',
      '🏪 Connect 1 Store Platform',
      'Support: Email'
    ],
    isActive: true
  },
  growth: {
    id: '203404b0-bcfa-406a-87a4-85b5eb08e8e0',
    name: 'growth',
    displayName: 'Growth',
    price: 45.00,
    resolutions: 40,
    storeLimit: 3,
    emailLimit: null,
    costPerResolution: 0.75,
    features: [
      'Unlimited access to AI Assistant',
      'Full Platform Access Included',
      'AI automations and Quick Actions',
      '🏪 Connect 2-5 Store Platforms',
      'Support: Priority Email + Phone'
    ],
    isActive: true
  },
  scale: {
    id: 'f9f0e453-422a-43a9-9f18-be9d4dec0475',
    name: 'scale',
    displayName: 'Scale',
    price: 80.00,
    resolutions: 100,
    storeLimit: 10,
    emailLimit: null,
    costPerResolution: 0.70,
    features: [
      'Unlimited access to AI Assistant',
      'Full Platform Access Included',
      'AI automations and Quick Actions',
      '🏪 Connect 5+ Store Platforms',
      'Support: Priority Email + Phone + Slack'
    ],
    isActive: true
  }
};

// Legacy exports for backward compatibility
export const COST_PER_RESOLUTION_RATES = {
  solopreneur: PLAN_CONFIGS.solopreneur.costPerResolution,
  growth: PLAN_CONFIGS.growth.costPerResolution,
  scale: PLAN_CONFIGS.scale.costPerResolution
};

export const PLAN_PRICING = {
  solopreneur: PLAN_CONFIGS.solopreneur.price,
  growth: PLAN_CONFIGS.growth.price,
  scale: PLAN_CONFIGS.scale.price
};

export function getCostPerResolution(planName: string): number {
  const normalizedName = planName.toLowerCase() as keyof typeof COST_PER_RESOLUTION_RATES;
  return COST_PER_RESOLUTION_RATES[normalizedName] || 0.80; // fallback to solopreneur rate
}

export function getPlanPrice(planName: string): number {
  const normalizedName = planName.toLowerCase() as keyof typeof PLAN_PRICING;
  return PLAN_PRICING[normalizedName] || PLAN_CONFIGS.solopreneur.price; // dynamic fallback
}

export function getIncludedAutomations(price: number, planName: string): number {
  const costPerResolution = getCostPerResolution(planName);
  return Math.floor(price / costPerResolution);
}

export function getIncludedAutomationsByPlan(planName: string): number {
  const price = getPlanPrice(planName);
  return getIncludedAutomations(price, planName);
}

// API Usage Limits - AfterShip based on automations, OpenAI unlimited
export function getApiLimits(planName: string) {
  const totalAutomations = getIncludedAutomationsByPlan(planName);
  
  // Development/testing override - use higher limits when testing
  const isDevelopment = process.env.NODE_ENV === 'development' || process.env.ENABLE_TESTING_LIMITS === 'true';
  
  return {
    // AfterShip: Limited by total automations they've paid for (monthly limit only)
    aftership: { 
      daily: Infinity, // No daily limits for AfterShip
      monthly: isDevelopment ? 500 : totalAutomations, // Use testing limits in development
      unlimited: false 
    },
    // OpenAI: No limits, just usage tracking  
    openai: { 
      daily: Infinity, // No daily limits
      monthly: Infinity, // No monthly limits
      unlimited: true 
    }
  };
}

export function formatCostPerResolution(planName: string): string {
  const cost = getCostPerResolution(planName);
  return `$${cost.toFixed(2)} per AI agent resolution`;
}

export function formatIncludedAutomations(price: number, planName: string): string {
  const count = getIncludedAutomations(price, planName);
  return `~${count} automations included in base price`;
}

// Get all plan configurations as an array for database initialization
export function getAllPlanConfigs() {
  return Object.values(PLAN_CONFIGS);
}

// Get plan config by name
export function getPlanConfig(planName: string) {
  const normalizedName = planName.toLowerCase() as keyof typeof PLAN_CONFIGS;
  return PLAN_CONFIGS[normalizedName];
}