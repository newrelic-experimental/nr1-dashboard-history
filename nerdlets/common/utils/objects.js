export const isEmpty = obj => {
  for (let i in obj) return false
  return true
}

export const arrayToCommaDelimited = arr => arr.map(a => `'${a}'`).join()
