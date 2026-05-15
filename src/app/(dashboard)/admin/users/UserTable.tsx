"use client";

import { useState, type CSSProperties } from "react";
import { Button } from "@/components/ui/Button";
import { EditUserModal, ResetPasswordModal, CreateUserModal } from "@/components/forms/UserForms";
import { USER_ROLE_LABEL } from "@/lib/constants";
import { UserPlus, Pencil, KeyRound, ShieldOff } from "lucide-react";
import type { UserRole } from "@prisma/client";
import { clsx } from "clsx";

type User = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
};

const ROLE_BADGE_STYLE: Record<UserRole, CSSProperties> = {
  ADMIN:         { backgroundColor: "#f3e8ff", color: "#7e22ce" },
  PRESIDENT:     { backgroundColor: "#dbeafe", color: "#1d4ed8" },
  FOUNDER_AGENT: { backgroundColor: "#e0e7ff", color: "#4338ca" },
  FINANCE:       { backgroundColor: "#d1fae5", color: "#047857" },
  SECRETARY:     { backgroundColor: "#ffedd5", color: "#c2410c" },
  DIRECTOR:      { backgroundColor: "#f3f4f6", color: "#4b5563" },
  SUPERVISOR:    { backgroundColor: "#ccfbf1", color: "#0f766e" },
  APPLICANT:     { backgroundColor: "#fef9c3", color: "#854d0e" },
};

function canEdit(actorRole: UserRole, targetRole: UserRole) {
  if (actorRole === "ADMIN") return true;
  if (["PRESIDENT", "FOUNDER_AGENT"].includes(actorRole)) {
    return ["FINANCE", "DIRECTOR", "SUPERVISOR"].includes(targetRole);
  }
  return false;
}

export function UserTable({ users, actorRole, actorId }: { users: User[]; actorRole: UserRole; actorId: string }) {
  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [resetUser, setResetUser] = useState<User | null>(null);

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-gray-400">共 {users.length} 位使用者</p>
        <Button onClick={() => setShowCreate(true)} size="sm">
          <UserPlus size={14} />
          新增使用者
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500">姓名</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Email</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">角色</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">狀態</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">建立日期</th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map((user) => {
              const editable = canEdit(actorRole, user.role);
              return (
                <tr key={user.id} className={clsx("transition-colors", user.isActive ? "hover:bg-gray-50/80" : "bg-gray-50/50 opacity-60")}>
                  <td className="px-5 py-3">
                    <div>
                      <p className="font-medium text-gray-900">{user.name}</p>
                      {!user.isActive && (
                        <p className="text-xs text-red-400 flex items-center gap-0.5">
                          <ShieldOff size={10} />已停用
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{user.email}</td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                      style={ROLE_BADGE_STYLE[user.role]}
                    >
                      {USER_ROLE_LABEL[user.role]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={clsx("px-2 py-0.5 rounded-full text-xs font-medium", user.isActive ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600")}>
                      {user.isActive ? "啟用" : "停用"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {user.createdAt.toLocaleDateString("zh-TW")}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button
                        disabled={!editable}
                        onClick={() => setEditUser(user)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
                        title="編輯"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        disabled={!editable}
                        onClick={() => setResetUser(user)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
                        title="重設密碼"
                      >
                        <KeyRound size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <CreateUserModal actorRole={actorRole} onClose={() => setShowCreate(false)} />
      )}
      {editUser && (
        <EditUserModal user={editUser} actorRole={actorRole} actorId={actorId} onClose={() => setEditUser(null)} />
      )}
      {resetUser && (
        <ResetPasswordModal userId={resetUser.id} userName={resetUser.name} onClose={() => setResetUser(null)} />
      )}
    </>
  );
}
