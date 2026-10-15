export function createRecordCodec() {
  return {
    decode(text) {
      try { return {ok: true, record: JSON.parse(text)}; }
      catch { return {ok: false, error: 'parse'}; }
    },
    encode(record) {
      try { return {ok: true, text: JSON.stringify(record)}; }
      catch { return {ok: false, error: 'serialization'}; }
    }
  };
}
