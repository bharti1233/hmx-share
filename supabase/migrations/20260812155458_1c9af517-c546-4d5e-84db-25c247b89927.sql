-- profiles
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- transfers: owner + file count
ALTER TABLE public.transfers ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.transfers ADD COLUMN IF NOT EXISTS file_count integer NOT NULL DEFAULT 1;
CREATE INDEX IF NOT EXISTS transfers_user_id_idx ON public.transfers(user_id);

CREATE POLICY "Owners can view their transfers" ON public.transfers FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Owners can update their transfers" ON public.transfers FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Owners can delete their transfers" ON public.transfers FOR DELETE TO authenticated USING (user_id = auth.uid());

-- download history
CREATE TABLE public.download_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  transfer_code text NOT NULL,
  file_name text NOT NULL,
  file_size bigint NOT NULL DEFAULT 0,
  file_count integer NOT NULL DEFAULT 1,
  downloaded_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.download_history TO authenticated;
GRANT ALL ON public.download_history TO service_role;
ALTER TABLE public.download_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own downloads" ON public.download_history FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own downloads" ON public.download_history FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own downloads" ON public.download_history FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS download_history_user_idx ON public.download_history(user_id, downloaded_at DESC);

-- storage: owners may delete their own transfer objects
CREATE POLICY "Owners can delete their transfer objects" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'transfers' AND EXISTS (
  SELECT 1 FROM public.transfers t WHERE t.user_id = auth.uid() AND t.storage_path = storage.objects.name
));