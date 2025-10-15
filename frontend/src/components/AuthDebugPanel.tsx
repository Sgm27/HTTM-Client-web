import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { debugAuth, refreshSession } from '@/utils/auth-debug';
import { useUserRole } from '@/hooks/useUserRole';
import { toast } from 'sonner';
import { RefreshCw, Bug, User, Shield } from 'lucide-react';

interface AuthDebugPanelProps {
  className?: string;
}

export const AuthDebugPanel = ({ className }: AuthDebugPanelProps) => {
  const { user, role, loading, isAdmin } = useUserRole();
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [isDebugging, setIsDebugging] = useState(false);

  const handleDebug = async () => {
    setIsDebugging(true);
    try {
      const result = await debugAuth();
      setDebugInfo(result);
      toast.success("Debug hoàn thành - kiểm tra thông tin bên dưới");
    } catch (error) {
      toast.error("Lỗi debug: " + error);
    } finally {
      setIsDebugging(false);
    }
  };

  const handleRefresh = async () => {
    try {
      const result = await refreshSession();
      if (result.error) {
        toast.error("Lỗi refresh: " + result.error.message);
      } else {
        toast.success("Đã refresh session thành công");
        // Refresh debug info
        await handleDebug();
      }
    } catch (error) {
      toast.error("Lỗi refresh: " + error);
    }
  };

  return (
    <Card className={`p-4 ${className}`}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold flex items-center">
            <Bug className="w-5 h-5 mr-2" />
            Auth Debug Panel
          </h3>
          <div className="space-x-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleDebug}
              disabled={isDebugging}
            >
              <Bug className="w-4 h-4 mr-2" />
              Debug
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRefresh}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Current Auth Status */}
        <div className="space-y-2">
          <h4 className="font-medium flex items-center">
            <User className="w-4 h-4 mr-2" />
            Trạng thái hiện tại
          </h4>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex justify-between">
              <span>Loading:</span>
              <Badge variant={loading ? "destructive" : "secondary"}>
                {loading ? "Đang tải" : "Hoàn thành"}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span>User:</span>
              <Badge variant={user ? "default" : "destructive"}>
                {user ? "Đã đăng nhập" : "Chưa đăng nhập"}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span>Role:</span>
              <Badge variant={role ? "default" : "secondary"}>
                {role || "Không có"}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span>Admin:</span>
              <Badge variant={isAdmin ? "default" : "secondary"}>
                {isAdmin ? "Có" : "Không"}
              </Badge>
            </div>
          </div>
        </div>

        {/* Debug Info */}
        {debugInfo && (
          <div className="space-y-2">
            <h4 className="font-medium flex items-center">
              <Shield className="w-4 h-4 mr-2" />
              Thông tin debug
            </h4>
            <div className="bg-muted p-3 rounded-md text-xs font-mono">
              <div><strong>Session:</strong> {debugInfo.session ? "Có" : "Không"}</div>
              <div><strong>User ID:</strong> {debugInfo.user?.id || "Không có"}</div>
              <div><strong>Email:</strong> {debugInfo.user?.email || "Không có"}</div>
              <div><strong>Auth Token:</strong> {debugInfo.hasAuthToken ? "Có" : "Không"}</div>
              {debugInfo.sessionError && (
                <div className="text-red-500"><strong>Session Error:</strong> {debugInfo.sessionError.message}</div>
              )}
              {debugInfo.userError && (
                <div className="text-red-500"><strong>User Error:</strong> {debugInfo.userError.message}</div>
              )}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};
