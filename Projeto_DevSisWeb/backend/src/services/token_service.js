import jwt from 'jsonwebtoken';

const secret = process.env.JWT_SECRET;
if (!secret) throw new Error('JWT_SECRET não foi configurado.');

export const createToken = (user) => jwt.sign(
  { sub: String(user.id), username: user.username },
  secret,
  { expiresIn: process.env.JWT_EXPIRES_IN || '8h' },
);

export const verifyToken = (token) => jwt.verify(token, secret);
