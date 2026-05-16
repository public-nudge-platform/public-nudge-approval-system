# 協會請款與預付請款簽核系統

Public Nudge 協會內部使用的電子簽核平台，支援一般請款（事後報銷）與預付請款兩種流程。

## 技術棧

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **ORM**: Prisma
- **Database**: PostgreSQL (Railway)
- **Auth**: NextAuth.js v5

## 本機開發

### 1. 安裝相依套件

```bash
npm install
```

### 2. 設定環境變數

```bash
cp .env.example .env
```

編輯 `.env`，填入 Railway PostgreSQL 的連線字串：

```
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="..."  # openssl rand -base64 32
```

### 3. 執行資料庫 Migration

```bash
npx prisma migrate dev --name init
```

### 4. 啟動開發伺服器

```bash
npm run dev
```

開啟 [http://localhost:3000](http://localhost:3000)

---

## 開發測試：Demo 資料重置

> **⚠️ 此指令會清空資料庫所有資料，僅限開發環境使用。**
> production 環境（`NODE_ENV=production`）執行時會直接中斷。

### 執行指令

```bash
npm run db:reset-demo
```

執行後會等待 3 秒並顯示警告，可按 `Ctrl+C` 中止。完成後資料庫將包含完整的測試情境資料。

### 測試帳號（密碼皆為 `Demo1234`）

| 角色 | Email |
|------|-------|
| 系統管理員 | `admin@example.com` |
| 理事長 | `president@example.com` |
| 創會理事長 | `founder@example.com` |
| 財務人員 | `finance@example.com` |
| 申請人 | `applicant@example.com` |

### 建立的測試情境

| 單號 | 類型 | 狀態 |
|------|------|------|
| 2026D001 | 一般請款 | 草稿 DRAFT |
| 2026D002 | 一般請款 | 待簽核 PENDING |
| 2026D003 | 一般請款 | 已抽單 WITHDRAWN |
| 2026D004 | 一般請款 | 已退回 RETURNED |
| 2026D005 | 一般請款 | 已核准 APPROVED |
| 2026D006 | 一般請款 | 已拒絕 REJECTED |
| 2026D007 | 一般請款 | 已付款 PAID |
| 2026D008 | 預付請款 | 待沖銷 PENDING_SETTLEMENT |
| 2026D009 | 預付請款 | 沖銷待確認 OFFSET_SUBMITTED |
| 2026D010 | 預付請款 | 沖銷退回補件 OFFSET_RETURNED |
| 2026D011 | 預付請款 | 已結案 CLOSED |

### 安全機制

- `NODE_ENV=production` 時拒絕執行（hard block）
- 需要 `ENABLE_DEMO_RESET=true`（由 npm script 自動設定，不會寫入 `.env`）
- 執行前顯示 3 秒警告，可按 `Ctrl+C` 中止

## 資料夾結構

```
src/
├── app/
│   ├── (auth)/          # 登入頁面（不需要 layout）
│   ├── (dashboard)/     # 需要登入的頁面
│   │   ├── requests/    # 申請單列表與新增
│   │   ├── approvals/   # 待簽核列表
│   │   └── admin/       # 管理員功能
│   └── api/             # API Routes
├── components/
│   ├── ui/              # 通用 UI 元件
│   ├── forms/           # 表單元件
│   └── layout/          # 版面元件（Sidebar、Header）
├── lib/
│   ├── prisma.ts        # Prisma client singleton
│   └── validations/     # Zod schema
├── types/               # TypeScript 型別
└── hooks/               # Custom React hooks
prisma/
└── schema.prisma        # 資料庫 Schema
```

## 主要功能（規劃中）

- [ ] 使用者登入 / 登出
- [ ] 申請單建立（請款 / 預付請款）
- [ ] 多層簽核流程
- [ ] 簽核通知
- [ ] 附件上傳
- [ ] 管理員後台（使用者管理、簽核流程設定）

## 部署

本專案部署於 Railway。
