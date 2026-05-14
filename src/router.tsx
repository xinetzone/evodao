import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";
import Admin from "./pages/Admin";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { AdminRoute } from "./components/auth/AdminRoute";

export const routers = [
  /* Public routes */
  {
    path: "/auth",
    name: "auth",
    element: <Auth />,
  },

  /* Protected routes — requires login */
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: "/",
        name: "home",
        element: <Index />,
      },
      /* Admin-only routes */
      {
        element: <AdminRoute />,
        children: [
          {
            path: "/admin",
            name: "admin",
            element: <Admin />,
          },
        ],
      },
    ],
  },

  /* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */
  {
    path: "*",
    name: "404",
    element: <NotFound />,
  },
];

declare global {
  interface Window {
    __routers__: typeof routers;
  }
}

window.__routers__ = routers;
