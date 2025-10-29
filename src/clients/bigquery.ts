import { BigQuery } from "@google-cloud/bigquery";
import type { BigQueryResult } from '@/types/index.js';

export class BigQueryClient {
  private bigquery: BigQuery;

  constructor() {
    let credentials = null;
    
    if (process.env.GOOGLE_CLOUD_CREDENTIALS) {
      try {
        credentials = JSON.parse(process.env.GOOGLE_CLOUD_CREDENTIALS);
        console.log('Using GOOGLE_CLOUD_CREDENTIALS for BigQuery, project:', credentials.project_id);
      } catch (error) {
        console.warn('GOOGLE_CLOUD_CREDENTIALS is not valid JSON, ignoring:', error);
      }
    }

    if (credentials) {
      this.bigquery = new BigQuery({
        projectId: credentials.project_id,
        credentials: credentials,
      });
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      this.bigquery = new BigQuery({
        projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || 'orcaanalytics',
        keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
      });
      console.log('Using GOOGLE_APPLICATION_CREDENTIALS file path for BigQuery');
    } else {
      this.bigquery = new BigQuery({
        projectId: 'orcaanalytics',
        keyFilename: './bigquery-key.json',
      });
      console.log('Using local key file for BigQuery');
    }
  }

  async executeQuery(sqlText: string, companyId: string): Promise<BigQueryResult | null> {
    try {
      console.log('Executing BigQuery SQL:', {
        sqlLength: sqlText.length,
        companyId
      });

      const jobOptions = {
        query: sqlText,
        location: 'US',
        dryRun: false,
        maximumBytesBilled: '1000000000',
        jobTimeoutMs: 30000,
        useLegacySql: false,
        useQueryCache: true,
      };


      const [job] = await this.bigquery.createJob({ 
        configuration: { query: jobOptions } 
      });
      
      const [jobMetadata] = await job.getMetadata();
      console.log('Job created, waiting for completion...', {
        jobId: jobMetadata.id,
        status: jobMetadata.status?.state
      });
      
      let jobComplete = false;
      let attempts = 0;
      const maxAttempts = 60;
      
      while (!jobComplete && attempts < maxAttempts) {
        const [metadata] = await job.getMetadata();
        const state = metadata.status?.state;
        
        if (state === 'DONE') {
          if (metadata.status?.errors && metadata.status.errors.length > 0) {
            throw new Error(`BigQuery job failed: ${JSON.stringify(metadata.status.errors)}`);
          }
          jobComplete = true;
        } else if (state === 'PENDING' || state === 'RUNNING') {
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
          attempts++;
        } else {
          throw new Error(`BigQuery job in unexpected state: ${state}`);
        }
      }
      
      if (!jobComplete) {
        throw new Error('BigQuery job timed out after 60 seconds');
      }
      
      console.log('Job completed, fetching results...');
      const [rows] = await job.getQueryResults({
        maxResults: 10000,
        autoPaginate: false
      });
      
      const [finalMetadata] = await job.getMetadata();
      
      console.log('Raw query results:', {
        rowsLength: rows?.length || 0,
        hasRows: !!rows,
        totalRowsProcessed: finalMetadata?.statistics?.query?.totalRowsProcessed || 'unknown',
        totalBytesProcessed: finalMetadata?.statistics?.query?.totalBytesProcessed || 'unknown',
        jobState: finalMetadata?.status?.state
      });
      
      if (rows && rows.length > 0) {
        const formattedRows = rows.map((row: any) => {
          const formattedRow: Record<string, any> = {};
          Object.keys(row).forEach((key) => {
            let value = row[key];
            
            if (value && value.constructor && value.constructor.name === 'Big') {
              value = value.toString();
            } else if (value instanceof Date) {
              value = value.toISOString();
            } else if (typeof value === 'bigint') {
              value = value.toString();
            } else if (value === null || value === undefined) {
              value = null;
            } else if (typeof value === 'object' && value !== null) {
              if (value.hasOwnProperty('value')) {
                value = value.value;
              } else {
                try {
                  value = JSON.stringify(value);
                } catch (e) {
                  value = String(value);
                }
              }
            }
            
            formattedRow[key] = value;
          });
          return formattedRow;
        });

        const result: BigQueryResult = {
          data: formattedRows,
          rows: formattedRows
        };
        
        console.log('BigQuery query executed successfully:', {
          rowsReturned: formattedRows.length
        });

        return result;
      }

      console.warn('Query returned no rows', {
        rowsWasNull: rows === null,
        rowsWasUndefined: rows === undefined,
        rowsLength: rows?.length || 0,
        totalRowsProcessed: finalMetadata?.statistics?.query?.totalRowsProcessed || 'unknown'
      });

      return null;
    } catch (error) {
      console.error('BigQuery execution error:', error);
      throw error;
    }
  }
}
