/**
 * Integration test for backend connectivity
 * 
 * This test actually connects to the running backend server.
 * Make sure the backend is running on http://localhost:8000 before running this test.
 * 
 * Run with: npm test -- src/api/__tests__/backend.integration.test.ts
 */

import { describe, it, expect } from 'vitest';
import { healthCheck } from '../backend';

describe('Backend Integration', () => {
  it('should connect to running backend', async () => {
    const result = await healthCheck();
    
    expect(result).toEqual({
      status: 'healthy',
      version: '0.1.0',
      message: 'SigilWeaver Backend is running',
    });
  }, { timeout: 5000 });
});
