-- AlterTable
ALTER TABLE "NewsletterPreferences" ADD COLUMN     "days" TEXT[] DEFAULT ARRAY['Monday']::TEXT[],
ADD COLUMN     "frequency" TEXT NOT NULL DEFAULT 'daily';
