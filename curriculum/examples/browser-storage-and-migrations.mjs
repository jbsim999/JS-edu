const prefix = context.storagePrefix + 'b05-example:';
const key = prefix + 'local';
const databaseName = prefix + 'database';
let database;
try {
  localStorage.setItem(key, JSON.stringify({schemaVersion: 2, text: '한글 초안'}));
  console.log(JSON.stringify({backend: 'local', text: JSON.parse(localStorage.getItem(key)).text}));
  database = await new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('drafts');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  database.onversionchange = () => database.close();
  await new Promise((resolve, reject) => {
    const transaction = database.transaction('drafts', 'readwrite');
    transaction.oncomplete = resolve;
    transaction.onabort = () => reject(transaction.error);
    transaction.onerror = () => reject(transaction.error);
    transaction.objectStore('drafts').put({text: 'IDB 초안'}, 'main');
  });
  const record = await new Promise((resolve, reject) => {
    const transaction = database.transaction('drafts', 'readonly');
    const request = transaction.objectStore('drafts').get('main');
    transaction.oncomplete = () => resolve(request.result);
    transaction.onabort = () => reject(transaction.error);
  });
  console.log(JSON.stringify({backend: 'indexeddb', text: record.text}));
} finally {
  database?.close();
  localStorage.removeItem(key);
  await new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(databaseName);
    request.onsuccess = resolve;
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Temporary database deletion blocked'));
  });
}
