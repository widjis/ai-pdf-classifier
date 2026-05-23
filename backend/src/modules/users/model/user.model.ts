export type UserRole = 'admin' | 'reviewer' | 'operator';

export type AppUser = {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
};

