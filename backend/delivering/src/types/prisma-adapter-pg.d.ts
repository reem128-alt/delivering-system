import type { Prisma } from '@prisma/client';

type PrismaPgAdapter = NonNullable<Prisma.PrismaClientOptions['adapter']>;

type SslConfig =
  | boolean
  | {
      ca?: string;
      cert?: string;
      key?: string;
      rejectUnauthorized?: boolean;
      [extra: string]: unknown;
    };

declare module '@prisma/adapter-pg' {
  export interface PrismaPgOptions {
    connectionString: string;
    schema?: string;
    ssl?: SslConfig;
  }

  export interface PrismaPgConstructor {
    new (options: PrismaPgOptions): PrismaPgAdapter;
  }

  export const PrismaPg: PrismaPgConstructor;
}
