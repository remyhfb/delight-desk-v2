# Customer Service Automation System - Industry Standards

AI-powered customer service automation system with e-commerce integration, email processing, and intelligent response generation.

## 🚀 Features

### Core Automation
- **Industry-Standard AI Email Classification** - OpenAI GPT-4o with research-backed confidence thresholds (50%/70%/80%)
- **Smart Response Generation** - Automated responses based on email classification
- **Escalation Management** - Complex issues are automatically escalated to human agents
- **Activity Tracking** - Comprehensive audit trail with Human/AI attribution

### E-commerce Integration
- **WooCommerce OAuth** - Secure OAuth connection with order management
- **Shopify OAuth** - Partner app integration with full store access
- **Order Lookup** - Unified search across platforms by order number or email
- **Refund Processing** - Automated refund handling with payment gateway integration
- **Subscription Management** - Pause, reactivate, cancel, and renew subscriptions

### Email & Communication
- **SendGrid Integration** - Centralized email delivery service
- **Gmail/Outlook OAuth** - Connect customer email accounts securely
- **Minimalist Templates** - Professional, focused email templates
- **Tracking Integration** - Smart tracking URL generation for UPS, FedEx, USPS, DHL

### Dashboard & Monitoring
- **Real-time Metrics** - Email processing statistics with time range filtering
- **Quick Actions** - One-click customer service operations
- **Smart Lookup** - Order, subscription, and customer search with context-aware actions
- **System Monitoring** - Connection status and health checks

## 🛠️ Technology Stack

### Backend
- **Node.js** with Express.js and TypeScript
- **PostgreSQL** with Drizzle ORM
- **OAuth 2.0** authentication (Google, Microsoft, WooCommerce, Shopify)
- **OpenAI GPT-4o** with industry-standard vector embeddings (0.70 threshold) and enterprise-grade hallucination prevention
- **SendGrid** for email delivery

### Frontend
- **React** with TypeScript
- **Vite** for development and build
- **Tailwind CSS** with shadcn/ui components
- **TanStack Query** for server state management
- **Wouter** for client-side routing

## 🔧 Setup & Installation

### Prerequisites
- Node.js 18+ 
- PostgreSQL database
- API keys for integrations (see Environment Variables section)

### Environment Variables
Create a `.env` file with the following variables:

```env
# Database
DATABASE_URL=postgresql://username:password@localhost:5432/customer_service

# OpenAI (Required)
OPENAI_API_KEY=sk-...

# SendGrid (Required)
SENDGRID_API_KEY=SG....

# Google OAuth (Optional - for Gmail integration)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# Microsoft OAuth (Optional - for Outlook integration)
MICROSOFT_CLIENT_ID=...
MICROSOFT_CLIENT_SECRET=...

# WooCommerce OAuth (Optional)
# Configured automatically through OAuth flow

# Shopify OAuth (Optional)
SHOPIFY_API_KEY=...
SHOPIFY_API_SECRET=...
```

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/remyhfb/customer-service-automation.git
   cd customer-service-automation
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up the database**
   ```bash
   npm run db:push
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```

The application will be available at `http://localhost:5000`

## 📋 OAuth Setup Instructions

### Google (Gmail Integration)
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. Enable Gmail API
4. Create OAuth 2.0 credentials
5. Add redirect URIs:
   - `http://localhost:5000/oauth/callback` (development)
   - `https://your-domain.com/oauth/callback` (production)

### Microsoft (Outlook Integration)
1. Go to [Azure Portal](https://portal.azure.com)
2. Register a new application in Azure AD
3. Add redirect URIs:
   - `http://localhost:5000/api/oauth/outlook/callback` (development)
   - `https://your-domain.com/api/oauth/outlook/callback` (production)

### WooCommerce Integration
- Uses built-in WooCommerce OAuth system
- No additional setup required - handled through the app interface

### Shopify Integration
1. Create a Partner app in [Shopify Partner Dashboard](https://partners.shopify.com)
2. Add redirect URIs:
   - `http://localhost:5000/api/oauth/shopify/callback` (development)
   - `https://your-domain.com/api/oauth/shopify/callback` (production)

## 🎯 Usage

### Connecting Stores
1. Navigate to Settings → Store Connections
2. Click "Connect" next to WooCommerce or Shopify
3. Enter your store URL/domain
4. Complete OAuth authorization in the popup window

### Processing Emails
1. Connect email accounts in Settings → Email Connections
2. Set up automation rules in the Automations page
3. Monitor processing in the Activity Log

### Quick Actions
1. Use the Dashboard for common customer service tasks
2. Search for orders, subscriptions, or customers
3. Send order updates, process refunds, or manage subscriptions with one click

## 📁 Project Structure

```
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Page components
│   │   └── lib/           # Utilities and API client
├── server/                 # Express.js backend
│   ├── services/          # Business logic services
│   ├── routes.ts          # API route definitions
│   └── storage.ts         # Database interface
├── shared/                # Shared types and schemas
│   └── schema.ts          # Drizzle database schema
└── docs/                  # Documentation
```

## 🔐 Security Features

- OAuth 2.0 authentication for all integrations
- Session-based user authentication
- Secure credential storage in environment variables
- HTTPS-only redirect URIs for production
- Input validation and sanitization
- Comprehensive activity logging

## 📊 Monitoring & Analytics

- Real-time email processing metrics
- Success/failure rate tracking
- Response time monitoring
- Platform-specific performance analytics
- Time-based filtering (today, 7/30/365 days)

## 🚀 Deployment

### Replit Deployment
1. Connect your Replit to this GitHub repository
2. Set environment variables in Replit Secrets
3. Click "Deploy" to create a production deployment

### Custom Deployment
1. Build the application: `npm run build`
2. Set up PostgreSQL database
3. Configure environment variables
4. Start the server: `npm start`

## 📝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes and add tests
4. Commit your changes: `git commit -am 'Add feature'`
5. Push to the branch: `git push origin feature-name`
6. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support or questions:
- Create an issue in this repository
- Check the [documentation](docs/) folder
- Review the setup instructions above

## 🎉 Acknowledgments

- Built with modern web technologies for scalability and performance
- Integrates with leading e-commerce and email platforms
- Designed for non-technical users with comprehensive automation capabilities