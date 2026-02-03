CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.analysis_scripts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "clientId"   text NOT NULL,
  "scriptKey"  text NOT NULL,
  "version"    int NOT NULL DEFAULT 1,
  "name"       text NOT NULL,
  "description" text NULL,
  "scriptText" text NOT NULL,
  "topics"     jsonb NOT NULL DEFAULT '[]',
  "isActive"   boolean NOT NULL DEFAULT true,
  "createdAt"  timestamptz NOT NULL DEFAULT now(),
  "updatedAt"  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_analysis_scripts UNIQUE ("clientId","scriptKey","version")
);

CREATE INDEX IF NOT EXISTS ix_analysis_scripts_client_key_active
  ON public.analysis_scripts ("clientId","scriptKey","isActive");

CREATE TABLE IF NOT EXISTS public.session_analyses (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "clientId"          text NOT NULL,
  "sessionId"         text NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  "scriptKey"         text NOT NULL,
  "scriptVersion"     int NOT NULL,
  "analysisVersionTag" text NOT NULL DEFAULT 'v1',
  "model"             text NULL,
  "promptHash"        text NULL,
  "status"            text NOT NULL DEFAULT 'pending',
  "startedAt"         timestamptz NULL,
  "processedAt"       timestamptz NULL,
  "retryCount"        int NOT NULL DEFAULT 0,
  "nextRetryAt"       timestamptz NULL,
  "error"             text NULL,
  "report"            jsonb NULL,
  "createdAt"         timestamptz NOT NULL DEFAULT now(),
  "updatedAt"         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_session_analysis UNIQUE ("sessionId","scriptKey","scriptVersion","analysisVersionTag")
);

CREATE INDEX IF NOT EXISTS ix_session_analyses_queue
  ON public.session_analyses ("clientId","status","nextRetryAt");

CREATE INDEX IF NOT EXISTS ix_session_analyses_session
  ON public.session_analyses ("sessionId","createdAt" DESC);

CREATE INDEX IF NOT EXISTS ix_messages_sessionId
  ON public.messages ("sessionId");

CREATE INDEX IF NOT EXISTS ix_messages_sessionId_updatedAtExternal
  ON public.messages ("sessionId","updatedAtExternal");
