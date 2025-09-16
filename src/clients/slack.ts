import type { SlackMessagePayload, SlackResponse, SlackBlock } from '@/types/index.js';

export class SlackClient {
  async sendMessage(messagePayload: SlackMessagePayload, accessToken: string): Promise<SlackResponse> {
    console.log('Sending message payload to Slack:', JSON.stringify(messagePayload, null, 2));
    
    const slackResponse = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messagePayload),
    });

    const result = await slackResponse.json() as SlackResponse;
    
    if (!result.ok) {
      console.error(' Slack API error response:', JSON.stringify(result, null, 2));
    } else {
      console.log(' Slack API success response:', { ok: result.ok, ts: result.ts, channel: result.channel });
    }

    return result;
  }

  generateErrorMessage(slackResult: SlackResponse): string {
    let errorMessage = `Failed to send message: ${slackResult.error}`;
    
    if (slackResult.error === 'invalid_blocks') {
      errorMessage += '. There are issues with the message blocks (likely invalid image URLs).';
      if (slackResult.error) {
        errorMessage += ` Details: ${slackResult.error}`;
      }
    } else if (slackResult.error === 'channel_not_found') {
      errorMessage += '. The specified channel was not found or the bot is not a member.';
    } else if (slackResult.error === 'not_in_channel') {
      errorMessage += '. The bot is not a member of the specified channel.';
    } else if (slackResult.error === 'invalid_auth') {
      errorMessage += '. The Slack token is invalid or expired.';
    }
    
    return errorMessage;
  }
}

export function ensureImageInBlocks(blocks: SlackBlock[], imageUrl: string, altText?: string): SlackBlock[] {
  const hasImageBlock = blocks.some(block => block.type === 'image');
  
  if (hasImageBlock) {
    return blocks;
  }
  
  const imageBlock: SlackBlock = {
    type: 'image',
    image_url: imageUrl,
    alt_text: altText || 'Visualization'
  };
  
  return [...blocks, imageBlock];
}