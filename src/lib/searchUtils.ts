export function getGoogleSearchUrl(word: string, customQuery?: string): string {
  if (!word) return 'https://www.google.com/search?q=';
  const queryFormat = customQuery && customQuery.trim() !== '' ? customQuery.trim() : 'meaning';
  
  let finalQuery = '';
  if (/\{word\}/i.test(queryFormat)) {
    finalQuery = queryFormat.replace(/\{word\}/gi, word);
  } else {
    finalQuery = `${word} ${queryFormat}`;
  }
  
  return `https://www.google.com/search?q=${encodeURIComponent(finalQuery)}`;
}
