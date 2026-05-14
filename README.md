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
