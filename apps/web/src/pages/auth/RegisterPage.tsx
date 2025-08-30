import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';\nimport { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Mail, Lock, User, Building, UserPlus, CheckCircle, XCircle } from 'lucide-react';\nimport { useAuth } from '../../hooks/useAuth';\nimport { Button } from '@penny/ui';

const registerSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255, 'Name is too long'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128, 'Password is too long'),
  confirmPassword: z.string(),
  tenantName: z.string().min(1, 'Organization name is required').max(255, 'Organization name is too long'),
  acceptTerms: z.boolean().refine((val) => val === true, 'You must accept the terms and conditions'),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type RegisterFormData = z.infer<typeof registerSchema>;

interface PasswordRequirement {
  label: string;
  regex: RegExp;
}

const PASSWORD_REQUIREMENTS: PasswordRequirement[] = [
  { label: 'At least 8 characters', regex: /.{8,}/ },
  { label: 'One uppercase letter', regex: /[A-Z]/ },
  { label: 'One lowercase letter', regex: /[a-z]/ },
  { label: 'One number', regex: /\d/ },\n  { label: 'One special character', regex: /[!@#$%^&*()_+\-=\[\]{};':"\|,.<>?]/ },
];

export const RegisterPage: React.FC = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { register: registerUser, isLoading } = useAuth();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
    setError,
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      acceptTerms: false,
    },
  });

  const password = watch('password');

  const getPasswordStrength = (password: string): { score: number; feedback: string[] } => {
    if (!password) return { score: 0, feedback: [] };
    
    let score = 0;
    const feedback: string[] = [];
    
    PASSWORD_REQUIREMENTS.forEach((req) => {
      if (req.regex.test(password)) {
        score += 20;
      } else {
        feedback.push(req.label);
      }
    });
    
    return { score, feedback };
  };
\n  const passwordStrength = getPasswordStrength(password || '');

  const getStrengthColor = (score: number): string => {
    if (score < 40) return 'bg-red-500';
    if (score < 60) return 'bg-yellow-500';
    if (score < 80) return 'bg-orange-500';
    return 'bg-green-500';
  };

  const getStrengthLabel = (score: number): string => {
    if (score < 40) return 'Weak';
    if (score < 60) return 'Fair';
    if (score < 80) return 'Good';
    return 'Strong';
  };

  const onSubmit = async (data: RegisterFormData) => {
    try {
      await registerUser({
        name: data.name,
        email: data.email,
        password: data.password,
        tenantName: data.tenantName,
      });\n      navigate('/auth/verify-email', { 
        state: { email: data.email },
        replace: true 
      });
    } catch (error) {
      setError('root', {
        type: 'manual',
        message: error instanceof Error ? error.message : 'Registration failed',
      });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4 sm:px-6 lg:px-8 py-12">\n      <div className="max-w-md w-full space-y-8">\n        <div className="text-center">\n          <div className="mx-auto h-12 w-12 bg-indigo-600 rounded-lg flex items-center justify-center">\n            <UserPlus className="h-6 w-6 text-white" />
          </div>\n          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Create your account
          </h2>\n          <p className="mt-2 text-sm text-gray-600">
            Start your journey with PENNY today
          </p>
        </div>
\n        <div className="bg-white py-8 px-6 shadow-xl rounded-lg sm:px-8">\n          <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
            {errors.root && (\n              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm">
                {errors.root.message}
              </div>
            )}

            <div>\n              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                Full name
              </label>\n              <div className="mt-1 relative">\n                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">\n                  <User className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  {...register('name')}\n                  type="text"\n                  autoComplete="name"\n                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"\n                  placeholder="Enter your full name"
                />
              </div>
              {errors.name && (\n                <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
              )}
            </div>

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

            <div>\n              <label htmlFor="tenantName" className="block text-sm font-medium text-gray-700">
                Organization name
              </label>\n              <div className="mt-1 relative">\n                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">\n                  <Building className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  {...register('tenantName')}\n                  type="text"\n                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"\n                  placeholder="Enter your organization name"
                />
              </div>
              {errors.tenantName && (\n                <p className="mt-1 text-sm text-red-600">{errors.tenantName.message}</p>
              )}
            </div>

            <div>\n              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>\n              <div className="mt-1 relative">\n                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">\n                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}\n                  autoComplete="new-password"\n                  className="block w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"\n                  placeholder="Create a strong password"
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
              
              {password && (\n                <div className="mt-2">\n                  <div className="flex items-center justify-between text-xs">\n                    <span className="text-gray-600">Password strength:</span>
                    <span className={`font-medium ${
                      passwordStrength.score < 40 ? 'text-red-600' :
                      passwordStrength.score < 60 ? 'text-yellow-600' :
                      passwordStrength.score < 80 ? 'text-orange-600' :
                      'text-green-600'
                    }`}>
                      {getStrengthLabel(passwordStrength.score)}
                    </span>
                  </div>\n                  <div className="mt-1 bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-300 ${getStrengthColor(passwordStrength.score)}`}\n                      style={{ width: `${passwordStrength.score}%` }}
                    />
                  </div>
                  
                  {password.length > 0 && (\n                    <div className="mt-2 space-y-1">
                      {PASSWORD_REQUIREMENTS.map((req, index) => {
                        const isValid = req.regex.test(password);
                        return (\n                          <div key={index} className="flex items-center text-xs">
                            {isValid ? (\n                              <CheckCircle className="h-3 w-3 text-green-500 mr-2" />
                            ) : (\n                              <XCircle className="h-3 w-3 text-red-500 mr-2" />
                            )}
                            <span className={isValid ? 'text-green-600' : 'text-red-600'}>
                              {req.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
              
              {errors.password && (\n                <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
              )}
            </div>

            <div>\n              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                Confirm password
              </label>\n              <div className="mt-1 relative">\n                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">\n                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  {...register('confirmPassword')}
                  type={showConfirmPassword ? 'text' : 'password'}\n                  autoComplete="new-password"\n                  className="block w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"\n                  placeholder="Confirm your password"
                />\n                <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                  <button\n                    type="button"\n                    className="text-gray-400 hover:text-gray-600 focus:outline-none"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? (\n                      <EyeOff className="h-5 w-5" />
                    ) : (\n                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>
              {errors.confirmPassword && (\n                <p className="mt-1 text-sm text-red-600">{errors.confirmPassword.message}</p>
              )}
            </div>
\n            <div className="flex items-start">\n              <div className="flex items-center h-5">
                <input
                  {...register('acceptTerms')}\n                  type="checkbox"\n                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
              </div>\n              <div className="ml-3 text-sm">\n                <label htmlFor="acceptTerms" className="text-gray-700">\n                  I agree to the{' '}\n                  <Link to="/terms" className="font-medium text-indigo-600 hover:text-indigo-500">
                    Terms of Service\n                  </Link>{' '}\n                  and{' '}\n                  <Link to="/privacy" className="font-medium text-indigo-600 hover:text-indigo-500">
                    Privacy Policy
                  </Link>
                </label>
              </div>
            </div>
            {errors.acceptTerms && (\n              <p className="text-sm text-red-600">{errors.acceptTerms.message}</p>
            )}

            <div>
              <Button\n                type="submit"
                disabled={isLoading}\n                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Creating account...' : 'Create account'}
              </Button>
            </div>
          </form>
\n          <div className="mt-6 text-center">\n            <p className="text-sm text-gray-600">\n              Already have an account?{' '}
              <Link\n                to="/auth/login"\n                className="font-medium text-indigo-600 hover:text-indigo-500"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};