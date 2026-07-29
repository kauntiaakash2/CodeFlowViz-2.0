export const DEFAULT_MAX_QUEUE_SIZE = 20;

export class RequestQueue {
  #concurrency;
  #active = 0;
  #queue = [];
  #maxQueueSize;

  constructor(concurrency, maxQueueSize = DEFAULT_MAX_QUEUE_SIZE) {
    this.#concurrency = concurrency;
    this.#maxQueueSize = maxQueueSize;
  }

  get active() {
    return this.#active;
  }

  acquire() {
    if (this.#active < this.#concurrency) {
      this.#active++;
      return Promise.resolve();
    }
    if (this.#queue.length >= this.#maxQueueSize) {
      return Promise.reject(new Error('Server is busy. Please try again later.'));
    }
    return new Promise((resolve, reject) => {
      this.#queue.push({ resolve, reject });
    });
  }

  release() {
    const next = this.#queue.shift();
    if (next) {
      next.resolve();
    } else {
      this.#active--;
    }
  }
}
