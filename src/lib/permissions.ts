import type { AdminRank, HouseRole, HouseScoreVisibility, HouseMasterToggle, LeaderboardVisibility, UserType } from "@/lib/types";

/**
 * Mô tả tối thiểu của một actor (người đang thao tác) và target (đối tượng)
 * để quyết định hiển thị nút quản trị trên UI.
 *
 * QUAN TRỌNG: đây chỉ là lớp ẩn/hiện UI. Nguồn chân lý thực sự là RLS + các
 * RPC SECURITY DEFINER ở DB (can_manage_admin, admin_set_role, mute_user...).
 * Không bao giờ tin tưởng lớp này cho bảo mật.
 */
export interface ActorContext {
  id: string;
  userType: UserType;
  adminRank: AdminRank | null;
  departmentId: string | null;
}

export interface TargetContext {
  id: string;
  userType: UserType;
  adminRank: AdminRank | null;
  departmentId: string | null;
}

export interface HouseLeaderContext {
  id: string;
  userType: UserType;
  houseRole: HouseRole | null;
  houseId: string | null;
}

export function isGlobalDirector(actor: ActorContext): boolean {
  return actor.userType === "admin" && actor.adminRank === "global_director";
}

export function isDirector(actor: ActorContext): boolean {
  return actor.userType === "admin" && actor.adminRank === "director";
}

export function isAdmin(actor: ActorContext): boolean {
  return actor.userType === "admin";
}

export function isHouseMaster(ctx: HouseLeaderContext): boolean {
  return ctx.userType === "player" && ctx.houseRole === "master";
}

export function isHouseLeader(ctx: HouseLeaderContext): boolean {
  return ctx.userType === "player" && (ctx.houseRole === "master" || ctx.houseRole === "vice");
}

/**
 * Phản chiếu logic can_manage_admin() ở DB (supabase/rbac.sql):
 *  - Global Director: quản lý được tất cả (trừ chính mình)
 *  - Director: quản lý player + member cùng department
 *  - Member: chỉ quản lý player
 *  - Không ai tự quản lý bản thân
 */
export function canManage(actor: ActorContext, target: TargetContext): boolean {
  if (actor.id === target.id) return false;
  if (actor.userType !== "admin") return false;

  if (actor.adminRank === "global_director") return true;

  if (actor.adminRank === "director") {
    if (target.userType === "player") return true;
    return target.adminRank === "member" && target.departmentId === actor.departmentId;
  }

  if (actor.adminRank === "member") {
    return target.userType === "player";
  }

  return false;
}

/** Có được phép đổi role / phong admin không (chỉ Global Director). */
export function canSetRoles(actor: ActorContext): boolean {
  return isGlobalDirector(actor);
}

/** Có được phép đổi tên chức danh department không (chỉ Global Director). */
export function canRenameDepartments(actor: ActorContext): boolean {
  return isGlobalDirector(actor);
}

/** Có được phép mute/unmute target không (cùng luật can_manage). */
export function canMute(actor: ActorContext, target: TargetContext): boolean {
  if (actor.id === target.id) return false;
  if (actor.userType !== "admin") return false;

  if (actor.adminRank === "global_director") return true;

  if (actor.adminRank === "director") {
    if (target.userType === "player") return true;
    return target.adminRank === "member" && target.departmentId === actor.departmentId;
  }

  if (actor.adminRank === "member") {
    return target.userType === "player";
  }

  return false;
}

/** House Master được phép toggle hiển thị điểm house (nếu admin chưa cấm). */
export function canToggleHouseScore(
  leader: HouseLeaderContext,
  houseMasterToggle: HouseMasterToggle | undefined
): boolean {
  if (!isHouseMaster(leader)) return false;
  return houseMasterToggle !== "blocked";
}

/** Admin được phép cấm/cho phép House Master toggle điểm. */
export function canAdminBlockMasterScoreToggle(actor: ActorContext): boolean {
  return isAdmin(actor);
}

/** Admin được phép cấm đích danh House Master xem điểm. */
export function canAdminBlockMasterScoreView(actor: ActorContext): boolean {
  return isAdmin(actor);
}

/** Admin được phép đổi leaderboard visibility. */
export function canSetLeaderboardVisibility(actor: ActorContext): boolean {
  return isAdmin(actor);
}

/**
 * Quyết định hiển thị điểm house cho viewer.
 * Phản chiếu can_view_house_score() ở DB.
 */
export function canViewHouseScore(
  viewer: HouseLeaderContext,
  houseId: string,
  scoreVisibility: HouseScoreVisibility | undefined,
  isMasterBlocked: boolean
): boolean {
  // Người ngoài house luôn xem được
  if (viewer.houseId !== houseId) return true;
  // House Master của house đó: nếu bị block thì không
  if (isHouseMaster(viewer) && viewer.houseId === houseId && isMasterBlocked) return false;
  // Thành viên house: tuỳ score_visibility
  if (viewer.houseId === houseId) {
    return scoreVisibility !== "hidden";
  }
  return true;
}

/**
 * Quyết định hiển thị leaderboard chung.
 * Phản chiếu can_view_leaderboard() ở DB.
 */
export function canViewLeaderboard(
  actor: ActorContext,
  leader: HouseLeaderContext,
  visibility: LeaderboardVisibility
): boolean {
  if (isAdmin(actor)) return true;
  if (visibility === "public") return true;
  if (visibility === "masters_only") return isHouseMaster(leader);
  return false;
}
