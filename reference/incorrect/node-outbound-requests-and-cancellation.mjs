export async function fetchRecord(url, options = {}) {
  const response = await fetch(url);
  return { record: await response.json(), attempts: 1 };
}
