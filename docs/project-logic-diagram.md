# 專案邏輯 Diagram

本文件依據目前專案的 Prisma schema、server actions、API routes、dashboard pages 與 shared libs 整理。除資料模型關係圖外，所有流程圖都包含菱形判斷節點，方便看出實際行為分支。

## 1. 登入與路由保護

```mermaid
flowchart TD
  Start([使用者進入系統]) --> Route{"是否進入公開頁 /login?"}
  Route -->|是| HasSessionLogin{"已登入?"}
  HasSessionLogin -->|是| RedirectDashboard["導向 /dashboard"]
  HasSessionLogin -->|否| LoginPage["顯示登入頁"]

  Route -->|否| HasSession{"已有有效 session?"}
  HasSession -->|否| RedirectLogin["導向 /login"]
  HasSession -->|是| DashboardLayout["進入 dashboard layout"]

  LoginPage --> SubmitLogin["提交 email / password"]
  SubmitLogin --> ValidInput{"email 與 password 格式正確?"}
  ValidInput -->|否| LoginFail["登入失敗"]
  ValidInput -->|是| FindUser["查詢 User by email"]
  FindUser --> UserFound{"使用者存在且 isActive?"}
  UserFound -->|否| LoginFail
  UserFound -->|是| PasswordOK{"bcrypt 密碼比對成功?"}
  PasswordOK -->|否| LoginFail
  PasswordOK -->|是| CreateJWT["建立 JWT: user.id + role"]
  CreateJWT --> Audit["寫入 USER_LOGIN AuditLog"]
  Audit --> RedirectDashboard

  DashboardLayout --> CountUnread["計算未讀通知數"]
  CountUnread --> AppShell["渲染 AppShell / Sidebar / Header"]
  AppShell --> RoleMenu{"依角色顯示選單?"}
  RoleMenu --> Views["Dashboard / Requests / Approvals / Finance / Admin 等頁面"]
```

## 2. 請款主流程

```mermaid
flowchart TD
  Start([建立或編輯請款]) --> LoggedIn{"已登入?"}
  LoggedIn -->|否| NotLogin["回傳未登入"]
  LoggedIn -->|是| Validate{"表單資料有效?"}
  Validate -->|否| ValidationError["回傳欄位錯誤"]
  Validate -->|是| HasItems{"至少一個品項且金額大於 0?"}
  HasItems -->|否| AmountError["回傳品項或金額錯誤"]
  HasItems -->|是| SubmitNow{"是否立即送出?"}

  SubmitNow -->|否| SaveDraft["建立或更新為 DRAFT"]
  SaveDraft --> AuditDraft["寫入 REQUEST_CREATED 或 REQUEST_UPDATED"]
  AuditDraft --> Revalidate["revalidate requests / dashboard"]

  SubmitNow -->|是| NeedNumber{"是否已有流水號?"}
  NeedNumber -->|否| GenerateNumber["產生 YYYYMM### 流水號"]
  NeedNumber -->|是| UseNumber["沿用既有流水號"]
  GenerateNumber --> ReturnSource{"是否為 RETURNED 重送?"}
  UseNumber --> ReturnSource

  ReturnSource -->|否| CreateApprovalStep["建立理事長審核 ApprovalStep"]
  ReturnSource -->|由簽核者退回| CreateApprovalStep
  ReturnSource -->|由財務退回| BackToApproved["狀態回到 APPROVED 待付款"]

  CreateApprovalStep --> SetPending["狀態設為 PENDING"]
  SetPending --> NotifyApprover["通知 PRESIDENT / FOUNDER_AGENT"]
  BackToApproved --> NotifyFinance["通知 FINANCE 繼續付款"]

  NotifyApprover --> AuditSubmit["寫入 REQUEST_SUBMITTED"]
  NotifyFinance --> AuditSubmit
  AuditSubmit --> Revalidate
```

## 3. 請款簽核與狀態分支

```mermaid
flowchart TD
  Start([打開請款詳情]) --> RoleCheck{"角色可簽核?"}
  RoleCheck -->|否| NoPermission["回傳無簽核權限"]
  RoleCheck -->|是| StatusCheck{"請款狀態是 PENDING?"}
  StatusCheck -->|否| WrongStatus["回傳非待簽核狀態"]
  StatusCheck -->|是| StepOpen{"簽核步驟尚未處理?"}
  StepOpen -->|否| AlreadyHandled["回傳此步驟已處理"]
  StepOpen -->|是| Action{"簽核動作?"}

  Action -->|APPROVED| Approved["狀態改為 APPROVED"]
  Action -->|RETURNED| Returned["狀態改為 RETURNED"]
  Action -->|REJECTED| Rejected["狀態改為 REJECTED"]

  Approved --> NotifyApplicantPaid["通知申請人已核准"]
  Approved --> NotifyFinancePay["通知財務待付款"]
  Approved --> NotifyPeerDone["通知其他簽核者不用處理"]

  Returned --> NotifyApplicantReturn["通知申請人修改後重送"]
  Returned --> NotifyPeerReturn["通知其他簽核者已退回"]

  Rejected --> NotifyApplicantReject["通知申請人已拒絕"]
  Rejected --> NotifyPeerReject["通知其他簽核者已拒絕"]

  NotifyApplicantPaid --> Audit["寫入簽核 AuditLog"]
  NotifyApplicantReturn --> Audit
  NotifyApplicantReject --> Audit
  NotifyFinancePay --> Audit
  NotifyPeerDone --> Audit
  NotifyPeerReturn --> Audit
  NotifyPeerReject --> Audit
  Audit --> Revalidate["revalidate requests / approvals / dashboard"]
```

## 4. 抽單、財務退回與付款

```mermaid
flowchart TD
  Start([請款詳情操作]) --> Operation{"使用者動作?"}

  Operation -->|抽單| WithdrawOwner{"是原申請人?"}
  WithdrawOwner -->|否| WithdrawDenied["回傳只有原申請人可抽單"]
  WithdrawOwner -->|是| WithdrawPending{"狀態是 PENDING?"}
  WithdrawPending -->|否| WithdrawWrongStatus["回傳只有待簽核可抽單"]
  WithdrawPending -->|是| HasRecord{"已有簽核紀錄?"}
  HasRecord -->|是| CannotWithdraw["回傳已有簽核紀錄無法抽單"]
  HasRecord -->|否| SetWithdrawn["刪除空簽核步驟並改為 WITHDRAWN"]

  Operation -->|財務退回| FinanceRole{"FINANCE 或 ADMIN?"}
  FinanceRole -->|否| FinanceDenied["回傳無財務權限"]
  FinanceRole -->|是| ApprovedStatus{"狀態是 APPROVED 且未付款?"}
  ApprovedStatus -->|否| FinanceReturnDenied["回傳不可退回"]
  ApprovedStatus -->|是| AddFinanceReturnStep["建立財務退回修改步驟與 RETURNED record"]
  AddFinanceReturnStep --> SetReturned["狀態改為 RETURNED"]

  Operation -->|標記付款| PayRole{"FINANCE 或 ADMIN?"}
  PayRole -->|否| PayDenied["回傳無財務權限"]
  PayRole -->|是| CanPay{"狀態是 APPROVED?"}
  CanPay -->|否| PayWrongStatus["回傳只能標記已核准請款"]
  CanPay -->|是| RequestType{"請款類型?"}
  RequestType -->|REIMBURSEMENT| SetPaid["狀態改為 PAID"]
  RequestType -->|PREPAID| SetSettlement["狀態改為 PENDING_SETTLEMENT"]
  SetPaid --> HasAccount{"有選資金帳戶?"}
  SetSettlement --> HasAccount
  HasAccount -->|是| CreateTxn["自動建立 AccountTransaction EXPENSE"]
  HasAccount -->|否| SkipTxn["不建立帳戶交易"]

  SetWithdrawn --> Notify["通知相關角色"]
  SetReturned --> Notify
  CreateTxn --> Notify
  SkipTxn --> Notify
  Notify --> Audit["寫入 AuditLog"]
  Audit --> Revalidate["revalidate requests / finance / dashboard / accounts"]
```

## 5. 預付請款沖銷

```mermaid
flowchart TD
  Start([申請人或審核者操作沖銷]) --> Operation{"使用者動作?"}

  Operation -->|送出沖銷| Owner{"是原申請人?"}
  Owner -->|否| OwnerDenied["找不到可操作請款或無權限"]
  Owner -->|是| Prepaid{"請款類型是 PREPAID?"}
  Prepaid -->|否| NotPrepaid["回傳只有預付請款需要沖銷"]
  Prepaid -->|是| OffsetStatus{"狀態是 PENDING_SETTLEMENT 或 OFFSET_RETURNED?"}
  OffsetStatus -->|否| OffsetWrongStatus["回傳狀態不可送沖銷"]
  OffsetStatus -->|是| ActualOK{"actualAmount 大於 0 且格式正確?"}
  ActualOK -->|否| ActualError["回傳實際支出金額錯誤"]
  ActualOK -->|是| SetSubmitted["狀態改為 OFFSET_SUBMITTED"]

  Operation -->|審核沖銷| ReviewRole{"FINANCE / PRESIDENT / FOUNDER_AGENT / ADMIN?"}
  ReviewRole -->|否| ReviewDenied["回傳無沖銷審核權限"]
  ReviewRole -->|是| Reviewable{"類型 PREPAID 且狀態 OFFSET_SUBMITTED?"}
  Reviewable -->|否| ReviewWrongStatus["回傳不可審核"]
  Reviewable -->|是| ReviewAction{"審核結果?"}
  ReviewAction -->|APPROVED| Close["狀態改為 CLOSED"]
  ReviewAction -->|RETURNED| OffsetReturned["狀態改為 OFFSET_RETURNED"]

  SetSubmitted --> NotifyReviewers["通知 FINANCE / PRESIDENT / FOUNDER_AGENT"]
  Close --> NotifyClosed["通知申請人與其他審核者已結案"]
  OffsetReturned --> NotifyReturned["通知申請人補件"]
  NotifyReviewers --> Audit["寫入沖銷 AuditLog"]
  NotifyClosed --> Audit
  NotifyReturned --> Audit
  Audit --> Revalidate["revalidate requests / finance / dashboard"]
```

## 6. 附件上傳與讀取

```mermaid
flowchart TD
  Start([上傳或讀取附件]) --> Action{"動作?"}

  Action -->|POST /api/upload| Login{"已登入?"}
  Login -->|否| Upload401["回傳 401"]
  Login -->|是| HasFile{"有 file 與 requestId?"}
  HasFile -->|否| Upload400["回傳缺少參數"]
  HasFile -->|是| SizeOK{"檔案小於 10MB?"}
  SizeOK -->|否| TooLarge["回傳檔案過大"]
  SizeOK -->|是| TypeOK{"檔案是圖片或 PDF?"}
  TypeOK -->|否| BadType["回傳格式不支援"]
  TypeOK -->|是| UploadType{"附件種類?"}

  UploadType -->|付款附件| PaymentRole{"FINANCE 或 ADMIN?"}
  PaymentRole -->|否| UploadDenied["回傳無上傳權限"]
  PaymentRole -->|是| PaymentStatus{"請款狀態 APPROVED?"}
  PaymentStatus -->|否| UploadWrongStatus["回傳此狀態不可上傳"]
  PaymentStatus -->|是| SaveAttachment["Attachment 寫入 DB bytes"]

  UploadType -->|一般附件| OwnerOrAdmin{"申請人本人或 ADMIN?"}
  OwnerOrAdmin -->|否| UploadDenied
  OwnerOrAdmin -->|是| EditableStatus{"狀態 DRAFT / WITHDRAWN / RETURNED?"}
  EditableStatus -->|否| UploadWrongStatus
  EditableStatus -->|是| SaveAttachment

  UploadType -->|沖銷附件| OffsetAttachStatus{"狀態 PENDING_SETTLEMENT / OFFSET_RETURNED?"}
  OffsetAttachStatus -->|否| UploadWrongStatus
  OffsetAttachStatus -->|是| SaveAttachment

  SaveAttachment --> FileUrl["產生 /api/files/id URL"]
  FileUrl --> AuditUpload["寫入 ATTACHMENT_UPLOADED"]

  Action -->|GET /api/files/id| ReadLogin{"已登入?"}
  ReadLogin -->|否| Read401["回傳 Unauthorized"]
  ReadLogin -->|是| Found{"附件存在且有 data?"}
  Found -->|否| Read404["回傳 Not Found"]
  Found -->|是| FinanceView{"FINANCE_ROLES 或 ADMIN?"}
  FinanceView -->|是| ReturnFile["回傳檔案 bytes"]
  FinanceView -->|否| FileOwner{"是原申請人?"}
  FileOwner -->|否| Read403["回傳 Forbidden"]
  FileOwner -->|是| ReturnFile
```

## 7. 通知、推播與稽核副作用

```mermaid
flowchart TD
  Action([核心 server action 或 API 完成]) --> NeedAudit{"需要稽核?"}
  NeedAudit -->|是| Headers["讀取 ip 與 user-agent"]
  NeedAudit -->|否| SkipAudit["略過稽核"]
  Headers --> AuditOK{"AuditLog 寫入成功?"}
  AuditOK -->|是| AuditDone["稽核完成"]
  AuditOK -->|否| AuditIgnored["稽核失敗但不阻斷主流程"]

  Action --> NeedNotification{"需要通知?"}
  NeedNotification -->|否| NoNotify["略過通知"]
  NeedNotification -->|是| TargetType{"通知目標?"}
  TargetType -->|指定 userIds| CreateForUsers["建立 Notification records"]
  TargetType -->|指定 roles| FindUsers["查詢 active users by role"]
  TargetType -->|指定 roles 且排除操作者| FindUsersExcept["查詢 active users by role 並排除 userIds"]
  FindUsers --> CreateForUsers
  FindUsersExcept --> CreateForUsers

  CreateForUsers --> PushEnabled{"VAPID 是否設定?"}
  PushEnabled -->|否| NotifyDone["只保留站內通知"]
  PushEnabled -->|是| HasSub{"使用者有 PushSubscription?"}
  HasSub -->|否| NotifyDone
  HasSub -->|是| SendPush["送 Web Push"]
  SendPush --> Gone410{"endpoint 回傳 410?"}
  Gone410 -->|是| DeleteSub["刪除失效訂閱"]
  Gone410 -->|否| NotifyDone
  DeleteSub --> NotifyDone
```

## 8. 資金帳戶與手動交易

```mermaid
flowchart TD
  Start([進入資金帳戶功能]) --> Action{"動作?"}

  Action -->|查看帳戶列表| CanView{"ADMIN / PRESIDENT / FOUNDER_AGENT / FINANCE?"}
  CanView -->|否| Empty["回傳空資料或導回 dashboard"]
  CanView -->|是| LoadAccounts["查詢啟用 FinancialAccount 與 transactions"]
  LoadAccounts --> Balance["餘額 = initialBalance + income - expense"]
  Balance --> AccountCards["顯示帳戶卡與本月收入支出"]

  Action -->|查看帳戶明細| DetailView{"有檢視權限?"}
  DetailView -->|否| DetailNull["回傳 null 或導回 dashboard"]
  DetailView -->|是| ApplyFilters["套用日期、類型、專案、關鍵字篩選"]
  ApplyFilters --> LoadTx["查詢 AccountTransaction 明細"]
  LoadTx --> DetailPage["顯示交易列表與餘額"]

  Action -->|新增交易| CanWrite{"ADMIN 或 FINANCE?"}
  CanWrite -->|否| WriteDenied["回傳無資金管理權限"]
  CanWrite -->|是| InputOK{"摘要、金額、日期有效?"}
  InputOK -->|否| InputError["回傳欄位錯誤"]
  InputOK -->|是| AccountExists{"帳戶存在且啟用?"}
  AccountExists -->|否| AccountError["回傳找不到帳戶"]
  AccountExists -->|是| CreateTx["建立 AccountTransaction"]
  CreateTx --> AuditTx["寫入 TRANSACTION_CREATED AuditLog"]
  AuditTx --> Revalidate["revalidate financial-accounts / dashboard"]

  Action -->|更新帳戶資訊| AdminOnly{"角色是 ADMIN?"}
  AdminOnly -->|否| AdminDenied["回傳需要管理員權限"]
  AdminOnly -->|是| UpdateAccount["更新後五碼、初始餘額、備註"]
  UpdateAccount --> AuditAccount["寫入 FINANCIAL_ACCOUNT_UPDATED"]
```

## 9. 付款調整

```mermaid
flowchart TD
  Start([付款調整操作]) --> Role{"FINANCE 或 ADMIN?"}
  Role -->|否| Denied["回傳無操作權限"]
  Role -->|是| Action{"動作?"}

  Action -->|新增| RequestFound{"找得到請款單?"}
  RequestFound -->|否| NotFound["回傳找不到請款單"]
  RequestFound -->|是| AllowedStatus{"狀態是 PAID / PENDING_SETTLEMENT / OFFSET_SUBMITTED / OFFSET_RETURNED / CLOSED?"}
  AllowedStatus -->|否| StatusDenied["回傳此狀態不允許新增調整"]
  AllowedStatus -->|是| AmountOK{"金額大於 0?"}
  AmountOK -->|否| AmountError["回傳金額錯誤"]
  AmountOK -->|是| CreateAdjustment["建立 PaymentAdjustment"]
  CreateAdjustment --> NotifyAdjustment["通知 PRESIDENT / FOUNDER_AGENT 與申請人"]

  Action -->|編輯| AdjustmentFound{"找得到付款調整?"}
  AdjustmentFound -->|否| AdjNotFound["回傳找不到紀錄"]
  AdjustmentFound -->|是| UpdateAdjustment["更新 type / amount / subject / date / note"]

  Action -->|刪除| DeleteFound{"找得到付款調整?"}
  DeleteFound -->|否| AdjNotFound
  DeleteFound -->|是| DeleteAdjustment["刪除 PaymentAdjustment"]

  NotifyAdjustment --> Audit["寫入 PAYMENT_ADJUSTMENT AuditLog"]
  UpdateAdjustment --> Audit
  DeleteAdjustment --> Audit
  Audit --> Revalidate["revalidate request detail / finance"]
```

## 10. 專案收支表流程

```mermaid
flowchart TD
  User["財務或管理角色"] --> Page["/reports 財務報表頁"]
  Page --> Params["選擇期間與專案"]
  Params --> API["GET /api/export/reports/income-expense"]
  API --> Auth["檢查登入與 FINANCE_ROLES"]
  Auth --> AuthOK{"有匯出權限?"}
  AuthOK -->|否| AuthReject["回傳 401 / 403"]
  AuthOK -->|是| PeriodOK{"有提供月份或日期區間?"}
  PeriodOK -->|否| PeriodReject["回傳 400 請提供查詢期間"]
  PeriodOK -->|是| Parse["parsePeriodParams 解析期間"]

  Parse --> HasProject{"是否指定專案?"}
  HasProject -->|是| ProjectFilter["查詢條件加入 projectId"]
  HasProject -->|否| AllProjects["查詢全部專案"]
  ProjectFilter --> Query["查詢 AccountTransaction"]
  AllProjects --> Query

  Query --> DateFilter["transactionDate 在期間內"]
  DateFilter --> JoinSubject["讀取 AccountingSubject code 與 name"]
  JoinSubject --> EachTx{"逐筆交易判斷"}

  EachTx --> IncomeCheck{"INCOME 且科目 code 以 4 開頭?"}
  IncomeCheck -->|是| IncomeMap["依科目代號加總收入"]
  IncomeCheck -->|否| ExpenseCheck{"EXPENSE 且科目 code 以 5 開頭?"}
  ExpenseCheck -->|是| ExpenseMap["依科目代號加總支出"]
  ExpenseCheck -->|否| Skip["略過不屬於收支表的交易"]

  IncomeMap --> MoreTx{"還有交易?"}
  ExpenseMap --> MoreTx
  Skip --> MoreTx
  MoreTx -->|是| EachTx
  MoreTx -->|否| Group["支出依代號分組"]

  Group --> IncomeTotal["收入合計"]
  Group --> ExpenseTotal["支出合計"]
  IncomeTotal --> Net["本期餘絀 = 收入合計 - 支出合計"]
  ExpenseTotal --> Net

  Net --> Workbook["ExcelJS 建立專案收支表"]
  Workbook --> Sheet["收入區、支出分組、百分比、本期餘絀"]
  Sheet --> Audit["寫入 DATA_EXPORTED AuditLog"]
  Audit --> Download["回傳 xlsx 下載"]
```

## 11. 資產負債表流程

```mermaid
flowchart TD
  User["財務或管理角色"] --> Page["/reports 財務報表頁"]
  Page --> Params["選擇截至日期 asOf"]
  Params --> API["GET /api/export/reports/balance-sheet"]
  API --> Auth["檢查登入與 FINANCE_ROLES"]
  Auth --> AuthOK{"有匯出權限?"}
  AuthOK -->|否| AuthReject["回傳 401 / 403"]
  AuthOK -->|是| HasAsOf{"有提供 asOf?"}
  HasAsOf -->|否| AsOfReject["回傳 400 請提供截至日期"]
  HasAsOf -->|是| DateOK{"日期格式正確?"}
  DateOK -->|否| DateReject["回傳 400 日期格式錯誤"]
  DateOK -->|是| AsOf["解析 asOf 到當日 23:59:59"]
  AsOf --> Generate["generateBalanceSheet"]

  Generate --> Cash["現金與銀行帳戶"]
  Cash --> Accounts["查詢啟用的 FinancialAccount"]
  Accounts --> TxBefore["納入 asOf 前 AccountTransaction"]
  TxBefore --> Balance["帳戶餘額 = initialBalance + income - expense"]
  Balance --> CashTotal["現金合計"]

  Generate --> Receivable["應收款項 1230"]
  Receivable --> ARTx["查詢科目 1230 交易"]
  ARTx --> ARPositive{"計算結果大於 0?"}
  ARPositive -->|是| ARTotal["使用計算結果"]
  ARPositive -->|否| ARZero["應收款項設為 0"]
  ARZero --> Assets

  Generate --> Prepaid["預付款項 1250"]
  Prepaid --> PrepaidReq["查詢 PREPAID 且已付款未結案請款"]
  PrepaidReq --> HasActual{"有 actualAmount?"}
  HasActual -->|是| UseActual["使用 actualAmount"]
  HasActual -->|否| UseAmount["使用原請款 amount"]
  UseActual --> PrepaidTotal["加總預付款項"]
  UseAmount --> PrepaidTotal

  Generate --> Payable["應付款項 2130"]
  Payable --> ApprovedReq["查詢 APPROVED 未付款請款"]
  ApprovedReq --> PayableTotal["加總 amount"]

  Generate --> PreReceived["預收款項 2150"]
  PreReceived --> PRTx["查詢科目 2150 交易"]
  PRTx --> PRPositive{"計算結果大於 0?"}
  PRPositive -->|是| PRTotal["使用計算結果"]
  PRPositive -->|否| PRZero["預收款項設為 0"]
  PRZero --> Liabilities

  Generate --> Fund["基金暨餘絀"]
  Fund --> Accumulated["累計餘絀 3210: 查詢 opening 類交易"]
  Fund --> Current["本期餘絀 3440: 年初至 asOf 收入 4 減支出 5"]

  CashTotal --> Assets["資產總額"]
  ARTotal --> Assets
  PrepaidTotal --> Assets

  PayableTotal --> Liabilities["負債總額"]
  PRTotal --> Liabilities
  Accumulated --> FundTotal["基金暨餘絀總額"]
  Current --> FundTotal

  Assets --> Check["檢查 資產 = 負債 + 基金暨餘絀"]
  Liabilities --> Check
  FundTotal --> Check

  Check --> Balanced{"是否平衡?"}
  Balanced -->|是| Workbook["ExcelJS 建立資產負債表"]
  Balanced -->|否| Warning["加入期初帳資料警示"]
  Warning --> Workbook
  Workbook --> Audit["寫入 DATA_EXPORTED AuditLog"]
  Audit --> Download["回傳 xlsx 下載"]
```

## 12. 管理功能與權限

```mermaid
flowchart TD
  Start([管理功能入口]) --> Module{"管理哪個模組?"}

  Module -->|使用者| UserRole{"ADMIN / PRESIDENT / FOUNDER_AGENT?"}
  UserRole -->|否| UserDenied["導回 dashboard 或回傳無權限"]
  UserRole -->|是| TargetRole{"是否可管理目標角色?"}
  TargetRole -->|否| TargetDenied["回傳無法管理或指定此角色"]
  TargetRole -->|是| UserAction{"建立、編輯、停用、重設密碼?"}
  UserAction --> UserAudit["寫入 USER_* 或 PASSWORD_RESET AuditLog"]

  Module -->|專案| ProjectRole{"ADMIN / PRESIDENT / FOUNDER_AGENT?"}
  ProjectRole -->|否| ProjectDenied["回傳無權限"]
  ProjectRole -->|是| ProjectAction{"建立、改名、變更狀態、刪除?"}
  ProjectAction --> DeleteProject{"若刪除，專案已有請款單?"}
  DeleteProject -->|是| CannotDelete["回傳不可刪除，只能結案"]
  DeleteProject -->|否| ProjectAudit["寫入 PROJECT_* AuditLog"]
  CannotDelete --> EndProject([結束])

  Module -->|付款對象| RecipientRole{"ADMIN / PRESIDENT / FOUNDER_AGENT / FINANCE?"}
  RecipientRole -->|否| RecipientDenied["回傳無管理權限"]
  RecipientRole -->|是| RecipientAction["建立、更新、啟用或停用 PaymentRecipient"]

  Module -->|會計科目| SubjectRole{"ADMIN / PRESIDENT / FOUNDER_AGENT / FINANCE?"}
  SubjectRole -->|否| SubjectDenied["回傳無管理會計科目權限"]
  SubjectRole -->|是| CodeUnique{"新增或改代號時是否唯一?"}
  CodeUnique -->|否| CodeError["回傳代號已存在"]
  CodeUnique -->|是| SubjectAction["建立、更新、停用 AccountingSubject"]
  SubjectAction --> SubjectAudit["寫入 ACCOUNTING_SUBJECT_* AuditLog"]

  UserAudit --> Revalidate["revalidate 對應管理頁"]
  ProjectAudit --> Revalidate
  RecipientAction --> Revalidate
  SubjectAudit --> Revalidate
```

## 13. 核心資料模型關係

```mermaid
flowchart LR
  User["User 使用者"]
  Request["Request 請款單"]
  Item["RequestItem 品項"]
  Attachment["Attachment 附件"]
  Step["ApprovalStep 簽核步驟"]
  Record["ApprovalRecord 簽核紀錄"]
  Project["Project 專案"]
  Subject["AccountingSubject 會計科目"]
  Adjustment["PaymentAdjustment 付款調整"]
  Recipient["PaymentRecipient 付款對象"]
  Account["FinancialAccount 資金帳戶"]
  Transaction["AccountTransaction 帳戶交易"]
  Notification["Notification 通知"]
  Push["PushSubscription 推播訂閱"]
  Audit["AuditLog 稽核紀錄"]

  User -->|submitterId| Request
  Request -->|has many| Item
  Request -->|has many| Attachment
  Request -->|has many| Step
  Step -->|has many| Record
  User -->|approverId| Record

  Project -->|groups| Request
  Project -->|tags| Transaction
  Subject -->|requested or final subject| Request
  Subject -->|categorizes| Adjustment
  Subject -->|categorizes| Transaction

  Request -->|has many| Adjustment
  Request -->|links optional| Transaction
  Account -->|contains| Transaction
  User -->|creates| Adjustment
  User -->|creates| Transaction

  User -->|receives| Notification
  User -->|owns| Push
  Recipient -->|master data copied into payment fields| Request
  Audit -->|records operations by user and entity| User
```

## 主要依據

- `prisma/schema.prisma`
- `src/lib/auth.ts`
- `src/proxy.ts`
- `src/lib/actions/request.ts`
- `src/lib/actions/financialAccount.ts`
- `src/lib/actions/paymentAdjustment.ts`
- `src/lib/actions/project.ts`
- `src/lib/actions/user.ts`
- `src/lib/actions/paymentRecipient.ts`
- `src/lib/notifications.ts`
- `src/lib/audit.ts`
- `src/lib/reports.ts`
- `src/app/api/upload/route.ts`
- `src/app/api/files/[id]/route.ts`
- `src/app/api/accounting-subjects/*`
- `src/app/api/export/*`
- `src/app/(dashboard)/*`
