import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { 
  LayoutDashboard, 
  Satellite, 
  Bot, 
  CheckCircle,
  AlertTriangle,
  Clock, 
  Settings,
  Mail,
  Brain,
  Zap,
  Package,
  Globe,
  ChevronUp,
  Tag,
  MapPin,
  BarChart3,
  Users,
  Truck
} from "lucide-react";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

// Primary navigation - frequently used features
const primaryNavigation = [
  { name: 'Dashboard', href: '/dashboard', icon: Satellite },
  { name: 'AI Assistant', href: '/ai-assistant', icon: Bot },
  { name: 'Quick Actions', href: '/quick-actions', icon: LayoutDashboard },
  { name: 'AI Agents', href: '#', icon: Users }, // Dropdown menu, no direct route
  { name: 'AI Team Center', href: '/ai-training', icon: Brain },
  { name: 'Approval Queue', href: '/approval-queue', icon: CheckCircle },
];

// AI Agents submenu navigation
const aiAgentsNavigation = [
  { name: 'WISMO Agent', href: '/wismo-agent', icon: Truck },
  { name: 'Subscription Agent', href: '/subscription-agent', icon: Bot },
  { name: 'Product Agent', href: '/product-agent', icon: Brain },
  { name: 'Returns Agent', href: '/returns-agent', icon: Package },
  { name: 'Promo Code Agent', href: '/promo-code-agent', icon: Tag },
  { name: 'Address Change Agent', href: '/address-change', icon: MapPin },
  { name: 'Cancellation Agent', href: '/order-cancellations', icon: Package },
];

// Settings navigation - setup/admin/maintenance features
const settingsNavigation = [
  { name: 'WISMO Widget', href: '/wismo-widget', icon: Globe },
  { name: 'AI Performance', href: '/ai-performance', icon: BarChart3 },
  { name: 'Activity Log', href: '/activity-log', icon: Clock },
  { name: 'Connections', href: '/connections', icon: Settings },
];

function SidebarContent() {
  const [location] = useLocation();
  const [aiAgentsOpen, setAiAgentsOpen] = useState(false);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white border-r border-gray-200">
      {/* Logo */}
      <div className="flex items-center h-16 flex-shrink-0 px-4 border-b border-gray-200">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
          </div>
          <div className="ml-3">
            <h1 className="text-lg font-semibold text-gray-900">Delight Desk</h1>
          </div>
        </div>
      </div>
      
      {/* Main Navigation */}
      <nav className="flex-1 px-4 py-4 space-y-1">
        {primaryNavigation.map((item) => {
          const isActive = location === item.href;
          const isAiAgentsActive = location === '/wismo-agent' ||
                                   location === '/subscription-agent' ||
                                   location === '/product-agent' ||
                                   location === '/promo-code-agent' ||
                                   location === '/address-change' ||
                                   location === '/order-cancellations';
          
          // Special handling for AI Agents with submenu
          if (item.name === 'AI Agents') {
            return (
              <div key={item.name}>
                <button
                  onClick={() => setAiAgentsOpen(!aiAgentsOpen)}
                  className={cn(
                    isAiAgentsActive 
                      ? "bg-primary/10 text-primary border-primary/20" 
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
                    "w-full group flex items-center justify-between px-2 py-2 text-sm font-medium rounded-md border border-transparent cursor-pointer"
                  )}
                >
                  <div className="flex items-center">
                    <item.icon className={cn(
                      "mr-3 h-4 w-4",
                      isAiAgentsActive ? "text-primary" : "text-gray-400"
                    )} />
                    {item.name}
                  </div>
                  <ChevronUp className={cn(
                    "h-4 w-4 transition-transform",
                    aiAgentsOpen ? "rotate-180" : "",
                    isAiAgentsActive ? "text-primary" : "text-gray-400"
                  )} />
                </button>
                
                {/* AI Agents Submenu */}
                {aiAgentsOpen && (
                  <div className="ml-6 mt-1 space-y-1">
                    {aiAgentsNavigation.map((subItem) => {
                      const isSubActive = location === subItem.href;
                      return (
                        <Link key={subItem.name} href={subItem.href}>
                          <span className={cn(
                            isSubActive 
                              ? "bg-primary/10 text-primary border-primary/20" 
                              : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
                            "group flex items-center px-2 py-2 text-sm rounded-md border border-transparent cursor-pointer"
                          )}>
                            <subItem.icon className={cn(
                              "mr-3 h-3 w-3",
                              isSubActive ? "text-primary" : "text-gray-400"
                            )} />
                            {subItem.name}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }
          
          // Regular menu items
          return (
            <Link key={item.name} href={item.href}>
              <span className={cn(
                isActive 
                  ? "bg-primary/10 text-primary border-primary/20" 
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
                "group flex items-center px-2 py-2 text-sm font-medium rounded-md border border-transparent cursor-pointer"
              )}>
                <item.icon className={cn(
                  "mr-3 h-4 w-4",
                  isActive ? "text-primary" : "text-gray-400"
                )} />
                {item.name}
              </span>
            </Link>
          );
        })}
      </nav>
      
      {/* Bottom Settings Menu */}
      <div className="px-4 pb-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className={cn(
              "w-full group flex items-center justify-between px-2 py-2 text-sm font-medium rounded-md cursor-pointer",
              "text-gray-600 hover:bg-gray-50 hover:text-gray-900 border border-transparent hover:border-gray-200"
            )}>
              <div className="flex items-center">
                <Settings className="mr-3 h-4 w-4 text-gray-400" />
                Settings & More
              </div>
              <ChevronUp className="h-4 w-4 text-gray-400" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-56 mb-2 z-[70]">
            {settingsNavigation.map((item) => (
              <DropdownMenuItem key={item.name} asChild>
                <Link href={item.href}>
                  <div className="flex items-center w-full cursor-pointer">
                    <item.icon className="mr-2 h-4 w-4" />
                    {item.name}
                  </div>
                </Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent side="left" className="p-0 w-64 z-[60]">
          <SidebarContent />
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 lg:z-50">
      <SidebarContent />
    </aside>
  );
}
