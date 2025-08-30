import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';\nimport { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Mail, Lock, LogIn, Github, Chrome } from 'lucide-react';\nimport { useAuth } from '../../hooks/useAuth';\nimport { Button } from '@penny/ui';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional(),
});

type LoginFormData = z.infer<typeof loginSchema>;

export const LoginPage: React.FC = () => {
  const [showPassword, setShowPassword] = useState(false);
  const { login, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  \n  const from = location.state?.from?.pathname || '/dashboard';

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      rememberMe: false,
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    try {
      await login(data);
      navigate(from, { replace: true });
    } catch (error) {
      setError('root', {
        type: 'manual',
        message: error instanceof Error ? error.message : 'Login failed',
      });
    }
  };

  const handleOAuthLogin = (provider: 'google' | 'github') => {
    // For now, show message that OAuth is not implemented in the web app
    // In production, you would implement OAuth flow or redirect to admin app
    alert(`OAuth login with ${provider} is handled by the admin portal. Please use email/password login or visit the admin portal.`);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4 sm:px-6 lg:px-8">\n      <div className="max-w-md w-full space-y-8">\n        <div className="text-center">\n          <div className="mx-auto h-12 w-12 bg-indigo-600 rounded-lg flex items-center justify-center">\n            <LogIn className="h-6 w-6 text-white" />
          </div>\n          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Sign in to PENNY
          </h2>\n          <p className="mt-2 text-sm text-gray-600">
            Welcome back! Please enter your details.
          </p>
        </div>
\n        <div className="bg-white py-8 px-6 shadow-xl rounded-lg sm:px-8">\n          <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
            {errors.root && (\n              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm">
                {errors.root.message}
              </div>
            )}

            <div>\n              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email address
              </label>\n              <div className="mt-1 relative">\n                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">\n                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  {...register('email')}\n                  type="email"\n                  autoComplete="email"\n                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"\n                  placeholder="Enter your email"
                />
              </div>
              {errors.email && (\n                <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
              )}
            </div>

            <div>\n              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>\n              <div className="mt-1 relative">\n                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">\n                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}\n                  autoComplete="current-password"\n                  className="block w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"\n                  placeholder="Enter your password"
                />\n                <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                  <button\n                    type="button"\n                    className="text-gray-400 hover:text-gray-600 focus:outline-none"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (\n                      <EyeOff className="h-5 w-5" />
                    ) : (\n                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>
              {errors.password && (\n                <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
              )}
            </div>
\n            <div className="flex items-center justify-between">\n              <div className="flex items-center">
                <input
                  {...register('rememberMe')}\n                  type="checkbox"\n                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />\n                <label htmlFor="rememberMe" className="ml-2 block text-sm text-gray-700">
                  Remember me
                </label>
              </div>

              <Link\n                to="/auth/forgot-password"\n                className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
              >
                Forgot your password?
              </Link>
            </div>

            <div>
              <Button\n                type="submit"
                disabled={isLoading}\n                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Signing in...' : 'Sign in'}
              </Button>
            </div>
\n            <div className="relative">\n              <div className="absolute inset-0 flex items-center">\n                <div className="w-full border-t border-gray-300" />
              </div>\n              <div className="relative flex justify-center text-sm">\n                <span className="px-2 bg-white text-gray-500">Or continue with</span>
              </div>
            </div>
\n            <div className="grid grid-cols-2 gap-3">
              <button\n                type="button"
                onClick={() => handleOAuthLogin('google')}\n                className="w-full inline-flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >\n                <Chrome className="h-5 w-5 text-red-500" />\n                <span className="ml-2">Google</span>
              </button>

              <button\n                type="button"
                onClick={() => handleOAuthLogin('github')}\n                className="w-full inline-flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >\n                <Github className="h-5 w-5 text-gray-900" />\n                <span className="ml-2">GitHub</span>
              </button>
            </div>
          </form>
\n          <div className="mt-6 text-center">\n            <p className="text-sm text-gray-600">
              Don't have an account?{' '}
              <Link\n                to="/auth/register"\n                className="font-medium text-indigo-600 hover:text-indigo-500"
              >
                Sign up for free
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};