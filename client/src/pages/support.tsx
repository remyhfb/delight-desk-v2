import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ChevronDown, ChevronRight, Mail, MessageCircle, Book, Video, Users, Search, Send, CheckCircle, Zap } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Link } from "wouter";

interface FAQ {
  id: string;
  question: string;
  answer: string;
  category: string;
  tags: string[];
}

const faqs: FAQ[] = [
  {
    id: "getting-started-1",
    question: "How do I connect my email account?",
    answer: "Go to Settings > Connections and click 'Connect Gmail' or 'Connect Outlook'. You'll be redirected to sign in with your email provider. Once connected, Delight Desk can read and respond to your customer emails automatically.",
    category: "Getting Started",
    tags: ["email", "setup", "gmail", "outlook"]
  },
  {
    id: "getting-started-2", 
    question: "How do I connect my WooCommerce or Shopify store?",
    answer: "In Settings > Connections, click 'Connect WooCommerce' or 'Connect Shopify'. For WooCommerce, you'll need your store URL and API credentials. For Shopify, you'll authorize through Shopify's OAuth system. This lets Delight Desk look up orders and customer information automatically.",
    category: "Getting Started",
    tags: ["woocommerce", "shopify", "store", "orders"]
  },
  {
    id: "getting-started-3",
    question: "Why can't I see any emails in my dashboard?",
    answer: "Make sure you've connected your email account first. If connected, check that you have customer emails in your inbox. Delight Desk only shows customer service emails, not personal messages. If you're still not seeing emails, try clicking the refresh button or contact support.",
    category: "Getting Started", 
    tags: ["emails", "dashboard", "empty", "refresh"]
  },
  {
    id: "automation-1",
    question: "How do I set up automated responses?",
    answer: "Go to Auto-Responders in your dashboard. Click 'Create New Rule' and set up conditions (like email contains 'refund' or 'order status'). Then choose what action to take - you can send a template response, escalate to human review, or trigger a quick action like issuing a refund.",
    category: "Automation",
    tags: ["automation", "responses", "rules", "templates"]
  },
  {
    id: "automation-2",
    question: "What are Quick Actions and how do I use them?",
    answer: "Quick Actions are one-click solutions for common customer requests. When viewing an email, you'll see buttons like 'Issue Refund', 'Provide Tracking', or 'Send Order Status'. Click these to automatically handle the request without typing a response.",
    category: "Automation",
    tags: ["quick actions", "one-click", "refunds", "tracking"]
  },
  {
    id: "automation-3",
    question: "How does the AI classify my emails?",
    answer: "Delight Desk's AI reads each email and categorizes it (like 'Refund Request', 'Order Status', 'Product Question'). This happens automatically and helps route emails to the right automation rules. You can see the category in the email details.",
    category: "Automation",
    tags: ["ai", "classification", "categories", "automatic"]
  },
  {
    id: "orders-1",
    question: "Why can't Delight Desk find my customer's order?",
    answer: "Make sure your store is connected properly. The customer's email in the support request must match the email used for the order. If they used a different email or made the order as a guest, you might need to search by order number or customer name instead.",
    category: "Order Management",
    tags: ["orders", "lookup", "customer", "email", "guest"]
  },
  {
    id: "orders-2",
    question: "How do I issue a refund through Delight Desk?",
    answer: "When viewing a customer email, click the 'Issue Refund' quick action. Delight Desk will look up their recent orders and let you select which one to refund. You can choose full or partial refunds. The refund is processed through your connected store (WooCommerce/Shopify).",
    category: "Order Management",
    tags: ["refunds", "partial", "full", "processing"]
  },
  {
    id: "orders-3",
    question: "Can I provide tracking information automatically?",
    answer: "Yes! Delight Desk integrates with AfterShip to provide real-time tracking updates. When a customer asks about their order status, use the 'Provide Tracking' quick action and Delight Desk will automatically include the latest tracking information in your response.",
    category: "Order Management",
    tags: ["tracking", "aftership", "shipping", "status"]
  },
  {
    id: "escalation-1",
    question: "What is the Escalation Queue?",
    answer: "The Escalation Queue holds emails that need human review - either because the AI wasn't confident in how to respond, or because you've set up rules to escalate certain types of emails. Review these emails and either handle them manually or create automation rules for similar future emails.",
    category: "Escalation & Review",
    tags: ["escalation", "queue", "human review", "manual"]
  },
  {
    id: "escalation-2",
    question: "How do I handle emails that were escalated?",
    answer: "In the Escalation Queue, click on any email to review it. You can write a manual response, use quick actions, or mark it as resolved. If you see a pattern, consider creating an automation rule so similar emails are handled automatically in the future.",
    category: "Escalation & Review",
    tags: ["handle", "manual response", "resolve", "patterns"]
  },
  {
    id: "billing-1",
    question: "How does the 7-day free trial work?",
    answer: "Your 7-day free trial starts when you sign up and includes full access to all Delight Desk features. You can connect unlimited email accounts and stores, set up automations, and process up to 100 emails. No credit card required to start. You'll get reminder emails as your trial approaches the end.",
    category: "Billing & Plans",
    tags: ["trial", "free", "7-day", "features", "credit card"]
  },
  {
    id: "billing-2",
    question: "What happens when my trial ends?",
    answer: "When your 7-day trial ends, you'll need to choose a paid plan to continue using Delight Desk. Your automation rules and settings are saved, but email processing will be paused until you upgrade. You can upgrade anytime during or after your trial.",
    category: "Billing & Plans",
    tags: ["trial end", "upgrade", "paid plans", "pause"]
  },
  {
    id: "billing-3",
    question: "Can I change my plan later?",
    answer: "Yes! You can upgrade or downgrade your plan anytime in Account Settings. Changes take effect immediately, and billing is prorated. If you downgrade, you'll keep access to premium features until the end of your current billing period.",
    category: "Billing & Plans",
    tags: ["change plan", "upgrade", "downgrade", "prorated"]
  },
  {
    id: "troubleshooting-1",
    question: "My emails aren't being processed automatically",
    answer: "Check these things: 1) Is your email account connected? 2) Are your automation rules enabled? 3) Do the emails match your automation conditions? If everything looks correct, try refreshing your browser or contact support.",
    category: "Troubleshooting", 
    tags: ["not working", "processing", "automation"]
  },
  {
    id: "troubleshooting-2",
    question: "I'm getting an error when trying to connect my store",
    answer: "For WooCommerce: Ensure your store URL is correct and your API keys have the right permissions. For Shopify: Make sure you're logged into the correct Shopify account. If you're still having issues, try disconnecting and reconnecting, or contact support with the specific error message.",
    category: "Troubleshooting",
    tags: ["connection error", "store", "api keys", "permissions"]
  },
  {
    id: "troubleshooting-3",
    question: "Quick Actions aren't working properly",
    answer: "Quick Actions require a connected store to work. Make sure your WooCommerce or Shopify store is connected and the customer's order exists in your system. If the order is very old or from a different email address, Quick Actions might not find it automatically.",
    category: "Troubleshooting",
    tags: ["quick actions", "not working", "store connection", "order lookup"]
  },
  {
    id: "security-1",
    question: "Is my customer data secure?",
    answer: "Yes! Delight Desk uses industry-standard encryption for all data transmission and storage. We only access the minimum email and order data needed to provide our service. We never store customer payment information - refunds are processed directly through your store's secure payment system.",
    category: "Security & Privacy",
    tags: ["security", "encryption", "data", "privacy", "payment"]
  },
  {
    id: "security-2",
    question: "What email permissions does Delight Desk need?",
    answer: "Delight Desk needs read access to identify customer emails and write access to send responses. We only read emails that appear to be customer service related - personal emails are ignored. You can revoke access anytime through your email provider's security settings.",
    category: "Security & Privacy",
    tags: ["permissions", "email access", "read", "write", "revoke"]
  },
  {
    id: "advanced-1",
    question: "Can I customize the email templates?",
    answer: "Yes! In Auto-Responders, you can create custom email templates with variables like customer name, order number, and tracking information. Use simple variables like {{customer_name}} and {{order_number}} to personalize your responses automatically.",
    category: "Advanced Features",
    tags: ["templates", "customize", "variables", "personalization"]
  },
  {
    id: "advanced-2",
    question: "How do I set up different rules for different types of emails?",
    answer: "In Auto-Responders, create multiple rules with different conditions. For example: one rule for emails containing 'refund' that automatically offers a refund, and another for 'tracking' that provides shipping updates. You can have unlimited rules and they're processed in priority order.",
    category: "Advanced Features",
    tags: ["multiple rules", "conditions", "priority", "unlimited"]
  }
];

export default function SupportPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [openItems, setOpenItems] = useState<Set<string>>(new Set());
  const [contactForm, setContactForm] = useState({
    name: "",
    email: "",
    subject: "",
    message: ""
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const categories = ["All", ...Array.from(new Set(faqs.map(faq => faq.category)))];

  const filteredFAQs = faqs.filter(faq => {
    const matchesSearch = searchTerm === "" || 
      faq.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchTerm.toLowerCase()) ||
      faq.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesCategory = selectedCategory === "All" || faq.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  const toggleItem = (id: string) => {
    const newOpenItems = new Set(openItems);
    if (newOpenItems.has(id)) {
      newOpenItems.delete(id);
    } else {
      newOpenItems.add(id);
    }
    setOpenItems(newOpenItems);
  };

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/support/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(contactForm),
      });

      if (response.ok) {
        toast({
          title: "Message sent successfully!",
          description: "We'll get back to you within 24 hours.",
        });
        setContactForm({ name: "", email: "", subject: "", message: "" });
      } else {
        throw new Error('Failed to send message');
      }
    } catch (error) {
      toast({
        title: "Failed to send message",
        description: "Please try again or email us directly at remy@delightdesk.io",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation Bar */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <span className="ml-3 text-lg font-semibold text-gray-900">Delight Desk</span>
            </div>
            <div className="flex items-center space-x-4">
              <Link href="/dashboard">
                <Button 
                  variant="ghost" 
                  className="text-gray-600 hover:text-gray-900"
                >
                  Back to Dashboard
                </Button>
              </Link>
              <Link href="/">
                <Button 
                  variant="ghost" 
                  className="text-gray-600 hover:text-gray-900"
                >
                  Home
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
      
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">Delight Desk Support Center</h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Get help with Delight Desk, find answers to common questions, and learn how to automate your customer service.
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          
          {/* Quick Help Cards */}
          <div className="lg:col-span-4 mb-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
              <Card className="text-center">
                <CardContent className="p-6">
                  <Book className="h-12 w-12 text-blue-600 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">FAQ & Documentation</h3>
                  <p className="text-gray-600 mb-4">Find answers to common questions and setup guides</p>
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => document.getElementById('faq-section')?.scrollIntoView({ behavior: 'smooth' })}
                  >
                    Browse FAQ
                  </Button>
                </CardContent>
              </Card>

              <Card className="text-center">
                <CardContent className="p-6">
                  <Mail className="h-12 w-12 text-purple-600 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Direct Email Support</h3>
                  <p className="text-gray-600 mb-4">Get personalized help from our support team within 24 hours</p>
                  <Button 
                    className="w-full"
                    onClick={() => document.getElementById('contact-form')?.scrollIntoView({ behavior: 'smooth' })}
                  >
                    Contact Support
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <Card className="sticky top-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="h-5 w-5" />
                  Search & Filter
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Input
                    placeholder="Search FAQs..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full"
                  />
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">Category</label>
                  <div className="space-y-2">
                    {categories.map((category) => (
                      <button
                        key={category}
                        onClick={() => setSelectedCategory(category)}
                        className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                          selectedCategory === category
                            ? 'bg-blue-100 text-blue-700 font-medium'
                            : 'text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        {category}
                      </button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* FAQ Content */}
          <div className="lg:col-span-3" id="faq-section">
            <Card>
              <CardHeader>
                <CardTitle>Frequently Asked Questions</CardTitle>
                <CardDescription>
                  {filteredFAQs.length} {filteredFAQs.length === 1 ? 'question' : 'questions'} found
                  {searchTerm && ` for "${searchTerm}"`}
                  {selectedCategory !== "All" && ` in ${selectedCategory}`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {filteredFAQs.map((faq) => (
                    <Collapsible key={faq.id} open={openItems.has(faq.id)} onOpenChange={() => toggleItem(faq.id)}>
                      <CollapsibleTrigger className="w-full">
                        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                          <div className="flex items-start gap-3 text-left">
                            <div className="flex-1">
                              <h3 className="font-medium text-gray-900 mb-1">{faq.question}</h3>
                              <Badge variant="secondary" className="text-xs">
                                {faq.category}
                              </Badge>
                            </div>
                          </div>
                          {openItems.has(faq.id) ? (
                            <ChevronDown className="h-5 w-5 text-gray-500" />
                          ) : (
                            <ChevronRight className="h-5 w-5 text-gray-500" />
                          )}
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="p-4 bg-white border border-gray-200 rounded-lg mt-2">
                          <p className="text-gray-700 leading-relaxed">{faq.answer}</p>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  ))}
                  
                  {filteredFAQs.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <Book className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                      <p className="text-lg font-medium mb-2">No FAQs found</p>
                      <p>Try adjusting your search terms or category filter</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Contact Form */}
            <Card className="mt-8" id="contact-form">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Still Need Help?
                </CardTitle>
                <CardDescription>
                  Can't find what you're looking for? Send us a message and we'll get back to you within 24 hours.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleContactSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1 block">Name</label>
                      <Input
                        required
                        value={contactForm.name}
                        onChange={(e) => setContactForm(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Your name"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1 block">Email</label>
                      <Input
                        type="email"
                        required
                        value={contactForm.email}
                        onChange={(e) => setContactForm(prev => ({ ...prev, email: e.target.value }))}
                        placeholder="your@email.com"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Subject</label>
                    <Input
                      required
                      value={contactForm.subject}
                      onChange={(e) => setContactForm(prev => ({ ...prev, subject: e.target.value }))}
                      placeholder="What do you need help with?"
                    />
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Message</label>
                    <Textarea
                      required
                      rows={5}
                      value={contactForm.message}
                      onChange={(e) => setContactForm(prev => ({ ...prev, message: e.target.value }))}
                      placeholder="Please describe your issue or question in detail..."
                    />
                  </div>
                  
                  <Button type="submit" disabled={isSubmitting} className="w-full">
                    {isSubmitting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Send Message
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}