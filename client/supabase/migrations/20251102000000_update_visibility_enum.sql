-- Update visibility enum to only have PUBLIC and PRIVATE
-- First, update any existing UNLISTED values to PUBLIC
UPDATE public.uploads SET visibility = 'PUBLIC' WHERE visibility = 'UNLISTED';
UPDATE public.stories SET visibility = 'PUBLIC' WHERE visibility = 'UNLISTED';

-- Drop the old enum and create a new one with only PUBLIC and PRIVATE
ALTER TYPE public.visibility RENAME TO visibility_old;

CREATE TYPE public.visibility AS ENUM ('PUBLIC', 'PRIVATE');

-- Update columns to use the new enum type
ALTER TABLE public.uploads 
  ALTER COLUMN visibility TYPE visibility USING visibility::text::visibility;

ALTER TABLE public.stories 
  ALTER COLUMN visibility TYPE visibility USING visibility::text::visibility;

-- Drop the old enum type
DROP TYPE visibility_old;
