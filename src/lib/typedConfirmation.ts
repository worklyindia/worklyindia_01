export function matchesConfirmation(value: string, phrase: string) {
  return value.trim().toLowerCase() === phrase.toLowerCase();
}
