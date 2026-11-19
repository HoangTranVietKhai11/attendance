import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';

declare global {
  namespace Express {
    interface Request {
      admin?: { id: string; username: string; role: string };
    }
  }
}

export const authenticate = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'Unauthorized: missing token' });
    return;
  }
  const token = header.slice(7);
  try {
    const decoded = jwt.verify(token, config.jwtSecret) as {
      id: string;
      username: string;
      role: string;
    };
    req.admin = decoded;
    next();
  } catch {
    res.status(401).json({ success: false, error: 'Unauthorized: invalid or expired token' });
  }
};