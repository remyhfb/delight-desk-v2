import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ArrowRight, Zap, Brain, CheckCircle, Check, Mail, DollarSign, RefreshCw, BarChart3, Star, Users, Shield, Clock, Target, Sparkles, Globe, ArrowUpRight, TrendingUp, Menu, X, Settings, Store, Link2, Layout, Layers, Command, Activity, Gauge, User, Lightbulb, Heart, Linkedin, Instagram, Send, AlertTriangle, AlertCircle, HelpCircle, PieChart, ChevronDown, Truck, MessageSquare, ShoppingCart, Infinity as InfinityIcon } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useState, useEffect } from "react";
import { useQuery } from '@tanstack/react-query';
import founderPhoto from "@assets/TennantFamily2017-168 copy_1754154985254.jpg";
import { formatCostPerResolution, formatIncludedAutomations } from "../../../shared/pricing-utils";

interface BillingPlan {
  id: string;
  name: string;
  displayName: string;
  price: string;
  resolutions: number;
  storeLimit: number;
  emailLimit: number | null;
  features: string[];
  isActive: boolean;
  createdAt: string;
}

export default function StripeInspiredHomepage() {
  const [, navigate] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    company: '',
    inquiry: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [openFAQ, setOpenFAQ] = useState<number | null>(null);
  const { toast } = useToast();

  // Fetch available billing plans
  const { data: plansData, isLoading: plansLoading } = useQuery<BillingPlan[]>({
    queryKey: ["/api/billing/plans"],
    retry: 3,
  });

  // Sort plans by price ascending (cheapest to most expensive)
  const sortedPlans = (plansData || []).sort((a, b) => parseFloat(a.price) - parseFloat(b.price));

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(contactForm),
      });

      if (response.ok) {
        toast({
          title: "Message sent!",
          description: "Thank you for your inquiry. We'll get back to you soon.",
        });
        setContactForm({ name: '', email: '', company: '', inquiry: '' });
      } else {
        throw new Error('Failed to send message');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      setIsScrolled(scrollTop > 20);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white overflow-hidden">
      {/* Sticky Navigation */}
      <nav className={`fixed top-0 left-0 right-0 z-50 px-6 py-4 transition-all duration-300 ${
        isScrolled 
          ? 'border-b border-white/10 backdrop-blur-xl bg-slate-900/60' 
          : 'border-b border-transparent bg-transparent'
      }`}>
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-br from-purple-400 to-pink-400 rounded-lg flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-lg md:text-xl font-bold whitespace-nowrap">Delight Desk</span>
              <div className="bg-purple-500/80 backdrop-blur-sm text-xs px-2 py-1 rounded-full border border-purple-400/30">
                <span className="text-purple-100 font-medium">Beta</span>
              </div>
            </div>
          </div>
          
          {/* Desktop Menu */}
          <div className="hidden md:flex items-center space-x-6">
            <a href="#ai-processing" className="text-white/80 hover:text-white transition-colors">How It Works</a>
            <a href="#about" className="text-white/80 hover:text-white transition-colors">Company</a>
            <a href="#pricing" className="text-white/80 hover:text-white transition-colors">Pricing</a>
            <a href="#faq" className="text-white/80 hover:text-white transition-colors">FAQs</a>
            <a href="#contact" className="text-white/80 hover:text-white transition-colors">Contact</a>
            <button 
              onClick={() => window.location.href = '/login'}
              className="px-4 py-2 text-white/80 hover:text-white border border-white/30 rounded-lg hover:border-white/50 transition-all duration-300"
            >
              Login
            </button>
            <button 
              onClick={() => navigate('/signup')}
              className="px-6 py-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg text-white font-medium hover:from-purple-600 hover:to-pink-600 transition-all duration-300 shadow-lg"
            >
              Try Free
            </button>
          </div>

          {/* Mobile Menu */}
          <div className="md:hidden flex items-center space-x-3">
            <button 
              onClick={() => navigate('/signup')}
              className="px-3 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg text-white font-medium hover:from-purple-600 hover:to-pink-600 transition-all duration-300 text-sm flex items-center"
            >
              Try Free
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-1.5 text-white/80 hover:text-white transition-colors"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu Dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden absolute top-full left-0 right-0 bg-slate-900/80 backdrop-blur-xl border-b border-white/10">
            <div className="px-6 py-4 space-y-4">
              <a 
                href="#ai-processing" 
                className="block text-white/80 hover:text-white transition-colors py-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                How It Works
              </a>
              <a 
                href="#about" 
                className="block text-white/80 hover:text-white transition-colors py-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                Company
              </a>
              <a 
                href="#pricing" 
                className="block text-white/80 hover:text-white transition-colors py-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                Pricing
              </a>
              <a 
                href="#faq" 
                className="block text-white/80 hover:text-white transition-colors py-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                FAQs
              </a>
              <a 
                href="#contact" 
                className="block text-white/80 hover:text-white transition-colors py-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                Contact
              </a>
              <button 
                onClick={() => {
                  setMobileMenuOpen(false);
                  window.location.href = '/login';
                }}
                className="block text-white/80 hover:text-white transition-colors py-2 text-left"
              >
                Login
              </button>
            </div>
          </div>
        )}
      </nav>
      {/* Hero Section */}
      <section className="relative flex items-center justify-center pt-6 pb-0 md:pt-32 md:pb-24 lg:pt-40 lg:pb-32 px-4 md:px-6">
        
        {/* Stripe-Inspired Background Texture */}
        <div className="absolute inset-0 pointer-events-none opacity-40">
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 1000 1000" preserveAspectRatio="none">
            <defs>
              <pattern id="stripe-grid" width="50" height="50" patternUnits="userSpaceOnUse">
                <path d="M 50 0 L 0 0 0 50" fill="none" stroke="rgba(147, 51, 234, 0.4)" strokeWidth="1"/>
              </pattern>
              <pattern id="stripe-dots" width="25" height="25" patternUnits="userSpaceOnUse">
                <circle cx="12.5" cy="12.5" r="1" fill="rgba(147, 51, 234, 0.3)"/>
              </pattern>
            </defs>
            
            {/* Base grid pattern */}
            <rect width="100%" height="100%" fill="url(#stripe-grid)"/>
            
            {/* Dot overlay */}
            <rect width="100%" height="100%" fill="url(#stripe-dots)"/>
            
            {/* Diagonal lines */}
            <g stroke="rgba(236, 72, 153, 0.25)" strokeWidth="1">
              <line x1="0" y1="0" x2="1000" y2="1000" />
              <line x1="100" y1="0" x2="1100" y2="1000" />
              <line x1="200" y1="0" x2="1200" y2="1000" />
              <line x1="300" y1="0" x2="1300" y2="1000" />
              <line x1="400" y1="0" x2="1400" y2="1000" />
              <line x1="500" y1="0" x2="1500" y2="1000" />
              <line x1="-100" y1="0" x2="900" y2="1000" />
              <line x1="-200" y1="0" x2="800" y2="1000" />
              <line x1="-300" y1="0" x2="700" y2="1000" />
              <line x1="-400" y1="0" x2="600" y2="1000" />
              <line x1="-500" y1="0" x2="500" y2="1000" />
            </g>
            
            {/* Counter-diagonal lines */}
            <g stroke="rgba(147, 51, 234, 0.2)" strokeWidth="1">
              <line x1="0" y1="1000" x2="1000" y2="0" />
              <line x1="100" y1="1000" x2="1100" y2="0" />
              <line x1="200" y1="1000" x2="1200" y2="0" />
              <line x1="300" y1="1000" x2="1300" y2="0" />
              <line x1="400" y1="1000" x2="1400" y2="0" />
              <line x1="-100" y1="1000" x2="900" y2="0" />
              <line x1="-200" y1="1000" x2="800" y2="0" />
              <line x1="-300" y1="1000" x2="700" y2="0" />
              <line x1="-400" y1="1000" x2="600" y2="0" />
            </g>
          </svg>
        </div>

        {/* Single Accent Orb */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full mix-blend-multiply filter blur-3xl"></div>
        </div>

        <div className="relative z-10 max-w-7xl mx-auto w-full">
          
          {/* Two Column Layout */}
          <div className="grid lg:grid-cols-[1.1fr_1fr] gap-12 lg:gap-16 items-center min-h-[600px] mt-[-49px] mb-[-49px]">
            
            {/* Left Column - Messaging */}
            <div className="text-center lg:text-left flex flex-col justify-center">
              
              {/* AI Assistant Badge - Mobile Only */}
              <div className="mt-12 mb-5 lg:hidden">
                <div className="inline-flex items-center space-x-2 bg-white/10 backdrop-blur-xl rounded-full px-4 py-2 border border-white/20 glass-pulse">
                  <Brain className="w-4 h-4 text-purple-400" />
                  <span className="text-sm font-medium text-white/90">AI Assistant</span>
                </div>
              </div>

              {/* Main Content Block - Centered on Desktop */}
              <div className="lg:flex lg:flex-col lg:justify-center lg:space-y-6">
                {/* Focused Headline */}
                <h1 className="text-3xl sm:text-4xl md:text-4xl lg:text-6xl xl:text-7xl font-bold mb-5 md:mb-6 lg:mb-0 bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent leading-tight px-2 sm:px-0 md:px-4 lg:px-0">
                  Automate <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text">80% of Email Support Tickets</span>
                </h1>

                {/* Clear Value Proposition */}
                <p className="text-white/80 mb-5 md:mb-8 lg:mb-0 max-w-lg sm:max-w-xl md:max-w-2xl lg:max-w-xl mx-auto lg:mx-0 font-light leading-relaxed px-2 sm:px-0 md:px-4 lg:px-0">
                  Delight Desk AI transforms inbox chaos into customer delight by instantly resolving routine support requests with human-level understanding.
                </p>

                {/* Primary CTA */}
                <div className="mb-5 md:mb-8 lg:mb-0">
                  <Button 
                    size="lg" 
                    className="ds-button-primary ds-button-lg"
                    onClick={() => navigate('/signup')}
                  >
                    Start Free Trial
                    <ArrowRight className="w-5 h-5 md:w-6 md:h-6 ml-2 md:ml-3" />
                  </Button>
                </div>

                {/* Proof Points */}
                <div className="flex flex-col sm:flex-row md:flex-col lg:flex-col xl:flex-row items-center justify-center lg:justify-start space-y-3 sm:space-y-0 sm:space-x-6 md:space-x-0 md:space-y-3 lg:space-x-0 lg:space-y-3 xl:space-y-0 xl:space-x-6 text-white/80">
                  <div className="flex items-center space-x-2">
                    <div className="w-6 h-6 md:w-7 md:h-7 lg:w-8 lg:h-8 bg-blue-500/20 rounded-full flex items-center justify-center">
                      <Clock className="w-4 h-4 md:w-4 md:h-4 lg:w-5 lg:h-5 text-blue-400" />
                    </div>
                    <span className="font-medium text-sm md:text-sm lg:text-base whitespace-nowrap">5 Minute Set Up</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-6 h-6 md:w-7 md:h-7 lg:w-8 lg:h-8 bg-yellow-500/20 rounded-full flex items-center justify-center">
                      <Zap className="w-4 h-4 md:w-4 md:h-4 lg:w-5 lg:h-5 text-yellow-400" />
                    </div>
                    <span className="font-medium text-sm md:text-sm lg:text-base whitespace-nowrap">Instant Results</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-6 h-6 md:w-7 md:h-7 lg:w-8 lg:h-8 bg-green-500/20 rounded-full flex items-center justify-center">
                      <DollarSign className="w-4 h-4 md:w-4 md:h-4 lg:w-5 lg:h-5 text-green-400" />
                    </div>
                    <span className="font-medium text-sm md:text-sm lg:text-base whitespace-nowrap">Guaranteed ROI</span>
                  </div>
                </div>
              </div>
              
            </div>

            {/* Right Column - Visual Element */}
            <div className="relative hidden lg:block">
              
              {/* Main Visual Container */}
              <div className="relative h-96 lg:h-[500px] xl:h-[600px]">
                
                {/* Background Glow */}
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 via-blue-500/10 to-pink-500/20 rounded-3xl blur-3xl"></div>
                
                {/* Email Interface Mockup */}
                <div className="relative bg-white/10 backdrop-blur-xl rounded-3xl border border-white/20 p-6 flex flex-col">
                  
                  {/* Header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-2">
                      <div className="w-6 h-6 bg-blue-500/20 rounded-lg flex items-center justify-center">
                        <Mail className="w-3 h-3 text-blue-400" />
                      </div>
                      <span className="text-white/80 text-sm font-medium">Email Inbox</span>
                    </div>
                    <div className="flex items-center space-x-2 bg-gradient-to-r from-purple-500/30 to-blue-500/30 rounded-full px-3 py-1 border border-purple-500/40">
                      <Brain className="w-3 h-3 text-purple-400" />
                      <span className="text-white font-medium text-xs">AI Agent</span>
                    </div>
                  </div>
                  
                  {/* Email Thread */}
                  <div className="space-y-4 flex-1">
                    
                    {/* Incoming Email */}
                    <div className="bg-white/5 rounded-2xl p-4 border-l-4 border-blue-400 stripe-shimmer">
                      <div className="flex items-center space-x-2 mb-2">
                        <div className="w-6 h-6 bg-blue-400 rounded-full flex items-center justify-center">
                          <Mail className="w-3 h-3 text-white" />
                        </div>
                        <span className="text-white/80 text-sm font-medium">sarah@example.com</span>
                        <span className="text-white/40 text-xs">3 min ago</span>
                      </div>
                      <p className="text-white/80 text-sm">Hi, I need to pause my subscription because I have too much product.</p>
                    </div>
                    
                    {/* AI Processing Indicator */}
                    <div className="flex items-center space-x-2 py-2">
                      <div className="ai-thinking-grid">
                        <div className="ai-thinking-dot"></div>
                        <div className="ai-thinking-dot"></div>
                        <div className="ai-thinking-dot"></div>
                        <div className="ai-thinking-dot"></div>
                        <div className="ai-thinking-dot"></div>
                        <div className="ai-thinking-dot"></div>
                        <div className="ai-thinking-dot"></div>
                        <div className="ai-thinking-dot"></div>
                        <div className="ai-thinking-dot"></div>
                      </div>
                      <span className="text-purple-400 text-sm">AI agent analyzing...</span>
                    </div>
                    
                    {/* AI Response */}
                    <div className="bg-gradient-to-r from-purple-500/20 to-blue-500/20 rounded-2xl p-4 border-l-4 border-green-400 stripe-shimmer">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <div className="w-6 h-6 bg-green-400 rounded-full flex items-center justify-center">
                            <Brain className="w-3 h-3 text-white" />
                          </div>
                          <span className="text-white/80 text-sm font-medium">Delight Desk Agent</span>
                        </div>
                        <span className="text-green-400 text-sm font-medium">✓ 2.3s</span>
                      </div>
                      <p className="text-white/80 text-sm mb-3">I've paused your subscription and you can reactivate it anytime just by replying to this email when you're ready!</p>
                      <div className="bg-white/10 rounded-lg p-3">
                        <div className="flex items-center space-x-2">
                          <CheckCircle className="w-4 h-4 text-green-400" />
                          <span className="text-white/80 text-sm">Subscription paused successfully</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Customer Reply */}
                    <div className="bg-white/5 rounded-2xl p-4 border-l-4 border-blue-400 stripe-shimmer">
                      <div className="flex items-center space-x-2 mb-2">
                        <div className="w-6 h-6 bg-blue-400 rounded-full flex items-center justify-center">
                          <Mail className="w-3 h-3 text-white" />
                        </div>
                        <span className="text-white/80 text-sm font-medium">sarah@example.com</span>
                        <span className="text-white/40 text-xs">Just now</span>
                      </div>
                      <p className="text-white/80 text-sm mb-3">Wow, that was so fast! Thank you so much for taking care of this instantly. I'll definitely be back soon to reactivate! 😊</p>
                      <div className="bg-gradient-to-r from-green-500/20 to-blue-500/20 rounded-lg p-3 border border-green-500/30">
                        <div className="flex items-center space-x-2">
                          <Heart className="w-4 h-4 text-green-400" />
                          <span className="text-white/80 text-sm font-medium">Customer Delighted</span>
                          <span className="text-green-400 text-sm">• Instant Resolution</span>
                        </div>
                      </div>
                    </div>
                    
                  </div>
                  
                </div>
                

                
              </div>
              
            </div>
            
          </div>
          
        </div>

      </section>
      {/* Section Divider - Optimized Spacing */}
      <div className="relative py-4 md:py-16 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="relative flex items-center justify-center">
            {/* Left line */}
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-purple-500/30 to-purple-500/50"></div>
            
            {/* Lightning bolt icon */}
            <div className="mx-6 md:mx-8 w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
              <Zap className="w-5 h-5 md:w-6 md:h-6 text-white" />
            </div>
            
            {/* Right line */}
            <div className="flex-1 h-px bg-gradient-to-l from-transparent via-purple-500/30 to-purple-500/50"></div>
          </div>
        </div>
      </div>
      {/* AI Processing Timeline Section - Desktop */}
      <section id="ai-processing" className="relative ds-section-padding-desktop hidden md:block">
        
        {/* Background Elements */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-1/2 left-0 w-full h-px bg-gradient-to-r from-transparent via-blue-500 to-transparent"></div>
        </div>

        <div className="max-w-6xl mx-auto">
          
          {/* Section Header */}
          <div className="text-center mb-20">
            <div className="inline-flex items-center space-x-2 bg-white/10 backdrop-blur-xl rounded-full px-4 py-2 mb-8 border border-white/20 glass-pulse">
              <Brain className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-medium text-white/90">AI Agent Processing Flow</span>
            </div>
            <h2 className="ds-heading-lg font-bold mb-6 bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent stripe-fade-in-up stripe-stagger-2">
              Delight Customers With
              <br />
              <span className="ds-gradient-primary-text">Instant Resolution</span>
            </h2>
            <p className="text-white/70 max-w-3xl mx-auto leading-relaxed stripe-fade-in-up stripe-stagger-3">
              See how the Delight Desk Agent processes and resolves customer requests in real-time.
            </p>
          </div>

          {/* Timeline Visualization - Center Line Style */}
          <div className="relative max-w-5xl mx-auto">
            
            {/* Timeline Line */}
            <div className="absolute left-1/2 transform -translate-x-1/2 h-full w-0.5 bg-gradient-to-b from-purple-500 via-blue-500 to-green-500 opacity-30"></div>
            
            {/* Timeline Icons - Static positioning */}
            <div className="absolute left-1/2 transform -translate-x-1/2 w-10 h-full z-10">
              {/* Step 1 Icon */}
              <div className="absolute left-1/2 transform -translate-x-1/2 w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center" style={{top: '4rem'}}>
                <Mail className="w-5 h-5 text-white" />
              </div>
              {/* Step 2 Icon */}
              <div className="absolute left-1/2 transform -translate-x-1/2 w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center" style={{top: '20rem'}}>
                <Brain className="w-5 h-5 text-white" />
              </div>
              {/* Step 3 Icon */}
              <div className="absolute left-1/2 transform -translate-x-1/2 w-10 h-10 bg-gradient-to-br from-green-500 to-blue-500 rounded-full flex items-center justify-center" style={{top: '37rem'}}>
                <CheckCircle className="w-5 h-5 text-white" />
              </div>
            </div>
            
            {/* Timeline Steps */}
            <div className="space-y-20">
              
              {/* Step 1: Customer Email - Left Side */}
              <div className="flex items-center stripe-scale-in stripe-stagger-4">
                <div className="w-1/2 pr-8 text-right">
                  <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 p-6 inline-block hover:border-purple-500/50 transition-all duration-300 stripe-shimmer">
                    <div className="text-sm text-purple-400 mb-2 font-medium">3:47 PM • Incoming Email</div>
                    <div className="font-semibold text-white mb-2">From: sarah@customer.com</div>
                    <div className="text-white/80">"Where's my order #1234?! I need it by Friday for my trip!"</div>
                    <div className="text-xs text-red-400 mt-2">😤 Frustrated Customer</div>
                  </div>
                </div>
                <div className="w-1/2 pl-8">
                  <div className="text-xl font-bold text-white">Customer reaches out</div>
                  <div className="text-white/70">Urgent shipping inquiry received</div>
                </div>
              </div>

              {/* Step 2: AI Processing - Right Side */}
              <div className="flex items-center stripe-scale-in stripe-stagger-5">
                <div className="w-1/2 pr-8 text-right">
                  <div className="text-xl font-bold text-white">AI agent analyzes in real-time</div>
                  <div className="text-white/70">Order lookup + carrier tracking + prediction</div>
                </div>
                <div className="w-1/2 pl-8">
                  <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 p-6 inline-block hover:border-blue-500/50 transition-all duration-300 stripe-shimmer">
                    <div className="text-sm text-blue-400 mb-3 font-medium">Processing • 1.2 seconds</div>
                    <div className="space-y-2 text-sm text-white/80">
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="w-4 h-4 text-green-400" />
                        <span>Order #1234 found in WooCommerce</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="w-4 h-4 text-green-400" />
                        <span>UPS tracking: Out for delivery</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="w-4 h-4 text-green-400" />
                        <span>AI agent prediction: Friday 2:00 PM delivery</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="w-4 h-4 text-green-400" />
                        <span>Professional response generated</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 3: Intelligent Response - Left Side */}
              <div className="flex items-center stripe-scale-in stripe-stagger-6">
                <div className="w-1/2 pr-8 text-right">
                  <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 p-6 inline-block hover:border-green-500/50 transition-all duration-300 stripe-shimmer">
                    <div className="text-sm text-green-400 mb-2 font-medium">3:47 PM • Sent (0.3s later)</div>
                    <div className="font-semibold text-white mb-2">Hi Sarah!</div>
                    <div className="text-white/80 mb-3">Perfect timing! Your order is out for delivery and will arrive <strong className="text-white">Friday at 2:00 PM</strong> based on current UPS tracking data.</div>
                    <div className="text-xs text-green-400">😊 Problem solved instantly</div>
                  </div>
                </div>
                <div className="w-1/2 pl-8">
                  <div className="text-xl font-bold text-white">Customer delighted</div>
                  <div className="text-white/70">Precise answer delivered instantly</div>
                </div>
              </div>

            </div>
          </div>



        </div>
      </section>
      {/* AI Processing Timeline Section - Mobile */}
      <section className="relative ds-section-padding-mobile md:hidden">
        
        {/* Background Elements */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-1/2 left-0 w-full h-px bg-gradient-to-r from-transparent via-blue-500 to-transparent"></div>
        </div>

        <div className="max-w-lg mx-auto">
          
          {/* Section Header */}
          <div className="text-center mb-16">
            <div className="inline-flex items-center space-x-2 bg-white/10 backdrop-blur-xl rounded-full px-4 py-2 mb-6 border border-white/20 glass-pulse">
              <Brain className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-medium text-white/90">AI Agent Processing Flow</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4 bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent">
              Delight Customers With
              <br />
              <span className="ds-gradient-primary-text">Instant Resolution</span>
            </h2>
            <p className="text-base text-white/70 leading-relaxed">
              See how the Delight Desk Agent processes and resolves customer requests in real-time.
            </p>
          </div>

          {/* Mobile Timeline - Left-Aligned Design */}
          <div className="relative pl-8">
            
            {/* Left Timeline Line */}
            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gradient-to-b from-purple-500 via-blue-500 to-green-500 opacity-20"></div>
            
            <div className="space-y-16">
            
              {/* Step 1: Customer Email */}
              <div className="relative">
                {/* Timeline Icon */}
                <div className="absolute -left-6 w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                  <Mail className="w-4 h-4 text-white" />
                </div>
                
                <div className="ml-6">
                  <div className="text-lg font-bold text-white mb-2">Customer reaches out</div>
                  <div className="text-white/70 text-sm mb-4">Urgent shipping inquiry received</div>
                  
                  <div className="bg-white/10 backdrop-blur-xl rounded-xl border border-white/20 p-4 stripe-shimmer">
                    <div className="text-xs text-purple-400 mb-2 font-medium">3:47 PM • Incoming Email</div>
                    <div className="font-semibold text-white text-sm mb-2">From: sarah@customer.com</div>
                    <div className="text-white/80 text-sm">"Where's my order #1234?! I need it by Friday for my trip!"</div>
                    <div className="text-xs text-red-400 mt-2">😤 Frustrated Customer</div>
                  </div>
                </div>
              </div>

              {/* Step 2: AI Processing */}
              <div className="relative">
                {/* Timeline Icon */}
                <div className="absolute -left-6 w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                  <Brain className="w-4 h-4 text-white" />
                </div>
                
                <div className="ml-6">
                  <div className="text-lg font-bold text-white mb-2">AI agent analyzes in real-time</div>
                  <div className="text-white/70 text-sm mb-4">Order lookup + carrier tracking + prediction</div>
                  
                  <div className="bg-white/10 backdrop-blur-xl rounded-xl border border-white/20 p-4 stripe-shimmer">
                    <div className="text-xs text-blue-400 mb-3 font-medium">Processing • 1.2 seconds</div>
                    <div className="space-y-2 text-xs text-white/80">
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="w-3 h-3 text-green-400" />
                        <span>Order #1234 found in WooCommerce</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="w-3 h-3 text-green-400" />
                        <span>UPS tracking: Out for delivery</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="w-3 h-3 text-green-400" />
                        <span>AI agent prediction: Friday 2:00 PM delivery</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="w-3 h-3 text-green-400" />
                        <span>Professional response generated</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 3: Intelligent Response */}
              <div className="relative">
                {/* Timeline Icon */}
                <div className="absolute -left-6 w-8 h-8 bg-gradient-to-br from-green-500 to-blue-500 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-4 h-4 text-white" />
                </div>
                
                <div className="ml-6">
                  <div className="text-lg font-bold text-white mb-2">Customer delighted</div>
                  <div className="text-white/70 text-sm mb-4">Precise answer delivered instantly</div>
                  
                  <div className="bg-white/10 backdrop-blur-xl rounded-xl border border-white/20 p-4 stripe-shimmer">
                    <div className="text-xs text-green-400 mb-2 font-medium">3:47 PM • Sent (0.3s later)</div>
                    <div className="font-semibold text-white text-sm mb-2">Hi Sarah!</div>
                    <div className="text-white/80 text-sm mb-3">Perfect timing! Your order is out for delivery and will arrive <strong className="text-white">Friday at 2:00 PM</strong> based on current UPS tracking data.</div>
                    <div className="text-xs text-green-400">😊 Problem solved instantly</div>
                  </div>
                </div>
              </div>

            </div>
          </div>





        </div>
      </section>



      {/* Live Dashboard Section - Desktop Version 2 */}
      <section className="relative ds-section-padding-desktop overflow-hidden hidden md:block">
        
        {/* Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/50 to-pink-900/50"></div>
        
        <div className="relative max-w-7xl mx-auto">
          
          <div className="text-center mb-20">
            <div className="inline-flex items-center space-x-2 bg-white/10 backdrop-blur-xl rounded-full px-4 py-2 mb-8 border border-white/20 glass-pulse">
              <Zap className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-medium text-white/90">Live Dashboard</span>
            </div>
            <h2 className="ds-heading-lg font-bold mb-6 bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent">
              Mission Control Hub
            </h2>
            <p className="text-base text-white/70 max-w-3xl mx-auto">
              Complete visibility into your customer service automation with real-time AI agent processing and performance metrics all in one powerful dashboard.
            </p>
          </div>

          {/* Single Full-Width Dashboard Card - Desktop Only */}
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 p-8 glass-pulse mb-8">
            
            {/* Header with Title, Subhead, and Stats */}
            <div className="flex items-start justify-between mb-8">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
                  <Zap className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white mb-1">Delight Desk Mission Control</h3>
                  <p className="text-white/70">Live customer service automation</p>
                </div>
              </div>
              <div className="flex items-center space-x-2 bg-green-500/20 rounded-lg px-4 py-2">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-green-400 font-medium">127 emails processed today</span>
              </div>
            </div>

            {/* Top Row - 2 Cards */}
            <div className="grid grid-cols-2 gap-8 mb-6">

              {/* AI Agent Processing */}
              <div className="bg-purple-500/10 backdrop-blur-xl rounded-xl border border-purple-500/30 p-6">
                <div className="flex items-center space-x-3 mb-4">
                  <Brain className="w-5 h-5 text-purple-400" />
                  <h4 className="font-bold text-white">AI Agent Processing</h4>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-white/70 text-sm">Processing Queue</span>
                    <span className="text-purple-200 text-sm">3 emails</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></div>
                    <span className="text-purple-200 text-sm">Analyzing email intent...</span>
                  </div>
                  <div className="bg-purple-500/20 rounded-lg p-3">
                    <div className="text-purple-200 text-xs mb-1">Current: Order Status Request</div>
                    <div className="text-purple-300 text-xs">Confidence: 98.7% • ETA: 0.8s</div>
                  </div>
                </div>
              </div>

              {/* Today's Stats */}
              <div className="bg-green-500/10 backdrop-blur-xl rounded-xl border border-green-500/30 p-6">
                <div className="flex items-center space-x-3 mb-4">
                  <BarChart3 className="w-5 h-5 text-green-400" />
                  <h4 className="font-bold text-white">Today's Stats</h4>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-white/70 text-sm">Auto-resolved</span>
                    <span className="text-green-400 font-semibold">83%</span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-2">
                    <div className="bg-green-400 h-2 rounded-full" style={{width: '83%'}}></div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-white/70 text-sm">Human resolved</span>
                    <span className="text-purple-400 font-semibold">17%</span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-2">
                    <div className="bg-purple-400 h-2 rounded-full" style={{width: '17%'}}></div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-white/70 text-sm">Avg Response</span>
                    <span className="text-blue-400 font-semibold">2.1s</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Row - 2 Cards */}
            <div className="grid grid-cols-2 gap-6">
              
              {/* AI Assistant Queue */}
              <div className="bg-orange-500/10 backdrop-blur-xl rounded-xl border border-orange-500/30 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <AlertTriangle className="w-5 h-5 text-orange-400" />
                    <h4 className="font-bold text-white">AI Assistant Queue</h4>
                  </div>
                  <span className="text-orange-300 text-sm">(Human intervention required)</span>
                </div>
                <div className="space-y-3">
                  <div className="flex items-start space-x-3 p-3 bg-orange-500/20 rounded-lg border-l-4 border-orange-500">
                    <User className="w-4 h-4 text-orange-400 mt-0.5" />
                    <div className="flex-1">
                      <div className="text-white text-sm font-medium">Complex refund requires human review</div>
                      <div className="text-orange-200 text-xs">Multiple orders • Customer: alex@business.com</div>
                    </div>
                    <div className="text-orange-300 text-xs">3m</div>
                  </div>
                  <div className="flex items-start space-x-3 p-3 bg-red-500/20 rounded-lg border-l-4 border-red-500">
                    <HelpCircle className="w-4 h-4 text-red-400 mt-0.5" />
                    <div className="flex-1">
                      <div className="text-white text-sm font-medium">Billing dispute needs agent attention</div>
                      <div className="text-red-200 text-xs">Chargeback claim • Order #12659</div>
                    </div>
                    <div className="text-red-300 text-xs">7m</div>
                  </div>
                  <div className="flex items-start space-x-3 p-3 bg-yellow-500/20 rounded-lg border-l-4 border-yellow-500">
                    <Lightbulb className="w-4 h-4 text-yellow-400 mt-0.5" />
                    <div className="flex-1">
                      <div className="text-white text-sm font-medium">Custom inquiry beyond AI scope</div>
                      <div className="text-yellow-200 text-xs">Special request • Priority customer</div>
                    </div>
                    <div className="text-yellow-300 text-xs">12m</div>
                  </div>
                </div>
              </div>

              {/* Live Activity Stream */}
              <div className="bg-slate-500/10 backdrop-blur-xl rounded-xl border border-slate-500/30 p-6">
                <div className="flex items-center space-x-3 mb-4">
                  <Activity className="w-5 h-5 text-slate-400" />
                  <h4 className="font-bold text-white">Live Activity Stream</h4>
                </div>
                <div className="space-y-3">
                  <div className="flex items-start space-x-3 p-3 bg-green-500/20 rounded-lg border-l-4 border-green-500">
                    <CheckCircle className="w-4 h-4 text-green-400 mt-0.5" />
                    <div className="flex-1">
                      <div className="text-white text-sm">
                        <strong>AI resolved</strong> order status inquiry from sarah@example.com
                      </div>
                      <div className="text-green-200 text-xs">Order #12847 • Response time: 1.2s • Rating: ⭐⭐⭐⭐⭐</div>
                    </div>
                    <div className="text-green-300 text-xs">2 min ago</div>
                  </div>
                  <div className="flex items-start space-x-3 p-3 bg-blue-500/20 rounded-lg border-l-4 border-blue-500">
                    <DollarSign className="w-4 h-4 text-blue-400 mt-0.5" />
                    <div className="flex-1">
                      <div className="text-white text-sm">
                        <strong>Manual refund</strong> processed for promo code issue
                      </div>
                      <div className="text-blue-200 text-xs">$29.99 refund • Order #12843 • Agent: You</div>
                    </div>
                    <div className="text-blue-300 text-xs">5 min ago</div>
                  </div>
                  <div className="flex items-start space-x-3 p-3 bg-purple-500/20 rounded-lg border-l-4 border-purple-500">
                    <RefreshCw className="w-4 h-4 text-purple-400 mt-0.5" />
                    <div className="flex-1">
                      <div className="text-white text-sm">
                        <strong>AI paused</strong> subscription for customer request
                      </div>
                      <div className="text-purple-200 text-xs">Monthly plan • Customer: mike@store.com</div>
                    </div>
                    <div className="text-purple-300 text-xs">8 min ago</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* Order Change Automation - Desktop */}
      <section className="relative ds-section-padding-desktop overflow-hidden hidden md:block">
        
        <div className="relative max-w-7xl mx-auto">
          
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center space-x-2 bg-white/10 backdrop-blur-xl rounded-full px-4 py-2 mb-8 border border-white/20 glass-pulse">
              <RefreshCw className="w-4 h-4 text-cyan-400" />
              <span className="text-sm font-medium text-white/90">6-Second Resolution</span>
            </div>
            <h2 className="ds-heading-lg font-bold mb-4 bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent">
              Order Changes
              <br />
              <span className="ds-gradient-primary-text">Fully Automated</span>
            </h2>
            <p className="text-white/70 max-w-2xl mx-auto text-lg">
              Cancellations, address changes, order modifications—all handled by AI in seconds.
            </p>
          </div>

          {/* Horizontal Timeline - No Card */}
          <div className="max-w-6xl mx-auto mb-16">
            <div className="relative">
              {/* Timeline Line */}
              <div className="absolute top-8 left-0 right-0 h-0.5 bg-gradient-to-r from-purple-500 via-blue-500 to-green-500"></div>
              
              {/* Timeline Steps */}
              <div className="relative flex justify-between">
                
                {/* Step 1 */}
                <div className="flex flex-col items-center">
                  <div className="w-16 h-16 bg-purple-500 rounded-full flex items-center justify-center z-10">
                    <Mail className="w-8 h-8 text-white" />
                  </div>
                  <p className="text-sm font-medium text-white mt-4">Request Received</p>
                  <p className="text-xs text-white/60 mt-1">Customer email arrives</p>
                  <p className="text-xs text-white/40 mt-0.5">0s</p>
                </div>

                {/* Step 2 */}
                <div className="flex flex-col items-center">
                  <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center z-10">
                    <Brain className="w-8 h-8 text-white" />
                  </div>
                  <p className="text-sm font-medium text-white mt-4">AI Processing</p>
                  <p className="text-xs text-white/60 mt-1">Intent analyzed & extracted</p>
                  <p className="text-xs text-white/40 mt-0.5">1s</p>
                </div>

                {/* Step 3 */}
                <div className="flex flex-col items-center">
                  <div className="w-16 h-16 bg-indigo-500 rounded-full flex items-center justify-center z-10">
                    <Shield className="w-8 h-8 text-white" />
                  </div>
                  <p className="text-sm font-medium text-white mt-4">Validation</p>
                  <p className="text-xs text-white/60 mt-1">Eligibility & rules checked</p>
                  <p className="text-xs text-white/40 mt-0.5">2s</p>
                </div>

                {/* Step 4 */}
                <div className="flex flex-col items-center">
                  <div className="w-16 h-16 bg-cyan-500 rounded-full flex items-center justify-center z-10">
                    <Send className="w-8 h-8 text-white" />
                  </div>
                  <p className="text-sm font-medium text-white mt-4">3PL Email</p>
                  <p className="text-xs text-white/60 mt-1">Warehouse notified automatically</p>
                  <p className="text-xs text-white/40 mt-0.5">3s</p>
                </div>

                {/* Step 5 */}
                <div className="flex flex-col items-center">
                  <div className="w-16 h-16 bg-teal-500 rounded-full flex items-center justify-center z-10">
                    <RefreshCw className="w-8 h-8 text-white" />
                  </div>
                  <p className="text-sm font-medium text-white mt-4">System Update</p>
                  <p className="text-xs text-white/60 mt-1">Order status synchronized</p>
                  <p className="text-xs text-white/40 mt-0.5">5s</p>
                </div>

                {/* Step 6 */}
                <div className="flex flex-col items-center">
                  <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center z-10">
                    <CheckCircle className="w-8 h-8 text-white" />
                  </div>
                  <p className="text-sm font-medium text-white mt-4">Customer Notified</p>
                  <p className="text-xs text-white/60 mt-1">Confirmation sent & complete</p>
                  <p className="text-xs text-white/40 mt-0.5">6s</p>
                </div>

              </div>
            </div>
          </div>

          {/* Use Cases Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
            <div className="bg-white/10 backdrop-blur-xl rounded-xl border border-white/20 p-6 text-center">
              <h3 className="text-lg font-semibold text-white mb-2">Cancellations</h3>
              <p className="text-sm text-white/60">Stop shipments & process refunds</p>
            </div>
            <div className="bg-white/10 backdrop-blur-xl rounded-xl border border-white/20 p-6 text-center">
              <h3 className="text-lg font-semibold text-white mb-2">Address Changes</h3>
              <p className="text-sm text-white/60">Update shipping before dispatch</p>
            </div>
            <div className="bg-white/10 backdrop-blur-xl rounded-xl border border-white/20 p-6 text-center">
              <h3 className="text-lg font-semibold text-white mb-2">Order Modifications</h3>
              <p className="text-sm text-white/60">Add, remove, or change items</p>
            </div>
          </div>

        </div>
      </section>

      {/* Order Change Automation - Mobile */}
      <section className="relative ds-section-padding-mobile md:hidden">
        
        <div className="relative max-w-xl mx-auto">
          
          {/* Header */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center space-x-2 bg-white/10 backdrop-blur-xl rounded-full px-4 py-2 mb-6 border border-white/20 glass-pulse">
              <RefreshCw className="w-4 h-4 text-cyan-400" />
              <span className="text-sm font-medium text-white/90">6-Second Resolution</span>
            </div>
            <h2 className="text-3xl font-bold mb-4 bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent">
              Order Changes
              <br />
              <span className="ds-gradient-primary-text">Fully Automated</span>
            </h2>
            <p className="text-white/70 text-base">
              Cancellations, address changes, order modifications—all handled by AI in seconds.
            </p>
          </div>

          {/* Vertical Timeline for Mobile */}
          <div className="relative mb-12">
            
            {/* Vertical Timeline Line */}
            <div className="absolute left-6 top-6 bottom-6 w-0.5 bg-gradient-to-b from-purple-500 via-blue-500 via-indigo-500 via-cyan-500 via-teal-500 to-green-500"></div>
            
            <div className="space-y-6">
              {/* Step 1 */}
              <div className="flex items-start space-x-4 relative">
                <div className="w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center flex-shrink-0 z-10">
                  <Mail className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <h4 className="text-white font-medium">Request Received</h4>
                  <p className="text-white/60 text-sm">Customer email arrives • 0s</p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex items-start space-x-4 relative">
                <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 z-10">
                  <Brain className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <h4 className="text-white font-medium">AI Processing</h4>
                  <p className="text-white/60 text-sm">Intent analyzed & extracted • 1s</p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex items-start space-x-4 relative">
                <div className="w-12 h-12 bg-indigo-500 rounded-full flex items-center justify-center flex-shrink-0 z-10">
                  <Shield className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <h4 className="text-white font-medium">Validation</h4>
                  <p className="text-white/60 text-sm">Eligibility & rules checked • 2s</p>
                </div>
              </div>

              {/* Step 4 */}
              <div className="flex items-start space-x-4 relative">
                <div className="w-12 h-12 bg-cyan-500 rounded-full flex items-center justify-center flex-shrink-0 z-10">
                  <Send className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <h4 className="text-white font-medium">3PL Email</h4>
                  <p className="text-white/60 text-sm">Warehouse notified automatically • 3s</p>
                </div>
              </div>

              {/* Step 5 */}
              <div className="flex items-start space-x-4 relative">
                <div className="w-12 h-12 bg-teal-500 rounded-full flex items-center justify-center flex-shrink-0 z-10">
                  <RefreshCw className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <h4 className="text-white font-medium">System Update</h4>
                  <p className="text-white/60 text-sm">Order status synchronized • 5s</p>
                </div>
              </div>

              {/* Step 6 */}
              <div className="flex items-start space-x-4 relative">
                <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0 z-10">
                  <CheckCircle className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <h4 className="text-white font-medium">Customer Notified</h4>
                  <p className="text-white/60 text-sm">Confirmation sent & complete • 6s</p>
                </div>
              </div>
            </div>

          </div>

          {/* Use Cases */}
          <div className="space-y-4">
            <div className="bg-white/10 backdrop-blur-xl rounded-xl border border-white/20 p-4 text-center">
              <h3 className="text-base font-semibold text-white mb-1">Cancellations</h3>
              <p className="text-sm text-white/60">Stop shipments & process refunds</p>
            </div>
            <div className="bg-white/10 backdrop-blur-xl rounded-xl border border-white/20 p-4 text-center">
              <h3 className="text-base font-semibold text-white mb-1">Address Changes</h3>
              <p className="text-sm text-white/60">Update shipping before dispatch</p>
            </div>
            <div className="bg-white/10 backdrop-blur-xl rounded-xl border border-white/20 p-4 text-center">
              <h3 className="text-base font-semibold text-white mb-1">Order Modifications</h3>
              <p className="text-sm text-white/60">Add, remove, or change items</p>
            </div>
          </div>

        </div>
      </section>

      {/* Rapid Resolution Marketing Section */}
      <section className="relative ds-section-padding-desktop overflow-hidden hidden md:block">
        
        {/* Animated Background */}
        <div className="absolute inset-0">
          <div className="absolute top-20 right-20 w-64 h-64 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-20 left-20 w-80 h-80 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
        </div>

        <div className="relative max-w-7xl mx-auto">
          
          {/* Section Header */}
          <div className="text-center mb-20">
            <div className="inline-flex items-center space-x-2 bg-white/10 backdrop-blur-xl rounded-full px-4 py-2 mb-8 border border-white/20 glass-pulse">
              <Zap className="w-4 h-4 text-orange-400" />
              <span className="text-sm font-medium text-white/90">Rapid Resolution Engine</span>
            </div>
            <h2 className="ds-heading-lg font-bold mb-6 bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent">
              When Humans Step In,
              <br />
              <span className="ds-gradient-primary-text">Problems Get Solved</span>
            </h2>
            <p className="text-white/70 max-w-4xl mx-auto leading-relaxed text-lg">
              For complex cases requiring human touch, the AI assistant provides context-aware suggestions while Quick Actions resolve issues instantly.
            </p>
          </div>

          {/* Main Content Grid */}
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            
            {/* Left: Key Benefits */}
            <div className="space-y-8">
              
              {/* Context-Aware AI */}
              <div className="flex items-start space-x-6">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center flex-shrink-0">
                  <Brain className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white mb-3">Context-Aware AI Agent Responses</h3>
                  <p className="text-white/70 text-lg leading-relaxed">
                    The Delight Desk Agent reads entire conversation threads, customer history, and order details to craft genuinely helpful responses.
                  </p>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="flex items-start space-x-6">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center flex-shrink-0">
                  <Zap className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white mb-3">One-Click Quick Actions</h3>
                  <p className="text-white/70 text-lg leading-relaxed">
                    Process refunds, send tracking info, and handle complex requests with single clicks. Turn 10-minute tasks into 10-second solutions.
                  </p>
                </div>
              </div>

              {/* Happy Customers */}
              <div className="flex items-start space-x-6">
                <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-blue-500 rounded-2xl flex items-center justify-center flex-shrink-0">
                  <Heart className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white mb-3">Customers That Actually Thank You</h3>
                  <p className="text-white/70 text-lg leading-relaxed">
                    Instant solutions with personalized responses turn frustrated customers into advocates.
                  </p>
                </div>
              </div>

            </div>

            {/* Right: Interactive Demo */}
            <div className="relative">
              
              {/* Demo Container */}
              <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 p-8 space-y-6 stripe-shimmer">
                
                {/* Demo Header */}
                <div className="flex items-center space-x-3 pb-4 border-b border-white/10">
                  <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-white">Rapid Resolution Process</h4>
                    <p className="text-white/60 text-sm">How human + AI collaboration works</p>
                  </div>
                </div>
                
                {/* Process Steps */}
                <div className="bg-white/5 rounded-lg p-4 mb-6">
                  <h5 className="text-white font-medium mb-3 text-sm">The Process:</h5>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center space-x-3">
                      <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold">1</div>
                      <span className="text-white/80">Email arrives in inbox</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center text-white text-xs font-bold">2</div>
                      <span className="text-white/80">AI classifies complexity and routes to human review</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="w-6 h-6 bg-indigo-500 rounded-full flex items-center justify-center text-white text-xs font-bold">3</div>
                      <span className="text-white/80">Deep analysis generates contextual response</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center text-white text-xs font-bold">4</div>
                      <span className="text-white/80">Human expert reviews and refines</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white text-xs font-bold">5</div>
                      <span className="text-white/80">Solution delivered with precision</span>
                    </div>
                  </div>
                </div>

                {/* Email Inbox */}
                <div className="space-y-4">
                  <h5 className="text-white font-medium text-sm">Email Inbox:</h5>
                  
                  {/* Customer Email */}
                  <div className="bg-red-500/20 rounded-xl p-4 border-l-4 border-red-500">
                    <div className="flex items-center space-x-2 mb-2">
                      <Mail className="w-4 h-4 text-red-400" />
                      <span className="text-white font-medium text-sm">mike.torres@gmail.com</span>
                    </div>
                    <p className="text-white/90 text-sm mb-2">
                      "I bought this jacket for $89 but missed your 25% off sale due to a family emergency. Can I get the sale price? Order #DD-2847"
                    </p>
                    <div className="text-xs text-red-300">
                      Sale ended 3 days ago • Customer wants price adjustment
                    </div>
                  </div>

                  {/* AI Suggestion */}
                  <div className="bg-blue-500/20 rounded-xl p-4 border border-blue-500/30">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <Brain className="w-4 h-4 text-blue-400" />
                        <span className="text-blue-300 font-medium text-sm">AI Suggestion (1.2s)</span>
                      </div>
                      <span className="text-green-300 text-xs">High Confidence</span>
                    </div>
                    <p className="text-blue-100 text-sm mb-3">
                      "Hi Mike, sorry about your emergency. I'm applying the 25% discount to your order retroactively. Processing a $22.25 refund now - you'll see it in 1-2 business days!"
                    </p>
                    <div className="flex space-x-2">
                      <button className="flex-1 bg-green-600 text-white px-3 py-2 rounded text-sm font-medium">
                        ✓ Approve & Send
                      </button>
                      <button className="flex-1 bg-blue-600 text-white px-3 py-2 rounded text-sm font-medium flex items-center justify-center space-x-1">
                        <DollarSign className="w-3 h-3" />
                        <span>Partial Refund $22.25</span>
                      </button>
                    </div>
                  </div>

                  {/* Resolution */}
                  <div className="bg-green-500/20 rounded-xl p-4 border-l-4 border-green-500">
                    <div className="flex items-center space-x-2 mb-2">
                      <CheckCircle className="w-4 h-4 text-green-400" />
                      <span className="text-green-300 font-medium text-sm">Problem Resolved</span>
                    </div>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-white/80">✓ Compassionate email reviewed and sent</span>
                        <span className="text-green-300 text-xs">20s</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/80">✓ Partial refund processed</span>
                        <span className="text-green-300 text-xs">1.1s</span>
                      </div>
                      <div className="text-green-200 text-xs mt-2">
                        💝 Customer keeps purchase + feels valued
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              {/* Floating Stats Pill */}
              <div className="absolute -bottom-5 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full px-6 py-2 border border-purple-400/30 shadow-lg whitespace-nowrap">
                <div className="text-sm font-medium text-white">
                  30 seconds vs 7 minutes manually
                </div>
              </div>

            </div>

          </div>

        </div>
      </section>

      {/* Intelligent Command Center - Mobile */}
      <section className="relative ds-section-padding-mobile md:hidden">
        
        {/* Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/50 to-pink-900/50"></div>
        
        <div className="relative max-w-xl mx-auto">
          
          <div className="text-center mb-12">
            <div className="inline-flex items-center space-x-2 bg-white/10 backdrop-blur-xl rounded-full px-4 py-2 mb-6 border border-white/20 glass-pulse">
              <Zap className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-medium text-white/90">Live Dashboard</span>
            </div>
            <h2 className="ds-heading-lg font-bold mb-4 bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent">
              Mission Control Hub
            </h2>
            <p className="text-white/70">
              Real-time AI processing and performance metrics in one powerful dashboard.
            </p>
          </div>

          {/* Mobile Dashboard Header */}
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 p-6 mb-6 glass-pulse">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Mission Control</h3>
                <p className="text-white/60 text-sm">Live automation dashboard</p>
              </div>
            </div>
            <div className="bg-green-500/20 rounded-lg px-3 py-2 text-center">
              <div className="flex items-center justify-center space-x-2">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-green-400 text-sm font-medium">127 emails processed today</span>
              </div>
            </div>
          </div>

          {/* Mobile Action Cards - Vertical Stack */}
          <div className="space-y-4">

            {/* AI Processing - Mobile */}
            <div className="bg-purple-500/10 backdrop-blur-xl rounded-xl border border-purple-500/30 p-4 glass-pulse">
              <div className="flex items-center space-x-3 mb-3">
                <div className="w-6 h-6 bg-purple-500/20 rounded-lg flex items-center justify-center">
                  <Brain className="w-4 h-4 text-purple-400" />
                </div>
                <h4 className="font-bold text-white">AI Processing</h4>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-white/80 text-sm">Queue</span>
                  <span className="text-purple-200 text-sm">3 emails</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <div className="ai-thinking-grid-small">
                    <div className="ai-thinking-dot-small"></div>
                    <div className="ai-thinking-dot-small"></div>
                    <div className="ai-thinking-dot-small"></div>
                    <div className="ai-thinking-dot-small"></div>
                    <div className="ai-thinking-dot-small"></div>
                    <div className="ai-thinking-dot-small"></div>
                    <div className="ai-thinking-dot-small"></div>
                    <div className="ai-thinking-dot-small"></div>
                    <div className="ai-thinking-dot-small"></div>
                  </div>
                  <span className="text-purple-200 text-sm">Analyzing intent...</span>
                </div>
                <div className="bg-purple-500/20 rounded-lg p-2">
                  <div className="text-purple-200 text-xs">
                    Order Status Request<br/>
                    Confidence: 98.7% • ETA: 0.8s
                  </div>
                </div>
              </div>
            </div>

            {/* Live Stats - Mobile */}
            <div className="bg-green-500/10 backdrop-blur-xl rounded-xl border border-green-500/30 p-4 glass-pulse">
              <div className="flex items-center space-x-3 mb-3">
                <div className="w-6 h-6 bg-green-500/20 rounded-lg flex items-center justify-center">
                  <BarChart3 className="w-4 h-4 text-green-400" />
                </div>
                <h4 className="font-bold text-white">Today's Stats</h4>
              </div>
              <div className="space-y-2.5">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-white/80 text-sm">Auto-resolved</span>
                    <span className="text-green-200 text-sm font-medium">83%</span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-2">
                    <div className="bg-gradient-to-r from-green-400 to-green-500 h-2 rounded-full" style={{width: '83%'}}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-white/80 text-sm">Human resolved</span>
                    <span className="text-blue-200 text-sm font-medium">17%</span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-2">
                    <div className="bg-gradient-to-r from-blue-400 to-blue-500 h-2 rounded-full" style={{width: '17%'}}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-white/80 text-sm">Avg Response</span>
                    <span className="text-green-200 text-sm font-medium">2.1s</span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-2">
                    <div className="bg-gradient-to-r from-purple-400 to-purple-500 h-2 rounded-full" style={{width: '88%'}}></div>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Rapid Resolution - Mobile */}
          <div className="mt-6 bg-orange-500/10 backdrop-blur-xl rounded-xl border border-orange-500/30 p-4 glass-pulse">
            <h4 className="font-bold text-white mb-3 flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-orange-400" />
              <span>Rapid Resolution <span className="text-orange-300/80 font-normal text-xs">(AI + Human expertise)</span></span>
            </h4>
            
            <div className="space-y-3">
              <div className="flex items-start space-x-3 p-3 bg-orange-500/10 rounded-lg border-l-2 border-orange-500">
                <User className="w-4 h-4 text-orange-400 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="text-white text-sm">
                    <strong>Complex refund</strong> requires human review
                  </div>
                  <div className="text-orange-200 text-xs">Multiple orders • Customer: alex@business.com</div>
                </div>
                <div className="text-white/50 text-xs">3m</div>
              </div>
              
              <div className="flex items-start space-x-3 p-3 bg-red-500/10 rounded-lg border-l-2 border-red-500">
                <AlertCircle className="w-4 h-4 text-red-400 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="text-white text-sm">
                    <strong>Billing dispute</strong> needs agent attention
                  </div>
                  <div className="text-red-200 text-xs">Chargeback claim • Order #12899</div>
                </div>
                <div className="text-white/50 text-xs">7m</div>
              </div>
            </div>
          </div>

          {/* Mobile Activity Stream */}
          <div className="mt-6 bg-white/5 backdrop-blur-xl rounded-xl border border-white/10 p-4 glass-pulse">
            <h4 className="font-bold text-white mb-3 flex items-center space-x-2">
              <Globe className="w-4 h-4 text-blue-400" />
              <span>Live Activity</span>
            </h4>
            
            <div className="space-y-3">
              <div className="flex items-start space-x-3 p-3 bg-green-500/10 rounded-lg border-l-2 border-green-500">
                <CheckCircle className="w-4 h-4 text-green-400 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="text-white text-sm">
                    <strong>AI resolved</strong> order inquiry
                  </div>
                  <div className="text-green-200 text-xs">Order #12847 • 1.2s • ⭐⭐⭐⭐⭐</div>
                </div>
                <div className="text-white/50 text-xs">2m</div>
              </div>
              
              <div className="flex items-start space-x-3 p-3 bg-blue-500/10 rounded-lg border-l-2 border-blue-500">
                <DollarSign className="w-4 h-4 text-blue-400 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="text-white text-sm">
                    <strong>Manual refund</strong> processed
                  </div>
                  <div className="text-blue-200 text-xs">$29.99 • Order #12843</div>
                </div>
                <div className="text-white/50 text-xs">5m</div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* Rapid Resolution Demo - Mobile */}
      <section className="relative ds-section-padding-mobile md:hidden">
        
        {/* Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/50 to-purple-900/50"></div>
        
        <div className="relative max-w-xl mx-auto">
          
          <div className="text-center mb-12">
            <div className="inline-flex items-center space-x-2 bg-white/10 backdrop-blur-xl rounded-full px-4 py-2 mb-6 border border-white/20 glass-pulse">
              <Zap className="w-4 h-4 text-orange-400" />
              <span className="text-sm font-medium text-white/90">Rapid Resolution Engine</span>
            </div>
            <h2 className="ds-heading-lg font-bold mb-4 bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent">
              When Humans Step In,
              <br />
              <span className="ds-gradient-primary-text">Problems Get Solved</span>
            </h2>
            <p className="text-white/70 text-sm">
              For complex cases requiring human touch, AI provides context-aware suggestions while Quick Actions resolve issues instantly.
            </p>
          </div>

          {/* Key Benefits - Mobile */}
          <div className="space-y-6 mb-12">
            
            {/* Context-Aware AI */}
            <div className="flex items-start space-x-4">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center flex-shrink-0">
                <Brain className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white mb-2">Context-Aware AI Responses</h3>
                <p className="text-white/70 text-sm leading-relaxed">
                  AI reads entire conversation threads, customer history, and order details to craft genuinely helpful responses.
                </p>
              </div>
            </div>

            {/* One-Click Quick Actions */}
            <div className="flex items-start space-x-4">
              <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center flex-shrink-0">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white mb-2">One-Click Quick Actions</h3>
                <p className="text-white/70 text-sm leading-relaxed">
                  Process refunds, send tracking info, and handle complex requests with single clicks. Turn 10-minute tasks into 10-second solutions.
                </p>
              </div>
            </div>

            {/* Happy Customers */}
            <div className="flex items-start space-x-4">
              <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-blue-500 rounded-xl flex items-center justify-center flex-shrink-0">
                <Heart className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white mb-2">Customers That Actually Thank You</h3>
                <p className="text-white/70 text-sm leading-relaxed">
                  Instant solutions with personalized responses turn frustrated customers into advocates.
                </p>
              </div>
            </div>

          </div>

          {/* Mobile Demo Flow */}
          <div className="space-y-6 relative">

            {/* Process Overview */}
            <div className="bg-white/5 rounded-lg p-4">
              <h5 className="text-white font-medium mb-3 text-sm">The Process:</h5>
              <div className="space-y-2 text-sm">
                <div className="flex items-center space-x-3">
                  <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold">1</div>
                  <span className="text-white/80">Email arrives in inbox</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center text-white text-xs font-bold">2</div>
                  <span className="text-white/80">AI classifies complexity and routes to human review</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-5 h-5 bg-indigo-500 rounded-full flex items-center justify-center text-white text-xs font-bold">3</div>
                  <span className="text-white/80">Deep analysis generates contextual response</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-5 h-5 bg-orange-500 rounded-full flex items-center justify-center text-white text-xs font-bold">4</div>
                  <span className="text-white/80">Human expert reviews and refines</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center text-white text-xs font-bold">5</div>
                  <span className="text-white/80">Solution delivered with precision</span>
                </div>
              </div>
            </div>

            {/* Email Inbox */}
            <div className="space-y-4">
              <h5 className="text-white font-medium text-sm">Email Inbox:</h5>
              
              {/* Customer Email */}
              <div className="bg-red-500/20 rounded-xl p-4 border-l-4 border-red-500">
                <div className="flex items-center space-x-2 mb-2">
                  <Mail className="w-4 h-4 text-red-400" />
                  <span className="text-white font-medium text-sm">mike.torres@gmail.com</span>
                </div>
                <p className="text-white/90 text-sm mb-2">
                  "I bought this jacket for $89 but missed your 25% off sale due to a family emergency. Can I get the sale price? Order #DD-2847"
                </p>
                <div className="text-xs text-red-300">
                  Sale ended 3 days ago • Customer wants price adjustment
                </div>
              </div>

              {/* AI Suggestion */}
              <div className="bg-blue-500/20 rounded-xl p-4 border border-blue-500/30">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <Brain className="w-4 h-4 text-blue-400" />
                    <span className="text-blue-300 font-medium text-sm">AI Suggestion (1.2s)</span>
                  </div>
                  <span className="text-green-300 text-xs">High Confidence</span>
                </div>
                <p className="text-blue-100 text-sm mb-3">
                  "Hi Mike, sorry about your emergency. I'm applying the 25% discount to your order retroactively. Processing a $22.25 refund now - you'll see it in 1-2 business days!"
                </p>
                <div className="flex space-x-2">
                  <button className="flex-1 bg-green-600 text-white px-3 py-2 rounded text-sm font-medium">
                    ✓ Approve & Send
                  </button>
                  <button className="flex-1 bg-blue-600 text-white px-3 py-2 rounded text-sm font-medium flex items-center justify-center space-x-1">
                    <DollarSign className="w-3 h-3" />
                    <span>Partial Refund $22.25</span>
                  </button>
                </div>
              </div>

              {/* Resolution */}
              <div className="bg-green-500/20 rounded-xl p-4 border-l-4 border-green-500">
                <div className="flex items-center space-x-2 mb-2">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  <span className="text-green-300 font-medium text-sm">Problem Resolved</span>
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-white/80">✓ Compassionate email reviewed and sent</span>
                    <span className="text-green-300 text-xs">20s</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/80">✓ Partial refund processed</span>
                    <span className="text-green-300 text-xs">1.1s</span>
                  </div>
                  <div className="text-green-200 text-xs mt-2">
                    💝 Customer keeps purchase + feels valued
                  </div>
                </div>
              </div>
            </div>

            {/* Mobile Stats Pill */}
            <div className="flex justify-center pt-4">
              <div className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-full px-6 py-3 border border-purple-400/30 shadow-lg">
                <div className="text-sm font-medium text-white text-center">
                  30 seconds vs 7 minutes manually
                </div>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* Benefits Section - Why This Works - Desktop */}
      <section id="how-it-works" className="relative ds-section-padding-desktop bg-gradient-to-br from-purple-900/30 via-slate-900 to-blue-900/30 hidden md:block">
        <div className="max-w-7xl mx-auto">
          
          <div className="text-center mb-16">
            <div className="inline-flex items-center space-x-2 bg-white/10 backdrop-blur-xl rounded-full px-4 py-2 mb-8 border border-white/20 glass-pulse">
              <Brain className="w-4 h-4 text-purple-400" />
              <span className="text-sm font-medium text-white/90">Selective Automation</span>
            </div>
            <h2 className="ds-heading-lg font-bold mb-6 text-white stripe-fade-in-up stripe-stagger-2">
              <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">AI You Can Trust</span>
            </h2>
            <p className="text-xl text-white/70 max-w-3xl mx-auto stripe-fade-in-up stripe-stagger-3">
              Smart automation that knows when to step back. The AI agent handles routine requests instantly while complex issues go straight to your team.
            </p>
          </div>

          {/* Simple AI vs Human Split */}
          <div className="flex justify-center mb-16 stripe-scale-in stripe-stagger-4">
            <div className="grid lg:grid-cols-2 gap-6 max-w-4xl w-full">
              
              {/* AI Agent Handles */}
              <div className="bg-green-500/20 rounded-2xl border border-green-500/30 p-6 text-center">
                <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Brain className="w-6 h-6 text-green-400" />
                </div>
                <div className="text-5xl font-bold text-green-400 mb-2">80%</div>
                <h4 className="text-xl font-bold text-white mb-3">AI Agent Handles</h4>
                <p className="text-green-200 leading-relaxed mb-4">
                  Order status, refunds and returns, subscription changes.
                </p>
                <div className="bg-white/10 backdrop-blur-xl rounded-lg border border-white/20 px-4 py-2">
                  <div className="text-green-300 font-medium text-sm">
                    ⚡ Instant • Accurate • Delightful
                  </div>
                </div>
              </div>

              {/* Humans Handle */}
              <div className="bg-blue-500/20 rounded-2xl border border-blue-500/30 p-6 text-center">
                <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Users className="w-6 h-6 text-blue-400" />
                </div>
                <div className="text-5xl font-bold text-blue-400 mb-2">20%</div>
                <h4 className="text-xl font-bold text-white mb-3">Humans Handle</h4>
                <p className="text-blue-200 leading-relaxed mb-4">
                  VIP customers, policy exceptions, and sensitive situations.
                </p>
                <div className="bg-white/10 backdrop-blur-xl rounded-lg border border-white/20 px-4 py-2">
                  <div className="text-blue-300 font-medium text-sm">
                    🧠 Thoughtful • Personal • Strategic
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* CTA Section - Desktop AI Strategy */}
          <div className="text-center mt-16">
            <Button 
              className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-medium px-8 py-3 rounded-lg stripe-scale-in stripe-stagger-7"
              onClick={() => navigate('/signup')}
            >
              Start Free Trial
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>

        </div>
      </section>
      {/* Benefits Section - Why This Works - Mobile */}
      <section id="how-it-works-mobile" className="relative ds-section-padding-mobile bg-gradient-to-br from-purple-900/30 via-slate-900 to-blue-900/30 md:hidden">
        <div className="max-w-xl mx-auto">
          
          <div className="text-center mb-12">
            <div className="inline-flex items-center space-x-2 bg-white/10 backdrop-blur-xl rounded-full px-4 py-2 mb-6 border border-white/20 glass-pulse">
              <Brain className="w-4 h-4 text-purple-400" />
              <span className="text-sm font-medium text-white/90">Selective Automation</span>
            </div>
            <h2 className="ds-heading-lg font-bold mb-4 text-white">
              <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">AI You Can Trust</span>
            </h2>
            <p className="text-white/70">
              Smart automation that knows when to step back. The AI agent handles routine requests instantly while complex issues go straight to your team.
            </p>
          </div>

          {/* Mobile AI vs Human Split */}
          <div className="space-y-6 mb-12">
              
              {/* AI Agent Handles */}
              <div className="bg-green-500/20 rounded-2xl border border-green-500/30 p-6 text-center">
                <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Brain className="w-6 h-6 text-green-400" />
                </div>
                <div className="text-4xl font-bold text-green-400 mb-2">80%</div>
                <h4 className="text-xl font-bold text-white mb-3">AI Agent Handles</h4>
                <p className="text-green-200 leading-relaxed mb-4">
                  Order status, refunds and returns, subscription changes.
                </p>
                <div className="bg-white/10 backdrop-blur-xl rounded-lg border border-white/20 px-4 py-2">
                  <div className="text-green-300 font-medium text-sm">
                    ⚡ Instant • Accurate • Delightful
                  </div>
                </div>
              </div>

              {/* Humans Handle */}
              <div className="bg-blue-500/20 rounded-2xl border border-blue-500/30 p-6 text-center">
                <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Users className="w-6 h-6 text-blue-400" />
                </div>
                <div className="text-4xl font-bold text-blue-400 mb-2">20%</div>
                <h4 className="text-xl font-bold text-white mb-3">Humans Handle</h4>
                <p className="text-blue-200 leading-relaxed mb-4">
                  VIP customers, policy exceptions, and sensitive situations.
                </p>
                <div className="bg-white/10 backdrop-blur-xl rounded-lg border border-white/20 px-4 py-2">
                  <div className="text-blue-300 font-medium text-sm">
                    🧠 Thoughtful • Personal • Strategic
                  </div>
                </div>
              </div>

          </div>

          {/* CTA Section - Mobile AI Strategy */}
          <div className="text-center mt-12">
            <Button 
              className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-medium px-8 py-3 rounded-lg"
              onClick={() => navigate('/signup')}
            >
              Start Free Trial
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>

        </div>
      </section>
      {/* Simple Setup Process */}
      <section className="relative ds-section-padding-mobile bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 overflow-hidden">
        {/* Animated Background Elements */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 sm:top-20 left-10 sm:left-20 w-32 h-32 sm:w-40 sm:h-40 bg-purple-500/20 rounded-full blur-2xl animate-pulse"></div>
          <div className="absolute bottom-10 sm:bottom-20 right-10 sm:right-20 w-48 h-48 sm:w-60 sm:h-60 bg-blue-500/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 sm:w-80 sm:h-80 bg-green-500/10 rounded-full blur-3xl animate-pulse delay-500"></div>
        </div>

        <div className="ds-container relative z-10">
          <div className="text-center mb-20">
            <div className="inline-flex items-center space-x-2 bg-white/10 backdrop-blur-xl rounded-full px-4 py-2 mb-8 border border-white/20 glass-pulse">
              <Settings className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-medium text-white/90">Simple Setup</span>
            </div>
            <h2 className="ds-heading-lg font-bold mb-6 bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent stripe-fade-in-up stripe-stagger-2">
              Get Started in <span className="ds-gradient-primary-text">Minutes</span>, Not Months
            </h2>
            <p className="ds-body-lg ds-text-muted max-w-3xl mx-auto stripe-fade-in-up stripe-stagger-3">
              Three simple steps to transform your customer service workflow. No training, no complexity.
            </p>
          </div>

          {/* Mobile Version - Cards Only */}
          <div className="block lg:hidden space-y-8">
            {/* Step 1 Card - Mobile */}
            <div className="relative">
              <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl blur opacity-20"></div>
              <div className="relative ds-surface-elevated rounded-2xl ds-card-padding shadow-2xl hover:border-purple-500/50 transition-all duration-300 stripe-shimmer">
                <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-4 sm:space-y-0 sm:space-x-4 mb-6">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-br from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center flex-shrink-0">
                    <span className="text-xl sm:text-2xl font-bold text-white">1</span>
                  </div>
                  <div>
                    <h3 className="ds-heading-md ds-text-primary mb-2">Connect Store & Email</h3>
                    <p className="ds-body-md ds-text-secondary">One-click OAuth for WooCommerce/Shopify + Gmail/Outlook</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="ds-surface-card rounded-xl p-4 border border-blue-500/20">
                    <div className="flex items-center space-x-2 mb-3">
                      <Store className="h-5 w-5 text-blue-400" />
                      <span className="ds-text-primary font-semibold ds-body-md">E-commerce</span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                        <span className="ds-body-sm ds-text-secondary">WooCommerce</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                        <span className="ds-body-sm ds-text-secondary">Shopify</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="ds-surface-card rounded-xl p-4 border border-purple-500/20">
                    <div className="flex items-center space-x-2 mb-3">
                      <Mail className="h-5 w-5 text-purple-400" />
                      <span className="ds-text-primary font-semibold ds-body-md">Email</span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                        <span className="ds-body-sm ds-text-secondary">Gmail</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                        <span className="ds-body-sm ds-text-secondary">Outlook 365</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 2 Card - Mobile */}
            <div className="relative">
              <div className="absolute -inset-1 bg-gradient-to-r from-green-500 to-blue-500 rounded-2xl blur opacity-20"></div>
              <div className="relative ds-surface-elevated rounded-2xl ds-card-padding shadow-2xl hover:border-green-500/50 transition-all duration-300 stripe-shimmer">
                <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-4 sm:space-y-0 sm:space-x-4 mb-6">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-br from-green-500 to-blue-500 rounded-2xl flex items-center justify-center flex-shrink-0">
                    <span className="text-xl sm:text-2xl font-bold text-white">2</span>
                  </div>
                  <div>
                    <h3 className="ds-heading-md ds-text-primary mb-2">Enable Automations</h3>
                    <p className="ds-body-md ds-text-secondary">Toggle AI rules for instant customer responses</p>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between ds-surface-card rounded-lg p-3 border border-green-500/20">
                    <span className="ds-body-md ds-text-primary font-medium">Order Status Requests</span>
                    <div className="w-10 h-5 sm:w-12 sm:h-6 bg-green-500 rounded-full flex items-center flex-shrink-0">
                      <div className="w-4 h-4 sm:w-5 sm:h-5 bg-white rounded-full ml-0.5 sm:ml-1 shadow transform translate-x-5 sm:translate-x-6"></div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between ds-surface-card rounded-lg p-3 border border-blue-500/20">
                    <span className="ds-body-md ds-text-primary font-medium">Refunds (Rules Based)</span>
                    <div className="w-10 h-5 sm:w-12 sm:h-6 bg-green-500 rounded-full flex items-center flex-shrink-0">
                      <div className="w-4 h-4 sm:w-5 sm:h-5 bg-white rounded-full ml-0.5 sm:ml-1 shadow transform translate-x-5 sm:translate-x-6"></div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between ds-surface-card rounded-lg p-3 border border-purple-500/20">
                    <span className="ds-body-md ds-text-primary font-medium">Subscription Changes</span>
                    <div className="w-10 h-5 sm:w-12 sm:h-6 bg-green-500 rounded-full flex items-center flex-shrink-0">
                      <div className="w-4 h-4 sm:w-5 sm:h-5 bg-white rounded-full ml-0.5 sm:ml-1 shadow transform translate-x-5 sm:translate-x-6"></div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between ds-surface-card rounded-lg p-3 border border-pink-500/20">
                    <span className="ds-body-md ds-text-primary font-medium">Product Questions</span>
                    <div className="w-10 h-5 sm:w-12 sm:h-6 bg-green-500 rounded-full flex items-center flex-shrink-0">
                      <div className="w-4 h-4 sm:w-5 sm:h-5 bg-white rounded-full ml-0.5 sm:ml-1 shadow transform translate-x-5 sm:translate-x-6"></div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between ds-surface-card rounded-lg p-3 border border-orange-500/20">
                    <span className="ds-body-md ds-text-primary font-medium">Order Cancellations</span>
                    <div className="w-10 h-5 sm:w-12 sm:h-6 bg-green-500 rounded-full flex items-center flex-shrink-0">
                      <div className="w-4 h-4 sm:w-5 sm:h-5 bg-white rounded-full ml-0.5 sm:ml-1 shadow transform translate-x-5 sm:translate-x-6"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 3 Card - Mobile */}
            <div className="relative">
              <div className="absolute -inset-1 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl blur opacity-20"></div>
              <div className="relative ds-surface-elevated rounded-2xl ds-card-padding shadow-2xl hover:border-pink-500/50 transition-all duration-300 stripe-shimmer">
                <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-4 sm:space-y-0 sm:space-x-4 mb-6">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center flex-shrink-0">
                    <span className="text-xl sm:text-2xl font-bold text-white">3</span>
                  </div>
                  <div>
                    <h3 className="ds-heading-md ds-text-primary mb-2">Train Your AI</h3>
                    <p className="ds-body-md ds-text-secondary">Drop URLs from your website to train on products and policies</p>
                  </div>
                </div>
                
                <div className="ds-surface-card rounded-xl p-4 border border-purple-500/20">
                  <div className="space-y-3">
                    <input 
                      placeholder="Drop URL: yourstore.com/faq" 
                      className="w-full ds-surface-subtle border border-purple-500/30 rounded-lg px-3 py-2 ds-text-primary placeholder-white/50 ds-body-sm focus:border-purple-400/50 focus:outline-none transition-colors"
                      disabled
                    />
                    <div className="flex items-center justify-between text-xs">
                      <span className="ds-text-secondary">✓ Product pages</span>
                      <span className="ds-text-secondary">✓ Return policy</span>
                      <span className="ds-text-secondary">✓ Brand info</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Desktop Version - Full Layout with Icons and Blurbs */}
          <div className="hidden lg:block">
            <div className="space-y-20">
              {/* Step 1: Connect Store & Email */}
              <div className="flex flex-col lg:flex-row items-center gap-12 stripe-scale-in stripe-stagger-4">
                <div className="flex-1 lg:order-1">
                  <div className="relative">
                    <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl blur opacity-20"></div>
                    <div className="relative ds-surface-elevated rounded-2xl ds-card-padding shadow-2xl hover:border-purple-500/50 transition-all duration-300 stripe-shimmer">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-4 sm:space-y-0 sm:space-x-4 mb-6">
                        <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-br from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center flex-shrink-0">
                          <span className="text-xl sm:text-2xl font-bold text-white">1</span>
                        </div>
                        <div>
                          <h3 className="ds-heading-md ds-text-primary mb-2">Connect Store & Email</h3>
                          <p className="ds-body-md ds-text-secondary">One-click OAuth for WooCommerce/Shopify + Gmail/Outlook</p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="ds-surface-card rounded-xl p-4 border border-blue-500/20">
                          <div className="flex items-center space-x-2 mb-3">
                            <Store className="h-5 w-5 text-blue-400" />
                            <span className="ds-text-primary font-semibold ds-body-md">E-commerce</span>
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center space-x-2">
                              <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                              <span className="ds-body-sm ds-text-secondary">WooCommerce</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                              <span className="ds-body-sm ds-text-secondary">Shopify</span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="ds-surface-card rounded-xl p-4 border border-purple-500/20">
                          <div className="flex items-center space-x-2 mb-3">
                            <Mail className="h-5 w-5 text-purple-400" />
                            <span className="ds-text-primary font-semibold ds-body-md">Email</span>
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center space-x-2">
                              <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                              <span className="ds-body-sm ds-text-secondary">Gmail</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                              <span className="ds-body-sm ds-text-secondary">Outlook 365</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex-1 lg:order-2">
                  <div className="text-center lg:text-left px-4 lg:px-0">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 lg:w-24 lg:h-24 mb-4 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto lg:mx-0">
                      <Link2 className="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 text-blue-400" />
                    </div>
                    <h4 className="ds-heading-md ds-text-primary mb-3">Link Your Systems</h4>
                    <p className="ds-body-lg ds-text-muted leading-relaxed">
                      Secure OAuth connections mean no API keys to manage. We access your order data and monitor your existing inbox for customer emails—you stay in control.
                    </p>
                  </div>
                </div>
              </div>

              {/* Step 2: Enable Automations */}
              <div className="flex flex-col lg:flex-row items-center gap-12 stripe-scale-in stripe-stagger-5">
                <div className="flex-1 lg:order-2">
                  <div className="relative">
                    <div className="absolute -inset-1 bg-gradient-to-r from-green-500 to-blue-500 rounded-2xl blur opacity-20"></div>
                    <div className="relative ds-surface-elevated rounded-2xl ds-card-padding shadow-2xl hover:border-green-500/50 transition-all duration-300 stripe-shimmer">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-4 sm:space-y-0 sm:space-x-4 mb-6">
                        <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-br from-green-500 to-blue-500 rounded-2xl flex items-center justify-center flex-shrink-0">
                          <span className="text-xl sm:text-2xl font-bold text-white">2</span>
                        </div>
                        <div>
                          <h3 className="ds-heading-md ds-text-primary mb-2">Enable Automations</h3>
                          <p className="ds-body-md ds-text-secondary">Toggle AI rules for instant customer responses</p>
                        </div>
                      </div>
                      
                      <div className="space-y-3">
                        <div className="flex items-center justify-between ds-surface-card rounded-lg p-3 border border-green-500/20">
                          <span className="ds-body-md ds-text-primary font-medium">Order Status Requests</span>
                          <div className="w-10 h-5 sm:w-12 sm:h-6 bg-green-500 rounded-full flex items-center flex-shrink-0">
                            <div className="w-4 h-4 sm:w-5 sm:h-5 bg-white rounded-full ml-0.5 sm:ml-1 shadow transform translate-x-5 sm:translate-x-6"></div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between ds-surface-card rounded-lg p-3 border border-blue-500/20">
                          <span className="ds-body-md ds-text-primary font-medium">Refunds (Rules Based)</span>
                          <div className="w-10 h-5 sm:w-12 sm:h-6 bg-green-500 rounded-full flex items-center flex-shrink-0">
                            <div className="w-4 h-4 sm:w-5 sm:h-5 bg-white rounded-full ml-0.5 sm:ml-1 shadow transform translate-x-5 sm:translate-x-6"></div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between ds-surface-card rounded-lg p-3 border border-purple-500/20">
                          <span className="ds-body-md ds-text-primary font-medium">Subscription Changes</span>
                          <div className="w-10 h-5 sm:w-12 sm:h-6 bg-green-500 rounded-full flex items-center flex-shrink-0">
                            <div className="w-4 h-4 sm:w-5 sm:h-5 bg-white rounded-full ml-0.5 sm:ml-1 shadow transform translate-x-5 sm:translate-x-6"></div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between ds-surface-card rounded-lg p-3 border border-pink-500/20">
                          <span className="ds-body-md ds-text-primary font-medium">Product Questions</span>
                          <div className="w-10 h-5 sm:w-12 sm:h-6 bg-green-500 rounded-full flex items-center flex-shrink-0">
                            <div className="w-4 h-4 sm:w-5 sm:h-5 bg-white rounded-full ml-0.5 sm:ml-1 shadow transform translate-x-5 sm:translate-x-6"></div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between ds-surface-card rounded-lg p-3 border border-orange-500/20">
                          <span className="ds-body-md ds-text-primary font-medium">Order Cancellations</span>
                          <div className="w-10 h-5 sm:w-12 sm:h-6 bg-green-500 rounded-full flex items-center flex-shrink-0">
                            <div className="w-4 h-4 sm:w-5 sm:h-5 bg-white rounded-full ml-0.5 sm:ml-1 shadow transform translate-x-5 sm:translate-x-6"></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex-1 lg:order-1">
                  <div className="text-center lg:text-right px-4 lg:px-0">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 lg:w-24 lg:h-24 mb-4 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto lg:mx-0 lg:ml-auto">
                      <Zap className="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 text-yellow-400" />
                    </div>
                    <h4 className="ds-heading-md ds-text-primary mb-3">Instant Automation</h4>
                    <p className="ds-body-lg ds-text-muted leading-relaxed">
                      Choose which emails get automated responses. AI handles the routine stuff while complex issues still reach you personally.
                    </p>
                  </div>
                </div>
              </div>

              {/* Step 3: Work Efficiently */}
              <div className="flex flex-col lg:flex-row items-center gap-12 stripe-scale-in stripe-stagger-6">
                <div className="flex-1 lg:order-1">
                  <div className="relative">
                    <div className="absolute -inset-1 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl blur opacity-20"></div>
                    <div className="relative ds-surface-elevated rounded-2xl ds-card-padding shadow-2xl hover:border-pink-500/50 transition-all duration-300 stripe-shimmer">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-4 sm:space-y-0 sm:space-x-4 mb-6">
                        <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center flex-shrink-0">
                          <span className="text-xl sm:text-2xl font-bold text-white">3</span>
                        </div>
                        <div>
                          <h3 className="ds-heading-md ds-text-primary mb-2">Train Your AI</h3>
                          <p className="ds-body-md ds-text-secondary">Drop URLs from your website to train on products and policies</p>
                        </div>
                      </div>
                      
                      <div className="ds-surface-card rounded-xl p-4 border border-purple-500/20">
                        <div className="space-y-3">
                          <input 
                            placeholder="Drop URL: yourstore.com/faq" 
                            className="w-full ds-surface-subtle border border-purple-500/30 rounded-lg px-3 py-2 ds-text-primary placeholder-white/50 ds-body-sm focus:border-purple-400/50 focus:outline-none transition-colors"
                            disabled
                          />
                          <div className="flex items-center justify-between text-xs">
                            <span className="ds-text-secondary">✓ Product pages</span>
                            <span className="ds-text-secondary">✓ Return policy</span>
                            <span className="ds-text-secondary">✓ Brand info</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex-1 lg:order-2">
                  <div className="text-center lg:text-left px-4 lg:px-0">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 lg:w-24 lg:h-24 mb-4 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto lg:mx-0">
                      <Brain className="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 text-purple-400" />
                    </div>
                    <h4 className="ds-heading-md ds-text-primary mb-3">Smart AI Training</h4>
                    <p className="ds-body-lg ds-text-muted leading-relaxed">
                      Just drop URLs from your website. AI automatically scrapes your product pages, policies, and brand info to learn your business and match your voice.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* AI Automation Showcase - The Old Way vs. The Delight Desk Way */}
      <section className="relative ds-section-padding-desktop bg-gradient-to-br from-purple-900/30 via-slate-900 to-indigo-900/30">
        <div className="ds-container">
          
          <div className="text-center mb-16">
            <div className="inline-flex items-center space-x-2 bg-white/10 backdrop-blur-xl rounded-full px-4 py-2 mb-8 border border-white/20 glass-pulse">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span className="text-sm font-medium text-white/90">Customer Support 2.0</span>
            </div>
            <h2 className="ds-heading-lg font-bold mb-6 text-white stripe-fade-in-up stripe-stagger-2">
              2.1 Seconds vs 4 Days
            </h2>
            <p className="text-white/70 max-w-3xl mx-auto leading-relaxed stripe-fade-in-up stripe-stagger-3">
              See the dramatic difference in customer experience
            </p>
          </div>
          
          <div className="flex flex-col lg:flex-row gap-8 max-w-5xl mx-auto">
            
            {/* Before */}
            <div className="bg-red-500/10 rounded-2xl border border-red-500/20 p-8 lg:flex-1 stripe-fade-in-up stripe-stagger-4">
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-12 h-12 bg-red-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Clock className="w-6 h-6 text-red-400" />
                </div>
                <h4 className="text-xl font-bold text-white">Traditional Support</h4>
              </div>
              <ul className="space-y-3 text-white/80 mb-6">
                <li className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-red-400 rounded-full mt-2 flex-shrink-0"></div>
                  <span className="leading-snug">Customer waits 24-48 hours for response</span>
                </li>
                <li className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-red-400 rounded-full mt-2 flex-shrink-0"></div>
                  <span className="leading-snug">Agent manually searches through systems</span>
                </li>
                <li className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-red-400 rounded-full mt-2 flex-shrink-0"></div>
                  <span className="leading-snug">Multiple back-and-forth emails needed</span>
                </li>
                <li className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-red-400 rounded-full mt-2 flex-shrink-0"></div>
                  <span className="leading-snug">Frustrated customers, stressed team</span>
                </li>
              </ul>
              <div className="text-red-300 font-semibold text-lg">
                Resolution Time: 1-4 days
              </div>
            </div>

            {/* After */}
            <div className="bg-green-500/10 rounded-2xl border border-green-500/20 p-8 lg:flex-1 stripe-fade-in-up stripe-stagger-5">
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Zap className="w-6 h-6 text-green-400" />
                </div>
                <h4 className="text-xl font-bold text-white">Delight Desk AI</h4>
              </div>
              <ul className="space-y-3 text-white/80 mb-6">
                <li className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-green-400 rounded-full mt-2 flex-shrink-0"></div>
                  <span className="leading-snug">Instant AI response in 2.1 seconds</span>
                </li>
                <li className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-green-400 rounded-full mt-2 flex-shrink-0"></div>
                  <span className="leading-snug">AI automatically finds order & tracking</span>
                </li>
                <li className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-green-400 rounded-full mt-2 flex-shrink-0"></div>
                  <span className="leading-snug">Complete answer in first response</span>
                </li>
                <li className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-green-400 rounded-full mt-2 flex-shrink-0"></div>
                  <span className="leading-snug">Delighted customers, relaxed team</span>
                </li>
              </ul>
              <div className="text-green-300 font-semibold text-lg">
                Resolution Time: 2.1 seconds
              </div>
            </div>

          </div>

        </div>
      </section>
      {/* Testimonials Section */}
      <section className="relative ds-section-padding-mobile bg-gradient-to-br from-green-900/30 via-slate-900 to-emerald-900/30">
        <div className="max-w-7xl mx-auto">
          
          <div className="text-center mb-16">
            <div className="inline-flex items-center space-x-2 bg-white/10 backdrop-blur-xl rounded-full px-4 py-2 mb-8 border border-white/20 glass-pulse">
              <Star className="w-4 h-4 text-green-400" />
              <span className="text-sm font-medium text-white/90">Customer Success</span>
            </div>
            <h2 className="ds-heading-lg font-bold mb-6 text-white stripe-fade-in-up stripe-stagger-2">
              Happy <span className="bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">Teams</span>
            </h2>
            <p className="text-base text-white/70 max-w-3xl mx-auto stripe-fade-in-up stripe-stagger-3">
              How small business teams use Delight Desk to compete with enterprise-level support
            </p>
          </div>

          {/* Testimonials Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            
            {/* Testimonial 1 */}
            <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 p-8 stripe-scale-in stripe-stagger-4">
              <div className="flex text-yellow-400 mb-4">★★★★★</div>
              <p className="text-white/80 mb-6 leading-relaxed">
                "I am certain our customer satisfaction has improved after implementing Delight Desk. Customers are blown away by instant responses."
              </p>
              <div className="flex items-center space-x-4">
                <img 
                  src="https://images.pexels.com/photos/762020/pexels-photo-762020.jpeg?auto=compress&cs=tinysrgb&w=200&h=200&fit=crop&crop=face"
                  alt="Marie Santana"
                  className="w-12 h-12 rounded-full object-cover"
                />
                <div>
                  <div className="font-semibold text-white">Marie Santana</div>
                  <div className="text-sm text-white/60">Customer Success Manager</div>
                  <div className="text-sm text-green-400">Wellness Box Co.</div>
                </div>
              </div>
            </div>

            {/* Testimonial 2 */}
            <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 p-8 stripe-scale-in stripe-stagger-5">
              <div className="flex text-yellow-400 mb-4">★★★★★</div>
              <p className="text-white/80 mb-6 leading-relaxed">
                "My team loves the dashboard—they can instantly look up any customer, process refunds, manage subscriptions, all without the dreaded WooCommerce login."
              </p>
              <div className="flex items-center space-x-4">
                <img 
                  src="https://images.pexels.com/photos/3777943/pexels-photo-3777943.jpeg?auto=compress&cs=tinysrgb&w=200&h=200&fit=crop&crop=face"
                  alt="Mike Torres"
                  className="w-12 h-12 rounded-full object-cover"
                />
                <div>
                  <div className="font-semibold text-white">Mike Torres</div>
                  <div className="text-sm text-white/60">Founder</div>
                  <div className="text-sm text-blue-400">Coffee Monthly</div>
                </div>
              </div>
            </div>

            {/* Testimonial 3 */}
            <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 p-8 stripe-scale-in stripe-stagger-6">
              <div className="flex text-yellow-400 mb-4">★★★★★</div>
              <p className="text-white/80 mb-6 leading-relaxed">
                "The promo code refund automation is a game-changer. Customers used to wait days for responses, now they get instant refunds and are so grateful."
              </p>
              <div className="flex items-center space-x-4">
                <img 
                  src="https://images.pexels.com/photos/1181519/pexels-photo-1181519.jpeg?auto=compress&cs=tinysrgb&w=200&h=200&fit=crop&crop=face"
                  alt="Jessica Park"
                  className="w-12 h-12 rounded-full object-cover"
                />
                <div>
                  <div className="font-semibold text-white">Jessica Park</div>
                  <div className="text-sm text-white/60">E-commerce Manager</div>
                  <div className="text-sm text-pink-400">BeautyBuzz</div>
                </div>
              </div>
            </div>

            {/* Testimonial 4 */}
            <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 p-8 stripe-scale-in stripe-stagger-7">
              <div className="flex text-yellow-400 mb-4">★★★★★</div>
              <p className="text-white/80 mb-6 leading-relaxed">
                "Our churn rate dropped 28% since launch. When customers can instantly pause subscriptions instead of waiting for support, they don't cancel out of frustration."
              </p>
              <div className="flex items-center space-x-4">
                <img 
                  src="https://images.pexels.com/photos/2182970/pexels-photo-2182970.jpeg?auto=compress&cs=tinysrgb&w=200&h=200&fit=crop&crop=face"
                  alt="David Blum"
                  className="w-12 h-12 rounded-full object-cover"
                />
                <div>
                  <div className="font-semibold text-white">David Blum</div>
                  <div className="text-sm text-white/60">Operations Director</div>
                  <div className="text-sm text-emerald-400">HealthyMeals Daily</div>
                </div>
              </div>
            </div>

            {/* Testimonial 5 */}
            <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 p-8 stripe-scale-in stripe-stagger-8">
              <div className="flex text-yellow-400 mb-4">★★★★★</div>
              <p className="text-white/80 mb-6 leading-relaxed">
                "I was skeptical about AI customer service, but this is different. We've gone from drowning in tickets to handling 3x more customers."
              </p>
              <div className="flex items-center space-x-4">
                <img 
                  src="https://images.pexels.com/photos/3786525/pexels-photo-3786525.jpeg?auto=compress&cs=tinysrgb&w=200&h=200&fit=crop&crop=face"
                  alt="Emma Rodriguez"
                  className="w-12 h-12 rounded-full object-cover"
                />
                <div>
                  <div className="font-semibold text-white">Emma Rodriguez</div>
                  <div className="text-sm text-white/60">CEO</div>
                  <div className="text-sm text-yellow-400">PetBox Plus</div>
                </div>
              </div>
            </div>

            {/* Testimonial 6 */}
            <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 p-8 stripe-scale-in stripe-stagger-9">
              <div className="flex text-yellow-400 mb-4">★★★★★</div>
              <p className="text-white/80 mb-6 leading-relaxed">
                "The subscription management automation saved us countless hours. No more waiting for human intervention, no more annoyance for us!"
              </p>
              <div className="flex items-center space-x-4">
                <img 
                  src="https://images.pexels.com/photos/3789888/pexels-photo-3789888.jpeg?auto=compress&cs=tinysrgb&w=200&h=200&fit=crop&crop=face"
                  alt="Ben Harmon"
                  className="w-12 h-12 rounded-full object-cover"
                />
                <div>
                  <div className="font-semibold text-white">Ben Harmon</div>
                  <div className="text-sm text-white/60">Operations Manager</div>
                  <div className="text-sm text-indigo-400">FreshBox Delivery</div>
                </div>
              </div>
            </div>

          </div>

          {/* CTA Section */}
          <div className="text-center mt-16">
            <div className="max-w-md mx-auto">
              <p className="text-white/70 mb-6">Experience the future of customer service automation in our Beta program</p>
              <Button 
                className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-medium px-8 py-3 rounded-lg w-full sm:w-auto stripe-scale-in"
                onClick={() => navigate('/signup')}
              >
                Start Free Trial
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>

        </div>
      </section>


      {/* Alternative Layout 1: Timeline/Journey Format */}
      <section className="relative ds-section-padding-mobile bg-gradient-to-br from-purple-900/20 via-slate-900 to-indigo-900/20">
        <div className="ds-container">
          <div className="max-w-5xl mx-auto">
            
            <div className="text-center mb-16">
              <div className="inline-flex items-center space-x-2 bg-white/10 backdrop-blur-xl rounded-full px-4 py-2 mb-8 border border-white/20">
                <User className="w-4 h-4 text-purple-400" />
                <span className="text-sm font-medium text-white/90">Founder Story</span>
              </div>
              <h2 className="ds-heading-lg font-bold mb-6 text-white">
                Created by E-commerce Teams,<br className="hidden lg:block" /> <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">for E-commerce Teams</span>
              </h2>
            </div>

            {/* Desktop Timeline */}
            <div className="relative hidden lg:block">
              {/* Vertical timeline line */}
              <div className="absolute left-1/2 transform -translate-x-px top-0 bottom-0 w-0.5 bg-gradient-to-b from-purple-500 from-25% via-blue-500 via-60% to-green-500 to-90%"></div>
              
              <div className="space-y-16">
                {/* Founder Introduction */}
                <div className="relative flex justify-center">
                  <div className="relative z-10">
                    <div className="absolute -inset-1 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl blur opacity-40"></div>
                    <div className="relative bg-white/5 backdrop-blur-xl rounded-2xl border border-white/20 p-3">
                      <img 
                        src={founderPhoto}
                        alt="Remy Tennant - Founder of Delight Desk"
                        className="w-48 h-72 object-cover object-center rounded-xl"
                      />
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-6 rounded-b-xl">
                        <h3 className="text-white font-bold text-xl text-center">Remy Tennant</h3>
                        <p className="text-white/80 text-base text-center mb-3">Founder</p>
                        <div className="flex justify-center space-x-3">
                          <a 
                            href="https://linkedin.com/in/remytennant" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="w-8 h-8 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center hover:bg-white/30 transition-colors"
                          >
                            <Linkedin className="w-4 h-4 text-white" />
                          </a>
                          <a 
                            href="https://instagram.com/remytennant" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="w-8 h-8 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center hover:bg-white/30 transition-colors"
                          >
                            <Instagram className="w-4 h-4 text-white" />
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Step 1 - The Problem (Left Side) */}
                <div className="relative flex items-center">
                  <div className="w-1/2 pr-8">
                    <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-purple-500/20 p-6 ml-auto max-w-md">
                      <h3 className="text-xl font-bold text-white mb-3 flex items-center">
                        <PieChart className="w-5 h-5 text-purple-400 mr-3" />
                        The Breaking Point
                      </h3>
                      <p className="text-white/70 leading-relaxed">
                        At Human Food Bar, customers expected Amazon-level service, but delivering competitive customer support was eating into our margins. Legacy solutions were outdated and couldn't meet modern expectations.
                      </p>
                    </div>
                  </div>
                  <div className="absolute left-1/2 transform -translate-x-1/2 z-20">
                    <div className="w-12 h-12 bg-purple-500/20 border-4 border-purple-500 rounded-full flex items-center justify-center bg-slate-900">
                      <div className="w-3 h-3 bg-purple-400 rounded-full"></div>
                    </div>
                  </div>
                  <div className="w-1/2 pl-8">
                    {/* Empty right side for alternating layout */}
                  </div>
                </div>

                {/* Step 2 - The Solution (Right Side) */}
                <div className="relative flex items-center">
                  <div className="w-1/2 pr-8">
                    {/* Empty left side for alternating layout */}
                  </div>
                  <div className="absolute left-1/2 transform -translate-x-1/2 z-20">
                    <div className="w-12 h-12 bg-blue-500/20 border-4 border-blue-500 rounded-full flex items-center justify-center bg-slate-900">
                      <div className="w-3 h-3 bg-blue-400 rounded-full"></div>
                    </div>
                  </div>
                  <div className="w-1/2 pl-8">
                    <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-blue-500/20 p-6 max-w-md">
                      <h3 className="text-xl font-bold text-white mb-3 flex items-center">
                        <Lightbulb className="w-5 h-5 text-blue-400 mr-3" />
                        The Breakthrough
                      </h3>
                      <p className="text-white/70 leading-relaxed">
                        With my software development background, I engineered a system that delivered exceptional customer experiences while dramatically reducing support costs. AI automation that integrated seamlessly with existing tools.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Step 3 - The Result (Left Side) */}
                <div className="relative flex items-center">
                  <div className="w-1/2 pr-8">
                    <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-green-500/20 p-6 ml-auto max-w-md">
                      <h3 className="text-xl font-bold text-white mb-3 flex items-center">
                        <Sparkles className="w-5 h-5 text-green-400 mr-3" />
                        The Transformation
                      </h3>
                      <p className="text-white/70 leading-relaxed">
                        Support costs dropped while customer satisfaction soared. Our team became more effective, handling complex issues while the AI agent managed routine inquiries. I knew other merchants needed this solution too.
                      </p>
                    </div>
                  </div>
                  <div className="absolute left-1/2 transform -translate-x-1/2 z-20">
                    <div className="w-12 h-12 bg-green-500/20 border-4 border-green-500 rounded-full flex items-center justify-center bg-slate-900">
                      <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                    </div>
                  </div>
                  <div className="w-1/2 pl-8">
                    {/* Empty right side for alternating layout */}
                  </div>
                </div>
              </div>
            </div>

            {/* Mobile Timeline - Left aligned line with right content */}
            <div className="relative lg:hidden">
              {/* Vertical timeline line - Far left */}
              <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gradient-to-b from-purple-500 from-30% via-blue-500 via-65% to-green-500 to-95%"></div>
              
              <div className="space-y-12">
                {/* Founder Introduction */}
                <div className="flex justify-center mb-16">
                  <div className="relative">
                    <div className="absolute -inset-1 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl blur opacity-40"></div>
                    <div className="relative bg-white/5 backdrop-blur-xl rounded-2xl border border-white/20 p-3">
                      <img 
                        src={founderPhoto}
                        alt="Remy Tennant - Founder of Delight Desk"
                        className="w-40 h-56 object-cover object-center rounded-xl"
                      />
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-4 rounded-b-xl">
                        <h3 className="text-white font-bold text-lg text-center">Remy Tennant</h3>
                        <p className="text-white/80 text-sm text-center mb-2">Founder</p>
                        <div className="flex justify-center space-x-2">
                          <a 
                            href="https://linkedin.com/in/remytennant" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="w-6 h-6 bg-white/20 backdrop-blur-sm rounded flex items-center justify-center hover:bg-white/30 transition-colors"
                          >
                            <Linkedin className="w-3 h-3 text-white" />
                          </a>
                          <a 
                            href="https://instagram.com/remytennant" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="w-6 h-6 bg-white/20 backdrop-blur-sm rounded flex items-center justify-center hover:bg-white/30 transition-colors"
                          >
                            <Instagram className="w-3 h-3 text-white" />
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Timeline Steps */}
                <div className="space-y-8">
                  {/* Step 1 - The Problem */}
                  <div className="relative flex items-start">
                    <div className="absolute left-6 transform -translate-x-1/2 z-20">
                      <div className="w-8 h-8 bg-slate-900 rounded-full border-2 border-purple-500/30 flex items-center justify-center">
                        <div className="w-4 h-4 bg-gradient-to-br from-purple-400 to-purple-600 rounded-full border border-purple-300/50"></div>
                      </div>
                    </div>
                    <div className="ml-16 flex-1">
                      <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-purple-500/20 p-5">
                        <h3 className="text-lg font-bold text-white mb-3 flex items-center">
                          <PieChart className="w-4 h-4 text-purple-400 mr-2" />
                          The Breaking Point
                        </h3>
                        <p className="text-white/70 leading-relaxed text-sm">
                          At Human Food Bar, customers expected Amazon-level service, but delivering competitive customer support was eating into our margins. Legacy solutions were outdated and couldn't meet modern expectations.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Step 2 - The Solution */}
                  <div className="relative flex items-start">
                    <div className="absolute left-6 transform -translate-x-1/2 z-20">
                      <div className="w-8 h-8 bg-slate-900 rounded-full border-2 border-blue-500/30 flex items-center justify-center">
                        <div className="w-4 h-4 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full border border-blue-300/50"></div>
                      </div>
                    </div>
                    <div className="ml-16 flex-1">
                      <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-blue-500/20 p-5">
                        <h3 className="text-lg font-bold text-white mb-3 flex items-center">
                          <Lightbulb className="w-4 h-4 text-blue-400 mr-2" />
                          The Breakthrough
                        </h3>
                        <p className="text-white/70 leading-relaxed text-sm">
                          With my software development background, I engineered a system that delivered exceptional customer experiences while dramatically reducing support costs. AI automation that integrated seamlessly with existing tools.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Step 3 - The Result */}
                  <div className="relative flex items-start">
                    <div className="absolute left-6 transform -translate-x-1/2 z-20">
                      <div className="w-8 h-8 bg-slate-900 rounded-full border-2 border-green-500/30 flex items-center justify-center">
                        <div className="w-4 h-4 bg-gradient-to-br from-green-400 to-green-600 rounded-full border border-green-300/50"></div>
                      </div>
                    </div>
                    <div className="ml-16 flex-1">
                      <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-green-500/20 p-5">
                        <h3 className="text-lg font-bold text-white mb-3 flex items-center">
                          <Sparkles className="w-4 h-4 text-green-400 mr-2" />
                          The Transformation
                        </h3>
                        <p className="text-white/70 leading-relaxed text-sm">
                          Support costs dropped while customer satisfaction soared. Our team became more effective, handling complex issues while the AI agent managed routine inquiries. I knew other merchants needed this solution too.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Alternative Layout 3: Single Column Prose */}
      <section className="relative ds-section-padding-mobile bg-gradient-to-br from-orange-900/20 via-slate-900 to-red-900/20">
        <div className="ds-container">
          <div className="max-w-3xl mx-auto">
            
            <div className="text-center mb-16">
              <div className="inline-flex items-center space-x-2 bg-white/10 backdrop-blur-xl rounded-full px-4 py-2 mb-8 border border-white/20">
                <User className="w-4 h-4 text-orange-400" />
                <span className="text-sm font-medium text-white/90">Founder Story</span>
              </div>
              <h2 className="ds-heading-lg font-bold mb-6 text-white">
                Created by E-commerce Teams,<br className="hidden lg:block" /> <span className="bg-gradient-to-r from-orange-400 to-red-400 bg-clip-text text-transparent">for E-commerce Teams</span>
              </h2>
            </div>

            {/* Split Layout: Photo + Article */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
              
              {/* Founder Photo - Left Sidebar */}
              <div className="lg:col-span-1">
                <div className="lg:sticky lg:top-8">
                  <div className="relative">
                    <div className="absolute -inset-1 bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl blur opacity-30"></div>
                    <div className="relative bg-white/5 backdrop-blur-xl rounded-2xl border border-white/20 p-2">
                      <img 
                        src={founderPhoto}
                        alt="Remy Tennant - Founder of Delight Desk"
                        className="w-full h-80 object-cover object-center rounded-xl"
                      />
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 rounded-b-xl">
                        <h3 className="text-white font-bold text-lg mb-1">Remy Tennant</h3>
                        <p className="text-white/80 text-sm mb-2">Founder of Delight Desk</p>
                        <div className="flex space-x-2">
                          <a 
                            href="https://linkedin.com/in/remytennant" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="w-6 h-6 bg-white/20 backdrop-blur-sm rounded flex items-center justify-center hover:bg-white/30 transition-colors"
                          >
                            <Linkedin className="w-3 h-3 text-white" />
                          </a>
                          <a 
                            href="https://instagram.com/remytennant" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="w-6 h-6 bg-white/20 backdrop-blur-sm rounded flex items-center justify-center hover:bg-white/30 transition-colors"
                          >
                            <Instagram className="w-3 h-3 text-white" />
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Article Content */}
              <div className="lg:col-span-2">
                <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-8">
                  <div className="prose prose-lg prose-invert max-w-none">
                    <p className="text-white/70 leading-relaxed mb-6">
                      Running Human Food Bar, I lived the daily reality every D2C founder knows too well. Customers expect Amazon-level service, but delivering that level of support was slowly eating into our margins. Legacy solutions felt ancient—clunky interfaces, expensive per-agent pricing, and zero intelligence.
                    </p>
                    
                    <p className="text-white/70 leading-relaxed mb-6">
                      With my software background, I saw an opportunity to build an AI agent that actually understood customer context and emotion. I engineered a system that integrated seamlessly with our existing tools—no expensive migrations, no team retraining.
                    </p>

                    <p className="text-white/70 leading-relaxed">
                      The results were immediate. Support costs dropped while customer satisfaction soared. When customers started praising our "new support team," I knew other merchants needed this transformation too. That's when building Delight Desk became an imperative.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="relative ds-section-padding-desktop bg-gradient-to-br from-blue-900/30 via-slate-900 to-purple-900/30">
        
        <div className="max-w-7xl mx-auto">
          
          <div className="text-center mb-20">
            <div className="inline-flex items-center space-x-2 bg-white/10 backdrop-blur-xl rounded-full px-4 py-2 mb-8 border border-white/20 glass-pulse">
              <DollarSign className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-medium text-white/90">Monthly Billing</span>
            </div>
            <h2 className="ds-heading-lg font-bold mb-6 bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent stripe-fade-in-up stripe-stagger-2 leading-tight">
              Simple, Usage-Based Pricing
            </h2>
            <p className="text-xl text-white/70 max-w-3xl mx-auto stripe-fade-in-up stripe-stagger-3">
              Every plan includes full platform access. Pay only when the AI agent resolves customer issues.
            </p>
          </div>

          {/* Pricing Cards */}
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {plansLoading ? (
              // Loading state
              Array.from({length: 3}).map((_, i) => (
                <div key={i} className="bg-white/10 backdrop-blur-xl rounded-3xl border border-white/20 p-8 text-center relative shadow-2xl stripe-scale-in">
                  <div className="animate-pulse">
                    <div className="h-6 bg-white/20 rounded mb-2"></div>
                    <div className="h-4 bg-white/10 rounded mb-8"></div>
                    <div className="h-12 bg-white/20 rounded mb-8"></div>
                    <div className="space-y-3">
                      <div className="h-4 bg-white/10 rounded"></div>
                      <div className="h-4 bg-white/10 rounded"></div>
                      <div className="h-4 bg-white/10 rounded"></div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              sortedPlans.map((plan, index) => {
                const isPopular = plan.name === 'growth';
                const isFirst = index === 0;
                const isLast = index === sortedPlans.length - 1;
                
                return (
                  <div 
                    key={plan.id} 
                    className={`bg-white/10 backdrop-blur-xl rounded-3xl p-8 text-center relative shadow-2xl stripe-scale-in ${
                      isPopular 
                        ? 'bg-white/15 border-2 border-purple-500/50 transform scale-105 stripe-stagger-5' 
                        : isFirst 
                        ? 'border border-white/20 stripe-stagger-4' 
                        : 'border border-white/20 stripe-stagger-6'
                    }`}
                  >
                    {isPopular && (
                      <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                        <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-6 py-2 rounded-full text-sm font-bold">
                          Most Popular
                        </div>
                      </div>
                    )}
                    
                    <div className={`mb-6 ${isPopular ? 'mt-4' : ''}`}>
                      <h3 className="text-2xl font-bold text-white mb-2">{plan.displayName}</h3>
                      <p className="text-white/60">
                        {plan.name === 'solopreneur' && 'Perfect for getting started'}
                        {plan.name === 'growth' && 'For growing businesses'}
                        {plan.name === 'scale' && 'For enterprise operations'}
                      </p>
                    </div>
                    
                    <div className="mb-8">
                      <div className="text-5xl font-bold text-white mb-2">${parseInt(plan.price)}</div>
                      <div className="text-white/60 mb-4">per month</div>
                      <div className="bg-white/10 rounded-lg p-4 border border-white/20">
                        <div className="text-sm text-white/60 mb-2">Pay only for AI automations:</div>
                        <div className="text-lg font-semibold text-green-400">
                          {formatCostPerResolution(plan.name)}
                        </div>
                        <div className="text-xs text-white/50 mt-1">
                          {formatIncludedAutomations(parseFloat(plan.price), plan.name)}
                        </div>
                      </div>
                    </div>
                    
                    <div className="mb-8">
                      <div className="text-center space-y-2">
                        {plan.features.map((feature, featureIndex) => (
                          <div key={featureIndex} className="text-sm font-medium text-white/80">
                            {feature}
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <Button 
                      className={`w-full ${
                        isPopular 
                          ? 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600'
                          : isFirst
                          ? 'bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600'
                          : 'bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600'
                      }`}
                      onClick={() => navigate('/signup')}
                    >
                      Start Free Trial
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                );
              })
            )}
          </div>



        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="relative ds-section-padding-mobile bg-gradient-to-br from-blue-900/30 via-slate-900 to-purple-900/30">
        <div className="max-w-4xl mx-auto">
          
          <div className="text-center mb-16">
            <h2 className="ds-heading-lg font-bold mb-6 text-white">
              Frequently Asked <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">Questions</span>
            </h2>
          </div>

          <div className="space-y-4">
            
            {/* FAQ Item 1 */}
            <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden">
              <button
                onClick={() => setOpenFAQ(openFAQ === 1 ? null : 1)}
                className="w-full px-6 py-5 text-left flex items-center justify-between hover:bg-white/5 transition-colors"
              >
                <h3 className="text-lg font-semibold text-white">What if I don't trust the AI agent?</h3>
                <ChevronDown className={`w-5 h-5 text-white/60 transition-transform ${openFAQ === 1 ? 'rotate-180' : ''}`} />
              </button>
              {openFAQ === 1 && (
                <div className="px-6 pb-5">
                  <p className="text-white/80 leading-relaxed">
                    That's why we have an approval queue. You have full control - you can manually approve every single automation before it processes, for as long as you want. Keep it on forever or turn it off when you're ready. You'll save time either way.
                  </p>
                </div>
              )}
            </div>

            {/* FAQ Item 2 */}
            <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden">
              <button
                onClick={() => setOpenFAQ(openFAQ === 2 ? null : 2)}
                className="w-full px-6 py-5 text-left flex items-center justify-between hover:bg-white/5 transition-colors"
              >
                <h3 className="text-lg font-semibold text-white">Do I continue to work in my existing inbox?</h3>
                <ChevronDown className={`w-5 h-5 text-white/60 transition-transform ${openFAQ === 2 ? 'rotate-180' : ''}`} />
              </button>
              {openFAQ === 2 && (
                <div className="px-6 pb-5">
                  <p className="text-white/80 leading-relaxed">
                    Yes, because that's where you're comfortable and efficient. We're not forcing you into a helpdesk platform. We're just giving you inbox superpowers.
                  </p>
                </div>
              )}
            </div>

            {/* FAQ Item 3 */}
            <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden">
              <button
                onClick={() => setOpenFAQ(openFAQ === 3 ? null : 3)}
                className="w-full px-6 py-5 text-left flex items-center justify-between hover:bg-white/5 transition-colors"
              >
                <h3 className="text-lg font-semibold text-white">What if customers realize they're talking to an AI agent?</h3>
                <ChevronDown className={`w-5 h-5 text-white/60 transition-transform ${openFAQ === 3 ? 'rotate-180' : ''}`} />
              </button>
              {openFAQ === 3 && (
                <div className="px-6 pb-5">
                  <p className="text-white/80 leading-relaxed">
                    We're completely transparent - every email clearly identifies it's from the AI agent. Customers actually prefer this because it resolves their issues instantly without waiting. Fast problem resolution matters more than who provides it.
                  </p>
                </div>
              )}
            </div>

            {/* FAQ Item 4 */}
            <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden">
              <button
                onClick={() => setOpenFAQ(openFAQ === 4 ? null : 4)}
                className="w-full px-6 py-5 text-left flex items-center justify-between hover:bg-white/5 transition-colors"
              >
                <h3 className="text-lg font-semibold text-white">Will this replace my customer service team?</h3>
                <ChevronDown className={`w-5 h-5 text-white/60 transition-transform ${openFAQ === 4 ? 'rotate-180' : ''}`} />
              </button>
              {openFAQ === 4 && (
                <div className="px-6 pb-5">
                  <p className="text-white/80 leading-relaxed">
                    No - it amplifies them. AI handles the routine 80% (order status, simple refunds) so your team can focus on complex issues, VIP customers, and relationship building.
                  </p>
                </div>
              )}
            </div>

            {/* FAQ Item 5 */}
            <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden">
              <button
                onClick={() => setOpenFAQ(openFAQ === 5 ? null : 5)}
                className="w-full px-6 py-5 text-left flex items-center justify-between hover:bg-white/5 transition-colors"
              >
                <h3 className="text-lg font-semibold text-white">What if the AI makes a mistake with a customer?</h3>
                <ChevronDown className={`w-5 h-5 text-white/60 transition-transform ${openFAQ === 5 ? 'rotate-180' : ''}`} />
              </button>
              {openFAQ === 5 && (
                <div className="px-6 pb-5">
                  <p className="text-white/80 leading-relaxed">
                    Our AI only handles transactional requests it's 98%+ confident about. Complex or unclear requests are automatically escalated to your team.
                  </p>
                </div>
              )}
            </div>

            {/* FAQ Item 6 */}
            <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden">
              <button
                onClick={() => setOpenFAQ(openFAQ === 6 ? null : 6)}
                className="w-full px-6 py-5 text-left flex items-center justify-between hover:bg-white/5 transition-colors"
              >
                <h3 className="text-lg font-semibold text-white">How do I know it won't hurt my brand?</h3>
                <ChevronDown className={`w-5 h-5 text-white/60 transition-transform ${openFAQ === 6 ? 'rotate-180' : ''}`} />
              </button>
              {openFAQ === 6 && (
                <div className="px-6 pb-5">
                  <p className="text-white/80 leading-relaxed">
                    Customers prefer fast resolution over waiting. The approval queue lets you review everything initially, and faster response times typically improve customer satisfaction.
                  </p>
                </div>
              )}
            </div>

            {/* FAQ Item 7 */}
            <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden">
              <button
                onClick={() => setOpenFAQ(openFAQ === 7 ? null : 7)}
                className="w-full px-6 py-5 text-left flex items-center justify-between hover:bg-white/5 transition-colors"
              >
                <h3 className="text-lg font-semibold text-white">What if my business is too unique or complex?</h3>
                <ChevronDown className={`w-5 h-5 text-white/60 transition-transform ${openFAQ === 7 ? 'rotate-180' : ''}`} />
              </button>
              {openFAQ === 7 && (
                <div className="px-6 pb-5">
                  <p className="text-white/80 leading-relaxed">
                    We integrate with WooCommerce, Shopify, and major email providers. The AI learns your specific products, policies, and common issues. Unique requests automatically go to your team.
                  </p>
                </div>
              )}
            </div>

            {/* FAQ Item 8 */}
            <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden">
              <button
                onClick={() => setOpenFAQ(openFAQ === 8 ? null : 8)}
                className="w-full px-6 py-5 text-left flex items-center justify-between hover:bg-white/5 transition-colors"
              >
                <h3 className="text-lg font-semibold text-white">Is this just another chatbot?</h3>
                <ChevronDown className={`w-5 h-5 text-white/60 transition-transform ${openFAQ === 8 ? 'rotate-180' : ''}`} />
              </button>
              {openFAQ === 8 && (
                <div className="px-6 pb-5">
                  <p className="text-white/80 leading-relaxed">
                    No - this processes actual email tickets in your existing workflow. No chatbot widget, no customer behavior change required. It works with Gmail, Outlook, and your current setup.
                  </p>
                </div>
              )}
            </div>

            {/* FAQ Item 9 */}
            <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden">
              <button
                onClick={() => setOpenFAQ(openFAQ === 9 ? null : 9)}
                className="w-full px-6 py-5 text-left flex items-center justify-between hover:bg-white/5 transition-colors"
              >
                <h3 className="text-lg font-semibold text-white">What about data security?</h3>
                <ChevronDown className={`w-5 h-5 text-white/60 transition-transform ${openFAQ === 9 ? 'rotate-180' : ''}`} />
              </button>
              {openFAQ === 9 && (
                <div className="px-6 pb-5">
                  <p className="text-white/80 leading-relaxed">
                    Enterprise-grade security with encrypted data transmission. We never store sensitive customer information permanently - only process it to generate responses.
                  </p>
                </div>
              )}
            </div>

            {/* FAQ Item 10 */}
            <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden">
              <button
                onClick={() => setOpenFAQ(openFAQ === 10 ? null : 10)}
                className="w-full px-6 py-5 text-left flex items-center justify-between hover:bg-white/5 transition-colors"
              >
                <h3 className="text-lg font-semibold text-white">Do the emails get sent out from my company or from Delight Desk?</h3>
                <ChevronDown className={`w-5 h-5 text-white/60 transition-transform ${openFAQ === 10 ? 'rotate-180' : ''}`} />
              </button>
              {openFAQ === 10 && (
                <div className="px-6 pb-5">
                  <p className="text-white/80 leading-relaxed">
                    They all go out from your company's email address, professionally formatted, and with language clarifying that it is AI and your company is using it in order to benefit its customers. Customers can reply back anytime and it will escalate to a human.
                  </p>
                </div>
              )}
            </div>

          </div>

        </div>
      </section>

      {/* Contact Form Section */}
      <section id="contact" className="relative ds-section-padding-mobile bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <div className="ds-container relative z-10">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-16">
              <div className="inline-flex items-center space-x-2 bg-white/10 backdrop-blur-xl rounded-full px-4 py-2 mb-8 border border-white/20 glass-pulse">
                <Mail className="w-4 h-4 text-purple-400" />
                <span className="text-sm font-medium text-white/90">Contact Us</span>
              </div>
              <h2 className="ds-heading-lg font-bold mb-6 bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent">
                Ready to Transform Your <span className="ds-gradient-primary-text">Customer Service?</span>
              </h2>
              <p className="ds-body-lg ds-text-muted max-w-2xl mx-auto">
                Get in touch to learn how Delight Desk can revolutionize your customer support workflow.
              </p>
            </div>

            {/* Contact Form - Centered */}
            <div className="max-w-2xl mx-auto">
              <div className="ds-surface-elevated rounded-2xl ds-card-padding">
                <form onSubmit={handleContactSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="name" className="block text-sm font-medium text-white/80 mb-2">
                        Name *
                      </label>
                      <Input
                        id="name"
                        type="text"
                        required
                        value={contactForm.name}
                        onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                        className="bg-white/5 border-white/20 text-white placeholder:text-white/40"
                        placeholder="Your full name"
                      />
                    </div>
                    <div>
                      <label htmlFor="email" className="block text-sm font-medium text-white/80 mb-2">
                        Email *
                      </label>
                      <Input
                        id="email"
                        type="email"
                        required
                        value={contactForm.email}
                        onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                        className="bg-white/5 border-white/20 text-white placeholder:text-white/40"
                        placeholder="your@email.com"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label htmlFor="company" className="block text-sm font-medium text-white/80 mb-2">
                      Company
                    </label>
                    <Input
                      id="company"
                      type="text"
                      value={contactForm.company}
                      onChange={(e) => setContactForm({ ...contactForm, company: e.target.value })}
                      className="bg-white/5 border-white/20 text-white placeholder:text-white/40"
                      placeholder="Your company name"
                    />
                  </div>

                  <div>
                    <label htmlFor="inquiry" className="block text-sm font-medium text-white/80 mb-2">
                      Inquiry *
                    </label>
                    <Textarea
                      id="inquiry"
                      required
                      rows={5}
                      value={contactForm.inquiry}
                      onChange={(e) => setContactForm({ ...contactForm, inquiry: e.target.value })}
                      className="bg-white/5 border-white/20 text-white placeholder:text-white/40 resize-none"
                      placeholder="Tell us about your customer service challenges and how we can help..."
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-medium py-3"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        Send Message
                      </>
                    )}
                  </Button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* Footer */}
      <footer className="relative border-t border-white/10 ds-section-padding-desktop">
        <div className="max-w-7xl mx-auto">
          
          <div className="text-center mb-12">
            <div className="flex items-center justify-center space-x-2 mb-6">
              <div className="w-8 h-8 bg-gradient-to-br from-purple-400 to-pink-400 rounded-lg flex items-center justify-center">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <span className="text-2xl font-bold text-white">Delight Desk</span>
            </div>
            <p className="text-white/60 max-w-2xl mx-auto">
              The most advanced customer service platform for modern e-commerce teams.
              Transform your support experience today.
            </p>
          </div>

          {/* Simplified Horizontal Menu */}
          <div className="flex flex-wrap justify-center items-center gap-8 mb-12 text-white/60">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
            <a href="#contact" className="hover:text-white transition-colors">About</a>
            <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-between pt-8 border-t border-white/10">
            <div className="text-white/60 mb-4 md:mb-0">
              © 2025 Delight Desk. All rights reserved.
            </div>
            <div className="flex items-center space-x-6">

            </div>
          </div>

        </div>
      </footer>
    </div>
  );
}