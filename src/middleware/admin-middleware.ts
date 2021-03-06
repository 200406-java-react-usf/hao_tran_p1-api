import { Request, Response } from "express";
import { AuthenticationError, AuthorizationError } from "../errors/errors";

export const adminGuard = (req: Request, res: Response, next) => {
    if (!req.session.principal) {
        res.status(401).json(new AuthenticationError('No session found! Please login.'));
    } else if (req.session.principal.role === 'admin') {
        next();
    } else {
        res.status(403).json(new AuthorizationError());
    }
}
