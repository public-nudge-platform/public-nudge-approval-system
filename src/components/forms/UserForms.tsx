"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { createUser, updateUser, resetPassword } from "@/lib/actions/user";
import { USER_ROLE_LABEL } from "@/lib/constants";
import type { UserRole } from "@prisma/client";
import { X } from "lucide-react";

const ALL_ROLES = Object.keys(USER_ROLE_LABEL) as UserRole[];

const inputCls = "w-full px-3 py-2 text-sm text-gray-800 border border-slate-300 rounded-lg placeholder:text-slate-400 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500";
const labelCls = "block text-xs font-medium text-gray-600 mb-1";

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Create User ──────────────────────────────────────────────
export function CreateUserModal({ actorRole, onClose }: { actorRole: UserRole; onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const allowedRoles = actorRole === "ADMIN" ? ALL_ROLES : (["FINANCE", "DIRECTOR", "SUPERVISOR"] as UserRole[]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const result = await createUser({
        name: fd.get("name") as string,
        email: fd.get("email") as string,
        password: fd.get("password") as string,
        role: fd.get("role") as UserRole,
      });
      if (result?.error) { setError(result.error); return; }
      router.refresh();
      onClose();
    });
  }

  return (
    <Modal title="新增使用者" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className={labelCls}>姓名 *</label>
          <input name="name" required className={inputCls} placeholder="王小明" />
        </div>
        <div>
          <label className={labelCls}>Email *</label>
          <input name="email" type="email" required className={inputCls} placeholder="user@example.com" />
        </div>
        <div>
          <label className={labelCls}>密碼 * （至少 6 字元）</label>
          <input name="password" type="password" required minLength={6} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>角色 *</label>
          <select name="role" required className={`${inputCls} bg-white`}>
            {allowedRoles.map((r) => (
              <option key={r} value={r}>{USER_ROLE_LABEL[r]}</option>
            ))}
          </select>
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
        <div className="flex gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">取消</Button>
          <Button type="submit" disabled={pending} className="flex-1">{pending ? "建立中…" : "建立使用者"}</Button>
        </div>
      </form>
    </Modal>
  );
}

// ── Edit User ────────────────────────────────────────────────
type UserData = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
};

export function EditUserModal({
  user, actorRole, actorId, onClose,
}: {
  user: UserData;
  actorRole: UserRole;
  actorId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(user.isActive);

  const allowedRoles = actorRole === "ADMIN" ? ALL_ROLES : (["FINANCE", "DIRECTOR", "SUPERVISOR"] as UserRole[]);
  const isSelf = actorId === user.id;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const result = await updateUser(user.id, {
        name: fd.get("name") as string,
        email: fd.get("email") as string,
        role: fd.get("role") as UserRole,
        isActive,
      });
      if (result?.error) { setError(result.error); return; }
      router.refresh();
      onClose();
    });
  }

  return (
    <Modal title="編輯使用者" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className={labelCls}>姓名 *</label>
          <input name="name" required defaultValue={user.name} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Email *</label>
          <input name="email" type="email" required defaultValue={user.email} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>角色 *</label>
          <select name="role" required defaultValue={user.role} className={`${inputCls} bg-white`}>
            {allowedRoles.map((r) => (
              <option key={r} value={r}>{USER_ROLE_LABEL[r]}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-between py-1 border-t border-gray-100">
          <div>
            <p className="text-sm font-medium text-gray-700">帳號狀態</p>
            <p className="text-xs text-gray-400">{isActive ? "帳號啟用中" : "帳號已停用"}</p>
          </div>
          <button
            type="button"
            disabled={isSelf}
            onClick={() => setIsActive((v) => !v)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed ${isActive ? "bg-blue-600" : "bg-gray-200"}`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${isActive ? "translate-x-6" : "translate-x-1"}`} />
          </button>
        </div>
        {isSelf && <p className="text-xs text-gray-400">無法停用自己的帳號</p>}

        {error && <p className="text-xs text-red-500">{error}</p>}
        <div className="flex gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">取消</Button>
          <Button type="submit" disabled={pending} className="flex-1">{pending ? "儲存中…" : "儲存變更"}</Button>
        </div>
      </form>
    </Modal>
  );
}

// ── Reset Password ────────────────────────────────────────────
export function ResetPasswordModal({ userId, userName, onClose }: { userId: string; userName: string; onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const pw = fd.get("password") as string;
    const confirm = fd.get("confirm") as string;
    if (pw !== confirm) { setError("兩次密碼不一致"); return; }
    start(async () => {
      const result = await resetPassword(userId, pw);
      if (result?.error) { setError(result.error); return; }
      router.refresh();
      onClose();
    });
  }

  return (
    <Modal title={`重設密碼：${userName}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className={labelCls}>新密碼 * （至少 6 字元）</label>
          <input name="password" type="password" required minLength={6} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>確認密碼 *</label>
          <input name="confirm" type="password" required minLength={6} className={inputCls} />
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
        <div className="flex gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">取消</Button>
          <Button type="submit" disabled={pending} className="flex-1">{pending ? "重設中…" : "確認重設"}</Button>
        </div>
      </form>
    </Modal>
  );
}
