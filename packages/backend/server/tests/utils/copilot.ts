import { randomBytes } from 'node:crypto';

import { INestApplication } from '@nestjs/common';
import request from 'supertest';

import {
  DEFAULT_DIMENSIONS,
  OpenAIProvider,
} from '../../src/plugins/copilot/providers/openai';
import {
  CopilotCapability,
  CopilotImageToTextProvider,
  CopilotProviderType,
  CopilotTextToEmbeddingProvider,
  CopilotTextToImageProvider,
  CopilotTextToTextProvider,
  PromptMessage,
} from '../../src/plugins/copilot/types';
import { gql } from './common';

export class TestProvider
  extends OpenAIProvider
  implements
    CopilotTextToTextProvider,
    CopilotTextToEmbeddingProvider,
    CopilotTextToImageProvider,
    CopilotImageToTextProvider
{
  override readonly availableModels = ['test'];

  override get type(): CopilotProviderType {
    return CopilotProviderType.Test;
  }

  override getCapabilities(): CopilotCapability[] {
    return TestProvider.capabilities;
  }

  override isModelAvailable(model: string): boolean {
    return this.availableModels.includes(model);
  }

  // ====== text to text ======

  override async generateText(
    messages: PromptMessage[],
    model: string = 'test',
    _options: {
      temperature?: number;
      maxTokens?: number;
      signal?: AbortSignal;
      user?: string;
    } = {}
  ): Promise<string> {
    this.checkParams({ messages, model });
    return 'generate text to text';
  }

  override async *generateTextStream(
    messages: PromptMessage[],
    model: string = 'gpt-3.5-turbo',
    options: {
      temperature?: number;
      maxTokens?: number;
      signal?: AbortSignal;
      user?: string;
    } = {}
  ): AsyncIterable<string> {
    this.checkParams({ messages, model });

    const result = 'generate text to text stream';
    for await (const message of result) {
      yield message;
      if (options.signal?.aborted) {
        break;
      }
    }
  }

  // ====== text to embedding ======

  override async generateEmbedding(
    messages: string | string[],
    model: string,
    options: {
      dimensions: number;
      signal?: AbortSignal;
      user?: string;
    } = { dimensions: DEFAULT_DIMENSIONS }
  ): Promise<number[][]> {
    messages = Array.isArray(messages) ? messages : [messages];
    this.checkParams({ embeddings: messages, model });

    return [Array.from(randomBytes(options.dimensions)).map(v => v % 128)];
  }

  // ====== text to image ======
  override async generateImages(
    messages: PromptMessage[],
    _model: string = 'test',
    _options: {
      signal?: AbortSignal;
      user?: string;
    } = {}
  ): Promise<Array<string>> {
    const { content: prompt } = messages.pop() || {};
    if (!prompt) {
      throw new Error('Prompt is required');
    }

    return ['https://example.com/image.jpg'];
  }

  override async *generateImagesStream(
    messages: PromptMessage[],
    model: string = 'dall-e-3',
    options: {
      signal?: AbortSignal;
      user?: string;
    } = {}
  ): AsyncIterable<string> {
    const ret = await this.generateImages(messages, model, options);
    for (const url of ret) {
      yield url;
    }
  }
}

export async function createCopilotSession(
  app: INestApplication,
  userToken: string,
  workspaceId: string,
  docId: string,
  promptName: string
): Promise<string> {
  const res = await request(app.getHttpServer())
    .post(gql)
    .auth(userToken, { type: 'bearer' })
    .set({ 'x-request-id': 'test', 'x-operation-name': 'test' })
    .send({
      query: `
        mutation createCopilotSession($options: CreateChatSessionInput!) {
          createCopilotSession(options: $options)
        }
      `,
      variables: { options: { workspaceId, docId, promptName } },
    })
    .expect(200);

  return res.body.data.createCopilotSession;
}
