# API contract

Base path /api. JSON requests, exact monetary amounts as strings. Mutations require an exact allowed Origin. Protected endpoints require Authorization: Bearer <short-lived JWT>. Refresh cookie is HttpOnly and only sent to /api/auth. Errors: {error: string}. Standard status codes 400,401,403,404,409,429,503.

| Method       | Path                    | Purpose                                                                                  |
| ------------ | ----------------------- | ---------------------------------------------------------------------------------------- |
| POST         | /auth/register          | fullName,email,password; starts session                                                  |
| POST         | /auth/login             | email,password; starts session                                                           |
| POST         | /auth/refresh           | rotates refresh cookie, returns accessToken                                              |
| POST         | /auth/logout            | revokes refresh session                                                                  |
| GET/PATCH    | /me                     | profile; update fullName/phone                                                           |
| GET/POST     | /accounts               | list owned accounts; create SAVINGS/CURRENT                                              |
| GET          | /accounts/:id           | owned account and latest 100 ledger entries                                              |
| GET          | /accounts/:id/statement | complete CSV, exact paise                                                                |
| POST         | /transfers              | senderId,recipient account number,amount in rupees,description; Idempotency-Key required |
| GET          | /transactions           | search,from,to,page,sort,status; 20 per page                                             |
| GET          | /transactions/:id       | authorized transaction detail                                                            |
| GET          | /analytics              | monthly incoming/outgoing in paise                                                       |
| GET/POST     | /beneficiaries          | list/add nickname and accountNumber                                                      |
| PATCH/DELETE | /beneficiaries/:id      | edit nickname/remove                                                                     |
| GET          | /admin/overview         | aggregate statistics                                                                     |
| GET/PATCH    | /admin/users[/:id]      | list users / set ACTIVE or SUSPENDED                                                     |
| GET/PATCH    | /admin/accounts[/:id]   | list accounts / set ACTIVE or FROZEN                                                     |
| POST         | /admin/adjustments      | accountId,amount,reason; Idempotency-Key required                                        |
| GET          | /admin/transactions     | all completed transactions, same filters                                                 |
| GET          | /admin/failures         | paginated failed attempts; search,from,to,page                                           |
| GET          | /admin/audit            | latest 100 audit records                                                                 |
| GET          | /admin/database         | MySQL version, isolation, reconciliation anomalies                                       |
| GET          | /admin/lab              | available experiments and enable state                                                   |
| POST         | /admin/lab/:experiment  | execute isolated experiment if enabled                                                   |
| GET          | /health/live            | process health (outside /api)                                                            |
| GET          | /health/ready           | database connectivity (outside /api)                                                     |

Posted transactions are always COMPLETED; rejected operations live in failed_attempts and never masquerade as posted ledger movements. Admin user/account lists currently cap at 200; audit lists cap at 100; failed attempts paginate at 20.
