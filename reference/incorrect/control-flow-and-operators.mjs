export function resolveSettings(options, loadDefaults) {
  // 대표 오답: 유효한 falsy를 기본값으로 덮고 기본값 로더를 중복 호출한다.
  return {
    retries: options?.retries || loadDefaults().retries,
    enabled: options?.ui?.enabled || loadDefaults().enabled,
    label: options?.ui?.label || loadDefaults().label,
  };
}
