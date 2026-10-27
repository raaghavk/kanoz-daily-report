import { createContext, useContext, useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { setDynamicRoles, can } from '../lib/permissions'
import { isEmployeeActive } from '../lib/employeeAccess'

const AuthContext = createContext({})

export function activePlantStorageKey(userId) {
  return `kanoz:activePlantId:${userId}`
}

function readSavedPlantId(userId) {
  if (!userId) return null
  try {
    return localStorage.getItem(activePlantStorageKey(userId))
  } catch {
    return null
  }
}

function writeSavedPlantId(userId, plantId) {
  if (!userId || !plantId) return
  try {
    localStorage.setItem(activePlantStorageKey(userId), plantId)
  } catch { /* private mode / storage blocked */ }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [employee, setEmployee] = useState(null)
  const [plant, setPlant] = useState(null)
  const [loading, setLoading] = useState(true)
  const [noEmployeeRecord, setNoEmployeeRecord] = useState(false)
  const [accountInactive, setAccountInactive] = useState(false)
  const plantRef = useRef(null)
  const userIdRef = useRef(null)

  function applyPlant(next) {
    plantRef.current = next
    setPlant(next)
  }

  function clearSessionState() {
    setEmployee(null)
    applyPlant(null)
    setNoEmployeeRecord(false)
    setAccountInactive(false)
  }

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      userIdRef.current = session?.user?.id ?? null
      if (session?.user) fetchEmployee(session.user.id)
      else {
        setAccountInactive(false)
        setLoading(false)
      }
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      userIdRef.current = session?.user?.id ?? null
      if (session?.user) fetchEmployee(session.user.id)
      else {
        clearSessionState()
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function resolvePersistedPlant(employeeRow, authUserId) {
    const orgId = employeeRow.org_id ?? employeeRow.plants?.org_id
    const candidateId = plantRef.current?.id || readSavedPlantId(authUserId)
    if (!candidateId || !orgId) return employeeRow.plants || null
    if (candidateId === employeeRow.plants?.id && !plantRef.current?.id) {
      return employeeRow.plants
    }
    const { data: savedPlant, error } = await supabase
      .from('plants')
      .select('*')
      .eq('id', candidateId)
      .eq('org_id', orgId)
      .single()
    if (!error && savedPlant) return savedPlant
    return employeeRow.plants || null
  }

  async function fetchEmployee(authUserId) {
    try {
      const { data } = await supabase
        .from('employees')
        .select('*, plants(*)')
        .eq('auth_user_id', authUserId)
        .single()

      if (data && !isEmployeeActive(data)) {
        setEmployee(null)
        applyPlant(null)
        setNoEmployeeRecord(false)
        setAccountInactive(true)
      } else if (data) {
        setEmployee(data)
        setNoEmployeeRecord(false)
        setAccountInactive(false)
        await loadRoles(data.org_id ?? data.plants?.org_id)
        if (can(data.role, 'switch_plant')) {
          try {
            applyPlant(await resolvePersistedPlant(data, authUserId))
          } catch (plantErr) {
            console.error('Error restoring saved plant:', plantErr)
            applyPlant(data.plants)
          }
        } else {
          applyPlant(data.plants)
        }
      } else {
        setNoEmployeeRecord(true)
        setAccountInactive(false)
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
      if (session) {
        await rejectIfInactive(session.user.id)
        return { session, user: session.user }
      }
      throw new Error('Connection timed out. Supabase may be blocked by your ISP in India. Try using a VPN.')
    }
    const userId = result?.user?.id || result?.session?.user?.id
    if (userId) await rejectIfInactive(userId)
    return result
  }

  async function rejectIfInactive(authUserId) {
    const { data } = await supabase
      .from('employees')
      .select('is_active')
      .eq('auth_user_id', authUserId)
      .maybeSingle()
    if (data && !isEmployeeActive(data)) {
      await supabase.auth.signOut()
      setUser(null)
      userIdRef.current = null
      setEmployee(null)
      applyPlant(null)
      setAccountInactive(false)
      throw new Error('Your account has been deactivated. Contact an admin.')
    }
  }

  async function switchPlant(newPlantId) {
    if (!employee || !can(employee.role, 'switch_plant')) return
    try {
      const { data: newPlant, error } = await supabase
        .from('plants')
        .select('*')
        .eq('id', newPlantId)
        .eq('org_id', employee.org_id)
        .single()
      if (error) throw error
      if (newPlant) {
        applyPlant(newPlant)
        writeSavedPlantId(userIdRef.current, newPlant.id)
        loadRoles(newPlant.org_id)
      }
    } catch (err) {
      console.error('Error switching plant:', err)
      throw err
    }
  }

  async function refreshPlant() {
    const currentId = plantRef.current?.id || readSavedPlantId(userIdRef.current)
    if (currentId) {
      try {
        const { data, error } = await supabase
          .from('plants')
          .select('*')
          .eq('id', currentId)
          .single()
        if (!error && data) {
          applyPlant(data)
          return
        }
      } catch (err) {
        console.error('refreshPlant error:', err)
      }
    }
    const authUserId = userIdRef.current
    if (!authUserId) return
    try {
      const { data } = await supabase
        .from('employees')
        .select('*, plants(*)')
        .eq('auth_user_id', authUserId)
        .single()
      if (data?.plants) applyPlant(data.plants)
    } catch (err) {
      console.error('refreshPlant error:', err)
    }
  }

  async function signOut() {
    await supabase.auth.signOut()
    setUser(null)
    userIdRef.current = null
    clearSessionState()
  }

  return (
    <AuthContext.Provider value={{ user, employee, plant, loading, noEmployeeRecord, accountInactive, signIn, signOut, switchPlant, refreshPlant }}>
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext)
