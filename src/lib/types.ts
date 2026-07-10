export type UserType = "player" | "admin";
export type AdminRole = "director" | "admin" | "judge" | "security" | "linguistic";
export type AdminRank = "global_director" | "director" | "member";
export type HouseRole = "master" | "vice";
export type HouseSlug = "arctic-wolves" | "inferno-phoenix" | "noble-lions" | "ironclad-rhinos";

export interface Department {
  id: string;
  key: string;
  name: string;
  director_title: string;
  member_title: string;
  sort_order: number;
  created_at: string;
}

export type HouseScoreVisibility = "visible" | "hidden";
export type HouseMasterToggle = "allowed" | "blocked";
export type LeaderboardVisibility = "public" | "masters_only" | "admin_only";

export interface House {
  id: string;
  name: string;
  slug: HouseSlug;
  color: string; // key into house.* tailwind colors: wolves | phoenix | lions | rhinos
  icon: string;
  description: string | null;
  created_at: string;
  score_visibility?: HouseScoreVisibility;
  master_can_toggle_score?: HouseMasterToggle;
}

export interface HousePoints extends House {
  total_points: number | null;
  house_id: string;
  can_view_score?: boolean;
}

export interface SystemSettings {
  id: number;
  leaderboard_visibility: LeaderboardVisibility;
  updated_at: string;
}

export interface HouseMasterScoreBlock {
  id: string;
  house_id: string;
  master_id: string;
  blocked_by: string | null;
  created_at: string;
  master?: Pick<Profile, "display_name" | "avatar_emoji" | "username">;
  blocked_by_admin?: Pick<Profile, "display_name">;
}

export interface MuteStatus {
  muted_until: string | null;
  muted_by: string | null;
  mute_reason: string | null;
  muted_by_name: string | null;
  chat_banned_at?: string | null;
  chat_banned_by?: string | null;
  chat_ban_reason?: string | null;
  chat_banned_by_name?: string | null;
  account_banned_at?: string | null;
  account_banned_by?: string | null;
  account_ban_reason?: string | null;
  account_banned_by_name?: string | null;
}

export interface AdminWithDepartment extends Profile {
  department?: Department | null;
}

export interface AdminDirectoryEntry {
  id: string;
  display_name: string;
  username: string;
  avatar_emoji: string | null;
  avatar_url: string | null;
  bio: string | null;
  user_type: UserType;
  admin_role: AdminRole | null;
  admin_rank: AdminRank | null;
  department_id: string | null;
  department?: Department | null;
  house_id: string | null;
  house_role: HouseRole | null;
  created_at: string;
}

export interface Profile {
  id: string;
  email: string | null;
  username: string;
  display_name: string;
  user_type: UserType;
  admin_role: AdminRole | null;
  admin_rank: AdminRank | null;
  department_id: string | null;
  house_role: HouseRole | null;
  house_id: string | null;
  avatar_emoji: string | null;
  avatar_url: string | null;
  bio: string | null;
  muted_until: string | null;
  muted_by: string | null;
  mute_reason: string | null;
  chat_banned_at: string | null;
  chat_banned_by: string | null;
  chat_ban_reason: string | null;
  account_banned_at: string | null;
  account_banned_by: string | null;
  account_ban_reason: string | null;
  last_seen_ip: string | null;
  last_seen_at: string | null;
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

export interface HouseAnnouncement {
  id: string;
  house_id: string;
  author_id: string;
  title: string;
  content: string;
  created_at: string;
  author?: Pick<Profile, "display_name" | "avatar_emoji" | "house_role">;
}

export interface DirectMessage {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  is_admin_chat: boolean;
  created_at: string;
  read_at: string | null;
  edited_at: string | null;
  deleted_at: string | null;
  reply_to_id: string | null;
  media_url: string | null;
  media_type: 'image' | 'video' | null;
}

export interface HouseMessage {
  id: string;
  house_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
  reply_to_id: string | null;
  media_url: string | null;
  media_type: 'image' | 'video' | null;
  sender?: Pick<Profile, "display_name" | "avatar_emoji" | "avatar_url" | "user_type" | "admin_role" | "house_role">;
}

export interface AdminMessage {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
  reply_to_id: string | null;
  media_url: string | null;
  media_type: 'image' | 'video' | null;
  sender?: Pick<Profile, "display_name" | "avatar_emoji" | "avatar_url" | "user_type" | "admin_role">;
}

export interface MessageReaction {
  id: string;
  user_id: string;
  emoji: string;
  message_type: 'dm' | 'house' | 'admin';
  message_id: string;
  created_at: string;
  user?: Pick<Profile, 'display_name'>;
}

export const ADMIN_ROLE_LABELS: Record<AdminRole, string> = {
  director: "Director",
  admin: "Admin",
  judge: "Judge",
  security: "Security",
  linguistic: "Linguistic",
};

export const ADMIN_RANK_LABELS: Record<AdminRank, string> = {
  global_director: "Global Director",
  director: "Director",
  member: "Member",
};

/**
 * Tiêu đề chức danh hiển thị của một admin, dựa trên rank + department.
 * - global_director: luôn là "Global Director" (cấp tối cao toàn hệ thống)
 * - director: dùng department.director_title (đổi tên được, vd "Commanding Chief")
 * - member: dùng department.member_title
 */
export function departmentTitle(
  rank: AdminRank | null,
  dept: Pick<Department, "director_title" | "member_title"> | null
): string {
  if (rank === "global_director") return ADMIN_RANK_LABELS.global_director;
  if (!dept) return rank ? ADMIN_RANK_LABELS[rank] : "";
  if (rank === "director") return dept.director_title;
  if (rank === "member") return dept.member_title;
  return "";
}

export const HOUSE_ROLE_LABELS: Record<HouseRole, string> = {
  master: "House Master",
  vice: "Vice Master",
};

export const HOUSE_LABELS: Record<HouseSlug, string> = {
  "arctic-wolves": "Arctic Wolves",
  "inferno-phoenix": "Inferno Phoenix",
  "noble-lions": "Noble Lions",
  "ironclad-rhinos": "Ironclad Rhinos",
};
