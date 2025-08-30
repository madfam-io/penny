'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import {
  Button,
  Input,
  Label,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,\n} from '@penny/ui';
import { Loader2 } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();\n  const [email, setEmail] = useState('');\n  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);\n  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);\n    setError('');

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError('Invalid email or password');
      } else {\n        router.push('/dashboard');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">\n      <Card className="w-full max-w-md">\n        <CardHeader className="space-y-1">\n          <CardTitle className="text-2xl font-bold">Admin Login</CardTitle>
          <CardDescription>
            Enter your credentials to access the PENNY admin dashboard
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>\n          <CardContent className="space-y-4">\n            <div className="space-y-2">\n              <Label htmlFor="email">Email</Label>
              <Input\n                id="email"\n                type="email"\n                placeholder="admin@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>\n            <div className="space-y-2">\n              <Label htmlFor="password">Password</Label>
              <Input\n                id="password"\n                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>\n            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          </CardContent>
          <CardFooter>\n            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>\n                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
