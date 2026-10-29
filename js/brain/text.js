// Простая обработка русского/английского текста без внешних библиотек.

// Только служебные частицы: вопросительные слова и местоимения (кто, ты, что...) важны для смысла.
const STOP = new Set([
  'и', 'в', 'во', 'не', 'на', 'с', 'со', 'а', 'то', 'но', 'да', 'к', 'у', 'же', 'бы',
  'по', 'от', 'о', 'из', 'ну', 'ли', 'или', 'ни', 'за', 'до', 'для', 'при', 'об',
])

export function normalize(s) {
  return String(s).toLowerCase().replace(/ё/g, 'е')
}

// «Грубый стеммер»: длинные слова обрезаем до 4 букв, чтобы «умеешь/умеет/умеют» совпадали.
export function stem(word) {
  return word.length > 4 ? word.slice(0, 4) : word
}

// Более строгая основа для цепочек слов: «небо» не должно совпадать с «небольшая».
export function stem5(word) {
  return word.length > 5 ? word.slice(0, 5) : word
}

export function words(s) {
  return (normalize(s).match(/[a-zа-я0-9]+/g) || []).filter(w => !STOP.has(w))
}

export function tokens(s) {
  const words = normalize(s).match(/[a-zа-я0-9]+/g) || []
  return words.filter(w => !STOP.has(w)).map(stem)
}
