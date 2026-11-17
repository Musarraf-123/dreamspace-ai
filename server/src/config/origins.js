const DEFAULT_DEVELOPMENT_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5174',
  'capacitor://localhost',
  'https://localhost',
];

function splitOrigins(value) {
  return value.split(',').map((origin) => origin.trim()).filter(Boolean);
}

function validateProductionOrigin(origin) {
  try {
    const parsed = new URL(origin);
    return parsed.protocol === 'https:' && parsed.origin === origin;
  } catch {
    return false;
  }
}

function validateExactOrigin(origin) {
  if (origin === 'capacitor://localhost') return true;
  try {
    return new URL(origin).origin === origin;
  } catch {
    return false;
  }
}

function validateDevelopmentOrigin(origin) {
  try {
    const parsed = new URL(origin);
    return parsed.protocol === 'http:'
      && ['localhost', '127.0.0.1'].includes(parsed.hostname)
      && parsed.origin === origin;
  } catch {
    return false;
  }
}

export function resolveAllowedOrigins({ nodeEnv, clientOrigin, devClientOrigin } = {}) {
  const isProduction = nodeEnv === 'production';
  if (isProduction && !clientOrigin) {
    throw new Error('CLIENT_ORIGIN must be configured in production.');
  }

  const configuredOrigins = clientOrigin ? splitOrigins(clientOrigin) : [];
  if (isProduction && configuredOrigins.some((origin) => !validateProductionOrigin(origin))) {
    throw new Error('Every production CLIENT_ORIGIN must be a valid HTTPS origin.');
  }
  if (configuredOrigins.some((origin) => !validateExactOrigin(origin))) {
    throw new Error('Every CLIENT_ORIGIN must be an exact origin without a path or wildcard.');
  }

  // Development keeps the known local origins even if an older CLIENT_ORIGIN
  // value lists only port 5173. Production uses only its explicit allowlist.
  const origins = new Set(isProduction
    ? configuredOrigins
    : [...DEFAULT_DEVELOPMENT_ORIGINS, ...configuredOrigins]);

  // A custom Vite port must be opted into as one exact loopback origin. This
  // setting is deliberately ignored in production, where CLIENT_ORIGIN is the
  // only source of allowed origins.
  if (!isProduction && devClientOrigin) {
    if (!validateDevelopmentOrigin(devClientOrigin)) {
      throw new Error('DEV_CLIENT_ORIGIN must be an exact http://localhost or http://127.0.0.1 origin.');
    }
    origins.add(devClientOrigin);
  }

  return [...origins];
}
