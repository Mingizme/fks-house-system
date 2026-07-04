export type UserType = "player" | "admin";
export type AdminRole = "director" | "admin" | "judge" | "security" | "linguistic";
export type HouseSlug = "arctic-wolves" | "inferno-phoenix" | "noble-lions" | "ironclad-rhinos";

export interface House {
  id: string;
  name: string;
  slug: HouseSlug;
  color: string; // key into house.* tailwind colors: wolves | phoenix | lions | rhinos
  icon: string;
  description: string | null;
  created_at: string;
}

export interface HousePoints extends House {
  total_points: number;
  house_id: string;
}

export interface Profile {
  id: string;
  email: string | null;
  username: string;
  display_name: string;
  user_type: UserType;
  admin_role: AdminRole | null;
  house_id: string | null;
  avatar_emoji: string | null;
  avatar_url: string | null;
  bio: string | null;
  display_name_changed_at: string | null;
  created_at: string;
}

export interface PointTransaction {
  id: string;
  house_id: string;
  admin_id: string;
  points: number;
  reason: string;
  created_at: string;
  admin?: Pick<Profile, "id" | "display_name" | "admin_role">;
  house?: Pick<House, "id" | "name" | "slug" | "color" | "icon">;
}

export interface Announcement {
  id: string;
  admin_id: string;
  title: string;
  content: string;
  created_at: string;
  admin?: Pick<Profile, "display_name" | "admin_role">;
}

export interface DirectMessage {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  is_admin_chat: boolean;
  created_at: string;
  read_at: string | null;
}

export interface HouseMessage {
  id: string;
  house_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  sender?: Pick<Profile, "display_name" | "avatar_emoji" | "avatar_url" | "user_type" | "admin_role">;
}

export interface AdminMessage {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  sender?: Pick<Profile, "display_name" | "avatar_emoji" | "avatar_url" | "user_type" | "admin_role">;
}

export const ADMIN_ROLE_LABELS: Record<AdminRole, string> = {
  director: "Director",
  admin: "Admin",
  judge: "Judge",
  security: "Security",
  linguistic: "Linguistic",
};

export const HOUSE_LABELS: Record<HouseSlug, string> = {
  "arctic-wolves": "Arctic Wolves",
  "inferno-phoenix": "Inferno Phoenix",
  "noble-lions": "Noble Lions",
  "ironclad-rhinos": "Ironclad Rhinos",
};
