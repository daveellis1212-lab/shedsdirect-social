const express = require('express');
const app = express();
app.use(express.json());

const POSTIZ_API = 'https://api.postiz.com/public/v1';
const POSTIZ_API_KEY = process.env.POSTIZ_API_KEY;

const CHANNELS = {
  instagram: process.env.POSTIZ_INSTAGRAM,
  pinterest: process.env.POSTIZ_PINTEREST,
  gmb: process.env.POSTIZ_GMB,
  x: process.env.POSTIZ_X,
  facebook: process.env.POSTIZ_FACEBOOK
};

function getPlatformSettings(platform) {
  switch (platform) {
    case 'instagram':
      return { post_type: 'post' };
    case 'x':
      return { who_can_reply_post: 'everyone' };
    case 'pinterest':
      return { __type: 'pinterest', board: process.env.POSTIZ_PINTEREST_BOARD_ID || 'garden-sheds' };
    default:
      return {};
  }
}

function getScheduledDates() {
  const now = new Date();
  return {
    facebook:  new Date(now.getTime() + 1 * 60 * 60 * 1000).toISOString(),
    instagram: new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString(),
    x:         new Date(now.getTime() + 3 * 60 * 60 * 1000).toISOString(),
    pinterest: new Date(now.getTime() + 4 * 60 * 60 * 1000).toISOString(),
    gmb:       new Date(now.getTime() + 5 * 60 * 60 * 1000).toISOString()
  };
}

function buildContent(platform, title, url, excerpt) {
  switch (platform) {
    case 'facebook':
      return `🌳 ${title}\n\n${excerpt}\n\nRead more: ${url}`;
    case 'instagram':
      return `${title}\n\n${excerpt}\n\n#woodensheds #gardenshed #shedsdirect #gardenstorage #ukgarden #gardenbuilding #shedlife #gardendesign`;
    case 'x':
      const xText = `${title} ${url}`;
      return xText.length > 240 ? xText.substring(0, 237) + '...' : xText;
    case 'pinterest':
      return `${title}\n\n${excerpt}\n\nFind out more: ${url}`;
    case 'gmb':
      return `${title}\n\n${excerpt}\n\nFree UK delivery available. Read more: ${url}`;
    default:
      return `${title}\n\n${url}`;
  }
}

async function schedulePost(integrationId, content, scheduledDate, platform) {
  const postPayload = {
    type: 'schedule',
    date: scheduledDate,
    shortLink: false,
    tags: [],
    posts: [{
      integration: { id: integrationId },
      value: [{ content, image: [] }],
      settings: getPlatformSettings(platform),
      group: `group_${Date.now()}_${platform}`
    }]
  };

  'Authorization': `Bearer ${POSTIZ_API_KEY}`,
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${POSTIZ_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(postPayload)
  });

  return response.json();
}

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'ShedsDirect Social Webhook running' });
});

// Main webhook endpoint — called by Zapier on new RSS item
app.post('/publish', async (req, res) => {
  const { title, url, excerpt } = req.body;

  if (!title || !url) {
    return res.status(400).json({ error: 'title and url are required' });
  }

  console.log(`\nNew post received: ${title}`);
  console.log(`URL: ${url}`);

  const scheduledDates = getScheduledDates();
  const results = {};

  for (const [platform, integrationId] of Object.entries(CHANNELS)) {
    if (!integrationId) {
      console.log(`Skipping ${platform} — no integration ID`);
      continue;
    }

    try {
      const content = buildContent(platform, title, url, excerpt || '');
      const result = await schedulePost(integrationId, content, scheduledDates[platform], platform);

      if (result.id || (Array.isArray(result) && result.length > 0)) {
        console.log(`✅ ${platform} scheduled for ${scheduledDates[platform]}`);
        results[platform] = 'scheduled';
      } else {
        console.log(`❌ ${platform} failed: ${JSON.stringify(result)}`);
        results[platform] = 'failed';
      }
    } catch (err) {
      console.log(`❌ ${platform} error: ${err.message}`);
      results[platform] = 'error';
    }

    await new Promise(r => setTimeout(r, 1000));
  }

  console.log('Results:', results);
  res.json({ success: true, results });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`ShedsDirect Social Webhook running on port ${PORT}`);
});
