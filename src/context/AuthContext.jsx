import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { setDynamicRoles, can } from '../lib/permissions'

const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [employee, setEmployee] = useState(null)
  const [plant, setPlant] = useState(null)
  const [loading, setLoading] = useState(true)
  const [noEmployeeRecord, setNoEmployeeRecord] = useState(false)

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchEmployee(session.user.id)
      else setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchEmployee(session.user.id)
      else {
        setEmployee(null)
        setPlant(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchEmployee(authUserId) {
    try {
      const { data } = await supabase
        .from('employees')
        .select('*, plants(*)')
        .eq('auth_user_id', authUserId)
        .single()

      if (data) {
        setEmployee(data)
        setPlant(data.plants)
        setNoEmployeeRecord(false)
        loadRoles(data.org_id ?? data.plants?.org_id)
      } else {
        setNoEmployeeRecord(true)
      }
    } catch (err) {
      console.error('Error fetching employee:', err)
      setNoEmployeeRecord(true)
    } finally {
      setLoading(false)
    }
  }

  // Fetch this org's roles and register them as the dynamic permission source.
  // Defensive: any failure leaves DYNAMIC_ROLES untouched so can() falls back
  // to the hardcoded PERMISSIONS matrix. Keyed by BOTH role.key and role.name
  // so employees.role storing either a built-in key or a custom role name resolves.
  async function loadRoles(orgId) {
    if (!orgId) return
    try {
      const { data, error } = await supabase
        .from('roles')
        .select('key,name,permissions')
        .eq('org_id', orgId)
      if (error) throw error
      if (Array.isArray(data)) {
        const map = {}
        for (const r of data) {
          const perms = Array.isArray(r.permissions) ? r.permissions : []
          if (r.key) map[r.key] = perms
          if (r.name) map[r.name] = perms
        }
        setDynamicRoles(map)
      }
    } catch (err) {
      // Do not crash — can() falls back to hardcoded PERMISSIONS.
      console.error('Error loading roles:', err)
    }
  }

  async function signIn(email, password) {
    const signInPromise = supabase.auth.signInWithPassword({ email, password })
      .then(({ data, error }) => {
        if (error) throw error
        return data
      })
    const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve('__timeout__'), 12000))
    const result = await Promise.race([signInPromise, timeoutPromise])
    if (result === '__timeout__') {
      // Slow network: the sign-in may still have succeeded in the background.
      // Check for a session once before showing an error, so the user isn't
      // told "timed out" while actually being logged in.
      const { data: { session } } = await supabase.auth.getSession()
      if (session) return { session, user: session.user }
      throw new Error('Connection timed out. Supabase may be blocked by your ISP in India. Try using a VPN.')
    }
    return result
  }

  async function switchPlant(newPlantId) {
    if (!employee || !can(employee.role, 'switch_plant')) return
    try {
      const { data: newPlant, error } = await supabase
        .from('plants')
        .select('*')
        .eq('id', newPlantId)
        .single()
      if (error) throw error
      if (newPlant) {
        setPlant(newPlant)
        loadRoles(newPlant.org_id)
      }
    } catch (err) {
      console.error('Error switching plant:', err)
      throw err
    }
  }

  async function refreshPlant() {
    if (!user) return
    try {
      const { data } = await supabase
        .from('employees')
        .select('*, plants(*)')
        .eq('auth_user_id', user.id)
        .single()
      if (data?.plants) setPlant(data.plants)
    } catch (err) {
      console.error('refreshPlant error:', err)
    }
  }

  async function signOut() {
    await supabase.auth.signOut()
    setUser(null)
    setEmployee(null)
    setPlant(null)
  }

  return (
    <AuthContext.Provider value={{ user, employee, plant, loading, noEmployeeRecord, signIn, signOut, switchPlant, refreshPlant }}>
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext)
