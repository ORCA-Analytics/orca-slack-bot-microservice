export interface SlackTemplate {
  id: string;
  name: string;
  sql_text?: string;
  slack_blocks?: SlackBlock[];
  viz_config_json?: VizConfig;
}

export interface SlackWorkspace {
  id: string;
  company_id: string;
  slack_team_id: string;
}

export interface SlackMessage {
  id: string;
  company_id?: string;
  slack_channel_id: string;
  workspace_id: string;
  is_parent: boolean;
  parent_message_id?: string;
  position?: number;
  slack_templates: SlackTemplate;
  slack_workspaces?: SlackWorkspace;
}

export interface SlackToken {
  access_token: string;
}

export interface SlackBlock {
  type: string;
  image_url?: string;
  accessory?: {
    type: string;
    image_url?: string;
  };
  elements?: Array<{
    type: string;
    image_url?: string;
  }>;
  [key: string]: any;
}

export interface BigQueryResult {
  data: Record<string, any>[];
  rows: Record<string, any>[];
}

export interface GCSFileInfo {
  filename: string;
  publicUrl: string;
  bucketName: string;
}

export interface SlackMessagePayload {
  channel: string;
  text: string;
  blocks?: SlackBlock[];
  thread_ts?: string;
}

export interface SlackResponse {
  ok: boolean;
  ts?: string;
  channel?: string;
  error?: string;
}

export interface TableConfig {
  [columnName: string]: {
    alignment?: 'Left' | 'Center' | 'Right';
    format?: 'Text' | 'Number' | 'Currency' | 'Percent';
    decimalPlaces?: number;
    currency?: string;
    conditionalFormatting?: 'Yes' | 'No';
    colorScale?: 'Low green, high red' | 'Low red, high green' | 'Low green, high white' | 'Low white, high green';
  };
}

export interface VizConfig {
  type?: string;
  queryMode?: string;
  tableConfig?: TableConfig;
}

export interface MessageData {
  id: string;
  company_id?: string;
  slack_templates: {
    name: string;
    viz_config_json?: VizConfig;
  };
  workspace_id: string;
  slack_channel_id: string;
  slack_workspaces?: {
    company_id: string;
  };
}
