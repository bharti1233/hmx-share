
-- Transfers table for HMX Share
CREATE TABLE public.transfers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  transfer_code TEXT NOT NULL UNIQUE,
  file_name TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  file_type TEXT,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  download_count INTEGER NOT NULL DEFAULT 0,
  uploader_ip TEXT,
  status TEXT NOT NULL DEFAULT 'active'
);

CREATE INDEX transfers_code_idx ON public.transfers (transfer_code);
CREATE INDEX transfers_expires_idx ON public.transfers (expires_at);

GRANT SELECT, INSERT, UPDATE ON public.transfers TO anon, authenticated;
GRANT ALL ON public.transfers TO service_role;

ALTER TABLE public.transfers ENABLE ROW LEVEL SECURITY;

-- Anyone can create a transfer (anonymous file sharing)
CREATE POLICY "Anyone can create transfers"
  ON public.transfers FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Anyone can read active, non-expired transfers (they need the code to find them)
CREATE POLICY "Anyone can read active transfers"
  ON public.transfers FOR SELECT
  TO anon, authenticated
  USING (status = 'active' AND expires_at > now());

-- Allow incrementing download_count on active transfers
CREATE POLICY "Anyone can update active transfers"
  ON public.transfers FOR UPDATE
  TO anon, authenticated
  USING (status = 'active' AND expires_at > now())
  WITH CHECK (status = 'active');

-- Function to generate unique transfer code
CREATE OR REPLACE FUNCTION public.generate_transfer_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code TEXT;
  i INT;
  attempt INT := 0;
BEGIN
  LOOP
    code := 'HMX-';
    FOR i IN 1..6 LOOP
      code := code || substr(chars, 1 + floor(random() * length(chars))::int, 1);
    END LOOP;
    IF NOT EXISTS (SELECT 1 FROM public.transfers WHERE transfer_code = code) THEN
      RETURN code;
    END IF;
    attempt := attempt + 1;
    IF attempt > 20 THEN
      RAISE EXCEPTION 'Could not generate unique transfer code';
    END IF;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_transfer_code() TO anon, authenticated;

-- Function to mark expired transfers
CREATE OR REPLACE FUNCTION public.expire_transfers()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count INT;
BEGIN
  UPDATE public.transfers
    SET status = 'expired'
    WHERE status = 'active' AND expires_at <= now();
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;
