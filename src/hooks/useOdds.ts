import { useQuery } from 'react-query';
import { oddsApi, Sport, Event, OddsApiError, ERROR_MESSAGES } from '../services/odds';

function handleError(error: unknown) {
  if (error instanceof OddsApiError) {
    return error;
  }
  return new OddsApiError(ERROR_MESSAGES.API_CONNECTION_ERROR, 'API_CONNECTION_ERROR');
}

export function useSports() {
  return useQuery<Sport[], OddsApiError>(
    'sports',
    () => oddsApi.getSports(),
    {
      retry: 2,
      staleTime: 300000, // 5 minutes
      enabled: oddsApi.isConfigured(),
      onError: (error) => {
        console.error('Failed to fetch sports:', error.message);
      }
    }
  );
}

export function useOdds(sportKey: string) {
  return useQuery<Event[], OddsApiError>(
    ['odds', sportKey],
    async () => {
      try {
        return await oddsApi.getOdds(sportKey);
      } catch (error) {
        throw handleError(error);
      }
    },
    {
      retry: (failureCount, error) => {
        // Only retry on network errors, not on business logic errors
        return failureCount < 2 && error.code !== 'SPORT_DISABLED';
      },
      staleTime: 60000, // 1 minute
      enabled: oddsApi.isConfigured() && !!sportKey,
      onError: (error) => {
        console.error(`Failed to fetch odds for ${sportKey}:`, error.message);
      }
    }
  );
}

export function useLiveEvents(sportKey: string) {
  return useQuery<Event[], OddsApiError>(
    ['live-events', sportKey],
    async () => {
      try {
        return await oddsApi.getLiveEvents(sportKey);
      } catch (error) {
        throw handleError(error);
      }
    },
    {
      retry: (failureCount, error) => {
        return failureCount < 2 && error.code !== 'SPORT_DISABLED';
      },
      refetchInterval: 30000, // Refresh every 30 seconds
      staleTime: 10000, // 10 seconds
      enabled: oddsApi.isConfigured() && !!sportKey,
      onError: (error) => {
        console.error(`Failed to fetch live events for ${sportKey}:`, error.message);
      }
    }
  );
}

export function useScores(sportKey: string) {
  return useQuery<Event[], OddsApiError>(
    ['scores', sportKey],
    async () => {
      try {
        return await oddsApi.getScores(sportKey);
      } catch (error) {
        throw handleError(error);
      }
    },
    {
      retry: (failureCount, error) => {
        return failureCount < 2 && error.code !== 'SPORT_DISABLED';
      },
      staleTime: 60000, // 1 minute
      enabled: oddsApi.isConfigured() && !!sportKey,
      onError: (error) => {
        console.error(`Failed to fetch scores for ${sportKey}:`, error.message);
      }
    }
  );
}