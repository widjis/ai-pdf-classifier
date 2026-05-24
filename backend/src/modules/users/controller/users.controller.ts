import type { Request, Response } from 'express';
import { ApiError } from '../../../core/http/apiError.js';
import { parseCreateUserDTO } from '../dto/createUser.dto.js';
import { parseUpdateUserDTO } from '../dto/updateUser.dto.js';
import { parseResetLocalPasswordDTO } from '../dto/resetLocalPassword.dto.js';
import { requireString, requireUuid } from '../../../core/validation/validators.js';
import { usersService } from '../service/users.service.js';
import { auditService } from '../../audit/service/audit.service.js';
import { usersRepository } from '../repository/users.repository.js';
import { lookupLdapUser, searchLdapUsers } from '../../../integrations/ldap/ldap.js';
import { parseProvisionLdapUserDTO } from '../dto/provisionLdapUser.dto.js';

export const usersController = {
  list: async (_req: Request, res: Response) => {
    res.json(await usersService.list());
  },
  ldapSearch: async (req: Request, res: Response) => {
    const query = requireString(req.query.query, 'query');
    if (query.length < 3) throw new ApiError({ status: 400, code: 'BAD_REQUEST', message: 'Query must be at least 3 characters' });
    try {
      const results = await searchLdapUsers(query, 12);
      res.json(results.map((u) => ({ email: u.email, displayName: u.displayName })));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'LDAP search failed';
      throw new ApiError({ status: 502, code: 'LDAP_SEARCH_FAILED', message });
    }
  },
  provisionLdapUser: async (req: Request, res: Response) => {
    const actor = req.authUser;
    if (!actor) throw new ApiError({ status: 401, code: 'BAD_REQUEST', message: 'Missing token' });
    const dto = parseProvisionLdapUserDTO(req.body);

    let ldapUser;
    try {
      ldapUser = await lookupLdapUser(dto.identity);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'LDAP lookup failed';
      throw new ApiError({ status: 502, code: 'LDAP_LOOKUP_FAILED', message });
    }
    if (!ldapUser) throw new ApiError({ status: 404, code: 'NOT_FOUND', message: 'User not found in LDAP' });

    const existing = await usersRepository.getByEmail(ldapUser.email);
    if (!existing) {
      const created = await usersService.create({
        email: ldapUser.email,
        displayName: ldapUser.displayName,
        role: dto.role,
      });
      await auditService.log({
        actorUserId: actor.id,
        targetUserId: created.id,
        action: 'users.create',
        before: null,
        after: created,
        ip: req.ip ?? null,
        userAgent: req.header('user-agent') ?? null,
      });
      res.status(201).json(created);
      return;
    }

    const updated = await usersService.update(existing.id, {
      displayName: ldapUser.displayName,
      role: dto.role,
      isActive: true,
    });
    await auditService.log({
      actorUserId: actor.id,
      targetUserId: updated.id,
      action: 'users.update',
      before: existing,
      after: updated,
      ip: req.ip ?? null,
      userAgent: req.header('user-agent') ?? null,
    });
    res.json(updated);
  },
  create: async (req: Request, res: Response) => {
    const actor = req.authUser;
    if (!actor) throw new ApiError({ status: 401, code: 'BAD_REQUEST', message: 'Missing token' });
    const dto = parseCreateUserDTO(req.body);
    const created = await usersService.create(dto);
    await auditService.log({
      actorUserId: actor.id,
      targetUserId: created.id,
      action: 'users.create',
      before: null,
      after: created,
      ip: req.ip ?? null,
      userAgent: req.header('user-agent') ?? null,
    });
    res.status(201).json(created);
  },
  update: async (req: Request, res: Response) => {
    const actor = req.authUser;
    if (!actor) throw new ApiError({ status: 401, code: 'BAD_REQUEST', message: 'Missing token' });
    const userId = requireUuid(req.params.id, 'id');
    const dto = parseUpdateUserDTO(req.body);
    const before = await usersRepository.getById(userId);
    if (!before) throw new ApiError({ status: 404, code: 'NOT_FOUND', message: 'User not found' });
    const updated = await usersService.update(userId, dto);
    await auditService.log({
      actorUserId: actor.id,
      targetUserId: updated.id,
      action: 'users.update',
      before,
      after: updated,
      ip: req.ip ?? null,
      userAgent: req.header('user-agent') ?? null,
    });
    res.json(updated);
  },
  resetLocalPassword: async (req: Request, res: Response) => {
    const actor = req.authUser;
    if (!actor) throw new ApiError({ status: 401, code: 'BAD_REQUEST', message: 'Missing token' });
    const userId = requireUuid(req.params.id, 'id');
    const dto = parseResetLocalPasswordDTO(req.body);
    await usersService.resetLocalAdminPassword({
      userId,
      newPassword: dto.newPassword,
      actorUserId: actor.id,
      ip: req.ip ?? null,
      userAgent: req.header('user-agent') ?? null,
    });
    res.status(204).end();
  },
};
