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
    const backendUrl = (import.meta as any).env?.VITE_BACKEND_URL as string | undefined;
    const authKey = supabase.auth.storageKey ?? undefined;
    const authData = authKey ? localStorage.getItem(authKey) : null;
    console.log('Auth Token in localStorage:', authData ? 'Exists' : 'Not found');
    
    // Kiểm tra cookies
    const cookies = document.cookie;
    console.log('Cookies:', cookies);
    
    return {
      session,
      user,
      hasAuthToken: !!authData,
      backendUrl,
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
