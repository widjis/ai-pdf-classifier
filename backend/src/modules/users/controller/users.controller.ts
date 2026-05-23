import type { Request, Response } from 'express';
import { parseCreateUserDTO } from '../dto/createUser.dto.js';
import { usersService } from '../service/users.service.js';

export const usersController = {
  list: async (_req: Request, res: Response) => {
    res.json(await usersService.list());
  },
  create: async (req: Request, res: Response) => {
    const dto = parseCreateUserDTO(req.body);
    const created = await usersService.create(dto);
    res.status(201).json(created);
  },
};

