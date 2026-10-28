export interface TenantRole { role_id: string; name: string }
export interface TenantMember {
  profile_id: string; institution_id: string; email: string; first_name: string; last_name: string;
  phone: string; role_name: string; is_active: boolean; modules: string[]; invitation_pending?: boolean;
}
export interface TenantRequest {
  source?: 'registration';
  request_id: string; profile_id: string; institution_id: string; email: string;
  first_name: string; last_name: string; phone: string;
}
export interface TenantSnapshot {
  version: 1; institution_id: string; actor_role: string;
  roles: TenantRole[]; members: TenantMember[]; requests: TenantRequest[]; modules: string[];
}
export interface AssignTenantRole {
  institutionId: string; email: string; roleId: string; firstName: string; lastName: string; phone: string; modules: string[];
}
export interface TenantAdminService {
  edit(input: AssignTenantRole): Promise<void>;
  notify(input: { institutionId: string; profileId: string; redirect_to: string; pending?: boolean }): Promise<{ notificationSent: boolean }>;
  approve(input: AssignTenantRole & { profileId: string; requestId: string }): Promise<void>;
  load(institutionId: string): Promise<TenantSnapshot>;
  invite(input: AssignTenantRole & { redirect_to: string }): Promise<{ notificationSent: boolean }>;
  remove(institutionId: string, profileId: string): Promise<void>;
  deleteMember(institutionId: string, profileId: string): Promise<void>;
}
