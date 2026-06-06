import { logger } from '../logger';

describe('logger', () => {
  let spy: jest.SpyInstance;

  beforeEach(() => { spy = jest.spyOn(console, 'log').mockImplementation(() => {}); });
  afterEach(() => spy.mockRestore());

  it('logs a plain message', () => {
    logger.info('hello');
    expect(spy).toHaveBeenCalledWith('[INFO] hello');
  });

  it('redacts password fields', () => {
    logger.info('login', { username: 'alice', password: 's3cr3t' });
    const call = spy.mock.calls[0];
    expect(JSON.stringify(call)).not.toContain('s3cr3t');
    expect(JSON.stringify(call)).toContain('[REDACTED]');
  });

  it('redacts envelope fields', () => {
    logger.debug('note', { id: '1', envelope: 'AAABBBCCC' });
    const call = spy.mock.calls[0];
    expect(JSON.stringify(call)).not.toContain('AAABBBCCC');
  });

  it('does not redact unrelated fields', () => {
    logger.info('data', { id: '123', title: 'my note' });
    const call = spy.mock.calls[0];
    expect(JSON.stringify(call)).toContain('123');
    expect(JSON.stringify(call)).toContain('my note');
  });
});
