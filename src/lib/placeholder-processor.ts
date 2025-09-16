import type { 
  BigQueryResult, 
  GCSFileInfo, 
  MessageData, 
  SlackBlock 
} from "@/types/index.js";

export class PlaceholderProcessor {
  validateSlackBlocks(blocks: SlackBlock[]): SlackBlock[] {
    if (!Array.isArray(blocks)) {
      console.warn('Slack blocks is not an array, returning empty blocks');
      return [];
    }

    return blocks.map((block, index) => {
      try {
        const validatedBlock = JSON.parse(JSON.stringify(block));
        
        if (validatedBlock.type === 'image') {
          if (validatedBlock.image_url !== undefined) {
            if (!validatedBlock.image_url || validatedBlock.image_url.trim() === '' || !this.isValidUrl(validatedBlock.image_url)) {
              console.warn(`Invalid or empty image URL in block ${index}:`, validatedBlock.image_url);
              return null;
            }
          }
          else {
            console.warn(`Image block ${index} missing image_url`);
            return null;
          }
        }
        
        if (validatedBlock.type === 'section' && validatedBlock.accessory) {
          if (validatedBlock.accessory.type === 'image') {
            if (!validatedBlock.accessory.image_url || validatedBlock.accessory.image_url.trim() === '' || !this.isValidUrl(validatedBlock.accessory.image_url)) {
              console.warn(`Invalid or empty accessory image URL in block ${index}:`, validatedBlock.accessory.image_url);
              delete validatedBlock.accessory;
            }
          }
        }
        
        if (validatedBlock.type === 'context' && validatedBlock.elements) {
           validatedBlock.elements = validatedBlock.elements.filter((element: any) => {
            if (element.type === 'image') {
              if (!element.image_url || element.image_url.trim() === '' || !this.isValidUrl(element.image_url)) {
                console.warn(`Invalid or empty context image URL in block ${index}:`, element.image_url);
                return false;
              }
            }
            return true;
          });
          
          if (validatedBlock.elements.length === 0) {
            console.warn(`Context block ${index} has no valid elements, removing block`);
            return null;
          }
        }
        
        return validatedBlock;
      } catch (error) {
        console.warn(`Error validating block ${index}:`, error);
        return null;
      }
    }).filter(block => block !== null);
  }

  private isValidUrl(string: string): boolean {
    try {
      const url = new URL(string);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (_) {
      return false;
    }
  }

  async replacePlaceholdersInBlocks(
    blocks: SlackBlock[], 
    queryResults: BigQueryResult | null, 
    message: MessageData, 
    gcsFileInfo: GCSFileInfo | null
  ): Promise<SlackBlock[]> {
    if (!Array.isArray(blocks)) {
      return blocks;
    }

    const context = {
      template_name: message.slack_templates.name,
      workspace_id: message.workspace_id,
      company_id: message.slack_workspaces?.company_id || message.company_id,
      channel_id: message.slack_channel_id,
      ...(queryResults && queryResults.data && queryResults.data[0] ? queryResults.data[0] : {}),
    };

    try {
      let processedBlocksString = JSON.stringify(blocks);
      
      processedBlocksString = processedBlocksString.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
        const trimmedKey = key.trim();
        
        if (trimmedKey === 'visualization_url') {
          if (gcsFileInfo && gcsFileInfo.publicUrl) {
            console.log('Using GCS public URL for visualization_url:', gcsFileInfo.publicUrl);
            return gcsFileInfo.publicUrl;
          } else {
            console.warn('Could not generate or upload image for {{visualization_url}} placeholder');
            return '';
          }
        }
        
        const value = context[trimmedKey as keyof typeof context];
        return value !== undefined ? String(value) : '';
      });
      
      return JSON.parse(processedBlocksString);
    } catch (error) {
      console.warn('Error replacing placeholders in blocks:', error);
      return blocks;
    }
  }
}
