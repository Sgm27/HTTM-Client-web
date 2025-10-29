import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import TrangChu from "./pages/TrangChu";
import Auth from "./pages/Auth";
import StoryDetail from "./pages/StoryDetail";
import Upload from "./pages/Upload";
import Account from "./pages/Account";
import NotFound from "./pages/NotFound";
import Bookmarks from "./pages/Bookmarks";
import AdminLayout from "./components/admin/AdminLayout";
import AdminDashboard from "./pages/admin/Dashboard";
import UserManagement from "./pages/admin/UserManagement";
import ContentManagement from "./pages/admin/ContentManagement";
import Analytics from "./pages/admin/Analytics";
import Settings from "./pages/admin/Settings";
import StoryStats from "./pages/admin/StoryStats";
import StoryStatsDetail from "./pages/admin/StoryStatsDetail";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<TrangChu />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/story/:id" element={<StoryDetail />} />
          <Route path="/upload" element={<Upload />} />
          <Route path="/account" element={<Account />} />
          <Route path="/bookmarks" element={<Bookmarks />} />
          
          {/* Admin Routes */}
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="users" element={<UserManagement />} />
            <Route path="content" element={<ContentManagement />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="story-stats" element={<StoryStats />} />
            <Route path="story-stats/:id" element={<StoryStatsDetail />} />
            <Route path="settings" element={<Settings />} />
          </Route>
          
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
