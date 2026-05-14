import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

const Button: React.FC<ButtonProps> = ({ children, className = '', ...props }) => {
  return (
    <button
      className={`
        /* Base Button Styling */
        px-6 py-2 font-mono text-white uppercase tracking-widest
        transition-all duration-300 ease-in-out
        bg-[#0a0a0a] border border-transparent
        shadow-[0_0_10px_rgba(6,182,212,0.2)]
        
        /* Hover States */
        hover:enabled:bg-[#111111]
        hover:enabled:shadow-cyan-400/50
        hover:enabled:text-[#06ba84]
        
        /* Interactive States */
        active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed
        
        ${className}
      `}
      {...props}
    >
      {children}
    </button>
  );
};

export default Button;