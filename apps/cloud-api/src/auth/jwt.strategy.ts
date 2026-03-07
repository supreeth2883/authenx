import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService, JwtPayload } from './auth.service.js';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        // 1. Try Authorization: Bearer <token> header
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        // 2. Try cookie named 'token'
        (req: any) => {
          if (req?.cookies?.token) {
            return req.cookies.token;
          }
          return null;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'authenx-jwt-secret-change-in-production', // must match auth.module.ts
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.authService.validateUserById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }
    return user; // This gets attached to request.user
  }
}
