const { BskyAgent } = require('@atproto/api');

async function runTests() {
  try {
    // Initialize AT Protocol agent
    const agent = new BskyAgent({ service: process.env.BSKY_SERVICE_URL });

    // Test AT Protocol connectivity
    await agent.createSession({
      identifier: process.env.BSKY_TEST_IDENTIFIER,
      password: process.env.BSKY_TEST_PASSWORD,
    });

    console.log('✓ AT Protocol connection successful');

    // Test record creation
    const testRecord = {
      repo: agent.session.did,
      collection: 'app.bsky.feed.post',
      record: {
        text: 'Test post from TikTokToe migration service',
        createdAt: new Date().toISOString(),
      },
    };

    await agent.api.com.atproto.repo.createRecord(testRecord);
    console.log('✓ Record creation successful');

    // Test record retrieval
    const records = await agent.api.app.bsky.feed.getAuthorFeed({
      actor: agent.session.did,
      limit: 1,
    });
    
    if (records.data.feed.length > 0) {
      console.log('✓ Record retrieval successful');
    }

    // Clean up test data
    await agent.api.com.atproto.repo.deleteRecord({
      repo: agent.session.did,
      collection: 'app.bsky.feed.post',
      rkey: records.data.feed[0].post.uri.split('/').pop(),
    });

    console.log('✓ Record cleanup successful');
    console.log('\nAll AT Protocol tests passed! ✨');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

runTests();
