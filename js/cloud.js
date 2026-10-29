// ОБПАО — облачная база весов на Supabase. Если библиотека не загрузилась,
// всё остальное работает: облако просто остаётся недоступным.

import { CLOUD } from './config.js'

let client = null
export const cloud = { user: null }

export function cloudAvailable() { return !!client }

export function initCloud() {
  if (client) return true
  try {
    if (!globalThis.supabase) return false
    client = globalThis.supabase.createClient(CLOUD.url, CLOUD.key)
    return true
  } catch (e) {
    return false
  }
}

export async function restoreSession() {
  if (!client) return null
  const { data } = await client.auth.getSession()
  cloud.user = data?.session?.user || null
  return cloud.user
}

export async function login(email, password) {
  const { data, error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw error
  cloud.user = data.user
  return data.user
}

// Возвращает пользователя, либо null, если нужно подтвердить почту.
export async function register(email, password) {
  const { data, error } = await client.auth.signUp({ email, password })
  if (error) throw error
  cloud.user = data.session ? data.session.user : null
  return cloud.user
}

export async function logout() {
  if (client) await client.auth.signOut()
  cloud.user = null
}

export async function baseModelInfo() {
  const { data, error } = await client.from(CLOUD.table)
    .select('id, meta, created_at').order('created_at', { ascending: false }).limit(1)
  if (error) throw error
  return data && data[0] ? data[0] : null
}

export async function downloadBase() {
  const { data, error } = await client.from(CLOUD.table)
    .select('vocab, meta, weights_b64').order('created_at', { ascending: false }).limit(1)
  if (error) throw error
  if (!data || !data[0]) throw new Error('Базовая модель не найдена в ОБПАО')
  return data[0]
}

export async function uploadModel(pack) {
  const { error } = await client.from(CLOUD.table).insert({
    vocab: pack.vocab, meta: pack.meta, weights_b64: pack.weights_b64,
    created_at: new Date().toISOString(),
  })
  if (error) throw error
}
