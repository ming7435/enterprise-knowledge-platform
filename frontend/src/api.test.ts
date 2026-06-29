import { describe, expect, it } from 'vitest';

import { API_BASE_URL } from './api';

describe('API 默认配置', () => {
  it('默认连接本地后端 9520 端口', () => {
    expect(API_BASE_URL).toBe('http://127.0.0.1:9520');
  });
});
