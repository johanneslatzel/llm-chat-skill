/***
 * Compile-time check that the real chat engine satisfies the prompt port.
 *
 * The package itself has no dependency on `@johannes.latzel/llm-chat`; this
 * test keeps `PromptTarget` aligned with `ChatService`.
 */
import { describe, expectTypeOf, it } from 'vitest';
import type { ChatService } from '@johannes.latzel/llm-chat';
import type { PromptTarget } from '../../src/lib/registry.js';

describe('PromptTarget', () => {
    it('is satisfied by ChatService', () => {
        expectTypeOf<ChatService>().toExtend<PromptTarget>();
    });
});
