import { Button } from "@/components/ui/button";
import { Menu, User, Shield, Zap, LogOut, HelpCircle } from "lucide-react";
import { useLocation } from "wouter";
import ImpersonationBanner from "@/components/impersonation-banner";
import { useAuth } from "@/hooks/use-auth";

interface TopBarProps {
  onMenuClick: () => void;
}

export default function TopBar({ onMenuClick }: TopBarProps) {
  const [, setLocation] = useLocation();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    setLocation('/');
  };
  
  // Admin emails that can see the admin panel
  const adminEmails = ['remy@delightdesk.io', 'brian@delightdesk.io', 'demo@delightdesk.io'];
  const isAdmin = user?.email && adminEmails.includes(user.email);

  return (
    <div className="sticky top-0 z-10 flex-shrink-0">
      <ImpersonationBanner />
      <div className="flex h-16 bg-white shadow-sm border-b border-gray-200">
        <Button
          variant="ghost"
          size="sm"
          className="px-4 border-r border-gray-200 text-gray-500 lg:hidden hover:bg-gray-100"
          onClick={onMenuClick}
        >
          <Menu className="h-5 w-5" />
          <span className="sr-only">Open sidebar</span>
        </Button>
        
        <div className="flex-1 px-4 flex justify-between items-center">
          {/* Logo for mobile */}
          <div className="flex items-center lg:hidden">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <div className="ml-3">
                <h1 className="text-lg font-semibold text-gray-900">Delight Desk</h1>
              </div>
            </div>
          </div>
          
          {/* Desktop: Empty center space, Mobile: Empty space */}
          <div className="flex-1"></div>
          
          {/* Right side navigation */}
          <div className="flex items-center gap-1">
            {/* Admin Button - Only visible to specific admin users */}
            {isAdmin && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex items-center gap-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 px-3"
                  onClick={() => setLocation('/admin')}
                >
                  <Shield className="h-4 w-4" />
                  <span className="hidden sm:inline">Admin</span>
                </Button>
                
                {/* Separator */}
                <div className="w-px h-6 bg-gray-300 mx-1"></div>
              </>
            )}
            
            {/* Get Help Button */}
            <Button
              variant="ghost"
              size="sm"
              className="flex items-center gap-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 px-3"
              onClick={() => setLocation('/support')}
            >
              <HelpCircle className="h-4 w-4" />
              <span className="hidden sm:inline">Get Help</span>
            </Button>

            {/* Account Settings Button */}
            <Button
              variant="ghost"
              size="sm"
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 px-3"
              onClick={() => setLocation('/account-settings')}
            >
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">Account</span>
            </Button>

            {/* Logout Button */}
            <Button
              variant="ghost"
              size="sm"
              className="flex items-center gap-2 text-gray-600 hover:text-red-600 hover:bg-red-50 px-3"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
