import React from "react";

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

const Button: React.FC<ButtonProps> = ({
  children,
  className = "",
  type = "button",
  ...props
}) => {
  return (
    <button
      type={type}
      className={className}
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