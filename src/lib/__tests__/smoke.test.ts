it('jest gira e crypto.getRandomValues è disponibile', () => {
  const a = new Uint8Array(8);
  crypto.getRandomValues(a);
  expect(a.some((x) => x !== 0)).toBe(true);
});

it('localStorage mock è disponibile', () => {
  localStorage.setItem('smoke', 'ok');
  expect(localStorage.getItem('smoke')).toBe('ok');
  localStorage.removeItem('smoke');
  expect(localStorage.getItem('smoke')).toBeNull();
});
