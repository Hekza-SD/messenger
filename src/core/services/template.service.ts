import { SupportedChannel, Template } from '@prisma/client';
import path from 'path';
import { config } from '../../config';
import prisma from '../../prisma';
import { AbstractProvider } from '../../providers/abstract-provider';

import { DataTransform } from '../../transforms/transform.type';
import { bus } from '../bus';
import { EventNames } from '../bus/event-names';
import { ProviderExecutionContext } from '../entities/provider-execution-ctx';
import { TemplateExecutionContext } from '../entities/template-execution-ctx';
import { ProviderService } from './provider.service';
import { TemplateRenderer } from './template-renderer';

export class TemplateService {
    static async getAllTemplates(): Promise<Template[]> {
        return prisma.template.findMany();
    }

    static async getByTemplateId(templateId: string): Promise<Template | null> {
        return prisma.template.findUnique({ where: { templateId } });
    }

    static async execute(ctx: TemplateExecutionContext): Promise<void> {
        bus.emit(EventNames.TemplateBeforeExecute, {
            templateId: ctx.templateId,
            data: ctx.businessData,
        });

        const template: Template = await this.loadTemplate(ctx.templateId);
        const transformedData = await this.transformData(
            template,
            ctx.businessData,
        );
        const rendered = await this.renderTemplate(
            template,
            transformedData,
            ctx,
        );
        const provider = await this.loadProviderInstance(template.providerId);

        try {
            await this.sendWithProvider(
                provider,
                rendered,
                ctx,
                template.channels,
            );
        } catch (err: any) {
            bus.emit(EventNames.TemplateError, {
                templateId: ctx.templateId,
                error: err,
            });
            throw err;
        }

        bus.emit(EventNames.TemplateAfterExecute, {
            templateId: ctx.templateId,
            result: { providerId: template.providerId },
        });
    }

    private static async loadTemplate(templateId: string): Promise<Template> {
        const template = await this.getByTemplateId(templateId);

        if (!template) {
            throw new Error(`Template not found: ${templateId}`);
        }
        return template;
    }

    private static async transformData(
        template: Template,
        data: any,
    ): Promise<any> {
        bus.emit(EventNames.TemplateBeforeTransform, {
            templateId: template.templateId,
            data,
        });
        const startTime = Date.now();

        const transformed = await this.applyTemplateTransform(template, data);

        bus.emit(EventNames.TemplateAfterTransform, {
            templateId: template.templateId,
            transformedData: transformed,
            durationMs: Date.now() - startTime,
        });

        return transformed;
    }

    private static async renderTemplate(
        template: Template,
        data: any,
        ctx: TemplateExecutionContext,
    ): Promise<{ subject: string; body: string }> {
        bus.emit(EventNames.TemplateBeforeRender, {
            templateId: template.templateId,
            context: ctx,
        });
        const startTime = Date.now();

        const rendered = await TemplateRenderer.render(template.path, data);

        const subject = ctx.subject || rendered.subject || 'Empty subject';
        const body = ctx.bodyOverride || rendered.body || 'Empty body';

        bus.emit(EventNames.TemplateAfterRender, {
            templateId: template.templateId,
            rendered: { subject, body },
            context: ctx,
            durationMs: Date.now() - startTime,
        });

        return { subject, body };
    }

    private static async loadProviderInstance(providerId: string) {
        const provider = ProviderService.getInstanceByProviderId(providerId);
        if (!provider) {
            throw new Error(`Provider not found: ${providerId}`);
        }
        return provider;
    }

    private static async sendWithProvider(
        provider: AbstractProvider,
        rendered: { subject: string; body: string },
        ctx: TemplateExecutionContext,
        channels: SupportedChannel[],
    ) {
        const payload: ProviderExecutionContext = {
            applicationId: ctx.applicationId,
            to: ctx.to,
            cc: ctx.cc,
            bcc: ctx.bcc,
            body: rendered.body,
            from: provider.from,
            channels: channels,
            subject: rendered.subject,
            meta: ctx.meta,
            tracking: ctx.tracking,
        };
        const results = await provider.send(payload);

        if (results.every((r) => !r.success)) {
            throw new Error(
                `All channels failed for template ${ctx.templateId} with provider ${provider.id}`,
            );
        }

        return results;
    }

    static async applyTemplateTransform(template: Template, data: any) {
        if (!template.dataTransformFiles?.length) {
            return data;
        }

        for (const file of template.dataTransformFiles) {
            if (file.includes('..') || path.isAbsolute(file)) {
                throw new Error(
                    `Invalid transform path "${file}" for template ${template.templateId}: path traversal not allowed`,
                );
            }

            const modulePath = path.resolve(config.transformsDir, file);
            const mod = await import(modulePath);
            const transform: DataTransform = mod.default;

            if (typeof transform !== 'function') {
                throw new Error(
                    `Transform in ${file} (template: ${template.templateId}) must export a default function`,
                );
            }

            try {
                data = await transform(data);
            } catch (err) {
                throw new Error(
                    `Error applying transform ${file} for template ${template.templateId}: ${(err as Error).message}`,
                );
            }
        }

        return data;
    }
}
