export function mountSearchForm(form, onSearch, delay = 200) {
  const input = form.querySelector('input[name="query"]');
  form.addEventListener('submit', event => {
    event.preventDefault();
    onSearch(input.value);
  });
  input.addEventListener('input', () => setTimeout(() => onSearch(input.value), delay));
  return { dispose() {} };
}
