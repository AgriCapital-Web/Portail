-- Lock OTP records to the backend service and index lookup/expiry paths.
CREATE INDEX IF NOT EXISTS idx_otp_codes_phone_created
  ON public.otp_codes (telephone, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_otp_codes_unverified_expiry
  ON public.otp_codes (expires_at)
  WHERE verified = false;
ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.otp_codes FROM anon, authenticated;
GRANT ALL ON TABLE public.otp_codes TO service_role;
