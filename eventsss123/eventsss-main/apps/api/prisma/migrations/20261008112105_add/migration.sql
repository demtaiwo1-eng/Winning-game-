-- CreateEnum
CREATE TYPE "OrganizationMode" AS ENUM ('EVENT_PLANNING', 'SERVICE_PROVIDER');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'ORGANIZATION';

-- AlterTable
ALTER TABLE "EventReadiness" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "EventServiceCheck" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "organizationMode" "OrganizationMode";

-- AlterTable
ALTER TABLE "VerifierProfile" ALTER COLUMN "updatedAt" DROP DEFAULT;
