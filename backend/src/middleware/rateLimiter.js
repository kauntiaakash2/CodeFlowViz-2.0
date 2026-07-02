const ipRequests = new Map(); // ip -> { count, resetTime }

export function createRateLimiter({ windowMs, maxRequests, message }) {
  return (req, res, next) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const now = Date.now();

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
