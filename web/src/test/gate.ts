/**
 * A promise the test resolves by hand. Lets a mocked request stay in flight
 * so the test can observe the optimistic UI before the server "answers".
 */
export function createGate() {
  let open!: () => void
  const promise = new Promise<void>((resolve) => {
    open = resolve
  })
  return { wait: () => promise, open }
}
