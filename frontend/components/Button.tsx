import React from "react";

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

const Button: React.FC<ButtonProps> = ({
  children,
  disabled,
  className = "",
  ...props
}) => {
  return (
    <button
      disabled={disabled}
      className={`
        px-6 py-3
        bg-[#0a0a0a]
        border border-cyan-400
        text-cyan-300
        font-mono
        rounded-lg
        shadow-[0_0_10px_rgba(34,211,238,0.4)]
        transition-all duration-300
        hover:bg-cyan-400
        hover:text-black
        hover:shadow-[0_0_20px_rgba(34,211,238,0.9)]
        disabled:opacity-50
        disabled:cursor-not-allowed
        ${className}
      `}
      {...props}
    >
      {children}
    </button>
  );
};

export default Button;

/*
Usage Example:

<Button onClick={() => console.log("Clicked!")}>
  Launch
</Button>
*/