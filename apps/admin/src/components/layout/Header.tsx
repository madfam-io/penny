'use client';

import { useState } from 'react';
import { Button } from '@penny/ui';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@penny/ui';
import { Avatar, AvatarFallback, AvatarImage } from '@penny/ui';
import { Badge } from '@penny/ui';
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
} from 'lucide-react';
import { Input } from '@penny/ui';

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
      {/* Left Section */}
      <div className="flex items-center gap-4">
        {/* Mobile Menu Button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onMobileMenuClick}
          className="lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </Button>

        {/* Desktop Sidebar Toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onSidebarToggle}
          className="hidden lg:flex"
        >
          {sidebarCollapsed ? (
            <PanelLeftOpen className="h-5 w-5" />
          ) : (
            <PanelLeftClose className="h-5 w-5" />
          )}
        </Button>

        {/* Search */}
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search users, tenants, logs..."
            className="pl-10 w-64 lg:w-80"
          />
        </div>
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-2">
        {/* Mobile Search */}
        <Button variant="ghost" size="icon" className="md:hidden">
          <Search className="h-5 w-5" />
        </Button>

        {/* Theme Toggle */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <ThemeIcon className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Theme</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setTheme('light')}>
              <Sun className="mr-2 h-4 w-4" />
              Light
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme('dark')}>
              <Moon className="mr-2 h-4 w-4" />
              Dark
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme('system')}>
              <Monitor className="mr-2 h-4 w-4" />
              System
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs">
                  {unreadCount}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel className="flex items-center justify-between">
              Notifications
              {unreadCount > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {unreadCount} new
                </Badge>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <div className="max-h-96 overflow-y-auto">
              {notifications.map((notification) => (
                <DropdownMenuItem
                  key={notification.id}
                  className="flex flex-col items-start p-4 cursor-pointer"
                >
                  <div className="flex items-start justify-between w-full">
                    <p className={`text-sm ${notification.unread ? 'font-medium' : 'font-normal'}`}>
                      {notification.title}
                    </p>
                    {notification.unread && (
                      <div className="w-2 h-2 bg-blue-600 rounded-full mt-1" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {notification.time}
                  </p>
                </DropdownMenuItem>
              ))}
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="justify-center text-center">
              View all notifications
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-10 w-10 rounded-full">
              <Avatar className="h-10 w-10">
                <AvatarImage src="/placeholder-avatar.jpg" alt="Admin" />
                <AvatarFallback>AD</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">Admin User</p>
                <p className="text-xs leading-none text-muted-foreground">
                  admin@penny.app
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <User className="mr-2 h-4 w-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem>
              <HelpCircle className="mr-2 h-4 w-4" />
              Help & Support
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-red-600">
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}