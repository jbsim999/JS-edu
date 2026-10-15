export async function runCallbackPipeline(read, transform, save) {
  const value = new Promise((resolve, reject) => {
    read((error, result) => {
      if (error !== null && error !== undefined) reject(error);
      else resolve(result);
    });
  });
  return value.then(transform).then(save);
}
