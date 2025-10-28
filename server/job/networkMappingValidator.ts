import TheMovieDb from '@server/api/themoviedb';
import { NETWORK_TO_COMPANY_ID } from '@server/constants/networkCompanyMapping';
import type {
  RunnableScanner,
  StatusBase,
} from '@server/lib/scanners/baseScanner';
import logger from '@server/logger';

/**
 * Job to validate network-to-company ID mappings against TMDB API
 * Runs periodically to ensure mappings are still valid
 */
class NetworkMappingValidator implements RunnableScanner<StatusBase> {
  private running = false;

  public async run() {
    logger.info('Starting job: Network Mapping Validation', {
      label: 'Jobs',
    });

    this.running = true;

    try {
      const tmdb = new TheMovieDb();
      let validCount = 0;
      let invalidCount = 0;
      const errors: string[] = [];

      for (const [networkIdStr, companyId] of Object.entries(
        NETWORK_TO_COMPANY_ID
      )) {
        const networkId = Number(networkIdStr);

        try {
          // Fetch network details
          const networkResponse = await tmdb.getNetwork(networkId);

          // Fetch company details
          const companyResponse = await tmdb.getStudio(companyId);

          if (networkResponse && companyResponse) {
            logger.debug(
              `Valid mapping: ${networkResponse.name} (${networkId}) -> ${companyResponse.name} (${companyId})`,
              {
                label: 'Jobs',
              }
            );
            validCount++;
          }
        } catch (error) {
          const errorMsg = `Invalid mapping: Network ${networkId} -> Company ${companyId}`;
          logger.warn(errorMsg, {
            label: 'Jobs',
            errorMessage: error.message,
          });
          errors.push(errorMsg);
          invalidCount++;
        }

        // Rate limiting - TMDB allows 40 requests per 10 seconds
        await new Promise((resolve) => setTimeout(resolve, 250));
      }

      logger.info(
        `Network mapping validation complete: ${validCount} valid, ${invalidCount} invalid`,
        {
          label: 'Jobs',
        }
      );

      if (errors.length > 0) {
        logger.warn(
          `Some network mappings may need updating in server/constants/networkCompanyMapping.ts`,
          {
            label: 'Jobs',
            invalidMappings: errors,
          }
        );
      }
    } catch (error) {
      logger.error('Network mapping validation failed', {
        label: 'Jobs',
        errorMessage: error.message,
      });
    } finally {
      this.running = false;
    }
  }

  public status(): StatusBase {
    return {
      running: this.running,
      progress: 0,
      total: 0,
    };
  }

  public cancel(): void {
    this.running = false;
  }
}

const networkMappingValidator = new NetworkMappingValidator();
export default networkMappingValidator;
