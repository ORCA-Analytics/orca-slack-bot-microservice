import type { 
  BigQueryResult, 
  MessageData, 
  TableConfig, 
  VizConfig 
} from "@/types/index.js";

export class TableGenerator {
  private getColumnConfig(columnName: string, tableConfig: TableConfig) {
    return tableConfig[columnName] || {
      alignment: 'Center',
      format: 'Text',
      decimalPlaces: 2,
      currency: '$ (USD)',
      conditionalFormatting: 'No',
      colorScale: 'Low green, high red'
    };
  }

  private formatValue(value: any, config: any): string {
    if (value === null || value === undefined) return '-';
    
    if (value && typeof value === 'object' && value.constructor && value.constructor.name === 'Date') {
      return value.toLocaleDateString('en-US');
    }
    
    if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/)) {
      const date = new Date(value);
      return date.toLocaleDateString('en-US');
    }
    
    if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)) {
      const date = new Date(value);
      return date.toLocaleDateString('en-US');
    }
    
    if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const date = new Date(value + 'T00:00:00');
      return date.toLocaleDateString('en-US');
    }
    
    switch (config.format) {
      case 'Currency':
        const currencySymbol = config.currency === '€ (EUR)' ? '€' : config.currency === '£ (GBP)' ? '£' : '$';
        return `${currencySymbol}${Number(value).toLocaleString('en-US', { 
          minimumFractionDigits: config.decimalPlaces, 
          maximumFractionDigits: config.decimalPlaces 
        })}`;
      case 'Number':
        return Number(value).toLocaleString('en-US', { 
          minimumFractionDigits: config.decimalPlaces, 
          maximumFractionDigits: config.decimalPlaces 
        });
      case 'Percent':
        return `${Number(value).toFixed(config.decimalPlaces)}%`;
      default:
        return String(value);
    }
  }

  private shouldShowConditionalFormatting(format: string): boolean {
    return ['Number', 'Currency', 'Percent'].includes(format);
  }

  private getBackgroundColor(value: any, config: any, allValues: any[]): string {
    if (config.conditionalFormatting !== 'Yes' || !this.shouldShowConditionalFormatting(config.format)) {
      return '';
    }
    
    const numValue = Number(value);
    if (isNaN(numValue)) return '';
    
    const numValues = allValues.map(v => Number(v)).filter(v => !isNaN(v));
    if (numValues.length === 0) return '';
    
    const sortedValues = [...numValues].sort((a, b) => a - b);
    
    const lowValue = sortedValues[0];
    const highValue = sortedValues[sortedValues.length - 1];
    const midValue = sortedValues[Math.floor(sortedValues.length / 2)];
    
    if (lowValue === highValue) return '';
    
    if (lowValue === undefined || highValue === undefined || midValue === undefined) return '';
    
    let position: number;
    if (numValue <= midValue) {
      position = midValue === lowValue ? 0 : (numValue - lowValue) / (midValue - lowValue) * 0.5;
    } else {
      position = 0.5 + (numValue - midValue) / (highValue - midValue) * 0.5;
    }
    
    const interpolateColor = (color1: number[], color2: number[], factor: number): number[] => {
      const result = color1.slice();
      for (let i = 0; i < 3; i++) {
        result[i] = Math.round((result[i] ?? 0) + factor * ((color2[i] ?? 0) - (result[i] ?? 0)));
      }
      return result;
    };
    
    const getThreeColorGradient = (lowColor: number[], midColor: number[], highColor: number[], pos: number): string => {
      let color: number[];
      if (pos <= 0.5) {
        const factor = pos * 2;
        color = interpolateColor(lowColor, midColor, factor);
      } else {
        const factor = (pos - 0.5) * 2;
        color = interpolateColor(midColor, highColor, factor);
      }
      return `rgba(${color[0]}, ${color[1]}, ${color[2]}, 0.85)`;
    };
    
    const green = [87, 187, 138];  
    const yellow = [254, 208, 102]; 
    const red = [231, 127, 114]; 
    
    const linearPosition = (numValue - lowValue) / (highValue - lowValue);
    
    switch (config.colorScale) {
      case 'Low green, high red':
        return getThreeColorGradient(green, yellow, red, position);
      case 'Low red, high green':
        return getThreeColorGradient(red, yellow, green, position);
      case 'Low green, high white':
        const greenToWhiteIntensity = 1 - linearPosition;
        return `rgba(87, 187, 138, ${greenToWhiteIntensity * 0.8})`;
      case 'Low white, high green':
        const whiteToGreenOpacity = linearPosition * 0.8;
        return whiteToGreenOpacity === 0 ? 'rgba(255, 255, 255, 0)' : `rgba(87, 187, 138, ${whiteToGreenOpacity})`;
      default:
        return '';
    }
  }

  generateTableHTML(queryResults: BigQueryResult, message: MessageData): string | null {
    if (!queryResults || !queryResults.data || queryResults.data.length === 0) {
      return null;
    }

    const data = queryResults.data;
    const headers = Object.keys(data[0] || {});
    const templateName = message?.slack_templates?.name || 'Data Results';
    const tableConfig = message?.slack_templates?.viz_config_json?.tableConfig || {};
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #ffffff;
          }
          .table-container {
            background-color: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
            border: 1px solid #e5e7eb;
          }
          .table-title {
            background-color: #f9fafb;
            padding: 16px 20px;
            border-bottom: 1px solid #e5e7eb;
            font-size: 16px;
            font-weight: 600;
            color: #374151;
            margin: 0;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
          }
          th {
            background-color: #B1E4E3;
            color: #374151;
            font-weight: 600;
            padding: 12px 16px;
            border-bottom: 2px solid #9fd3d1;
            white-space: nowrap;
          }
          td {
            padding: 10px 16px;
            border-bottom: 1px solid #f3f4f6;
            color: #374151;
            max-width: 200px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
          tr:nth-child(even) {
            background-color: #f9fafb;
          }
          tr:hover {
            background-color: #f3f4f6;
          }
          .text-left {
            text-align: left;
          }
          .text-center {
            text-align: center;
          }
          .text-right {
            text-align: right;
            font-variant-numeric: tabular-nums;
          }
          .no-data {
            text-align: center;
            padding: 40px;
            color: #6b7280;
            font-style: italic;
          }
        </style>
      </head>
      <body>
        <div class="table-container">
          <h3 class="table-title">${templateName}</h3>
          <table>
            <thead>
              <tr>
                ${headers.map(header => {
                  const config = this.getColumnConfig(header, tableConfig);
                  const headerAlignment = config.alignment === 'Left' ? 'text-left' : 
                                         config.alignment === 'Right' ? 'text-right' : 'text-center';
                  return `<th class="${headerAlignment}">${header}</th>`;
                }).join('')}
              </tr>
            </thead>
            <tbody>
              ${data.map(row => `
                <tr>
                  ${headers.map(header => {
                    const config = this.getColumnConfig(header, tableConfig);
                    const rawValue = row[header];
                    
                    const columnValues = data.map(r => r[header]);
                    const backgroundColor = this.getBackgroundColor(rawValue, config, columnValues);
                    
                    const alignment = config.alignment === 'Left' ? 'text-left' : 
                                     config.alignment === 'Right' ? 'text-right' : 'text-center';
                    
                    const formattedValue = this.formatValue(rawValue, config);
                    const style = backgroundColor ? `background-color: ${backgroundColor}` : '';
                    
                    return `<td class="${alignment}" style="${style}" title="${formattedValue}">${formattedValue}</td>`;
                  }).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </body>
      </html>
    `;
    
    return html;
  }
}
