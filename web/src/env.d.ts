/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "true" on the public demo: shows the "data resets" banner. */
  readonly VITE_DEMO_MODE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
