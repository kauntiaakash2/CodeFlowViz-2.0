import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

const PrimaryButton = ({ children, className, ...props }: ButtonProps) => {
  return (
    <button 
      className={`primary-button ${className || ''}`}
      {...props}
    >
      <span>{children}</span>
    </button>
  );
};

export default PrimaryButton;