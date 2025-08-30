'use client';

import { useState } from 'react';\nimport { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,\n} from '@/components/ui/dropdown-menu';\nimport { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';\nimport { Badge } from '@/components/ui/badge';
import { 
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Bell,
  Search,
  Settings,
  User,
  LogOut,
  Moon,
  Sun,
  Monitor,
  HelpCircle
} from 'lucide-react';\nimport { Input } from '@/components/ui/input';

interface HeaderProps {
  onMobileMenuClick: () => void;
  onSidebarToggle: () => void;
  sidebarCollapsed: boolean;
}

export function Header({ onMobileMenuClick, onSidebarToggle, sidebarCollapsed }: HeaderProps) {
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');
  const [notifications] = useState([
    { id: 1, title: 'New user registered', time: '2 min ago', unread: true },
    { id: 2, title: 'System maintenance scheduled', time: '1 hour ago', unread: true },
    { id: 3, title: 'Monthly report ready', time: '3 hours ago', unread: false },
  ]);

  const unreadCount = notifications.filter(n => n.unread).length;

  const themeIcons = {
    light: Sun,
    dark: Moon,
    system: Monitor
  };

  const ThemeIcon = themeIcons[theme];

  return (
    <header className="h-16 border-b bg-card px-6 flex items-center justify-between">
      {/* Left Section */}\n      <div className="flex items-center gap-4">
        {/* Mobile Menu Button */}
        <Button\n          variant="ghost"\n          size="icon"
          onClick={onMobileMenuClick}\n          className="lg:hidden"
        >\n          <Menu className="h-5 w-5" />
        </Button>

        {/* Desktop Sidebar Toggle */}
        <Button\n          variant="ghost"\n          size="icon"
          onClick={onSidebarToggle}\n          className="hidden lg:flex"
        >
          {sidebarCollapsed ? (\n            <PanelLeftOpen className="h-5 w-5" />
          ) : (\n            <PanelLeftClose className="h-5 w-5" />
          )}
        </Button>

        {/* Search */}\n        <div className="relative hidden md:block">\n          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input\n            placeholder="Search users, tenants, logs..."\n            className="pl-10 w-64 lg:w-80"
          />
        </div>
      </div>

      {/* Right Section */}\n      <div className="flex items-center gap-2">
        {/* Mobile Search */}\n        <Button variant="ghost" size="icon" className="md:hidden">\n          <Search className="h-5 w-5" />
        </Button>

        {/* Theme Toggle */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>\n            <Button variant="ghost" size="icon">\n              <ThemeIcon className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>\n          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Theme</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setTheme('light')}>\n              <Sun className="mr-2 h-4 w-4" />
              Light
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme('dark')}>\n              <Moon className="mr-2 h-4 w-4" />
              Dark
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme('system')}>\n              <Monitor className="mr-2 h-4 w-4" />
              System
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>\n            <Button variant="ghost" size="icon" className="relative">\n              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (\n                <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs">
                  {unreadCount}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>\n          <DropdownMenuContent align="end" className="w-80">\n            <DropdownMenuLabel className="flex items-center justify-between">
              Notifications
              {unreadCount > 0 && (\n                <Badge variant="secondary" className="text-xs">
                  {unreadCount} new
                </Badge>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />\n            <div className="max-h-96 overflow-y-auto">
              {notifications.map((notification) => (
                <DropdownMenuItem
                  key={notification.id}\n                  className="flex flex-col items-start p-4 cursor-pointer"
                >\n                  <div className="flex items-start justify-between w-full">
                    <p className={`text-sm ${notification.unread ? 'font-medium' : 'font-normal'}`}>
                      {notification.title}
                    </p>
                    {notification.unread && (\n                      <div className="w-2 h-2 bg-blue-600 rounded-full mt-1" />
                    )}
                  </div>\n                  <p className="text-xs text-muted-foreground mt-1">
                    {notification.time}
                  </p>
                </DropdownMenuItem>
              ))}
            </div>
            <DropdownMenuSeparator />\n            <DropdownMenuItem className="justify-center text-center">
              View all notifications
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>\n            <Button variant="ghost" className="relative h-10 w-10 rounded-full">\n              <Avatar className="h-10 w-10">\n                <AvatarImage src="/placeholder-avatar.jpg" alt="Admin" />
                <AvatarFallback>AD</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>\n          <DropdownMenuContent className="w-56" align="end">\n            <DropdownMenuLabel className="font-normal">\n              <div className="flex flex-col space-y-1">\n                <p className="text-sm font-medium leading-none">Admin User</p>\n                <p className="text-xs leading-none text-muted-foreground">
                  admin@penny.app
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>\n              <User className="mr-2 h-4 w-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem>\n              <Settings className="mr-2 h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem>\n              <HelpCircle className="mr-2 h-4 w-4" />
              Help & Support
            </DropdownMenuItem>
            <DropdownMenuSeparator />\n            <DropdownMenuItem className="text-red-600">\n              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}