export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  role: 'admin' | 'reviewer' | 'operator';
};

export type LoginResponse = {
  token: string;
  user: AuthUser;
};
