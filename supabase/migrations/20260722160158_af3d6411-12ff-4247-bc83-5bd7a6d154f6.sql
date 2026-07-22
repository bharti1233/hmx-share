
CREATE POLICY "Anyone can upload to transfers bucket"
  ON storage.objects FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'transfers');
