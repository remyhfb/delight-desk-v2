-- SQL script to ensure billing plans exist in production database
-- This can be run directly on the production database if needed

-- Insert billing plans with ON CONFLICT DO UPDATE to handle existing records
INSERT INTO billing_plans (id, name, display_name, price, store_limit, email_limit, features, is_active, created_at)
VALUES 
  (
    'cf730916-6324-4849-9446-e2e4c49ec7e9',
    'starter',
    'Starter',
    '29.00',
    1,
    NULL,
    ARRAY[
      'Up to 1 store connection',
      'Automated order status updates',
      'AI email classification',
      'Basic refund processing',
      'Email routing & forwarding',
      '7-day free trial'
    ],
    true,
    CURRENT_TIMESTAMP
  ),
  (
    '203404b0-bcfa-406a-87a4-85b5eb08e8e0',
    'growth',
    'Growth',
    '79.00',
    3,
    NULL,
    ARRAY[
      'Up to 3 store connections',
      'Advanced automation rules',
      'Promo code management',
      'Subscription lifecycle automation',
      'Priority email processing',
      'Advanced analytics',
      '7-day free trial'
    ],
    true,
    CURRENT_TIMESTAMP
  ),
  (
    'f9f0e453-422a-43a9-9f18-be9d4dec0475',
    'scale',
    'Scale',
    '199.00',
    10,
    NULL,
    ARRAY[
      'Up to 10 store connections',
      'White-label email responses',
      'Custom automation workflows',
      'Dedicated account manager',
      'Priority support',
      'Custom integrations',
      '7-day free trial'
    ],
    true,
    CURRENT_TIMESTAMP
  )
ON CONFLICT (id) 
DO UPDATE SET
  name = EXCLUDED.name,
  display_name = EXCLUDED.display_name,
  price = EXCLUDED.price,
  store_limit = EXCLUDED.store_limit,
  email_limit = EXCLUDED.email_limit,
  features = EXCLUDED.features,
  is_active = EXCLUDED.is_active;

-- Verify the plans were inserted/updated
SELECT id, name, display_name, price, is_active 
FROM billing_plans 
ORDER BY price::numeric;