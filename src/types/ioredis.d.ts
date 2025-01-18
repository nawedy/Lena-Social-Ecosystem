declare module 'ioredis' {
  export default class Redis {
    constructor(url?: string, options?: any);

    connect(): Promise<void>;
    disconnect(): Promise<void>;

    get(key: string): Promise<string | null>;
    set(key: string, value: string, mode?: string, duration?: number): Promise<'OK'>;
    del(key: string): Promise<number>;

    hget(key: string, field: string): Promise<string | null>;
    hset(key: string, field: string, value: string): Promise<number>;
    hdel(key: string, field: string): Promise<number>;

    expire(key: string, seconds: number): Promise<number>;
    ttl(key: string): Promise<number>;

    pipeline(): Pipeline;
    multi(): Pipeline;
  }

  interface Pipeline {
    exec(): Promise<Array<[Error | null, any]>>;
    get(key: string): Pipeline;
    set(key: string, value: string): Pipeline;
    del(key: string): Pipeline;
  }
}
