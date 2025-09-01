# Overview
"Delight Desk Agent" is a full-stack customer service automation system for small e-commerce businesses using WooCommerce. Its purpose is to enhance customer satisfaction, reduce response times, and streamline support operations through AI-powered auto-responders, Quick Actions, and efficient order management. The system is designed to prevent AI responses that could negatively impact revenue or customer relationships, providing an accessible, powerful AI-driven solution for scaling customer service. The business vision is to empower small e-commerce businesses (0-1 customer service reps, 50-200 emails/month) with enterprise-grade AI capabilities.

# User Preferences
Preferred communication style: Simple, everyday language.
UI Design: Prioritize speed and efficiency - minimal clicks, minimal fields, maximum automation.
Quick Actions: One-click actions with minimal user input - no unnecessary fields or features.
Visual Hierarchy: Avoid over-nesting cards or containers. Keep related information at the same visual level for easier consumption. Simpler layouts are preferred over complex nested structures.
Single User System: The system is designed for single-user operation targeting businesses with 0-1 full-time customer service representatives. No user assignment, ticket routing, or multi-user functionality should be implemented.
Individual Agent Controls: The system uses individual agent-based toggles (WISMO, Subscription, Returns, etc.) without a master automations switch. Each agent can be enabled/disabled independently through their respective configuration pages.
AI Agent Branding: The system is consistently branded as the "Delight Desk Agent" using clear "AI agent" terminology throughout the interface.
Email Template Testing: MANDATORY PROCESS - Always send test email immediately after any email template changes. User needs to verify visual changes, never make template changes without sending test email.
Email Template Change Checklist: CRITICAL PROCESS - When making email template changes: 1. Make code changes. 2. Verify changes are saved in file. 3. Clear any potential caching issues. 4. Send test email. 5. Verify changes appear in actual received email.
Architecture Principles: Use database constraints and built-in database features for data integrity instead of complex application logic. Let PostgreSQL handle what it's designed to handle (uniqueness, constraints, etc.) rather than implementing duplicate checking in application code.
Simplicity First: The simplest solution is always the best solution. Always look for existing data or simple direct approaches before creating complex mapping systems, transformation logic, or abstraction layers. Use what's already there before building something new.
Code Quality Standards: NEVER write band-aid, override, bypass, or workaround code under ANY circumstances. Always find and fix the root cause. Override code creates technical debt and is completely unacceptable amateur development. If logic isn't working, debug and fix the actual issue - never create "overrides" or "bypasses" to work around problems.

# System Architecture
### Backend
- **Framework**: Express.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Session-based with OAuth
- **API Design**: RESTful
- **Email Processing**: Multi-pipeline (real-time Gmail Push, OAuth-triggered, manual fallback) with atomic processing that combines classification and routing in one operation. Emails go directly from "processing" to "escalated" or "resolved" status. Bulletproof fallback logic ensures ALL emails reach AI Assistant if any step fails.
- **Order Lookup**: Integrated with WooCommerce for order, customer, subscription data, tracking, and refund processing.
- **Security**: Route-level authentication, admin access control, rate limiting, input validation, security headers, XSS protection.
- **Session Persistence**: PostgreSQL session store (7-day rolling persistence).
- **Professional RAG System**: Enterprise-grade semantic chunking (1500-character optimal chunks), vector embeddings using OpenAI Ada-002, intelligent text fallback, and 0.70-0.75 similarity thresholds. Multi-tenant architecture with user isolation.
- **AI Guard Rails**: Sentiment analysis, research-based confidence levels, enterprise-grade hallucination prevention, intelligent response filtering, business safety guard system with 6 critical rules. Content safety validation through OpenAI. Activity logging for all AI agent actions.
- **Payment Processing**: Exclusively Stripe live mode.

### Frontend
- **Framework**: React with TypeScript
- **Routing**: Wouter
- **State Management**: TanStack Query
- **UI Components**: Radix UI with shadcn/ui styling
- **Styling**: Tailwind CSS with CSS variables, Stripe-inspired aesthetic.
- **Form Handling**: React Hook Form with Zod validation.
- **UI/UX Decisions**: Clean, minimalist, efficient single-screen dashboard. Mobile-first design with optimized email templates. Superhuman-style vertical timelines. "AI Team Center" organized into AI Knowledge, AI Identity, Voice & Settings, AI Performance. Layout pattern `max-w-6xl mx-auto p-6 space-y-6` for all pages. Sidebar uses modern SaaS design pattern with primary navigation and a collapsible "Settings & More" dropdown. Admin panel uses flat tab navigation.

### Build System
- **Development**: Vite
- **Production**: ESBuild (backend), Vite (frontend)
- **TypeScript**: Strict type checking.

### Feature Specifications
- AI-powered Email Classification with Industry-Standard Vector Embeddings and Thread Context.
- **Breakthrough RAG Architecture**: Professional semantic chunking system with automatic processing, multi-tenant `content_chunks` and `manual_training_content` database tables. Automatic chunking triggers on content updates. Background processing prevents timeouts.
- Reactive Automation Rules & Quick Actions Module.
- Smart Lookup (orders, subscriptions, customers).
- Analytics Dashboard and Approval Queue.
- Two-Way Email Inbox Synchronization.
- Professional Web Scraping System for AI training with automatic semantic chunking and vector embedding generation.
- **AI Assistant with Comprehensive Feedback System**: Full escalation queue management with AI-powered response suggestions, detailed feedback collection ("Wrong tone/style", "Factually incorrect", "Too generic", "Missed context", "Violates policy"), edit tracking analytics, and performance insights for continuous training improvement. Includes brand voice tuning recommendations based on feedback patterns.
- Onboarding Drip System and Weekly Report System.
- Minimalist Email Templating.
- WooCommerce Integration Logging.
- Robust Subscription Conversion Flow and Date Handling.
- Two-Tier Usage Notification System for API limits.
- Manual Rejection Analytics System.
- Real-time Gmail Push Notification System.
- Product Agent for product/brand related questions.
- Automated AI agent signature system (text and HTML, configurable salutations).
- Empathetic and concise natural response generation.
- Business Intelligence system for managing customer experience goals, including multi-tenant business vertical intelligence.
- AI agent synchronization across pages using centralized API endpoints and cache invalidation.
- AI Agent Name Suggestions: GPT-4o powered, requires 500+ words of brand content.
- AI Agent Naming: Uses culturally diverse professional assistant names.
- Email Reputation Protection: Comprehensive validation to prevent sends to test/demo/invalid addresses.

# External Dependencies
- **Gmail**: OAuth integration
- **Microsoft Outlook 365**: Microsoft Graph API v1.0
- **SendGrid**: For DelightDesk-to-customer emails
- **WooCommerce**: REST API
- **OpenAI**: GPT-4o
- **AfterShip**: AI delivery predictions, tracking data
- **Amazon Comprehend**: Real-time sentiment analysis
- **Google Cloud Pub/Sub**: For real-time Gmail push notifications
- **Neon Database**: Serverless PostgreSQL
- **Sentry**: Error monitoring
- **Stripe**: Payment processing
- **ShipBob**: OAuth Integration