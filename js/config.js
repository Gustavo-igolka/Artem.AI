// Общие константы Артёма. Ключи localStorage оставлены как в V6,
// чтобы ранее сохранённая LSTM-модель продолжала загружаться.

export const VERSION = 'V7 HYBRID CORE'

export const CLOUD = {
  url: 'https://ljljtvywrmkmamhzyqha.supabase.co',
  // anon-ключ публичный по дизайну Supabase; безопасность держится на RLS-политиках таблицы.
  key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxqbGp0dnl3cm1rbWFtaHp5cWhhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyNjkyMTEsImV4cCI6MjA4Nzg0NTIxMX0.9wdkamyHzC6yhRIdAcX7RVOaBbZcLxZSgZ4punY8b9o',
  table: 'v6_shared_model',
}

export const KEYS = {
  vocab: 'artem-v6-vocab',
  meta: 'artem-v6-meta',
  model: 'localstorage://artem-v6-model',
  learned: 'artem-v7-learned',
  settings: 'artem-v7-settings',
}

export const PATHS = {
  dialogue: 'data/dialogue.txt',
}

// Фиксированный алфавит новых моделей: любой текст, обученный позже, совместим с ним.
export const BASE_CHARS =
  '\n !"#%\'(),-./0123456789:;?{}' +
  'abcdefghijklmnopqrstuvwxyz' +
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ' +
  'абвгдеёжзийклмнопрстуфхцчшщъыьэюя' +
  'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ' +
  '—«»…'
