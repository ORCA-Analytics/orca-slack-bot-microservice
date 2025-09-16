import { BigQueryClient } from "@/clients/bigquery.js";
import { GCSClient } from "@/clients/gcs.js";
import { SlackClient } from "@/clients/slack.js";
import { TableGenerator } from "./table-generator.js";
import { PlaceholderProcessor } from "./placeholder-processor.js";
import { renderHtmlToPngBuffer } from "@/clients/renderer.js";
import type { 
  BigQueryResult, 
  GCSFileInfo, 
  SlackMessagePayload, 
  SlackResponse, 
  SlackMessage, 
  SlackToken,
  MessageData,
  SlackBlock
} from "@/types/index.js";

export class SlackMessageProcessor {
  private bigQueryClient: BigQueryClient;
  private gcsClient: GCSClient;
  private slackClient: SlackClient;
  private tableGenerator: TableGenerator;
  private placeholderProcessor: PlaceholderProcessor;

  constructor() {
    this.bigQueryClient = new BigQueryClient();
    this.gcsClient = new GCSClient();
    this.slackClient = new SlackClient();
    this.tableGenerator = new TableGenerator();
    this.placeholderProcessor = new PlaceholderProcessor();
  }

  async processMessage(message: SlackMessage, accessToken: string, customPayload?: any): Promise<{
    success: boolean;
    slack_ts?: string;
    channel?: string;
    childResults?: any[];
    error?: string;
  }> {
    try {
      console.log(`Processing message: ${message.slack_templates.name} (${message.id})`);

      let queryResults: BigQueryResult | null = null;
      if (message.slack_templates.sql_text) {
        console.log(`Executing SQL query (${message.slack_templates.sql_text.length} chars)`);
        
        try {
          queryResults = await this.bigQueryClient.executeQuery(
            message.slack_templates.sql_text,
            message.slack_workspaces?.company_id || '1'
          );
          
          console.log(`SQL executed: ${queryResults?.data?.length || 0} rows`);
        } catch (error) {
          console.error('SQL execution error:', error);
        }
      } else {
        console.warn(`No SQL text found in template: ${message.slack_templates.name}`);
      }

      let gcsFileInfo: GCSFileInfo | null = null;
      if (message.slack_templates.slack_blocks && 
          JSON.stringify(message.slack_templates.slack_blocks).includes('{{visualization_url}}') && 
          queryResults && queryResults.data) {
        
        console.log('Generating table image...');
        
        const html = this.tableGenerator.generateTableHTML(queryResults, message);
        if (html) {
          const imageBuffer = await renderHtmlToPngBuffer(html);
          
          if (imageBuffer) {
            gcsFileInfo = await this.gcsClient.uploadImage(
              imageBuffer,
              `${message.slack_templates.name}_table.png`,
              message.id,
              message.slack_channel_id
            );
          }
        }
      }

      let messagePayload: SlackMessagePayload = {
        channel: message.slack_channel_id,
        text: `Message from ${message.slack_templates.name}`,
      };

      if (customPayload && (customPayload.parentText || customPayload.parentBlocks)) {
        messagePayload.text = customPayload.parentText || `Message from ${message.slack_templates.name}`;
        
        if (customPayload.parentBlocks && customPayload.parentBlocks.length > 0) {
          const processedBlocks = await this.placeholderProcessor.replacePlaceholdersInBlocks(
            customPayload.parentBlocks, 
            queryResults,
            message,
            gcsFileInfo
          );
          
          const validatedBlocks = this.placeholderProcessor.validateSlackBlocks(processedBlocks);
          messagePayload.blocks = validatedBlocks;
        }
      } else if (message.slack_templates.slack_blocks && message.slack_templates.slack_blocks.length > 0) {
        const processedBlocks = await this.placeholderProcessor.replacePlaceholdersInBlocks(
          message.slack_templates.slack_blocks, 
          queryResults,
          message,
          gcsFileInfo
        );
        
        const validatedBlocks = this.placeholderProcessor.validateSlackBlocks(processedBlocks);
        messagePayload.blocks = validatedBlocks;
      } else {
        messagePayload.text = `${message.slack_templates.name}`;
        
        if (queryResults && queryResults.data && queryResults.data.length > 0) {
          messagePayload.text += `\n\nQuery returned ${queryResults.data.length} row(s).`;
          
          if (queryResults.data.length > 0) {
            messagePayload.text += `\n\n💡 _Add Slack blocks to your template with {{visualization_url}} for beautiful table visualizations!_`;
          }
        } else if (message.slack_templates.sql_text) {
          messagePayload.text += `\n\nQuery executed but returned no data.`;
        }
      }

      console.log('Sending to Slack...');
      const slackResult = await this.slackClient.sendMessage(messagePayload, accessToken);

      if (!slackResult.ok) {
        console.error('Slack send error:', slackResult);
        const errorMessage = this.slackClient.generateErrorMessage(slackResult);
        
        return {
          success: false,
          error: errorMessage
        };
      }

       return {
         success: true,
         ...(slackResult.ts && { slack_ts: slackResult.ts }),
         ...(slackResult.channel && { channel: slackResult.channel })
       };

    } catch (error) {
      console.error('Error processing Slack message:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async processChildMessage(
    childMessage: SlackMessage, 
    accessToken: string, 
    parentTs: string,
    companyId: string
  ): Promise<{
    success: boolean;
    slack_ts?: string;
    error?: string;
  }> {
    try {
      console.log(`Processing child: ${childMessage.slack_templates.name}`);

      let childQueryResults: BigQueryResult | null = null;
      if (childMessage.slack_templates.sql_text) {
        try {
          childQueryResults = await this.bigQueryClient.executeQuery(
            childMessage.slack_templates.sql_text,
            companyId
          );
        } catch (error) {
          console.warn('Child message SQL execution error:', error);
        }
      }

      let gcsFileInfo: GCSFileInfo | null = null;
      if (childMessage.slack_templates.slack_blocks && 
          JSON.stringify(childMessage.slack_templates.slack_blocks).includes('{{visualization_url}}') && 
          childQueryResults && childQueryResults.data) {
        
        console.log('Generating child table image...');
        
        const html = this.tableGenerator.generateTableHTML(childQueryResults, childMessage);
        if (html) {
          const imageBuffer = await renderHtmlToPngBuffer(html);
          
          if (imageBuffer) {
            gcsFileInfo = await this.gcsClient.uploadImage(
              imageBuffer,
              `${childMessage.slack_templates.name}_table.png`,
              childMessage.id,
              childMessage.slack_channel_id
            );
          }
        }
      }

      let childMessagePayload: SlackMessagePayload = {
        channel: childMessage.slack_channel_id,
        text: `Reply from ${childMessage.slack_templates.name}`,
        thread_ts: parentTs
      };

      if (childMessage.slack_templates.slack_blocks && childMessage.slack_templates.slack_blocks.length > 0) {
        const processedBlocks = await this.placeholderProcessor.replacePlaceholdersInBlocks(
          childMessage.slack_templates.slack_blocks, 
          childQueryResults,
          childMessage,
          gcsFileInfo
        );
        
        const validatedBlocks = this.placeholderProcessor.validateSlackBlocks(processedBlocks);
        childMessagePayload.blocks = validatedBlocks;
      } else {
        childMessagePayload.text = `${childMessage.slack_templates.name}`;
        
        if (childQueryResults && childQueryResults.data && childQueryResults.data.length > 0) {
          childMessagePayload.text += `\n\nQuery returned ${childQueryResults.data.length} row(s).`;
          
          if (childQueryResults.data.length > 0) {
            childMessagePayload.text += `\n\n _Add Slack blocks with {{visualization_url}} for table visualizations!_`;
          }
        } else if (childMessage.slack_templates.sql_text) {
          childMessagePayload.text += `\n\nQuery executed but returned no data.`;
        }
      }

      console.log(`Sending child: ${childMessage.slack_templates.name}`);
      const childResult = await this.slackClient.sendMessage(childMessagePayload, accessToken);
      
      if (childResult.ok) {
         return {
           success: true,
           ...(childResult.ts && { slack_ts: childResult.ts })
         };
      } else {
        console.error('Child message send error:', childResult);
        const errorMessage = this.slackClient.generateErrorMessage(childResult);
        return {
          success: false,
          error: errorMessage
        };
      }
      
    } catch (error) {
      console.error('Error processing child message:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}
