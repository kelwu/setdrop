import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

async function main() {
  console.log('Testing Claude Managed Agents beta access...\n');

  try {
    // Step 1: Try creating an environment
    console.log('1. Creating environment...');
    const environment = await (client.beta as any).environments.create({
      name: 'setdrop-test-env',
      config: {
        type: 'cloud',
        networking: { type: 'unrestricted' },
      },
    });
    console.log(`   ✓ Environment created: ${environment.id}`);

    // Step 2: Try creating an agent
    console.log('2. Creating agent...');
    const agent = await (client.beta as any).agents.create({
      name: 'SetDrop Test Agent',
      model: 'claude-opus-4-7',
      system: 'You are a helpful DJ setlist assistant.',
      tools: [{ type: 'agent_toolset_20260401', default_config: { enabled: true } }],
    });
    console.log(`   ✓ Agent created: ${agent.id} (version: ${agent.version})`);

    // Step 3: Create a session
    console.log('3. Creating session...');
    const session = await (client.beta as any).sessions.create({
      agent: { type: 'agent', id: agent.id, version: agent.version },
      environment_id: environment.id,
    });
    console.log(`   ✓ Session created: ${session.id} (status: ${session.status})`);

    // Step 4: Send a message and stream the response
    console.log('4. Sending test message and streaming response...\n');
    console.log('--- Agent response ---');

    const [, events] = await Promise.all([
      (client.beta as any).sessions.events.send(session.id, {
        events: [{
          type: 'user.message',
          content: [{ type: 'text', text: 'Say "Managed Agents access confirmed!" and nothing else.' }],
        }],
      }),
      streamSession(session.id),
    ]);

    console.log('\n--- End response ---\n');
    console.log('✓ ALL CHECKS PASSED — your account has Managed Agents beta access!');

    // Cleanup
    await (client.beta as any).sessions.delete(session.id);
    console.log('\nCleaned up test session.');

  } catch (err: any) {
    console.log('\n✗ Error:');
    console.log(`  Status: ${err?.status}`);
    console.log(`  Message: ${err?.message}`);
    console.log(`  Full: ${JSON.stringify(err, null, 2)}`);
  }
}

async function streamSession(sessionId: string) {
  const stream = await (client.beta as any).sessions.events.stream(sessionId);
  for await (const event of stream) {
    if (event.type === 'agent.message') {
      for (const block of event.content) {
        if (block.type === 'text') process.stdout.write(block.text);
      }
    } else if (event.type === 'session.status_terminated') {
      break;
    } else if (event.type === 'session.status_idle') {
      break;
    }
  }
}

main();
