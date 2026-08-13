import type { AppRole } from "@/lib/auth/roles";

export type DemoSession = {
  userId: string;
  role: AppRole;
  displayName: string;
  businessId?: string;
};

export const demoClientSession: DemoSession = {
  userId: "demo-client",
  role: "client",
  displayName: "Demo Client"
};

export const demoPartnerSession: DemoSession = {
  userId: "demo-partner-owner",
  role: "partner_owner",
  displayName: "Demo Partner",
  businessId: "partner-demo"
};

export const demoCourierSession: DemoSession = {
  userId: "demo-courier",
  role: "courier",
  displayName: "Demo Courier"
};

export const demoAdminSession: DemoSession = {
  userId: "demo-admin",
  role: "super_admin",
  displayName: "KOL Admin"
};
