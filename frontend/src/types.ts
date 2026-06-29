export interface User {
  id: string;
  email: string;
  username: string;
  status: string;
}

export interface Workspace {
  id: string;
  name: string;
  type: 'personal' | 'enterprise';
  description?: string | null;
  status: string;
  role?: string | null;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface EmailCodeLoginInput {
  email: string;
  verification_code: string;
}

export interface RegisterInput extends LoginInput {
  username: string;
  verification_code: string;
}

export type EmailCodePurpose = 'login' | 'register';
