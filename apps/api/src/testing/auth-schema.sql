-- Espelho do schema de autenticação do Neon Auth, usado só em testes (banco local descartável).
CREATE SCHEMA IF NOT EXISTS neon_auth;

CREATE TABLE neon_auth."user" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  "emailVerified" boolean NOT NULL,
  image text,
  "createdAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  role text,
  banned boolean,
  "banReason" text,
  "banExpires" timestamptz
);

CREATE TABLE neon_auth.account (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "accountId" text NOT NULL,
  "providerId" text NOT NULL,
  "userId" uuid NOT NULL REFERENCES neon_auth."user"(id) ON DELETE CASCADE,
  "accessToken" text,
  "refreshToken" text,
  "idToken" text,
  "accessTokenExpiresAt" timestamptz,
  "refreshTokenExpiresAt" timestamptz,
  scope text,
  password text,
  "createdAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamptz NOT NULL
);
CREATE INDEX "account_userId_idx" ON neon_auth.account ("userId");

CREATE TABLE neon_auth.session (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "expiresAt" timestamptz NOT NULL,
  token text NOT NULL UNIQUE,
  "createdAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamptz NOT NULL,
  "ipAddress" text,
  "userAgent" text,
  "userId" uuid NOT NULL REFERENCES neon_auth."user"(id) ON DELETE CASCADE,
  "impersonatedBy" text,
  "activeOrganizationId" text
);
CREATE INDEX "session_userId_idx" ON neon_auth.session ("userId");

CREATE TABLE neon_auth.verification (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier text NOT NULL,
  value text NOT NULL,
  "expiresAt" timestamptz NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX verification_identifier_idx ON neon_auth.verification (identifier);
