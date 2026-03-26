-- CreateEnum
CREATE TYPE "SupportedChannel" AS ENUM ('email', 'sms', 'push', 'webhook');

-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('queued', 'processing', 'sent', 'delivered', 'failed', 'expired', 'cancelled');

-- CreateEnum
CREATE TYPE "ExecutionStatus" AS ENUM ('pending', 'running', 'success', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "DeliveryBackoff" AS ENUM ('fixed', 'linear', 'exponential');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('low', 'normal', 'high');

-- CreateEnum
CREATE TYPE "MetricUnit" AS ENUM ('ms', 'count', 'percent', 'bytes');

-- CreateEnum
CREATE TYPE "MetricType" AS ENUM ('counter', 'gauge', 'timer', 'error');

-- CreateEnum
CREATE TYPE "MetricSource" AS ENUM ('worker', 'scenario', 'template', 'provider', 'system');

-- CreateEnum
CREATE TYPE "MetricSeverity" AS ENUM ('info', 'warning', 'error');

-- CreateEnum
CREATE TYPE "MetricCategory" AS ENUM ('performance', 'system', 'business', 'delivery', 'error');

-- CreateTable
CREATE TABLE "QueueConfig" (
    "id" SERIAL NOT NULL,
    "queueId" TEXT NOT NULL,
    "description" TEXT,
    "options" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QueueConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Worker" (
    "id" SERIAL NOT NULL,
    "workerId" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Worker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkerConfig" (
    "id" SERIAL NOT NULL,
    "workerConfigId" TEXT NOT NULL,
    "workerImplId" TEXT NOT NULL,
    "queueId" TEXT NOT NULL,
    "description" TEXT,
    "options" JSONB,
    "concurrency" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkerConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Provider" (
    "id" SERIAL NOT NULL,
    "providerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "options" JSONB,
    "supportedChannels" "SupportedChannel"[],
    "from" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Provider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Application" (
    "id" SERIAL NOT NULL,
    "appId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Scenario" (
    "id" SERIAL NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Scenario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationScenario" (
    "id" SERIAL NOT NULL,
    "applicationId" INTEGER NOT NULL,
    "scenarioId" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplicationScenario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Template" (
    "id" SERIAL NOT NULL,
    "templateId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "channels" "SupportedChannel"[],
    "dataTransformFiles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "description" TEXT,
    "validationSchema" JSONB,
    "defaultFrom" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScenarioTemplate" (
    "id" SERIAL NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "order" INTEGER,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ScenarioTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventLog" (
    "id" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "payload" JSONB,
    "correlationId" TEXT,
    "messageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Metric" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "unit" "MetricUnit",
    "type" "MetricType",
    "source" "MetricSource",
    "severity" "MetricSeverity",
    "category" "MetricCategory",
    "tags" JSONB,
    "templateId" TEXT,
    "providerId" TEXT,
    "workerId" TEXT,
    "scenarioId" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Metric_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "QueueConfig_queueId_key" ON "QueueConfig"("queueId");

-- CreateIndex
CREATE UNIQUE INDEX "Worker_workerId_key" ON "Worker"("workerId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkerConfig_workerConfigId_key" ON "WorkerConfig"("workerConfigId");

-- CreateIndex
CREATE UNIQUE INDEX "Provider_providerId_key" ON "Provider"("providerId");

-- CreateIndex
CREATE UNIQUE INDEX "Application_appId_key" ON "Application"("appId");

-- CreateIndex
CREATE UNIQUE INDEX "Scenario_scenarioId_key" ON "Scenario"("scenarioId");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationScenario_applicationId_scenarioId_key" ON "ApplicationScenario"("applicationId", "scenarioId");

-- CreateIndex
CREATE UNIQUE INDEX "Template_templateId_key" ON "Template"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "ScenarioTemplate_scenarioId_templateId_key" ON "ScenarioTemplate"("scenarioId", "templateId");

-- CreateIndex
CREATE INDEX "EventLog_eventName_createdAt_idx" ON "EventLog"("eventName", "createdAt");

-- CreateIndex
CREATE INDEX "EventLog_correlationId_idx" ON "EventLog"("correlationId");

-- CreateIndex
CREATE INDEX "EventLog_messageId_idx" ON "EventLog"("messageId");

-- CreateIndex
CREATE INDEX "Metric_name_recordedAt_idx" ON "Metric"("name", "recordedAt");

-- CreateIndex
CREATE INDEX "Metric_source_idx" ON "Metric"("source");

-- CreateIndex
CREATE INDEX "Metric_category_idx" ON "Metric"("category");

-- CreateIndex
CREATE INDEX "Metric_severity_idx" ON "Metric"("severity");

-- AddForeignKey
ALTER TABLE "WorkerConfig" ADD CONSTRAINT "WorkerConfig_workerImplId_fkey" FOREIGN KEY ("workerImplId") REFERENCES "Worker"("workerId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerConfig" ADD CONSTRAINT "WorkerConfig_queueId_fkey" FOREIGN KEY ("queueId") REFERENCES "QueueConfig"("queueId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationScenario" ADD CONSTRAINT "ApplicationScenario_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationScenario" ADD CONSTRAINT "ApplicationScenario_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "Scenario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Template" ADD CONSTRAINT "Template_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("providerId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScenarioTemplate" ADD CONSTRAINT "ScenarioTemplate_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "Scenario"("scenarioId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScenarioTemplate" ADD CONSTRAINT "ScenarioTemplate_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("templateId") ON DELETE CASCADE ON UPDATE CASCADE;
