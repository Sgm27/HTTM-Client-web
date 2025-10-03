import { supabase } from '@/integrations/supabase/client';

export const debugAuth = async () => {
  console.log('=== AUTH DEBUG ===');
  
  try {
    // Kiểm tra session hiện tại
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    console.log('Session:', session);
    console.log('Session Error:', sessionError);
    
    // Kiểm tra user hiện tại
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    console.log('User:', user);
    console.log('User Error:', userError);
    
    // Kiểm tra localStorage
    const url = (import.meta as any).env?.VITE_SUPABASE_URL as string | undefined;
    let projectRef = (import.meta as any).env?.VITE_SUPABASE_PROJECT_ID as string | undefined;
    if (!projectRef && url) {
      try {
        const host = new URL(url).host; // <ref>.supabase.co
        projectRef = host.split('.')[0];
      } catch {}
    }
    const authKey = projectRef ? `sb-${projectRef}-auth-token` : undefined;
    const authData = authKey ? localStorage.getItem(authKey) : null;
    console.log('Auth Token in localStorage:', authData ? 'Exists' : 'Not found');
    
    // Kiểm tra cookies
    const cookies = document.cookie;
    console.log('Cookies:', cookies);
    
    return {
      session,
      user,
      hasAuthToken: !!authData,
      projectRef,
      sessionError,
      userError
    };
  } catch (error) {
    console.error('Debug auth error:', error);
    return { error };
  }
};

export const refreshSession = async () => {
  try {
    const { data, error } = await supabase.auth.refreshSession();
    console.log('Refresh session result:', data, error);
    return { data, error };
  } catch (error) {
    console.error('Refresh session error:', error);
    return { error };
  }
};
