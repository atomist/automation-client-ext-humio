/*
 * Copyright © 2019 Atomist, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
    AutomationContextAware,
    AutomationEventListener,
    AutomationEventListenerSupport,
    CommandIncoming,
    CommandInvocation,
    Configuration,
    Destination,
    EventFired,
    EventIncoming,
    HandlerContext,
    HandlerResult,
    MessageOptions,
} from "@atomist/automation-client";
import * as nsp from "@atomist/automation-client/lib/internal/util/cls";
import * as stringify from "json-stringify-safe";
import * as _ from "lodash";
import * as os from "os";
import * as serializeError from "serialize-error";
import * as winston from "winston";
import * as TransportStream from "winston-transport";

// tslint:disable:max-classes-per-file

export interface HumioOptions {
    token: string;
    repository: string;
}

export class HumioAutomationEventListener extends AutomationEventListenerSupport
    implements AutomationEventListener {

    constructor(private readonly humio: any) {
        super();
    }

    public commandIncoming(payload: CommandIncoming): void {
        this.sendEvent("Incoming command", "request", payload, nsp.get());
    }

    public commandStarting(payload: CommandInvocation,
                           ctx: HandlerContext): void {
        this.sendOperation("CommandHandler", "operation", "command-handler",
            payload.name, "starting", (ctx as any as AutomationContextAware).context);
    }

    public commandSuccessful(payload: CommandInvocation,
                             ctx: HandlerContext,
                             result: HandlerResult): Promise<void> {
        this.sendOperation("CommandHandler", "operation", "command-handler",
            payload.name, "successful", (ctx as any as AutomationContextAware).context, result);
        return Promise.resolve();
    }

    public commandFailed(payload: CommandInvocation,
                         ctx: HandlerContext,
                         err: any): Promise<void> {
        this.sendOperation("CommandHandler", "operation", "command-handler",
            payload.name, "failed", (ctx as any as AutomationContextAware).context, err);
        return Promise.resolve();
    }

    public eventIncoming(payload: EventIncoming): void {
        this.sendEvent("Incoming event", "event", payload, nsp.get());
    }

    public eventStarting(payload: EventFired<any>,
                         ctx: HandlerContext): void {
        this.sendOperation("EventHandler", "operation", "event-handler",
            payload.extensions.operationName, "starting", (ctx as any as AutomationContextAware).context);
    }

    public eventSuccessful(payload: EventFired<any>,
                           ctx: HandlerContext,
                           result: HandlerResult[]): Promise<void> {
        this.sendOperation("EventHandler", "operation", "event-handler",
            payload.extensions.operationName, "successful", (ctx as any as AutomationContextAware).context, result);
        return Promise.resolve();
    }

    public eventFailed(payload: EventFired<any>,
                       ctx: HandlerContext,
                       err: any): Promise<void> {
        this.sendOperation("EventHandler", "operation", "event-handler",
            payload.extensions.operationName, "failed", (ctx as any as AutomationContextAware).context, err);
        return Promise.resolve();
    }

    public messageSent(message: any,
                       destinations: Destination | Destination[],
                       options: MessageOptions,
                       ctx: HandlerContext): Promise<void> {
        this.sendEvent(
            "Outgoing message",
            "message",
            {
                message,
                destinations,
                options,
            },
            (ctx as any as AutomationContextAware).context);
        return Promise.resolve();
    }

    private sendOperation(identifier: string,
                          eventType: string,
                          type: string,
                          name: string,
                          status: string,
                          ctx: nsp.AutomationContext,
                          err?: any): void {
        if (!ctx) {
            return;
        }
        const start = ctx.ts;
        const data: any = {
            "operation-type": type,
            "operation": name,
            "registration": ctx.name,
            "version": ctx.version,
            "workspace-id": ctx.workspaceId,
            "workspace-name": ctx.workspaceName,
            "event-type": eventType,
            "level": status === "failed" ? "error" : "info",
            status,
            "execution-time": Date.now() - start,
            "correlation-id": ctx.correlationId,
            "invocation-id": ctx.invocationId,
            "message": `${identifier} ${name} invocation ${status} for ${ctx.workspaceName} '${ctx.workspaceId}'`,
        };
        if (err) {
            if (status === "failed") {
                data.stacktrace = serializeError(err);
            } else if (status === "successful") {
                data.result = JSON.stringify(err);
            }
        }
        if (!!this.humio) {
            this.humio.sendJson(data);
        }
    }

    private sendEvent(identifier: string,
                      type: string,
                      payload: any,
                      ctx: nsp.AutomationContext): void {
        if (!ctx) {
            return;
        }
        const data = {
            "operation": ctx.operation,
            "registration": ctx.name,
            "version": ctx.version,
            "workspace-id": ctx.workspaceId,
            "workspace-name": ctx.workspaceName,
            "event-type": type,
            "level": "info",
            "correlation-id": ctx.correlationId,
            "invocation-id": ctx.invocationId,
            "message": `${identifier} of ${ctx.operation} for ${ctx.workspaceName} '${ctx.workspaceId}'`,
            "payload": JSON.stringify(payload),
        };
        if (!!this.humio) {
            this.humio.sendJson(data);
        }
    }
}

/**
 * Configure Humio logging if token exists in configuration.
 */
export async function configureHumio(configuration: Configuration): Promise<Configuration> {
    if (_.get(configuration, "humio.enabled") === true) {

        const token = _.get(configuration, "humio.token");
        if (!token) {
            throw new Error("Humio token is missing. Please set 'humio.token' in your configuration.");
        }

        try {
            require("humio");
        } catch (err) {
            throw new Error("Humio can't be loaded. Please install with 'npm install humio --save'.");
        }

        const options = {
            ingestToken: configuration.humio.token,
            host: "cloud.humio.com",
            port: 443,
            ssl: true,
            dataspaceId: configuration.humio.repository || "sandbox",
            additionalFields: {
                "service": configuration.name,
                "registration": configuration.name,
                "version": configuration.version,
                "environment": configuration.environment,
                "application-id": configuration.application,
                "process-id": process.pid,
                "host": os.hostname(),
            },
        };

        const Humio = require("humio");
        const humio = new Humio(options);

        configuration.listeners.push(new HumioAutomationEventListener(humio));

        _.update(configuration, "logging.custom.transports",
            old => !!old ? old : []);
        configuration.logging.custom.transports.push(new HumioTransport({ humio }));
    }
    return configuration;
}

class HumioTransport extends TransportStream {

    private readonly humio: any;

    constructor(opts: any) {
        super(opts);
        this.humio = opts.humio;
        this.format = winston.format.combine(
            winston.format.splat(),
            winston.format.printf(info => info.message),
        );
    }

    public log(info: any, next: any): void {

        let msg = info.message;
        const level = info.level;

        if (typeof msg !== "string" && typeof msg !== "object") {
            msg = { message: stringify(msg) };
        } else if (typeof msg === "string") {
            msg = { message: msg };
        }

        if (!!nsp && !!nsp.get()) {
            _.assign(msg, {
                level,
                "operation": nsp.get().operation,
                "registration": nsp.get().name,
                "version": nsp.get().version,
                "workspace-id": nsp.get().workspaceId,
                "workspace-name": nsp.get().workspaceName,
                "correlation-id": nsp.get().correlationId,
                "invocation-id": nsp.get().invocationId,
            });
        } else {
            _.assign(msg, {
                level,
            });
        }

        this.humio.sendJson(msg);

        next();
    }
}
