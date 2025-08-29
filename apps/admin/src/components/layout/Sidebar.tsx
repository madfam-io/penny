'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  LayoutDashboard,
  Users,
  Building2,
  MessageCircle,
  Wrench,
  CreditCard,
  BarChart3,
  Settings,
  Shield,
  Webhook,
  Activity,
  ChevronLeft,
  ChevronRight,
  Bell,
  HelpCircle,
  LogOut
} from 'lucide-react';
import { cn } from '@/utils/cn';

interface SidebarProps {
  collapsed: boolean;
  mobileOpen: boolean;
  onCollapse: (collapsed: boolean) => void;
  onMobileToggle: (open: boolean) => void;
}

const navigationItems = [
  {
    title: 'Overview',
    items: [
      {
        title: 'Dashboard',
        href: '/dashboard',
        icon: LayoutDashboard,
        badge: null
      },
      {
        title: 'Analytics',
        href: '/analytics',
        icon: BarChart3,
        badge: null
      },
      {
        title: 'Activity',
        href: '/activity',
        icon: Activity,
        badge: '12'
      }
    ]
  },
  {
    title: 'Management',
    items: [
      {
        title: 'Users',
        href: '/users',
        icon: Users,
        badge: null
      },
      {
        title: 'Tenants',
        href: '/tenants',
        icon: Building2,
        badge: null
      },
      {
        title: 'Conversations',
        href: '/conversations',
        icon: MessageCircle,
        badge: null
      },
      {
        title: 'Tools',
        href: '/tools',
        icon: Wrench,
        badge: null
      }
    ]
  },
  {
    title: 'Financial',
    items: [
      {
        title: 'Billing',
        href: '/billing',
        icon: CreditCard,
        badge: null
      }
    ]
  },
  {
    title: 'System',
    items: [
      {
        title: 'Audit Logs',
        href: '/audit',
        icon: Shield,
        badge: '3'
      },
      {
        title: 'Webhooks',
        href: '/webhooks',
        icon: Webhook,
        badge: null
      },
      {
        title: 'Settings',
        href: '/settings',
        icon: Settings,
        badge: null
      }
    ]
  }
];

const bottomItems = [
  {
    title: 'Help & Support',
    href: '/help',
    icon: HelpCircle
  },
  {
    title: 'Notifications',
    href: '/notifications',
    icon: Bell,
    badge: '5'
  }
];

export function Sidebar({ collapsed, mobileOpen, onCollapse, onMobileToggle }: SidebarProps) {
  const pathname = usePathname();

  const NavItem = ({ item, isNested = false }: { item: any; isNested?: boolean }) => {
    const Icon = item.icon;
    const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
    
    return (
      <Link
        href={item.href}
        onClick={() => onMobileToggle(false)}
        className={cn(
          'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
          isActive
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:text-foreground hover:bg-accent',
          isNested && 'ml-6',
          collapsed && 'justify-center px-2'
        )}
        title={collapsed ? item.title : undefined}
      >
        <Icon className={cn('h-5 w-5 flex-shrink-0', collapsed && 'h-6 w-6')} />
        {!collapsed && (
          <>
            <span className="flex-1">{item.title}</span>
            {item.badge && (
              <Badge variant="secondary" className="h-5 px-2 text-xs">
                {item.badge}
              </Badge>
            )}
          </>
        )}
      </Link>
    );
  };

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="p-6 border-b">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <LayoutDashboard className="h-5 w-5 text-primary-foreground" />
          </div>
          {!collapsed && (
            <div>
              <h1 className="text-xl font-bold">PENNY Admin</h1>
              <p className="text-xs text-muted-foreground">Management Console</p>
            </div>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 px-4 py-6">
        <div className="space-y-6">
          {navigationItems.map((section) => (
            <div key={section.title}>
              {!collapsed && (
                <h2 className="px-3 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {section.title}
                </h2>
              )}
              <div className="space-y-1">
                {section.items.map((item) => (
                  <NavItem key={item.href} item={item} />
                ))}
              </div>
              {!collapsed && <Separator className="my-4" />}
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Bottom Items */}
      <div className="border-t p-4">
        <div className="space-y-1">
          {bottomItems.map((item) => (
            <NavItem key={item.href} item={item} />
          ))}
        </div>
        
        {!collapsed && <Separator className="my-4" />}
        
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'w-full justify-start text-muted-foreground',
            collapsed && 'justify-center px-2'
          )}
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && <span className="ml-2">Sign out</span>}
        </Button>
      </div>

      {/* Collapse Button */}
      <div className="hidden lg:block border-t p-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onCollapse(!collapsed)}
          className={cn(
            'w-full justify-start',
            collapsed && 'justify-center px-2'
          )}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4" />
              <span className="ml-2">Collapse</span>
            </>
          )}
        </Button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className={cn(
        'hidden lg:flex flex-col bg-card border-r h-full transition-all duration-300',
        collapsed ? 'w-20' : 'w-64'
      )}>
        {sidebarContent}
      </aside>

      {/* Mobile Sidebar */}
      <aside className={cn(
        'fixed inset-y-0 left-0 z-50 w-64 bg-card border-r h-full transition-transform duration-300 lg:hidden',
        mobileOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        {sidebarContent}
      </aside>
    </>
  );
}