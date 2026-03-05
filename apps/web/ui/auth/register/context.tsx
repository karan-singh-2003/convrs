"use client";

import React, {
  PropsWithChildren,
  useState,
  createContext,
  useContext,
} from "react";

interface RegisterContextType {
  email: string;
  password : string;

  step: "signup" | "verify";
  setStep: (step: "signup" | "verify") => void;
  setPassword: (password: string) => void;
  setEmail: (email: string) => void;
}

const RegisterContext = createContext<RegisterContextType | undefined>(
  undefined
);

export const RegisterProvider: React.FC<
  PropsWithChildren<{ email?: string }>
> = ({ children, email: initialEmail }) => {
  const [email, setEmail] = useState(initialEmail || "");
  const [password, setPassword] = useState("");
  const [lockEmail, setLockEmail] = useState(false);
  const [step, setStep] = useState<"signup" | "verify">("signup");

  return (
    <RegisterContext.Provider
      value={{ email, password,  step, setStep, setEmail, setPassword }}
    >
      {children}
    </RegisterContext.Provider>
  );
};

export const useRegisterContext = () => {
  const context = useContext(RegisterContext);
  if (context === undefined) {
    throw new Error("useRegister must be used within a RegisterProvider");
  }
  return context;
};

