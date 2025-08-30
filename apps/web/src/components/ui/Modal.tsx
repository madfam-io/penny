import React, { ReactNode, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '../../utils/cn';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  closeOnOverlayClick?: boolean;
  showCloseButton?: boolean;
}

export function Modal({
  isOpen,
  onClose,
  children,
  title,
  size = 'md',
  className,
  closeOnOverlayClick = true,
  showCloseButton = true,
}: ModalProps) {
  // Handle escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  };

  const handleOverlayClick = (event: React.MouseEvent) => {
    if (event.target === event.currentTarget && closeOnOverlayClick) {
      onClose();
    }
  };

  const modal = (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div
       className="flex min-h-full items-center justify-center p-4 text-center sm:p-0"
        onClick={handleOverlayClick}
      >
<div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
        
        <div 
          className={cn(
            'relative transform rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:p-6',
            sizeClasses[size],
            className
          )}
        >
          {(title || showCloseButton) && (
<div className="flex items-center justify-between mb-4">
              {title && (
<h3 className="text-lg font-medium leading-6 text-gray-900">
                  {title}
                </h3>
              )}
              {showCloseButton && (
                <button
                  type="button"
                  className="rounded-md bg-white text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                  onClick={onClose}
                >
<span className="sr-only">Close</span>
                  <X className="h-6 w-6" />
                </button>
              )}
            </div>
          )}
          
          {children}
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}