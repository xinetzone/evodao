import { Navigate, Outlet } from "react-router-dom";
import { Loader } from "lucide-react";
import { useAuthContext } from "@/context/AuthContext";

export function ProtectedRoute() {
  const { user, isLoading } = useAuthContext();

  if (isLoading) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader className="w-5 h-5 text-primary animate-spin" />
          <span className="text-xs text-muted-foreground tracking-widest">LOADING...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <Outlet />;
}
