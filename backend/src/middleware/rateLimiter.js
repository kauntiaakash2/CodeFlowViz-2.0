export function createRateLimiter({ windowMs, maxRequests, message }) {
  // Each limiter gets its own Map — prevents cross-limiter count bleed.
  const ipRequests = new Map(); // ip -> { count, resetTime }

  return (req, res, next) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const now = Date.now();

    // Evict all expired entries to prevent unbounded memory growth.
    for (const [key, data] of ipRequests) {
      if (now > data.resetTime) ipRequests.delete(key);
    }

    let rateData = ipRequests.get(ip);
    if (!rateData || now > rateData.resetTime) {
      rateData = {
        count: 0,
        resetTime: now + windowMs,
      };
    }

    rateData.count++;
    ipRequests.set(ip, rateData);

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - rateData.count));
    res.setHeader('X-RateLimit-Reset', Math.trunc(rateData.resetTime / 1000));

    if (rateData.count > maxRequests) {
      return res.status(429).json({
        ok: false,
        error: message || 'Too many requests, please try again later.',
      });
    }

    next();
  };
}
