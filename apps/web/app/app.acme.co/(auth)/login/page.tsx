import React from "react";
import LoginForm from "@/ui/auth/login/login-form";

export const dynamic = "force-dynamic";

const LogIn = () => {
  return (
    <div className="max-w-sm mx-auto py-8">
      <LoginForm />
      <p className="font-medium text-[14px] text-center mt-4 text-muted-foreground">
        New User?{" "}
        <a href="/register" className="text-black">
          Sign Up
        </a>
      </p>
    </div>
  );
};

export default LogIn;
