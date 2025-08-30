import React, { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { Modal } from '../ui/Modal';
import { Button } from '../../components/ui/button';

export interface SessionManagerProps {
  // How long before session expiry to show warning (in seconds)
  warningThreshold?: number;
  // How often to check session status (in seconds)
  checkInterval?: number;
}

/**
 * Component that manages user session lifecycle
 * Shows warnings before session expiry and handles automatic logout
 */
export function SessionManager({ 
  warningThreshold = 5 * 60, // 5 minutes
  checkInterval = 60, // 1 minute
}: SessionManagerProps) {
  const { isAuthenticated, logout, getAccessToken } = useAuth();
  const [showWarning, setShowWarning] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    const interval = setInterval(() => {
      const token = getAccessToken();
      if (!token) {
        return;
      }

      try {
        // Decode JWT to get expiration time
        const payload = JSON.parse(atob(token.split('.')[1]));
        const expirationTime = payload.exp * 1000; // Convert to milliseconds
        const currentTime = Date.now();
        const remaining = Math.max(0, expirationTime - currentTime);
        
        setTimeRemaining(Math.floor(remaining / 1000)); // Convert to seconds

        // Show warning if session is about to expire
        if (remaining <= warningThreshold * 1000 && remaining > 0) {
          setShowWarning(true);
        } else if (remaining <= 0) {
          // Session expired, logout user
          logout();
        } else {
          setShowWarning(false);
        }
      } catch (error) {
        console.error('Error parsing token:', error);
      }
    }, checkInterval * 1000);

    return () => clearInterval(interval);
  }, [isAuthenticated, warningThreshold, checkInterval, logout, getAccessToken]);

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const handleExtendSession = async () => {
    try {
      // Make a request to refresh the token
      // This could be done through the auth hook if you have a refresh method
      const response = await fetch('/api/v1/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken: localStorage.getItem('refreshToken') }),
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('accessToken', data.accessToken);
        localStorage.setItem('refreshToken', data.refreshToken);
        setShowWarning(false);
      } else {
        // Refresh failed, logout user
        logout();
      }
    } catch (error) {
      console.error('Error extending session:', error);
      logout();
    }
  };

  const handleLogout = () => {
    setShowWarning(false);
    logout();
  };

  if (!showWarning || !isAuthenticated) {
    return null;
  }

  return (
    <Modal
      isOpen={showWarning}
      onClose={() => {}} // Prevent closing by clicking overlay
      title="Session Expiring Soon"
      size="sm"
    >
      <div className="text-center">
        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100 mb-4">
          <svg
            className="h-6 w-6 text-yellow-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.664-.833-2.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
        </div>
       
       <h3 className="text-lg font-medium text-gray-900 mb-2">
          Your session will expire soon
        </h3>
       
        <p className="text-sm text-gray-500 mb-4">
          Your session will expire in{' '} 
         <span className="font-mono font-medium text-red-600">
            {formatTime(timeRemaining)}
          </span>
          . Would you like to extend your session?
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            onClick={handleExtendSession}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-medium"
          >
            Extend Session
          </Button>
          
          <Button
            onClick={handleLogout}
            variant="outline"
            className="border-gray-300 text-gray-700 hover:bg-gray-50 px-4 py-2 rounded-md text-sm font-medium"
          >
            Logout
          </Button>
        </div>

        <p className="text-xs text-gray-400 mt-3">
          You'll be automatically logged out when the session expires.
        </p>
      </div>
    </Modal>
  );
}