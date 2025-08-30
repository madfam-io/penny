'use client';

import { useSession, signOut } from 'next-auth/react';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Avatar,
  AvatarFallback,
  AvatarImage,\n} from '@penny/ui';
import { Bell, Moon, Sun, User, LogOut } from 'lucide-react';
import { useTheme } from 'next-themes';

export function Header() {
  const { data: session } = useSession();
  const { theme, setTheme } = useTheme();

  return (
    <header className="flex items-center justify-between h-16 px-6 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
      <div className="flex items-center">\n        <h2 className="text-lg font-semibold text-gray-800 dark:text-white">
          Welcome back, {session?.user?.name || 'Admin'}
        </h2>
      </div>
\n      <div className="flex items-center space-x-4">
        <Button\n          variant="ghost"\n          size="icon"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >\n          <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />\n          <span className="sr-only">Toggle theme</span>
        </Button>
\n        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />\n          <span className="absolute top-0 right-0 h-2 w-2 bg-red-500 rounded-full"></span>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>\n            <Button variant="ghost" className="relative h-8 w-8 rounded-full">
              <Avatar className="h-8 w-8">\n                <AvatarImage src={session?.user?.image || ''} alt={session?.user?.name || ''} />
                <AvatarFallback>\n                  <User className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>\n          <DropdownMenuContent className="w-56" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">\n              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{session?.user?.name}</p>\n                <p className="text-xs leading-none text-muted-foreground">{session?.user?.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />\n            <DropdownMenuItem onClick={() => signOut({ callbackUrl: '/login' })}>\n              <LogOut className="mr-2 h-4 w-4" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
