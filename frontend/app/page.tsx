"use client";

import { useEffect, useState } from "react";
import LoginForm from "../components/login-form";
import { getToken } from "../lib/auth";

export default function Home() {
  const [hasToken, setHasToken] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // 检查是否有 token
    const token = getToken();
    setHasToken(!!token);
    setChecking(false);

    // 如果有 token，且当前是根路径，则使用 replace 跳转到 dashboard
    if (token && window.location.pathname === "/") {
      window.location.replace("/dashboard");
    }
  }, []);

  // 正在检查 token 或已有 token（即将跳转）时，显示占位 loading
  if (checking || hasToken) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <LoginForm />
    </div>
  );
}

