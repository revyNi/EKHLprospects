import { supabase } from './supabaseClient'

export async function loadAdminStatus() {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { isAdmin: false, userId: null as string | null }
  }

  const { data, error } = await supabase
    .from('admin_users')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) {
    return { isAdmin: false, userId: user.id }
  }

  return {
    isAdmin: Boolean(data),
    userId: user.id,
  }
}
