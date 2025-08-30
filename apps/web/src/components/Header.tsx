import { Bell, Search, User, Moon, Sun, Monitor } from 'lucide-react';\nimport { useTheme } from '@/contexts/ThemeContext';\nimport { useAuth } from '@/contexts/AuthContext';

export default function Header() {
  const { theme, setTheme } = useTheme();
  const { user } = useAuth();

  return (
    <header className="h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">\n      <div className="h-full px-4 flex items-center justify-between">
        {/* Search */}\n        <div className="flex-1 max-w-lg">\n          <div className="relative">\n            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input\n              type="text"\n              placeholder="Search conversations, artifacts..."\n              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Right side */}\n        <div className="flex items-center gap-2">
          {/* Theme switcher */}\n          <div className="relative">
            <button
              onClick={() => {
                const themes: Array<'light' | 'dark' | 'system'> = ['light', 'dark', 'system'];
                const currentIndex = themes.indexOf(theme);
                const nextIndex = (currentIndex + 1) % themes.length;
                setTheme(themes[nextIndex]);
              }}\n              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >\n              {theme === 'light' && <Sun className="h-5 w-5 text-gray-600 dark:text-gray-400" />}\n              {theme === 'dark' && <Moon className="h-5 w-5 text-gray-600 dark:text-gray-400" />}
              {theme === 'system' && (\n                <Monitor className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              )}
            </button>
          </div>

          {/* Notifications */}\n          <button className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors relative">\n            <Bell className="h-5 w-5 text-gray-600 dark:text-gray-400" />\n            <span className="absolute top-1 right-1 h-2 w-2 bg-red-500 rounded-full"></span>
          </button>

          {/* User menu */}\n          <button className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">\n            <div className="h-8 w-8 rounded-full bg-brand-500 flex items-center justify-center">
              {user ? (\n                <span className="text-sm font-medium text-white">
                  {user.name.charAt(0).toUpperCase()}
                </span>
              ) : (\n                <User className="h-5 w-5 text-white" />
              )}
            </div>
          </button>
        </div>
      </div>
    </header>
  );
}
