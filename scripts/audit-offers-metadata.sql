-- Run against production to find offers with Google Play-prohibited metadata terms.
-- Policy: https://support.google.com/googleplay/android-developer/answer/9857753
-- Prohibited: Best, #1, Top, New, Discount, Sale, Free, Million Downloads, awards, testimonials.
-- Usage: psql -h <host> -U postgres -d postgres -f scripts/audit-offers-metadata.sql
SELECT id, title, description, badge_text, discount_label, discount_condition
FROM public.offers
WHERE
  title ~* '(best|#1|top\s|new\s|discount|sale|free\s|million|download|award|ranking|testimonial)'
  OR COALESCE(description, '') ~* '(best|#1|top\s|new\s|discount|sale|free\s|million|download|award|ranking|testimonial)'
  OR COALESCE(badge_text, '') ~* '(best|#1|top\s|new\s|discount|sale|free\s|million|download|award|ranking|testimonial)'
  OR COALESCE(discount_label, '') ~* '(best|#1|top\s|new\s|discount|sale|free\s|million|download|award|ranking|testimonial)'
  OR COALESCE(discount_condition, '') ~* '(best|#1|top\s|new\s|discount|sale|free\s|million|download|award|ranking|testimonial)';
