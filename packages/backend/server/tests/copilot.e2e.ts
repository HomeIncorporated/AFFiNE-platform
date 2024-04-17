/// <reference types="../src/global.d.ts" />

import { randomUUID } from 'node:crypto';

import { INestApplication } from '@nestjs/common';
import type { TestFn } from 'ava';
import ava from 'ava';

import { AppModule } from '../src/app.module';
import { AuthService } from '../src/core/auth';
import { ConfigModule } from '../src/fundamentals/config';
import { PromptService } from '../src/plugins/copilot/prompt';
import {
  CopilotProviderService,
  registerCopilotProvider,
} from '../src/plugins/copilot/providers';
import { ChatSessionService } from '../src/plugins/copilot/session';
import { createTestingApp, createWorkspace, signUp } from './utils';
import { createCopilotSession, TestProvider } from './utils/copilot';

const test = ava as TestFn<{
  auth: AuthService;
  app: INestApplication;
  prompt: PromptService;
  provider: CopilotProviderService;
  session: ChatSessionService;
}>;

test.beforeEach(async t => {
  const { app } = await createTestingApp({
    imports: [
      AppModule,
      ConfigModule.forRoot({
        plugins: {
          copilot: {
            openai: {
              apiKey: '1',
            },
          },
        },
      }),
    ],
  });

  const auth = app.get(AuthService);
  const prompt = app.get(PromptService);

  t.context.app = app;
  t.context.auth = auth;
  t.context.prompt = prompt;
});

let token: string;
const promptName = 'prompt';
test.beforeEach(async t => {
  const { app, prompt } = t.context;
  const user = await signUp(app, 'test', 'darksky@affine.pro', '123456');
  token = user.token.token;

  registerCopilotProvider(TestProvider);

  await prompt.set(promptName, 'test', [
    { role: 'system', content: 'hello {{word}}' },
  ]);
});

test.afterEach.always(async t => {
  await t.context.app.close();
});

// ==================== session ====================

test.only('should be able to create session', async t => {
  const { app } = t.context;

  const assertCreateSession = async (
    workspaceId: string,
    error = 'failed to create session',
    asserter = async (x: any) => {
      t.truthy(await x, error);
    }
  ) => {
    await asserter(
      createCopilotSession(app, token, workspaceId, randomUUID(), promptName)
    );
  };

  {
    const { id } = await createWorkspace(app, token);
    await assertCreateSession(
      id,
      'should be able to create session with cloud workspace that user can access'
    );
  }

  {
    await assertCreateSession(
      randomUUID(),
      'should be able to create session with local workspace'
    );
  }

  {
    const {
      token: { token },
    } = await signUp(app, 'test', 'test@affine.pro', '123456');
    const { id } = await createWorkspace(app, token);
    await assertCreateSession(id, '', async x => {
      await t.throwsAsync(
        x,
        { instanceOf: Error },
        'should not able to create session with cloud workspace that user cannot access'
      );
    });
  }
});

test.only('should be able to use test provider', async t => {
  const { app } = t.context;

  const { id } = await createWorkspace(app, token);
  t.truthy(
    await createCopilotSession(app, token, id, randomUUID(), promptName),
    'failed to create session'
  );
});
