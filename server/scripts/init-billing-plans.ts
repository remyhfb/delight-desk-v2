/**
 * Initialize billing plans in the database
 * Run this script to ensure all billing plans exist in the database
 * Usage: npm run init-billing-plans
 */

import { db } from "../db";
import { billingPlans } from "@shared/schema";
import { eq } from "drizzle-orm";
import { getAllPlanConfigs } from "@shared/pricing-utils";

// Get billing plans from centralized configuration - no more hardcoding!
const BILLING_PLANS = getAllPlanConfigs().map(config => ({
  id: config.id,
  name: config.name,
  displayName: config.displayName,
  price: config.price.toFixed(2),
  resolutions: config.resolutions,
  storeLimit: config.storeLimit,
  emailLimit: config.emailLimit,
  features: config.features,
  isActive: config.isActive
}));

export default async function initBillingPlans() {
  console.log('=== Initializing Billing Plans ===');
  console.log('Database URL configured:', !!process.env.DATABASE_URL);
  console.log('Environment:', process.env.NODE_ENV || 'development');
  console.log('');

  try {
    // First, check existing plans
    console.log('Checking existing plans in database...');
    const existingPlans = await db.select().from(billingPlans);
    console.log(`Found ${existingPlans.length} existing plans`);
    
    if (existingPlans.length > 0) {
      console.log('Existing plans:');
      existingPlans.forEach(plan => {
        console.log(`  - ${plan.name} (${plan.id}): ${plan.displayName} - $${plan.price} - Active: ${plan.isActive}`);
      });
    }

    // Insert or update each plan
    for (const plan of BILLING_PLANS) {
      console.log(`\nProcessing plan: ${plan.displayName} (${plan.id})`);
      
      // Check if plan exists
      const [existingPlan] = await db
        .select()
        .from(billingPlans)
        .where(eq(billingPlans.id, plan.id));
      
      if (existingPlan) {
        // Update existing plan
        console.log(`  Plan exists. Updating...`);
        await db
          .update(billingPlans)
          .set({
            name: plan.name,
            displayName: plan.displayName,
            price: plan.price,
            resolutions: plan.resolutions,
            storeLimit: plan.storeLimit,
            emailLimit: plan.emailLimit,
            features: plan.features,
            isActive: plan.isActive,
            createdAt: existingPlan.createdAt // Preserve original creation date
          })
          .where(eq(billingPlans.id, plan.id));
        console.log(`  ✓ Updated successfully`);
      } else {
        // Insert new plan
        console.log(`  Plan does not exist. Creating...`);
        await db
          .insert(billingPlans)
          .values({
            id: plan.id,
            name: plan.name,
            displayName: plan.displayName,
            price: plan.price,
            resolutions: plan.resolutions,
            storeLimit: plan.storeLimit,
            emailLimit: plan.emailLimit,
            features: plan.features,
            isActive: plan.isActive,
            createdAt: new Date()
          });
        console.log(`  ✓ Created successfully`);
      }
    }

    // Verify all plans are now in the database
    console.log('\n=== Verification ===');
    const finalPlans = await db
      .select()
      .from(billingPlans)
      .where(eq(billingPlans.isActive, true));
    
    console.log(`Total active plans in database: ${finalPlans.length}`);
    finalPlans.forEach(plan => {
      console.log(`  ✓ ${plan.name} (${plan.id}): ${plan.displayName} - $${plan.price}`);
    });

    console.log('\n✅ Billing plans initialization completed successfully!');
    // Don't exit - let the calling code handle process lifecycle
  } catch (error) {
    console.error('\n❌ Error initializing billing plans:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    throw error; // Throw instead of exit to let caller handle
  }
}

// Run the initialization if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  initBillingPlans();
}