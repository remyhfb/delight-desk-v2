import { useState } from 'react';
import Sidebar from './sidebar';
import TopBar from './topbar';
import { EmailConnectionWarning } from '../ui/email-connection-warning';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen flex bg-gray-50">
      <Sidebar isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />
      
      <div className="lg:pl-64 flex flex-col flex-1">
        <TopBar onMenuClick={() => setIsMobileMenuOpen(true)} />
        
        <main className="flex-1 relative overflow-y-auto focus:outline-none">
          <EmailConnectionWarning />
          {children}
        </main>
      </div>
    </div>
  );
}