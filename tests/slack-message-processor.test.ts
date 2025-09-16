import { SlackMessageProcessor } from "../src/lib/slack-message-processor.js";
import { BigQueryClient } from "../src/clients/bigquery.js";
import { GCSClient } from "../src/clients/gcs.js";
import { SlackClient } from "../src/clients/slack.js";
import { TableGenerator } from "../src/lib/table-generator.js";
import { PlaceholderProcessor } from "../src/lib/placeholder-processor.js";
import type { SlackMessage, BigQueryResult, GCSFileInfo } from "../src/types/index.js";

jest.mock("../src/clients/bigquery.js");
jest.mock("../src/clients/gcs.js");
jest.mock("../src/clients/slack.js");
jest.mock("../src/lib/table-generator.js");
jest.mock("../src/lib/placeholder-processor.js");

describe("SlackMessageProcessor", () => {
  let processor: SlackMessageProcessor;
  let mockBigQueryClient: any;
  let mockGCSClient: any;
  let mockSlackClient: any;
  let mockTableGenerator: any;
  let mockPlaceholderProcessor: any;

  beforeEach(() => {
    mockBigQueryClient = {
      executeQuery: jest.fn()
    };
    mockGCSClient = {
      uploadImage: jest.fn()
    };
    mockSlackClient = {
      sendMessage: jest.fn(),
      generateErrorMessage: jest.fn()
    };
    mockTableGenerator = {
      generateTableHTML: jest.fn()
    };
    mockPlaceholderProcessor = {
      replacePlaceholdersInBlocks: jest.fn(),
      validateSlackBlocks: jest.fn()
    };

    (BigQueryClient as any).mockImplementation(() => mockBigQueryClient);
    (GCSClient as any).mockImplementation(() => mockGCSClient);
    (SlackClient as any).mockImplementation(() => mockSlackClient);
    (TableGenerator as any).mockImplementation(() => mockTableGenerator);
    (PlaceholderProcessor as any).mockImplementation(() => mockPlaceholderProcessor);

    processor = new SlackMessageProcessor();
  });

  describe("processMessage", () => {
    const mockMessage: SlackMessage = {
      id: "msg-123",
      slack_channel_id: "C123",
      workspace_id: "ws-123",
      is_parent: true,
      slack_templates: {
        id: "template-123",
        name: "Test Template",
        sql_text: "SELECT * FROM test_table",
        slack_blocks: [
          {
            type: "section",
            text: { type: "mrkdwn", text: "Hello {{template_name}}" }
          },
          {
            type: "image",
            image_url: "{{visualization_url}}",
            alt_text: "Chart"
          }
        ],
        viz_config_json: {
          tableConfig: {
            column1: { alignment: "Center", format: "Number" }
          }
        }
      },
      slack_workspaces: {
        id: "ws-123",
        company_id: "company-123",
        slack_team_id: "team-123"
      }
    };

    it("processes message with SQL and visualization successfully", async () => {
      const mockQueryResults: BigQueryResult = {
        data: [
          { column1: 100, column2: "test" },
          { column1: 200, column2: "test2" }
        ],
        rows: []
      };

      const mockGCSFileInfo: GCSFileInfo = {
        filename: "test.png",
        publicUrl: "https://storage.googleapis.com/bucket/test.png",
        bucketName: "test-bucket"
      };

      const mockSlackResponse = {
        ok: true,
        ts: "1234567890.123456",
        channel: "C123"
      };

      mockBigQueryClient.executeQuery.mockResolvedValue(mockQueryResults);
      mockTableGenerator.generateTableHTML.mockReturnValue("<html>table</html>");
      mockGCSClient.uploadImage.mockResolvedValue(mockGCSFileInfo);
      mockPlaceholderProcessor.replacePlaceholdersInBlocks.mockResolvedValue([
        { type: "section", text: { type: "mrkdwn", text: "Hello Test Template" } },
        { type: "image", image_url: "https://storage.googleapis.com/bucket/test.png", alt_text: "Chart" }
      ]);
      mockPlaceholderProcessor.validateSlackBlocks.mockReturnValue([
        { type: "section", text: { type: "mrkdwn", text: "Hello Test Template" } },
        { type: "image", image_url: "https://storage.googleapis.com/bucket/test.png", alt_text: "Chart" }
      ]);
      mockSlackClient.sendMessage.mockResolvedValue(mockSlackResponse);

      const result = await processor.processMessage(mockMessage, "xoxb-token");

      expect(result.success).toBe(true);
      expect(result.slack_ts).toBe("1234567890.123456");
      expect(result.channel).toBe("C123");
      expect(mockBigQueryClient.executeQuery).toHaveBeenCalledWith(
        "SELECT * FROM test_table",
        "company-123"
      );
      expect(mockGCSClient.uploadImage).toHaveBeenCalled();
      expect(mockSlackClient.sendMessage).toHaveBeenCalled();
    });

    it("handles message without SQL text", async () => {
      const messageWithoutSQL = {
        ...mockMessage,
        slack_templates: {
          ...mockMessage.slack_templates,
          sql_text: undefined
        }
      };

      const mockSlackResponse = {
        ok: true,
        ts: "1234567890.123456",
        channel: "C123"
      };

      mockSlackClient.sendMessage.mockResolvedValue(mockSlackResponse);

      const result = await processor.processMessage(messageWithoutSQL, "xoxb-token");

      expect(result.success).toBe(true);
      expect(mockBigQueryClient.executeQuery).not.toHaveBeenCalled();
      expect(mockSlackClient.sendMessage).toHaveBeenCalled();
    });

    it("handles Slack API error", async () => {
      const mockSlackResponse = {
        ok: false,
        error: "channel_not_found"
      };

      mockSlackClient.sendMessage.mockResolvedValue(mockSlackResponse);
      mockSlackClient.generateErrorMessage.mockReturnValue("Channel not found");

      const result = await processor.processMessage(mockMessage, "xoxb-token");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Channel not found");
    });

    it("handles BigQuery execution error gracefully", async () => {
      mockBigQueryClient.executeQuery.mockRejectedValue(new Error("BigQuery error"));
      
      const mockSlackResponse = {
        ok: true,
        ts: "1234567890.123456",
        channel: "C123"
      };

      mockSlackClient.sendMessage.mockResolvedValue(mockSlackResponse);

      const result = await processor.processMessage(mockMessage, "xoxb-token");

      expect(result.success).toBe(true);
      expect(mockSlackClient.sendMessage).toHaveBeenCalled();
    });
  });

  describe("processChildMessage", () => {
    const mockChildMessage: SlackMessage = {
      id: "child-123",
      slack_channel_id: "C123",
      workspace_id: "ws-123",
      is_parent: false,
      parent_message_id: "parent-123",
      slack_templates: {
        id: "child-template-123",
        name: "Child Template",
        sql_text: "SELECT * FROM child_table",
        slack_blocks: [
          {
            type: "section",
            text: { type: "mrkdwn", text: "Child message" }
          }
        ]
      }
    };

    it("processes child message successfully", async () => {
      const mockQueryResults: BigQueryResult = {
        data: [{ child_column: "value" }],
        rows: []
      };

      const mockSlackResponse = {
        ok: true,
        ts: "1234567890.123457",
        channel: "C123"
      };

      mockBigQueryClient.executeQuery.mockResolvedValue(mockQueryResults);
      mockSlackClient.sendMessage.mockResolvedValue(mockSlackResponse);

      const result = await processor.processChildMessage(
        mockChildMessage,
        "xoxb-token",
        "1234567890.123456",
        "company-123"
      );

      expect(result.success).toBe(true);
      expect(result.slack_ts).toBe("1234567890.123457");
      expect(mockBigQueryClient.executeQuery).toHaveBeenCalledWith(
        "SELECT * FROM child_table",
        "company-123"
      );
      expect(mockSlackClient.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          thread_ts: "1234567890.123456"
        }),
        "xoxb-token"
      );
    });
  });
});
