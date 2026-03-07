import { Injectable } from '@nestjs/common';

export interface AppConfig {
  nodeEnv: 'development' | 'production' | 'test';
  port: number;
  cors: {
    origin: string | string[];
    credentials: boolean;
  };
  jwt: {
    secret: string;
    expiresIn: string;
  };
  throttle: {
    public: { ttl: number; limit: number };
    verify: { ttl: number; limit: number };
    auth: { ttl: number; limit: number };
  };
  logging: {
    level: string;
    json: boolean;
  };
}

@Injectable()
export class ConfigService {
  private readonly config: AppConfig;

  constructor() {
    const nodeEnv = (process.env.NODE_ENV || 'development') as AppConfig['nodeEnv'];
    const isProd = nodeEnv === 'production';

    this.config = {
      nodeEnv,
      port: parseInt(process.env.PORT || '3001', 10),

      cors: {
        // In production, only allow specific origins
        origin: isProd
          ? (process.env.CORS_ORIGIN || 'https://authenx.io').split(',')
          : process.env.CORS_ORIGIN || 'http://localhost:3000',
        credentials: true,
      },

      jwt: {
        secret: process.env.JWT_SECRET || 'authenx-jwt-secret-change-in-production',
        expiresIn: process.env.JWT_EXPIRES_IN || '24h',
      },

      throttle: {
        // Public endpoints: 100 req/min
        public: {
          ttl: 60000, // 1 minute in ms
          limit: 100,
        },
        // Verification endpoints: 20 req/min
        verify: {
          ttl: 60000,
          limit: 20,
        },
        // Auth login: 5 req/min (brute force protection)
        auth: {
          ttl: 60000,
          limit: 5,
        },
      },

      logging: {
        level: process.env.LOG_LEVEL || (isProd ? 'info' : 'debug'),
        json: isProd, // JSON in prod, pretty in dev
      },
    };
  }

  get<K extends keyof AppConfig>(key: K): AppConfig[K] {
    return this.config[key];
  }

  get isProd(): boolean {
    return this.config.nodeEnv === 'production';
  }

  get isDev(): boolean {
    return this.config.nodeEnv === 'development';
  }

  getAll(): AppConfig {
    return this.config;
  }
}
