import React from 'react';

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  children: React.ReactNode;
}

export const IconButton: React.FC<IconButtonProps> = ({ label, children, className = '', type = 'button', ...props }) => (
  <button
    type={type}
    aria-label={label}
    title={label}
    className={`inline-flex items-center justify-center focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100 ${className}`}
    {...props}
  >
    {children}
  </button>
);