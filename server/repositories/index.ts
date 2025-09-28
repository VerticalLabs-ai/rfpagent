// Base repository and utilities
export {
  BaseRepository,
  type BaseFilter,
  type RepositoryResult,
  createPaginatedResult,
} from './BaseRepository';

// Specific repositories
export { UserRepository } from './UserRepository';
export { PortalRepository, type PortalFilter } from './PortalRepository';
export { RFPRepository, type RFPFilter } from './RFPRepository';

// Repository manager
export {
  RepositoryManager,
  repositoryManager,
  repositories,
} from './RepositoryManager';

// Re-export for convenience
export default repositories;
