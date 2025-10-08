/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_APP_NAME: string;
  readonly VITE_APP_VERSION: string;
  readonly VITE_SOCKET_URL: string;
  readonly VITE_ENABLE_BARCODE_SCANNER: string;
  readonly VITE_ENABLE_OFFLINE_MODE: string;
  readonly VITE_ENABLE_REAL_TIME_UPDATES: string;
  readonly VITE_SCANNER_TIMEOUT: string;
  readonly VITE_SCANNER_FORMATS: string;
  readonly VITE_CACHE_DURATION: string;
  readonly VITE_DEBUG_MODE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}