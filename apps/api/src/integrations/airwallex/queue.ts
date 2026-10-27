type Job<T> = () => Promise<T>;

type PendingJob<T> = {
  run: Job<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
};

/** Keeps sandbox traffic below the documented concurrency ceiling. */
export class RequestQueue {
  private readonly pending: PendingJob<unknown>[] = [];
  private active = 0;

  constructor(private readonly concurrency = 10) {}

  add<T>(run: Job<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.pending.push({ run, resolve: resolve as (value: unknown) => void, reject });
      this.drain();
    });
  }

  private drain(): void {
    while (this.active < this.concurrency && this.pending.length > 0) {
      const job = this.pending.shift();
      if (!job) return;
      this.active += 1;
      void job.run().then(job.resolve, job.reject).finally(() => {
        this.active -= 1;
        this.drain();
      });
    }
  }
}

export const airwallexQueue = new RequestQueue();
