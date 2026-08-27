export type UserRole = 'student' | 'professional' | 'admin';

export type LoginFormData = {
  email: string;
  password: string;
};

export type RegisterFormData = {
  name: string;
  email: string;
  password: string;
};

export type ForgotPasswordFormData = {
  email: string;
};

export type UserProfile = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
};

export type AuthResponse = {
  success: boolean;
  message: string;
};
export type ProjectRole = 'owner' | 'member' | 'viewer';

export type Project = {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  archivedAt: string | null;
};

export type ProjectMember = {
  projectId: string;
  userId: string;
  role: ProjectRole;
};

export type CreateProjectData = {
  name: string;
  description?: string;
};

export type UpdateProjectData = {
  name?: string;
  description?: string | null;
};
